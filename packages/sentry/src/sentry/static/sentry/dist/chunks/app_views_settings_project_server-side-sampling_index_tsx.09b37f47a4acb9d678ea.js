(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_project_server-side-sampling_index_tsx"],{

/***/ "./app/actionCreators/serverSideSampling.tsx":
/*!***************************************************!*\
  !*** ./app/actionCreators/serverSideSampling.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "fetchSamplingDistribution": () => (/* binding */ fetchSamplingDistribution),
/* harmony export */   "fetchSamplingSdkVersions": () => (/* binding */ fetchSamplingSdkVersions)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_promise_finally_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.promise.finally.js */ "../node_modules/core-js/modules/es.promise.finally.js");
/* harmony import */ var core_js_modules_es_promise_finally_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_promise_finally_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_serverSideSamplingStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/serverSideSamplingStore */ "./app/stores/serverSideSamplingStore.tsx");
/* harmony import */ var sentry_utils_handleXhrErrorResponse__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/handleXhrErrorResponse */ "./app/utils/handleXhrErrorResponse.tsx");





function fetchSamplingSdkVersions(_ref) {
  var _project_breakdown$ma;

  let {
    api,
    orgSlug,
    projectID
  } = _ref;
  const {
    samplingDistribution
  } = sentry_stores_serverSideSamplingStore__WEBPACK_IMPORTED_MODULE_3__.ServerSideSamplingStore.getState();
  const {
    startTimestamp,
    endTimestamp,
    project_breakdown
  } = samplingDistribution;

  if (!startTimestamp || !endTimestamp) {
    sentry_stores_serverSideSamplingStore__WEBPACK_IMPORTED_MODULE_3__.ServerSideSamplingStore.setFetching(false);
    sentry_stores_serverSideSamplingStore__WEBPACK_IMPORTED_MODULE_3__.ServerSideSamplingStore.loadSamplingSdkVersionsSuccess([]);
    return new Promise(resolve => {
      resolve([]);
    });
  }

  const projectIds = [projectID, ...((_project_breakdown$ma = project_breakdown === null || project_breakdown === void 0 ? void 0 : project_breakdown.map(projectBreakdown => projectBreakdown.project_id)) !== null && _project_breakdown$ma !== void 0 ? _project_breakdown$ma : [])];
  const promise = api.requestPromise(`/organizations/${orgSlug}/dynamic-sampling/sdk-versions/`, {
    query: {
      project: projectIds,
      start: startTimestamp,
      end: endTimestamp
    }
  });
  sentry_stores_serverSideSamplingStore__WEBPACK_IMPORTED_MODULE_3__.ServerSideSamplingStore.setFetching(true);
  promise.then(sentry_stores_serverSideSamplingStore__WEBPACK_IMPORTED_MODULE_3__.ServerSideSamplingStore.loadSamplingSdkVersionsSuccess).catch(response => {
    const errorMessage = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Unable to fetch sampling sdk versions');
    (0,sentry_utils_handleXhrErrorResponse__WEBPACK_IMPORTED_MODULE_4__["default"])(errorMessage)(response);
  }).finally(() => {
    sentry_stores_serverSideSamplingStore__WEBPACK_IMPORTED_MODULE_3__.ServerSideSamplingStore.setFetching(false);
  });
  return promise;
}
function fetchSamplingDistribution(_ref2) {
  let {
    api,
    orgSlug,
    projSlug
  } = _ref2;
  sentry_stores_serverSideSamplingStore__WEBPACK_IMPORTED_MODULE_3__.ServerSideSamplingStore.reset();
  sentry_stores_serverSideSamplingStore__WEBPACK_IMPORTED_MODULE_3__.ServerSideSamplingStore.setFetching(true);
  const promise = api.requestPromise(`/projects/${orgSlug}/${projSlug}/dynamic-sampling/distribution/`);
  promise.then(sentry_stores_serverSideSamplingStore__WEBPACK_IMPORTED_MODULE_3__.ServerSideSamplingStore.loadSamplingDistributionSuccess).catch(response => {
    const errorMessage = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Unable to fetch sampling distribution');
    (0,sentry_utils_handleXhrErrorResponse__WEBPACK_IMPORTED_MODULE_4__["default"])(errorMessage)(response);
  }).finally(() => {
    sentry_stores_serverSideSamplingStore__WEBPACK_IMPORTED_MODULE_3__.ServerSideSamplingStore.setFetching(false);
  });
  return promise;
}

/***/ }),

/***/ "./app/components/actions/menuItemActionLink.tsx":
/*!*******************************************************!*\
  !*** ./app/components/actions/menuItemActionLink.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_actions_actionLink__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/actions/actionLink */ "./app/components/actions/actionLink.tsx");
/* harmony import */ var sentry_components_menuItem__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/menuItem */ "./app/components/menuItem.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function MenuItemActionLink(_ref) {
  let {
    className,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_menuItem__WEBPACK_IMPORTED_MODULE_2__["default"], {
    noAnchor: true,
    withBorder: true,
    disabled: props.disabled,
    className: className,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(InnerActionLink, { ...props
    })
  });
}

MenuItemActionLink.displayName = "MenuItemActionLink";

const InnerActionLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_actions_actionLink__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "e18s0uh10"
} : 0)("color:", p => p.theme.textColor, ";", p => p.theme.overflowEllipsis, " &:hover{color:", p => p.theme.textColor, ";}.dropdown-menu>li>&,.dropdown-menu>span>li>&{&.disabled:hover{background:", p => p.theme.background, ";}}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MenuItemActionLink);

/***/ }),

/***/ "./app/components/onboardingPanel.tsx":
/*!********************************************!*\
  !*** ./app/components/onboardingPanel.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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

/***/ "./app/stores/serverSideSamplingStore.tsx":
/*!************************************************!*\
  !*** ./app/stores/serverSideSamplingStore.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ServerSideSamplingStore": () => (/* binding */ ServerSideSamplingStore)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/makeSafeRefluxStore */ "./app/utils/makeSafeRefluxStore.ts");


const storeConfig = {
  state: {
    samplingDistribution: {},
    samplingSdkVersions: [],
    fetching: false
  },

  reset() {
    this.state = {
      samplingDistribution: {},
      samplingSdkVersions: []
    };
    this.trigger(this.state);
  },

  getState() {
    return this.state;
  },

  setFetching(fetching) {
    this.state.fetching = fetching;
    this.trigger(this.state);
  },

  loadSamplingSdkVersionsSuccess(data) {
    this.state = { ...this.state,
      samplingSdkVersions: data
    };
    this.trigger(this.state);
  },

  loadSamplingDistributionSuccess(data) {
    this.state = { ...this.state,
      samplingDistribution: data
    };
    this.trigger(this.state);
  }

};
const ServerSideSamplingStore = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createStore)((0,sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_1__.makeSafeRefluxStore)(storeConfig));

/***/ }),

/***/ "./app/types/sampling.tsx":
/*!********************************!*\
  !*** ./app/types/sampling.tsx ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SamplingConditionOperator": () => (/* binding */ SamplingConditionOperator),
/* harmony export */   "SamplingInnerName": () => (/* binding */ SamplingInnerName),
/* harmony export */   "SamplingInnerOperator": () => (/* binding */ SamplingInnerOperator),
/* harmony export */   "SamplingRuleOperator": () => (/* binding */ SamplingRuleOperator),
/* harmony export */   "SamplingRuleType": () => (/* binding */ SamplingRuleType)
/* harmony export */ });
let SamplingRuleType;

(function (SamplingRuleType) {
  SamplingRuleType["TRACE"] = "trace";
})(SamplingRuleType || (SamplingRuleType = {}));

let SamplingConditionOperator;

(function (SamplingConditionOperator) {
  SamplingConditionOperator["AND"] = "and";
})(SamplingConditionOperator || (SamplingConditionOperator = {}));

let SamplingRuleOperator;

(function (SamplingRuleOperator) {
  SamplingRuleOperator["IF"] = "if";
  SamplingRuleOperator["ELSE_IF"] = "else_if";
  SamplingRuleOperator["ELSE"] = "else";
})(SamplingRuleOperator || (SamplingRuleOperator = {}));

let SamplingInnerOperator;
/**
 * String of the sampling category that's used on the backend.
 * Default naming strategy should be based on the path in the event, prefixed with `event.`.
 * To see the path in the event, click on the JSON button on the issue details page.
 */

(function (SamplingInnerOperator) {
  SamplingInnerOperator["GLOB_MATCH"] = "glob";
  SamplingInnerOperator["EQUAL"] = "eq";
})(SamplingInnerOperator || (SamplingInnerOperator = {}));

let SamplingInnerName;

(function (SamplingInnerName) {
  SamplingInnerName["TRACE_RELEASE"] = "trace.release";
  SamplingInnerName["TRACE_ENVIRONMENT"] = "trace.environment";
})(SamplingInnerName || (SamplingInnerName = {}));

/***/ }),

/***/ "./app/utils/findClosestNumber.tsx":
/*!*****************************************!*\
  !*** ./app/utils/findClosestNumber.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "findClosestNumber": () => (/* binding */ findClosestNumber)
/* harmony export */ });
// Finds the closest match to the number from the provided numbers array
function findClosestNumber(number, numbersArray) {
  return numbersArray.reduce((previousBest, currentNumber) => {
    return Math.abs(currentNumber - number) < Math.abs(previousBest - number) ? currentNumber : previousBest;
  });
}

/***/ }),

/***/ "./app/views/organizationStats/types.tsx":
/*!***********************************************!*\
  !*** ./app/views/organizationStats/types.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Outcome": () => (/* binding */ Outcome)
/* harmony export */ });
let Outcome;
/**
 * Raw response from API endpoint
 */

(function (Outcome) {
  Outcome["ACCEPTED"] = "accepted";
  Outcome["FILTERED"] = "filtered";
  Outcome["INVALID"] = "invalid";
  Outcome["DROPPED"] = "dropped";
  Outcome["RATE_LIMITED"] = "rate_limited";
  Outcome["CLIENT_DISCARD"] = "client_discard";
})(Outcome || (Outcome = {}));

/***/ }),

/***/ "./app/views/performance/vitalDetail/colorBar.tsx":
/*!********************************************************!*\
  !*** ./app/views/performance/vitalDetail/colorBar.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




const ColorBar = props => {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(VitalBar, {
    barHeight: props.barHeight,
    fractions: props.colorStops.map(_ref => {
      let {
        percent
      } = _ref;
      return percent;
    }),
    children: props.colorStops.map(colorStop => {
      var _colorStop$renderBarS, _colorStop$renderBarS2;

      const barStatus = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(BarStatus, {
        color: colorStop.color
      }, colorStop.color);

      return (_colorStop$renderBarS = (_colorStop$renderBarS2 = colorStop.renderBarStatus) === null || _colorStop$renderBarS2 === void 0 ? void 0 : _colorStop$renderBarS2.call(colorStop, barStatus, colorStop.color)) !== null && _colorStop$renderBarS !== void 0 ? _colorStop$renderBarS : barStatus;
    })
  });
};

ColorBar.displayName = "ColorBar";

const VitalBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "etd41501"
} : 0)("height:", p => p.barHeight ? `${p.barHeight}px` : '16px', ";width:100%;overflow:hidden;position:relative;background:", p => p.theme.gray100, ";display:grid;grid-template-columns:", p => p.fractions.map(f => `${f}fr`).join(' '), ";margin-bottom:", p => p.barHeight ? '' : (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1), ";border-radius:2px;" + ( true ? "" : 0));

const BarStatus = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "etd41500"
} : 0)("background-color:", p => {
  var _p$theme$p$color;

  return (_p$theme$p$color = p.theme[p.color]) !== null && _p$theme$p$color !== void 0 ? _p$theme$p$color : p.color;
}, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ColorBar);

/***/ }),

/***/ "./app/views/settings/organization/permissionAlert.tsx":
/*!*************************************************************!*\
  !*** ./app/views/settings/organization/permissionAlert.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





const PermissionAlert = _ref => {
  let {
    access = ['org:write'],
    message = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('These settings can only be edited by users with the organization owner or manager role.'),
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_0__["default"], {
    access: access,
    children: _ref2 => {
      let {
        hasAccess
      } = _ref2;
      return !hasAccess && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__["default"], {
        type: "warning",
        showIcon: true,
        ...props,
        children: message
      });
    }
  });
};

PermissionAlert.displayName = "PermissionAlert";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PermissionAlert);

/***/ }),

/***/ "./app/views/settings/project/server-side-sampling/draggableRuleList.tsx":
/*!*******************************************************************************!*\
  !*** ./app/views/settings/project/server-side-sampling/draggableRuleList.tsx ***!
  \*******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DraggableRuleList": () => (/* binding */ DraggableRuleList)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_dom__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-dom */ "../node_modules/react-dom/profiling.js");
/* harmony import */ var _dnd_kit_core__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @dnd-kit/core */ "../node_modules/@dnd-kit/core/dist/core.esm.js");
/* harmony import */ var _dnd_kit_sortable__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @dnd-kit/sortable */ "../node_modules/@dnd-kit/sortable/dist/sortable.esm.js");
/* harmony import */ var _draggableRuleListItem__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./draggableRuleListItem */ "./app/views/settings/project/server-side-sampling/draggableRuleListItem.tsx");
/* harmony import */ var _draggableRuleListSortableItem__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./draggableRuleListSortableItem */ "./app/views/settings/project/server-side-sampling/draggableRuleListSortableItem.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./utils */ "./app/views/settings/project/server-side-sampling/utils/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










function DraggableRuleList(_ref) {
  let {
    items,
    onUpdateItems,
    renderItem,
    disabled = false,
    wrapperStyle = () => ({})
  } = _ref;
  const [state, setState] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)({});
  const itemIds = items.map(item => item.id);
  const getIndex = itemIds.indexOf.bind(itemIds);
  const activeIndex = state.activeId ? getIndex(state.activeId) : -1;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(_dnd_kit_core__WEBPACK_IMPORTED_MODULE_3__.DndContext, {
    onDragStart: _ref2 => {
      let {
        active
      } = _ref2;

      if (!active) {
        return;
      }

      setState({
        activeId: active.id
      });
    },
    onDragEnd: _ref3 => {
      let {
        over
      } = _ref3;
      setState({
        activeId: undefined
      });

      if (over) {
        const overIndex = getIndex(over.id);

        if (activeIndex !== overIndex) {
          onUpdateItems({
            activeIndex,
            overIndex,
            reorderedItems: (0,_dnd_kit_sortable__WEBPACK_IMPORTED_MODULE_4__.arrayMove)(itemIds, activeIndex, overIndex)
          });
        }
      }
    },
    onDragCancel: () => setState({
      activeId: undefined
    }),
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_dnd_kit_sortable__WEBPACK_IMPORTED_MODULE_4__.SortableContext, {
      items: itemIds,
      strategy: _dnd_kit_sortable__WEBPACK_IMPORTED_MODULE_4__.verticalListSortingStrategy,
      children: itemIds.map((itemId, index) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_draggableRuleListSortableItem__WEBPACK_IMPORTED_MODULE_6__.DraggableRuleListSortableItem, {
        id: itemId,
        index: index,
        renderItem: renderItem,
        disabled: disabled || (0,_utils__WEBPACK_IMPORTED_MODULE_7__.isUniformRule)({ ...items[index],
          id: Number(items[index].id)
        }),
        wrapperStyle: wrapperStyle
      }, itemId))
    }), /*#__PURE__*/(0,react_dom__WEBPACK_IMPORTED_MODULE_2__.createPortal)((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_dnd_kit_core__WEBPACK_IMPORTED_MODULE_3__.DragOverlay, {
      children: state.activeId ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_draggableRuleListItem__WEBPACK_IMPORTED_MODULE_5__.DraggableRuleListItem, {
        value: itemIds[activeIndex],
        renderItem: renderItem,
        wrapperStyle: wrapperStyle({
          index: activeIndex,
          isDragging: true,
          isSorting: false
        })
      }) : null
    }), document.body)]
  });
}
DraggableRuleList.displayName = "DraggableRuleList";

/***/ }),

/***/ "./app/views/settings/project/server-side-sampling/draggableRuleListItem.tsx":
/*!***********************************************************************************!*\
  !*** ./app/views/settings/project/server-side-sampling/draggableRuleListItem.tsx ***!
  \***********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DraggableRuleListItem": () => (/* binding */ DraggableRuleListItem)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function DraggableRuleListItem(_ref) {
  let {
    value,
    dragging,
    index,
    transform,
    listeners,
    sorting,
    transition,
    forwardRef,
    attributes,
    renderItem,
    wrapperStyle
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)(Wrapper, {
    "data-test-id": "sampling-rule",
    ref: forwardRef,
    style: { ...wrapperStyle,
      transition,
      '--translate-x': transform ? `${Math.round(transform.x)}px` : undefined,
      '--translate-y': transform ? `${Math.round(transform.y)}px` : undefined,
      '--scale-x': transform !== null && transform !== void 0 && transform.scaleX ? `${transform.scaleX}` : undefined,
      '--scale-y': transform !== null && transform !== void 0 && transform.scaleY ? `${transform.scaleY}` : undefined
    },
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)(InnerWrapper, {
      children: renderItem({
        dragging: Boolean(dragging),
        sorting: Boolean(sorting),
        listeners,
        transform,
        transition,
        value,
        index,
        attributes
      })
    })
  });
}
DraggableRuleListItem.displayName = "DraggableRuleListItem";
const boxShadowBorder = '0 0 0 calc(1px / var(--scale-x, 1)) rgba(63, 63, 68, 0.05)';
const boxShadowCommon = '0 1px calc(3px / var(--scale-x, 1)) 0 rgba(34, 33, 81, 0.15)';
const boxShadow = `${boxShadowBorder}, ${boxShadowCommon}`;

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e6owowo1"
} : 0)("transform:translate3d(var(--translate-x, 0), var(--translate-y, 0), 0) scaleX(var(--scale-x, 1)) scaleY(var(--scale-y, 1));transform-origin:0 0;touch-action:manipulation;--box-shadow:", boxShadow, ";--box-shadow-picked-up:", boxShadowBorder, ",-1px 0 15px 0 rgba(34, 33, 81, 0.01),0px 15px 15px 0 rgba(34, 33, 81, 0.25);" + ( true ? "" : 0));

const InnerWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e6owowo0"
} : 0)("background-color:", p => p.theme.background, ";animation:pop 200ms cubic-bezier(0.18, 0.67, 0.6, 1.22);box-shadow:var(--box-shadow-picked-up);opacity:1;:focus{box-shadow:0 0px 4px 1px rgba(76, 159, 254, 1),", boxShadow, ";}@keyframes pop{0%{transform:scale(1);box-shadow:var(--box-shadow);}100%{box-shadow:var(--box-shadow-picked-up);}}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/project/server-side-sampling/draggableRuleListSortableItem.tsx":
/*!*******************************************************************************************!*\
  !*** ./app/views/settings/project/server-side-sampling/draggableRuleListSortableItem.tsx ***!
  \*******************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DraggableRuleListSortableItem": () => (/* binding */ DraggableRuleListSortableItem)
/* harmony export */ });
/* harmony import */ var _dnd_kit_sortable__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @dnd-kit/sortable */ "../node_modules/@dnd-kit/sortable/dist/sortable.esm.js");
/* harmony import */ var _draggableRuleListItem__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./draggableRuleListItem */ "./app/views/settings/project/server-side-sampling/draggableRuleListItem.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function DraggableRuleListSortableItem(_ref) {
  let {
    id,
    index,
    renderItem,
    disabled,
    wrapperStyle
  } = _ref;
  const {
    attributes,
    isSorting,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition
  } = (0,_dnd_kit_sortable__WEBPACK_IMPORTED_MODULE_0__.useSortable)({
    id,
    disabled
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(_draggableRuleListItem__WEBPACK_IMPORTED_MODULE_1__.DraggableRuleListItem, {
    forwardRef: setNodeRef,
    value: id,
    sorting: isSorting,
    renderItem: renderItem,
    index: index,
    transform: transform,
    transition: transition,
    listeners: listeners,
    attributes: attributes,
    wrapperStyle: wrapperStyle({
      index,
      isDragging,
      isSorting
    })
  });
}
DraggableRuleListSortableItem.displayName = "DraggableRuleListSortableItem";

/***/ }),

/***/ "./app/views/settings/project/server-side-sampling/index.tsx":
/*!*******************************************************************!*\
  !*** ./app/views/settings/project/server-side-sampling/index.tsx ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ ServerSideSamplingContainer)
/* harmony export */ });
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/acl/featureDisabled */ "./app/components/acl/featureDisabled.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var _serverSideSampling__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./serverSideSampling */ "./app/views/settings/project/server-side-sampling/serverSideSampling.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







function ServerSideSamplingContainer(_ref) {
  let {
    project
  } = _ref;
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_4__["default"])();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_0__["default"], {
    features: ['server-side-sampling', 'server-side-sampling-ui'],
    organization: organization,
    renderDisabled: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_1__["default"], {
      alert: sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.PanelAlert,
      features: ['organization:server-side-sampling', 'organization:server-side-sampling-ui'],
      featureName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Server-Side Sampling')
    }),
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(_serverSideSampling__WEBPACK_IMPORTED_MODULE_5__.ServerSideSampling, {
      project: project
    })
  });
}
ServerSideSamplingContainer.displayName = "ServerSideSamplingContainer";

/***/ }),

/***/ "./app/views/settings/project/server-side-sampling/modals/recommendedStepsModal.tsx":
/*!******************************************************************************************!*\
  !*** ./app/views/settings/project/server-side-sampling/modals/recommendedStepsModal.tsx ***!
  \******************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "RecommendedStepsModal": () => (/* binding */ RecommendedStepsModal)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var prism_sentry_index_css__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! prism-sentry/index.css */ "../node_modules/prism-sentry/index.css");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_list__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/list */ "./app/components/list/index.tsx");
/* harmony import */ var sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/list/listItem */ "./app/components/list/listItem.tsx");
/* harmony import */ var sentry_components_sidebar_broadcastSdkUpdates__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/sidebar/broadcastSdkUpdates */ "./app/components/sidebar/broadcastSdkUpdates.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var _samplingProjectIncompatibleAlert__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ../samplingProjectIncompatibleAlert */ "./app/views/settings/project/server-side-sampling/samplingProjectIncompatibleAlert.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ../utils */ "./app/views/settings/project/server-side-sampling/utils/index.tsx");
/* harmony import */ var _utils_projectStatsToSampleRates__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ../utils/projectStatsToSampleRates */ "./app/views/settings/project/server-side-sampling/utils/projectStatsToSampleRates.tsx");
/* harmony import */ var _utils_useProjectStats__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ../utils/useProjectStats */ "./app/views/settings/project/server-side-sampling/utils/useProjectStats.tsx");
/* harmony import */ var _utils_useRecommendedSdkUpgrades__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ../utils/useRecommendedSdkUpgrades */ "./app/views/settings/project/server-side-sampling/utils/useRecommendedSdkUpgrades.tsx");
/* harmony import */ var _uniformRateModal__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ./uniformRateModal */ "./app/views/settings/project/server-side-sampling/modals/uniformRateModal.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






















function RecommendedStepsModal(_ref) {
  let {
    Header,
    Body,
    Footer,
    closeModal,
    organization,
    recommendedSdkUpgrades,
    onGoBack,
    onReadDocs,
    onSubmit,
    clientSampleRate,
    serverSampleRate,
    uniformRule,
    projectId,
    recommendedSampleRate,
    onSetRules
  } = _ref;
  const {
    isProjectIncompatible
  } = (0,_utils_useRecommendedSdkUpgrades__WEBPACK_IMPORTED_MODULE_18__.useRecommendedSdkUpgrades)({
    orgSlug: organization.slug,
    projectId
  });
  const [saving, setSaving] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(false);
  const {
    projectStats
  } = (0,_utils_useProjectStats__WEBPACK_IMPORTED_MODULE_17__["default"])({
    orgSlug: organization.slug,
    projectId,
    interval: '1h',
    statsPeriod: '48h',
    disable: !!clientSampleRate,
    groupBy: 'outcome'
  });
  const {
    maxSafeSampleRate
  } = (0,_utils_projectStatsToSampleRates__WEBPACK_IMPORTED_MODULE_16__.projectStatsToSampleRates)(projectStats);
  const suggestedClientSampleRate = clientSampleRate !== null && clientSampleRate !== void 0 ? clientSampleRate : maxSafeSampleRate;
  const isValid = (0,_utils__WEBPACK_IMPORTED_MODULE_15__.isValidSampleRate)(clientSampleRate) && (0,_utils__WEBPACK_IMPORTED_MODULE_15__.isValidSampleRate)(serverSampleRate);

  function handleDone() {
    if (!onSubmit) {
      closeModal();
    }

    if (!isValid) {
      return;
    }

    setSaving(true);
    onSubmit === null || onSubmit === void 0 ? void 0 : onSubmit({
      recommendedSampleRate: recommendedSampleRate !== null && recommendedSampleRate !== void 0 ? recommendedSampleRate : false,
      // the recommendedSampleRate prop will always be available in the wizard modal
      uniformRateModalOrigin: false,
      sampleRate: serverSampleRate,
      rule: uniformRule,
      onSuccess: newRules => {
        setSaving(false);
        onSetRules === null || onSetRules === void 0 ? void 0 : onSetRules(newRules);
        closeModal();
      },
      onError: () => {
        setSaving(false);
      }
    });
  }

  function handleGoBack() {
    if (!onGoBack) {
      return;
    }

    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_11__["default"])('sampling.settings.modal.recommended.next.steps_back', {
      organization,
      project_id: projectId
    });
    onGoBack();
  }

  function handleReadDocs() {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_11__["default"])('sampling.settings.modal.recommended.next.steps_read_docs', {
      organization,
      project_id: projectId
    });
    onReadDocs();
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(Header, {
      closeButton: true,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("h4", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Next steps')
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(Body, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_list__WEBPACK_IMPORTED_MODULE_6__["default"], {
        symbol: "colored-numeric",
        children: [!!recommendedSdkUpgrades.length && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_7__["default"], {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("h5", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Update the following SDK versions')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_13__["default"], {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('To activate server-side sampling rules, it’s a requirement to update the following project SDK(s):')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(UpgradeSDKfromProjects, {
            children: recommendedSdkUpgrades.map(_ref2 => {
              let {
                project: upgradableProject,
                latestSDKName,
                latestSDKVersion
              } = _ref2;
              return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)("div", {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_sidebar_broadcastSdkUpdates__WEBPACK_IMPORTED_MODULE_8__.SdkProjectBadge, {
                  project: upgradableProject,
                  organization: organization
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_sidebar_broadcastSdkUpdates__WEBPACK_IMPORTED_MODULE_8__.SdkOutdatedVersion, {
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)('This project is on [current-version]', {
                    ['current-version']: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_sidebar_broadcastSdkUpdates__WEBPACK_IMPORTED_MODULE_8__.OutdatedVersion, {
                      children: `${latestSDKName}@v${latestSDKVersion}`
                    })
                  })
                })]
              }, upgradableProject.id);
            })
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_7__["default"], {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("h5", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Increase your client-side transaction sample rate')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_13__["default"], {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Here’s your optimal client(SDK) sample rate based on your organization’s usage and quota. To make this change, find the tracesSampleRate option in your SDK Config, modify it’s value to what’s suggested below and re-deploy.')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("div", {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("pre", {
              className: "language-javascript highlight",
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)("code", {
                className: "language-javascript",
                children: ["Sentry", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("span", {
                  className: "token punctuation",
                  children: "."
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("span", {
                  className: "token function",
                  children: "init"
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("span", {
                  className: "token punctuation",
                  children: "("
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("span", {
                  className: "token punctuation",
                  children: '{'
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)("span", {
                  className: "token comment",
                  children: [' // ', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('JavaScript Example')]
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("br", {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("span", {
                  className: "token punctuation",
                  children: '  ...'
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("br", {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("span", {
                  className: "token literal-property property",
                  children: '  traceSampleRate'
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("span", {
                  className: "token operator",
                  children: ":"
                }), ' ', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("span", {
                  className: "token string",
                  children: suggestedClientSampleRate || ''
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("span", {
                  className: "token punctuation",
                  children: ","
                }), ' ', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)("span", {
                  className: "token comment",
                  children: ["//", ' ', suggestedClientSampleRate ? (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_12__.formatPercentage)(suggestedClientSampleRate) : '']
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("br", {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("span", {
                  className: "token punctuation",
                  children: '}'
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("span", {
                  className: "token punctuation",
                  children: ")"
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("span", {
                  className: "token punctuation",
                  children: ";"
                })]
              })
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(_samplingProjectIncompatibleAlert__WEBPACK_IMPORTED_MODULE_14__.SamplingProjectIncompatibleAlert, {
            organization: organization,
            projectId: projectId,
            isProjectIncompatible: isProjectIncompatible
          })]
        })]
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(Footer, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(_uniformRateModal__WEBPACK_IMPORTED_MODULE_19__.FooterActions, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
          href: _utils__WEBPACK_IMPORTED_MODULE_15__.SERVER_SIDE_SAMPLING_DOC_LINK,
          onClick: handleReadDocs,
          external: true,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Read Docs')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_5__["default"], {
          gap: 1,
          children: [onGoBack && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(_uniformRateModal__WEBPACK_IMPORTED_MODULE_19__.Stepper, {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Step 2 of 2')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
              onClick: handleGoBack,
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Back')
            })]
          }), !onGoBack && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
            onClick: closeModal,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Cancel')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
            priority: "primary",
            onClick: handleDone,
            disabled: onSubmit ? saving || !isValid || isProjectIncompatible : false // do not disable the button if there's on onSubmit handler (modal was opened from the sdk alert)
            ,
            title: onSubmit ? !isValid ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Sample rate is not valid') : undefined : undefined,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Done')
          })]
        })]
      })
    })]
  });
}
RecommendedStepsModal.displayName = "RecommendedStepsModal";

const UpgradeSDKfromProjects = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_sidebar_broadcastSdkUpdates__WEBPACK_IMPORTED_MODULE_8__.UpdatesList,  true ? {
  target: "ei24py70"
} : 0)("margin-top:0;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(3), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/project/server-side-sampling/modals/specificConditionsModal/conditions.tsx":
/*!*******************************************************************************************************!*\
  !*** ./app/views/settings/project/server-side-sampling/modals/specificConditionsModal/conditions.tsx ***!
  \*******************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Conditions": () => (/* binding */ Conditions)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_forms_field_fieldRequiredBadge__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/forms/field/fieldRequiredBadge */ "./app/components/forms/field/fieldRequiredBadge.tsx");
/* harmony import */ var sentry_components_forms_textareaField__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/forms/textareaField */ "./app/components/forms/textareaField.tsx");
/* harmony import */ var sentry_icons_iconDelete__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/icons/iconDelete */ "./app/icons/iconDelete.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_types_sampling__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/types/sampling */ "./app/types/sampling.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../../utils */ "./app/views/settings/project/server-side-sampling/utils/index.tsx");
/* harmony import */ var _tagValueAutocomplete__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./tagValueAutocomplete */ "./app/views/settings/project/server-side-sampling/modals/specificConditionsModal/tagValueAutocomplete.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./utils */ "./app/views/settings/project/server-side-sampling/modals/specificConditionsModal/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }














function Conditions(_ref) {
  let {
    conditions,
    orgSlug,
    projectId,
    onDelete,
    onChange
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: conditions.map((condition, index) => {
      const {
        category,
        match
      } = condition;
      const isAutoCompleteField = category === sentry_types_sampling__WEBPACK_IMPORTED_MODULE_8__.SamplingInnerName.TRACE_ENVIRONMENT || category === sentry_types_sampling__WEBPACK_IMPORTED_MODULE_8__.SamplingInnerName.TRACE_RELEASE;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(ConditionWrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(LeftCell, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)("span", {
            children: [(0,_utils__WEBPACK_IMPORTED_MODULE_9__.getInnerNameLabel)(category), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_forms_field_fieldRequiredBadge__WEBPACK_IMPORTED_MODULE_3__["default"], {})]
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(CenterCell, {
          children: isAutoCompleteField ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(_tagValueAutocomplete__WEBPACK_IMPORTED_MODULE_10__.TagValueAutocomplete, {
            category: category,
            tagKey: (0,_utils__WEBPACK_IMPORTED_MODULE_11__.getTagKey)(condition),
            orgSlug: orgSlug,
            projectId: projectId,
            value: match,
            onChange: value => onChange(index, 'match', value)
          }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(StyledTextareaField, {
            name: "match",
            value: match,
            onChange: value => onChange(index, 'match', value),
            placeholder: (0,_utils__WEBPACK_IMPORTED_MODULE_11__.getMatchFieldPlaceholder)(category),
            inline: false,
            rows: 1,
            autosize: true,
            hideControlState: true,
            flexibleControlStateSize: true,
            required: true,
            stacked: true
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(RightCell, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
            onClick: () => onDelete(index),
            icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_icons_iconDelete__WEBPACK_IMPORTED_MODULE_5__.IconDelete, {}),
            "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Delete Condition')
          })
        })]
      }, index);
    })
  });
}
Conditions.displayName = "Conditions";

const ConditionWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1y715mu5"
} : 0)("display:grid;grid-template-columns:minmax(0, 1fr) minmax(0, 1fr);align-items:flex-start;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(2), ";:not(:last-child){border-bottom:1px solid ", p => p.theme.gray100, ";}@media (min-width: ", p => p.theme.breakpoints.small, "){grid-template-columns:minmax(0, 0.6fr) minmax(0, 1fr) max-content;}" + ( true ? "" : 0));

const Cell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1y715mu4"
} : 0)( true ? {
  name: "38ghps",
  styles: "min-height:40px;display:inline-flex;align-items:center"
} : 0);

const LeftCell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Cell,  true ? {
  target: "e1y715mu3"
} : 0)("padding-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";line-height:16px;" + ( true ? "" : 0));

const CenterCell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Cell,  true ? {
  target: "e1y715mu2"
} : 0)("padding-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";grid-column:1/-1;grid-row:2/2;", p => !p.children && 'display: none', ";@media (min-width: ", p => p.theme.breakpoints.small, "){grid-column:auto;grid-row:auto;padding-top:0;}" + ( true ? "" : 0));

const RightCell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Cell,  true ? {
  target: "e1y715mu1"
} : 0)("justify-content:flex-end;padding-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";" + ( true ? "" : 0));

const StyledTextareaField = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_forms_textareaField__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "e1y715mu0"
} : 0)( true ? {
  name: "1fz47qv",
  styles: "padding-bottom:0;width:100%"
} : 0);

/***/ }),

/***/ "./app/views/settings/project/server-side-sampling/modals/specificConditionsModal/index.tsx":
/*!**************************************************************************************************!*\
  !*** ./app/views/settings/project/server-side-sampling/modals/specificConditionsModal/index.tsx ***!
  \**************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SpecificConditionsModal": () => (/* binding */ SpecificConditionsModal)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_select__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! react-select */ "../node_modules/react-select/dist/Select-9fdb8cd0.browser.esm.js");
/* harmony import */ var lodash_partition__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/partition */ "../node_modules/lodash/partition.js");
/* harmony import */ var lodash_partition__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_partition__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/forms/compactSelect */ "./app/components/forms/compactSelect.tsx");
/* harmony import */ var sentry_components_forms_field_fieldRequiredBadge__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/forms/field/fieldRequiredBadge */ "./app/components/forms/field/fieldRequiredBadge.tsx");
/* harmony import */ var sentry_components_forms_numberField__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/forms/numberField */ "./app/components/forms/numberField.tsx");
/* harmony import */ var sentry_components_forms_selectOption__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/forms/selectOption */ "./app/components/forms/selectOption.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_icons_iconSearch__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/icons/iconSearch */ "./app/icons/iconSearch.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/stores/projectsStore */ "./app/stores/projectsStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_types_sampling__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/types/sampling */ "./app/types/sampling.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! ../../utils */ "./app/views/settings/project/server-side-sampling/utils/index.tsx");
/* harmony import */ var _conditions__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! ./conditions */ "./app/views/settings/project/server-side-sampling/modals/specificConditionsModal/conditions.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! ./utils */ "./app/views/settings/project/server-side-sampling/modals/specificConditionsModal/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }




























const conditionAlreadyAddedTooltip = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('This condition has already been added');
function SpecificConditionsModal(_ref) {
  let {
    Header,
    Body,
    Footer,
    closeModal,
    project,
    rule,
    rules,
    organization
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_21__["default"])();
  const [data, setData] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(getInitialState());
  const [isSaving, setIsSaving] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(false);
  const conditionCategories = (0,_utils__WEBPACK_IMPORTED_MODULE_26__.generateConditionCategoriesOptions)(_utils__WEBPACK_IMPORTED_MODULE_26__.distributedTracesConditions);
  (0,react__WEBPACK_IMPORTED_MODULE_3__.useEffect)(() => {
    setData(d => {
      if (!!d.errors.sampleRate) {
        return { ...d,
          errors: { ...d.errors,
            sampleRate: undefined
          }
        };
      }

      return d;
    });
  }, [data.samplePercentage]);

  function getInitialState() {
    if (rule) {
      var _rateToPercentage;

      const {
        condition: conditions,
        sampleRate
      } = rule;
      const {
        inner
      } = conditions;
      return {
        conditions: inner.map(innerItem => {
          const {
            name,
            value
          } = innerItem;

          if (Array.isArray(value)) {
            return {
              category: name,
              match: value.join('\n')
            };
          }

          return {
            category: name
          };
        }),
        samplePercentage: (_rateToPercentage = (0,_utils__WEBPACK_IMPORTED_MODULE_24__.rateToPercentage)(sampleRate)) !== null && _rateToPercentage !== void 0 ? _rateToPercentage : null,
        errors: {}
      };
    }

    return {
      conditions: [],
      samplePercentage: null,
      errors: {}
    };
  }

  const {
    errors,
    conditions,
    samplePercentage
  } = data;

  function convertRequestErrorResponse(error) {
    if (typeof error === 'string') {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)(error);
      return;
    }

    switch (error.type) {
      case 'sampleRate':
        setData({ ...data,
          errors: { ...errors,
            sampleRate: error.message
          }
        });
        break;

      default:
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)(error.message);
    }
  }

  async function handleSubmit() {
    if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_19__.defined)(samplePercentage)) {
      return;
    }

    const sampleRate = (0,_utils__WEBPACK_IMPORTED_MODULE_24__.percentageToRate)(samplePercentage);
    const newRule = {
      // All new/updated rules must have id equal to 0
      id: 0,
      active: rule ? rule.active : false,
      type: sentry_types_sampling__WEBPACK_IMPORTED_MODULE_18__.SamplingRuleType.TRACE,
      condition: {
        op: sentry_types_sampling__WEBPACK_IMPORTED_MODULE_18__.SamplingConditionOperator.AND,
        inner: !conditions.length ? [] : conditions.map(_utils__WEBPACK_IMPORTED_MODULE_26__.getNewCondition)
      },
      sampleRate
    };
    const newRules = rule ? rules.map(existingRule => existingRule.id === rule.id ? newRule : existingRule) : [...rules, newRule]; // Make sure that a uniform rule is always send in the last position of the rules array

    const [uniformRule, specificRules] = lodash_partition__WEBPACK_IMPORTED_MODULE_4___default()(newRules, _utils__WEBPACK_IMPORTED_MODULE_24__.isUniformRule);
    setIsSaving(true);

    try {
      const response = await api.requestPromise(`/projects/${organization.slug}/${project.slug}/`, {
        method: 'PUT',
        data: {
          dynamicSampling: {
            rules: [...specificRules, ...uniformRule]
          }
        }
      });
      sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_16__["default"].onUpdateSuccess(response);
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addSuccessMessage)(rule ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Successfully edited sampling rule') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Successfully added sampling rule'));
      closeModal();
    } catch (error) {
      const currentRuleIndex = newRules.findIndex(newR => newR === newRule);
      convertRequestErrorResponse((0,_utils__WEBPACK_IMPORTED_MODULE_26__.getErrorMessage)(error, currentRuleIndex));
    }

    setIsSaving(false);
    const analyticsConditions = conditions.map(condition => condition.category);
    const analyticsConditionsStringified = analyticsConditions.sort().join(', ');
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_20__["default"])('sampling.settings.rule.specific_save', {
      organization,
      project_id: project.id,
      sampling_rate: sampleRate,
      conditions: analyticsConditions,
      conditions_stringified: analyticsConditionsStringified
    });

    if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_19__.defined)(rule)) {
      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_20__["default"])('sampling.settings.rule.specific_update', {
        organization,
        project_id: project.id,
        sampling_rate: sampleRate,
        conditions: analyticsConditions,
        conditions_stringified: analyticsConditionsStringified,
        old_conditions: rule.condition.inner.map(_ref2 => {
          let {
            name
          } = _ref2;
          return name;
        }),
        old_conditions_stringified: rule.condition.inner.map(_ref3 => {
          let {
            name
          } = _ref3;
          return name;
        }).sort().join(', '),
        old_sampling_rate: rule.sampleRate
      });
      return;
    }

    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_20__["default"])('sampling.settings.rule.specific_create', {
      organization,
      project_id: project.id,
      sampling_rate: sampleRate,
      conditions: analyticsConditions,
      conditions_stringified: analyticsConditionsStringified
    });
  }

  function handleAddCondition(selectedOptions) {
    const previousCategories = conditions.map(_ref4 => {
      let {
        category
      } = _ref4;
      return category;
    });
    const addedCategories = selectedOptions.filter(_ref5 => {
      let {
        value
      } = _ref5;
      return !previousCategories.includes(value);
    }).map(_ref6 => {
      let {
        value
      } = _ref6;
      return value;
    });
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_20__["default"])('sampling.settings.modal.specific.rule.condition_add', {
      organization,
      project_id: project.id,
      conditions: addedCategories
    });
    setData({ ...data,
      conditions: [...conditions, ...addedCategories.map(addedCategory => ({
        category: addedCategory,
        match: ''
      }))]
    });
  }

  function handleDeleteCondition(index) {
    const newConditions = [...conditions];
    newConditions.splice(index, 1);
    setData({ ...data,
      conditions: newConditions
    });
  }

  function handleChangeCondition(index, field, value) {
    const newConditions = [...conditions];
    newConditions[index][field] = value; // If custom tag key changes, reset the value

    if (field === 'category') {
      newConditions[index].match = '';
      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_20__["default"])('sampling.settings.modal.specific.rule.condition_add', {
        organization,
        project_id: project.id,
        conditions: [value]
      });
    }

    setData({ ...data,
      conditions: newConditions
    });
  }

  const predefinedConditionsOptions = conditionCategories.map(_ref7 => {
    let [value, label] = _ref7;
    const optionDisabled = conditions.some(condition => condition.category === value);
    return {
      value,
      label,
      disabled: optionDisabled,
      tooltip: optionDisabled ? conditionAlreadyAddedTooltip : undefined
    };
  });
  const submitDisabled = !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_19__.defined)(samplePercentage) || !conditions.length || conditions.some(condition => !condition.match);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(Header, {
      closeButton: true,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)("h4", {
        children: rule ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Edit Rule') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Add Rule')
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(Body, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(Fields, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(Description, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Sample transactions under specific conditions. Multiple conditions are logically expressed as AND and OR for multiple values.')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(StyledPanel, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(StyledPanelHeader, {
            hasButtons: true,
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)("div", {
              children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Conditions'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_forms_field_fieldRequiredBadge__WEBPACK_IMPORTED_MODULE_9__["default"], {})]
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(StyledCompactSelect, {
              placement: "bottom right",
              triggerProps: {
                size: 'sm',
                'aria-label': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Add Condition')
              },
              triggerLabel: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(TriggerLabel, {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_13__.IconAdd, {
                  isCircled: true
                }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Add Condition')]
              }),
              placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Filter conditions'),
              isDisabled: (0,_utils__WEBPACK_IMPORTED_MODULE_24__.isUniformRule)(rule),
              options: predefinedConditionsOptions,
              value: conditions.map(_ref8 => {
                let {
                  category
                } = _ref8;
                return category;
              }),
              onChange: handleAddCondition,
              isSearchable: true,
              multiple: true,
              filterOption: (candidate, input) => (0,react_select__WEBPACK_IMPORTED_MODULE_28__.c)(null)(candidate, input),
              components: {
                Option: containerProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_forms_selectOption__WEBPACK_IMPORTED_MODULE_11__["default"], { ...containerProps
                })
              }
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelBody, {
            children: !conditions.length ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_22__["default"], {
              icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_icons_iconSearch__WEBPACK_IMPORTED_MODULE_14__.IconSearch, {
                size: "xl"
              }),
              title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('No conditions added'),
              description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Click on the button above to add (+) a condition')
            }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(_conditions__WEBPACK_IMPORTED_MODULE_25__.Conditions, {
              conditions: conditions,
              onDelete: handleDeleteCondition,
              onChange: handleChangeCondition,
              orgSlug: organization.slug,
              projectId: project.id
            })
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_forms_numberField__WEBPACK_IMPORTED_MODULE_10__["default"], {
          label: `${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Sample Rate')} \u0025`,
          name: "sampleRate",
          onChange: value => {
            setData({ ...data,
              samplePercentage: !!value ? Number(value) : null
            });
          },
          onKeyDown: (_value, e) => {
            if (e.key === 'Enter') {
              handleSubmit();
            }
          },
          placeholder: '\u0025',
          step: "10",
          value: samplePercentage,
          inline: false,
          hideControlState: !errors.sampleRate,
          error: errors.sampleRate,
          showHelpInTooltip: true,
          stacked: true,
          required: true
        })]
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(Footer, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_7__["default"], {
        gap: 1,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
          onClick: closeModal,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Cancel')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
          priority: "primary",
          onClick: handleSubmit,
          title: submitDisabled ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Required fields must be filled out') : undefined,
          disabled: isSaving || submitDisabled,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Save Rule')
        })]
      })
    })]
  });
}
SpecificConditionsModal.displayName = "SpecificConditionsModal";

const Fields = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e6uyisd5"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(2), ";" + ( true ? "" : 0));

const StyledCompactSelect = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "e6uyisd4"
} : 0)( true ? {
  name: "1ffbk74",
  styles: "font-weight:400;text-transform:none"
} : 0);

const StyledPanelHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelHeader,  true ? {
  target: "e6uyisd3"
} : 0)("padding-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(2), ";" + ( true ? "" : 0));

const StyledPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.Panel,  true ? {
  target: "e6uyisd2"
} : 0)( true ? {
  name: "1ykowef",
  styles: "margin-bottom:0"
} : 0);

const TriggerLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e6uyisd1"
} : 0)("display:grid;grid-template-columns:repeat(2, max-content);align-items:center;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(1), ";" + ( true ? "" : 0));

const Description = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_23__["default"],  true ? {
  target: "e6uyisd0"
} : 0)( true ? {
  name: "ti75j2",
  styles: "margin:0"
} : 0);

/***/ }),

/***/ "./app/views/settings/project/server-side-sampling/modals/specificConditionsModal/tagValueAutocomplete.tsx":
/*!*****************************************************************************************************************!*\
  !*** ./app/views/settings/project/server-side-sampling/modals/specificConditionsModal/tagValueAutocomplete.tsx ***!
  \*****************************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TagValueAutocomplete": () => (/* binding */ TagValueAutocomplete)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react_select__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! react-select */ "../node_modules/react-select/dist/index-4322c0ed.browser.esm.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_actionCreators_tags__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/tags */ "./app/actionCreators/tags.tsx");
/* harmony import */ var sentry_components_count__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/count */ "./app/components/count.tsx");
/* harmony import */ var sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/selectField */ "./app/components/forms/selectField.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_types_sampling__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/types/sampling */ "./app/types/sampling.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var _truncatedLabel__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./truncatedLabel */ "./app/views/settings/project/server-side-sampling/modals/specificConditionsModal/truncatedLabel.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./utils */ "./app/views/settings/project/server-side-sampling/modals/specificConditionsModal/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }













function TagValueAutocomplete(_ref) {
  let {
    orgSlug,
    projectId,
    category,
    onChange,
    value,
    tagKey
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_8__["default"])();

  function getAriaLabel() {
    switch (category) {
      case sentry_types_sampling__WEBPACK_IMPORTED_MODULE_7__.SamplingInnerName.TRACE_RELEASE:
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Search or add a release');

      case sentry_types_sampling__WEBPACK_IMPORTED_MODULE_7__.SamplingInnerName.TRACE_ENVIRONMENT:
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Search or add an environment');

      default:
        return undefined;
    }
  }

  const debouncedFetchValues = lodash_debounce__WEBPACK_IMPORTED_MODULE_2___default()(async (inputValue, resolve) => {
    if (!tagKey) {
      return resolve([]);
    }

    return resolve(await (0,sentry_actionCreators_tags__WEBPACK_IMPORTED_MODULE_3__.fetchTagValues)(api, orgSlug, tagKey, inputValue, [projectId], null, true, undefined, '-count'));
  }, 250);

  const loadOptions = async inputValue => {
    const response = await new Promise(resolve => {
      debouncedFetchValues(inputValue, resolve);
    }); // react-select doesn't seem to work very well when its value contains
    // a created item that isn't listed in the options

    const createdOptions = value ? value.split('\n').filter(v => !response.some(tagValue => tagValue.value === v)).map(v => ({
      value: v,
      name: v,
      key: tagKey,
      count: 0,
      firstSeen: '',
      lastSeen: ''
    })) : [];
    return [...response, ...createdOptions].map(tagValue => ({
      value: tagValue.value,
      label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_truncatedLabel__WEBPACK_IMPORTED_MODULE_9__.TruncatedLabel, {
        value: tagValue.value
      }),
      trailingItems: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(StyledCount, {
        value: tagValue.count
      })
    }));
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(StyledSelectField, {
    name: "match" // The key is used as a way to force a reload of the options:
    // https://github.com/JedWatson/react-select/issues/1879#issuecomment-316871520
    ,
    "aria-label": getAriaLabel(),
    value: value ? value === null || value === void 0 ? void 0 : value.split('\n').map(v => ({
      value: v,
      label: v
    })) : [],
    onChange: newValue => {
      onChange(newValue === null || newValue === void 0 ? void 0 : newValue.join('\n'));
    },
    components: {
      MultiValue: multiValueProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(react_select__WEBPACK_IMPORTED_MODULE_12__.y.MultiValue, { ...multiValueProps,
        innerProps: { ...multiValueProps.innerProps,
          'data-test-id': 'multivalue'
        }
      })
    },
    formatCreateLabel: _utils__WEBPACK_IMPORTED_MODULE_10__.formatCreateTagLabel,
    isValidNewOption: (inputValue, _selectValue, optionsArray) => {
      // Do not show "Add new" for existing options
      if (optionsArray.some(option => option.value === inputValue)) {
        return false;
      } // Tag values cannot be empty and must have a maximum length of 200 characters
      // https://github.com/getsentry/relay/blob/d8223d8d03ed4764063855eb3480f22684163d92/relay-general/src/store/normalize.rs#L230-L236
      // In addition to that, it cannot contain a line-feed (newline) character
      // https://github.com/getsentry/relay/blob/d8223d8d03ed4764063855eb3480f22684163d92/relay-general/src/protocol/tags.rs#L8


      return !/\\n/.test(inputValue) && inputValue.trim().length > 0 && inputValue.trim().length <= 200;
    },
    filterOption: (option, filterText) => option.data.value.indexOf(filterText) > -1,
    placeholder: (0,_utils__WEBPACK_IMPORTED_MODULE_10__.getMatchFieldPlaceholder)(category),
    inline: false,
    multiple: true,
    hideControlState: true,
    flexibleControlStateSize: true,
    required: true,
    stacked: true,
    creatable: true,
    allowClear: true,
    async: true,
    cacheOptions: true,
    defaultOptions: true,
    loadOptions: loadOptions
  }, tagKey);
}

TagValueAutocomplete.displayName = "TagValueAutocomplete";

const StyledSelectField = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "ej2wvip1"
} : 0)( true ? {
  name: "1d3w5wq",
  styles: "width:100%"
} : 0);

const StyledCount = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_count__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "ej2wvip0"
} : 0)("color:", p => p.theme.subText, ";" + ( true ? "" : 0));



/***/ }),

/***/ "./app/views/settings/project/server-side-sampling/modals/specificConditionsModal/truncatedLabel.tsx":
/*!***********************************************************************************************************!*\
  !*** ./app/views/settings/project/server-side-sampling/modals/specificConditionsModal/truncatedLabel.tsx ***!
  \***********************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TruncatedLabel": () => (/* binding */ TruncatedLabel)
/* harmony export */ });
/* harmony import */ var sentry_components_truncate__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/truncate */ "./app/components/truncate.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var sentry_utils_useMedia__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/useMedia */ "./app/utils/useMedia.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function TruncatedLabel(_ref) {
  let {
    value
  } = _ref;
  const isSmallDevice = (0,sentry_utils_useMedia__WEBPACK_IMPORTED_MODULE_2__["default"])(`(max-width: ${sentry_utils_theme__WEBPACK_IMPORTED_MODULE_1__["default"].breakpoints.small})`);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_truncate__WEBPACK_IMPORTED_MODULE_0__["default"], {
    value: value,
    maxLength: isSmallDevice ? 30 : 40,
    expandable: false
  });
}
TruncatedLabel.displayName = "TruncatedLabel";

/***/ }),

/***/ "./app/views/settings/project/server-side-sampling/modals/specificConditionsModal/utils.tsx":
/*!**************************************************************************************************!*\
  !*** ./app/views/settings/project/server-side-sampling/modals/specificConditionsModal/utils.tsx ***!
  \**************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "distributedTracesConditions": () => (/* binding */ distributedTracesConditions),
/* harmony export */   "formatCreateTagLabel": () => (/* binding */ formatCreateTagLabel),
/* harmony export */   "generateConditionCategoriesOptions": () => (/* binding */ generateConditionCategoriesOptions),
/* harmony export */   "getErrorMessage": () => (/* binding */ getErrorMessage),
/* harmony export */   "getMatchFieldPlaceholder": () => (/* binding */ getMatchFieldPlaceholder),
/* harmony export */   "getNewCondition": () => (/* binding */ getNewCondition),
/* harmony export */   "getTagKey": () => (/* binding */ getTagKey)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_types_sampling__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/types/sampling */ "./app/types/sampling.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../utils */ "./app/views/settings/project/server-side-sampling/utils/index.tsx");
/* harmony import */ var _truncatedLabel__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./truncatedLabel */ "./app/views/settings/project/server-side-sampling/modals/specificConditionsModal/truncatedLabel.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function getMatchFieldPlaceholder(category) {
  switch (category) {
    case sentry_types_sampling__WEBPACK_IMPORTED_MODULE_2__.SamplingInnerName.TRACE_ENVIRONMENT:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('ex. prod, dev');

    case sentry_types_sampling__WEBPACK_IMPORTED_MODULE_2__.SamplingInnerName.TRACE_RELEASE:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('ex. 1*, [I3].[0-9].*');

    default:
      return undefined;
  }
}
function getNewCondition(condition) {
  var _condition$match;

  const newValue = ((_condition$match = condition.match) !== null && _condition$match !== void 0 ? _condition$match : '').split('\n').filter(match => !!match.trim()).map(match => match.trim());

  if (condition.category === sentry_types_sampling__WEBPACK_IMPORTED_MODULE_2__.SamplingInnerName.TRACE_RELEASE) {
    return {
      op: sentry_types_sampling__WEBPACK_IMPORTED_MODULE_2__.SamplingInnerOperator.GLOB_MATCH,
      name: condition.category,
      value: newValue
    };
  }

  return {
    op: sentry_types_sampling__WEBPACK_IMPORTED_MODULE_2__.SamplingInnerOperator.EQUAL,
    name: condition.category,
    value: newValue,
    options: {
      ignoreCase: true
    }
  };
}
const unexpectedErrorMessage = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('An internal error occurred while saving sampling rule');
function getErrorMessage(error, currentRuleIndex) {
  var _error$responseJSON, _errorResponse$dynami, _errorResponse$dynami2;

  const detailedErrorResponse = (_error$responseJSON = error.responseJSON) === null || _error$responseJSON === void 0 ? void 0 : _error$responseJSON.detail;

  if (detailedErrorResponse) {
    // This is a temp solution until we enable error rules again, therefore it does not need translation
    return detailedErrorResponse[0];
  }

  const errorResponse = error.responseJSON;

  if (!errorResponse) {
    return unexpectedErrorMessage;
  }

  const responseErrors = (_errorResponse$dynami = (_errorResponse$dynami2 = errorResponse.dynamicSampling) === null || _errorResponse$dynami2 === void 0 ? void 0 : _errorResponse$dynami2.rules[currentRuleIndex]) !== null && _errorResponse$dynami !== void 0 ? _errorResponse$dynami : {};
  const [type, _value] = Object.entries(responseErrors)[0];

  if (type === 'sampleRate') {
    return {
      type: 'sampleRate',
      message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Ensure this value is a floating number between 0 and 100')
    };
  }

  return unexpectedErrorMessage;
}
function getTagKey(condition) {
  switch (condition.category) {
    case sentry_types_sampling__WEBPACK_IMPORTED_MODULE_2__.SamplingInnerName.TRACE_RELEASE:
      return 'release';

    case sentry_types_sampling__WEBPACK_IMPORTED_MODULE_2__.SamplingInnerName.TRACE_ENVIRONMENT:
      return 'environment';

    default:
      return undefined;
  }
}
const distributedTracesConditions = [sentry_types_sampling__WEBPACK_IMPORTED_MODULE_2__.SamplingInnerName.TRACE_RELEASE, sentry_types_sampling__WEBPACK_IMPORTED_MODULE_2__.SamplingInnerName.TRACE_ENVIRONMENT];
function generateConditionCategoriesOptions(conditionCategories) {
  const sortedConditionCategories = conditionCategories // sort dropdown options alphabetically based on display labels
  .sort((a, b) => (0,_utils__WEBPACK_IMPORTED_MODULE_3__.getInnerNameLabel)(a).localeCompare((0,_utils__WEBPACK_IMPORTED_MODULE_3__.getInnerNameLabel)(b))); // massage into format that select component understands

  return sortedConditionCategories.map(innerName => [innerName, (0,_utils__WEBPACK_IMPORTED_MODULE_3__.getInnerNameLabel)(innerName)]);
}
function formatCreateTagLabel(label) {
  return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.tct)('Add "[newLabel]"', {
    newLabel: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(_truncatedLabel__WEBPACK_IMPORTED_MODULE_4__.TruncatedLabel, {
      value: label
    })
  });
}

/***/ }),

/***/ "./app/views/settings/project/server-side-sampling/modals/specifyClientRateModal.tsx":
/*!*******************************************************************************************!*\
  !*** ./app/views/settings/project/server-side-sampling/modals/specifyClientRateModal.tsx ***!
  \*******************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SpecifyClientRateModal": () => (/* binding */ SpecifyClientRateModal)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var _samplingProjectIncompatibleAlert__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../samplingProjectIncompatibleAlert */ "./app/views/settings/project/server-side-sampling/samplingProjectIncompatibleAlert.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../utils */ "./app/views/settings/project/server-side-sampling/utils/index.tsx");
/* harmony import */ var _utils_useRecommendedSdkUpgrades__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../utils/useRecommendedSdkUpgrades */ "./app/views/settings/project/server-side-sampling/utils/useRecommendedSdkUpgrades.tsx");
/* harmony import */ var _uniformRateModal__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./uniformRateModal */ "./app/views/settings/project/server-side-sampling/modals/uniformRateModal.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













function SpecifyClientRateModal(_ref) {
  let {
    Header,
    Body,
    Footer,
    closeModal,
    onReadDocs,
    onGoNext,
    organization,
    projectId,
    value,
    onChange
  } = _ref;
  const {
    isProjectIncompatible
  } = (0,_utils_useRecommendedSdkUpgrades__WEBPACK_IMPORTED_MODULE_9__.useRecommendedSdkUpgrades)({
    orgSlug: organization.slug,
    projectId
  });

  function handleReadDocs() {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_6__["default"])('sampling.settings.modal.specify.client.rate_read_docs', {
      organization,
      project_id: projectId
    });
    onReadDocs();
  }

  function handleGoNext() {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_6__["default"])('sampling.settings.modal.specify.client.rate_next', {
      organization,
      project_id: projectId
    });

    if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_5__.defined)(value)) {
      return;
    }

    onGoNext();
  }

  const isValid = (0,_utils__WEBPACK_IMPORTED_MODULE_8__.isValidSampleRate)(value);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Header, {
      closeButton: true,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)("h4", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Specify current client(SDK) sample rate')
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(Body, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_uniformRateModal__WEBPACK_IMPORTED_MODULE_10__.StyledNumberField, {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)('Find the [textHighlight:tracesSampleRate] option in your SDK config, and copy it’s value into the field below.', {
          textHighlight: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(TextHighlight, {})
        }),
        type: "number",
        name: "current-client-sampling",
        placeholder: "0.1",
        step: "0.1",
        value: value !== null && value !== void 0 ? value : null,
        onChange: newValue => {
          onChange(newValue === '' ? undefined : newValue);
        },
        stacked: true,
        flexibleControlStateSize: true,
        inline: false
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_samplingProjectIncompatibleAlert__WEBPACK_IMPORTED_MODULE_7__.SamplingProjectIncompatibleAlert, {
        organization: organization,
        projectId: projectId,
        isProjectIncompatible: isProjectIncompatible
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Footer, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(_uniformRateModal__WEBPACK_IMPORTED_MODULE_10__.FooterActions, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
          href: _utils__WEBPACK_IMPORTED_MODULE_8__.SERVER_SIDE_SAMPLING_DOC_LINK,
          onClick: handleReadDocs,
          external: true,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Read Docs')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_3__["default"], {
          gap: 1,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_uniformRateModal__WEBPACK_IMPORTED_MODULE_10__.Stepper, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Step 1 of 3')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
            onClick: closeModal,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Cancel')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
            priority: "primary",
            onClick: handleGoNext,
            disabled: !isValid || isProjectIncompatible,
            title: !isValid ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Sample rate is not valid') : undefined,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Next')
          })]
        })]
      })
    })]
  });
}
SpecifyClientRateModal.displayName = "SpecifyClientRateModal";

const TextHighlight = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "erh47t70"
} : 0)("color:", p => p.theme.gray300, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/project/server-side-sampling/modals/styles.tsx":
/*!***************************************************************************!*\
  !*** ./app/views/settings/project/server-side-sampling/modals/styles.tsx ***!
  \***************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "responsiveModal": () => (/* binding */ responsiveModal)
/* harmony export */ });
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");


const responsiveModal = /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_1__.css)("@media (max-width: ", sentry_utils_theme__WEBPACK_IMPORTED_MODULE_0__["default"].breakpoints.small, "){width:100%;}" + ( true ? "" : 0),  true ? "" : 0);

/***/ }),

/***/ "./app/views/settings/project/server-side-sampling/modals/uniformRateChart.tsx":
/*!*************************************************************************************!*\
  !*** ./app/views/settings/project/server-side-sampling/modals/uniformRateChart.tsx ***!
  \*************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "UniformRateChart": () => (/* binding */ UniformRateChart)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_charts_barChart__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/charts/barChart */ "./app/components/charts/barChart.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }











function UniformRateChart(_ref) {
  let {
    series
  } = _ref;
  const legend = {
    right: 10,
    top: 5,
    data: series.map(s => s.seriesName)
  };
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(ChartPanel, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_2__.ChartContainer, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_2__.HeaderTitle, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Transactions (Last 30 days) ')
      }), (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_7__["default"])({
        value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_charts_barChart__WEBPACK_IMPORTED_MODULE_1__.BarChart, {
          legend: legend,
          series: series,
          grid: {
            left: '10px',
            right: '10px',
            top: '40px',
            bottom: '0px'
          },
          height: 200,
          isGroupedByDate: true,
          showTimeInTooltip: false,
          tooltip: {
            valueFormatter: value => (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_6__.formatAbbreviatedNumber)(value)
          },
          yAxis: {
            axisLabel: {
              formatter: value => (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_6__.formatAbbreviatedNumber)(value)
            }
          }
        }),
        fixed: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_4__["default"], {
          height: "224px"
        })
      })]
    })
  });
}

UniformRateChart.displayName = "UniformRateChart";

const ChartPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.Panel,  true ? {
  target: "e151r2gs0"
} : 0)( true ? {
  name: "1524n4i",
  styles: "margin-bottom:0;border-bottom-left-radius:0;border-bottom:none;border-bottom-right-radius:0"
} : 0);



/***/ }),

/***/ "./app/views/settings/project/server-side-sampling/modals/uniformRateModal.tsx":
/*!*************************************************************************************!*\
  !*** ./app/views/settings/project/server-side-sampling/modals/uniformRateModal.tsx ***!
  \*************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FooterActions": () => (/* binding */ FooterActions),
/* harmony export */   "Stepper": () => (/* binding */ Stepper),
/* harmony export */   "StyledNumberField": () => (/* binding */ StyledNumberField),
/* harmony export */   "UniformRateModal": () => (/* binding */ UniformRateModal)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_forms__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/forms */ "./app/components/forms/index.tsx");
/* harmony import */ var sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/idBadge/projectBadge */ "./app/components/idBadge/projectBadge.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_components_radio__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/radio */ "./app/components/radio.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_modalStore__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/stores/modalStore */ "./app/stores/modalStore.tsx");
/* harmony import */ var sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/stores/useLegacyStore */ "./app/stores/useLegacyStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var sentry_views_organizationStats_types__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/views/organizationStats/types */ "./app/views/organizationStats/types.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var _samplingProjectIncompatibleAlert__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! ../samplingProjectIncompatibleAlert */ "./app/views/settings/project/server-side-sampling/samplingProjectIncompatibleAlert.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! ../utils */ "./app/views/settings/project/server-side-sampling/utils/index.tsx");
/* harmony import */ var _utils_hasFirstBucketsEmpty__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! ../utils/hasFirstBucketsEmpty */ "./app/views/settings/project/server-side-sampling/utils/hasFirstBucketsEmpty.tsx");
/* harmony import */ var _utils_projectStatsToPredictedSeries__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! ../utils/projectStatsToPredictedSeries */ "./app/views/settings/project/server-side-sampling/utils/projectStatsToPredictedSeries.tsx");
/* harmony import */ var _utils_projectStatsToSeries__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! ../utils/projectStatsToSeries */ "./app/views/settings/project/server-side-sampling/utils/projectStatsToSeries.tsx");
/* harmony import */ var _utils_useProjectStats__WEBPACK_IMPORTED_MODULE_32__ = __webpack_require__(/*! ../utils/useProjectStats */ "./app/views/settings/project/server-side-sampling/utils/useProjectStats.tsx");
/* harmony import */ var _utils_useRecommendedSdkUpgrades__WEBPACK_IMPORTED_MODULE_33__ = __webpack_require__(/*! ../utils/useRecommendedSdkUpgrades */ "./app/views/settings/project/server-side-sampling/utils/useRecommendedSdkUpgrades.tsx");
/* harmony import */ var _recommendedStepsModal__WEBPACK_IMPORTED_MODULE_34__ = __webpack_require__(/*! ./recommendedStepsModal */ "./app/views/settings/project/server-side-sampling/modals/recommendedStepsModal.tsx");
/* harmony import */ var _specifyClientRateModal__WEBPACK_IMPORTED_MODULE_35__ = __webpack_require__(/*! ./specifyClientRateModal */ "./app/views/settings/project/server-side-sampling/modals/specifyClientRateModal.tsx");
/* harmony import */ var _uniformRateChart__WEBPACK_IMPORTED_MODULE_36__ = __webpack_require__(/*! ./uniformRateChart */ "./app/views/settings/project/server-side-sampling/modals/uniformRateChart.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






































const CONSERVATIVE_SAMPLE_RATE = 0.1;
var Strategy;

(function (Strategy) {
  Strategy["CURRENT"] = "current";
  Strategy["RECOMMENDED"] = "recommended";
})(Strategy || (Strategy = {}));

var Step;

(function (Step) {
  Step["SET_CURRENT_CLIENT_SAMPLE_RATE"] = "set_current_client_sample_rate";
  Step["SET_UNIFORM_SAMPLE_RATE"] = "set_uniform_sample_rate";
  Step["RECOMMENDED_STEPS"] = "recommended_steps";
})(Step || (Step = {}));

function UniformRateModal(_ref) {
  let {
    Header,
    Body,
    Footer,
    closeModal,
    organization,
    projectStats,
    project,
    uniformRule,
    onSubmit,
    onReadDocs,
    ...props
  } = _ref;
  const [rules, setRules] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(props.rules);
  const [specifiedClientRate, setSpecifiedClientRate] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(undefined);
  const [activeStep, setActiveStep] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(undefined);
  const [selectedStrategy, setSelectedStrategy] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(Strategy.CURRENT);
  const modalStore = (0,sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_20__.useLegacyStore)(sentry_stores_modalStore__WEBPACK_IMPORTED_MODULE_19__["default"]);
  const {
    onRefetch: onRefetch30d,
    projectStats: projectStats30d,
    error: error30d,
    loading: loading30d
  } = (0,_utils_useProjectStats__WEBPACK_IMPORTED_MODULE_32__["default"])({
    orgSlug: organization.slug,
    projectId: project.id,
    interval: '1d',
    statsPeriod: '30d',
    groupBy: (0,react__WEBPACK_IMPORTED_MODULE_2__.useMemo)(() => ['outcome', 'reason'], [])
  });
  const {
    recommendedSdkUpgrades,
    affectedProjects,
    isProjectIncompatible
  } = (0,_utils_useRecommendedSdkUpgrades__WEBPACK_IMPORTED_MODULE_33__.useRecommendedSdkUpgrades)({
    orgSlug: organization.slug,
    projectId: project.id
  });
  const loading = loading30d || !projectStats;
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (loading || !projectStats30d) {
      return;
    }

    if (!projectStats30d.groups.length) {
      setActiveStep(Step.SET_UNIFORM_SAMPLE_RATE);
      return;
    }

    const clientDiscard = projectStats30d.groups.some(g => g.by.outcome === sentry_views_organizationStats_types__WEBPACK_IMPORTED_MODULE_25__.Outcome.CLIENT_DISCARD);
    setActiveStep(clientDiscard ? Step.SET_UNIFORM_SAMPLE_RATE : Step.SET_CURRENT_CLIENT_SAMPLE_RATE);
  }, [loading, projectStats30d]);
  const shouldUseConservativeSampleRate = (0,_utils_hasFirstBucketsEmpty__WEBPACK_IMPORTED_MODULE_29__.hasFirstBucketsEmpty)(projectStats30d, 27) && (0,_utils_hasFirstBucketsEmpty__WEBPACK_IMPORTED_MODULE_29__.hasFirstBucketsEmpty)(projectStats, 3) && !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_22__.defined)(specifiedClientRate);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    // updated or created rules will always have a new id,
    // therefore the isEqual will always work in this case
    if (modalStore.renderer === null && lodash_isEqual__WEBPACK_IMPORTED_MODULE_3___default()(rules, props.rules)) {
      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_23__["default"])(activeStep === Step.SET_CURRENT_CLIENT_SAMPLE_RATE ? 'sampling.settings.modal.specify.client.rate_cancel' : activeStep === Step.RECOMMENDED_STEPS ? 'sampling.settings.modal.recommended.next.steps_cancel' : 'sampling.settings.modal.uniform.rate_cancel', {
        organization,
        project_id: project.id
      });
    }
  }, [activeStep, modalStore.renderer, organization, project.id, rules, props.rules]);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_23__["default"])(selectedStrategy === Strategy.RECOMMENDED ? 'sampling.settings.modal.uniform.rate_switch_recommended' : 'sampling.settings.modal.uniform.rate_switch_current', {
      organization,
      project_id: project.id
    });
  }, [selectedStrategy, organization, project.id]);
  const uniformSampleRate = uniformRule === null || uniformRule === void 0 ? void 0 : uniformRule.sampleRate;
  const {
    recommended: recommendedClientSampling,
    current: currentClientSampling
  } = (0,_utils__WEBPACK_IMPORTED_MODULE_28__.getClientSampleRates)(projectStats, specifiedClientRate);
  const currentServerSampling = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_22__.defined)(uniformSampleRate) && !isNaN(uniformSampleRate) ? uniformSampleRate : undefined;
  const recommendedServerSampling = shouldUseConservativeSampleRate ? CONSERVATIVE_SAMPLE_RATE : Math.min(currentClientSampling !== null && currentClientSampling !== void 0 ? currentClientSampling : 1, recommendedClientSampling !== null && recommendedClientSampling !== void 0 ? recommendedClientSampling : 1);
  const [clientInput, setClientInput] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)((0,_utils__WEBPACK_IMPORTED_MODULE_28__.rateToPercentage)(recommendedClientSampling));
  const [serverInput, setServerInput] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)((0,_utils__WEBPACK_IMPORTED_MODULE_28__.rateToPercentage)(recommendedServerSampling)); // ^^^ We use clientInput and serverInput variables just for the text fields, everywhere else we should use client and server variables vvv

  const client = (0,_utils__WEBPACK_IMPORTED_MODULE_28__.percentageToRate)(clientInput);
  const server = (0,_utils__WEBPACK_IMPORTED_MODULE_28__.percentageToRate)(serverInput);
  const [saving, setSaving] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(false);
  const shouldHaveNextStep = client !== currentClientSampling || recommendedSdkUpgrades.length > 0;
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    setClientInput((0,_utils__WEBPACK_IMPORTED_MODULE_28__.rateToPercentage)(recommendedClientSampling));
    setServerInput((0,_utils__WEBPACK_IMPORTED_MODULE_28__.rateToPercentage)(recommendedServerSampling));
  }, [recommendedClientSampling, recommendedServerSampling]);
  const isEdited = client !== recommendedClientSampling || server !== recommendedServerSampling;
  const isServerRateHigherThanClientRate = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_22__.defined)(client) && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_22__.defined)(server) ? client < server : false;
  const isValid = (0,_utils__WEBPACK_IMPORTED_MODULE_28__.isValidSampleRate)(client) && (0,_utils__WEBPACK_IMPORTED_MODULE_28__.isValidSampleRate)(server) && !isServerRateHigherThanClientRate;

  function handlePrimaryButtonClick() {
    // this can either be "Next" or "Done"
    if (!isValid) {
      return;
    }

    if (shouldHaveNextStep) {
      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_23__["default"])('sampling.settings.modal.uniform.rate_next', {
        organization,
        project_id: project.id
      });
      setActiveStep(Step.RECOMMENDED_STEPS);
      return;
    }

    setSaving(true);
    onSubmit({
      recommendedSampleRate: !isEdited,
      uniformRateModalOrigin: true,
      sampleRate: server,
      rule: uniformRule,
      onSuccess: newRules => {
        setSaving(false);
        setRules(newRules);
        closeModal();
      },
      onError: () => {
        setSaving(false);
      }
    });
  }

  function handleReadDocs() {
    onReadDocs();

    if (activeStep === undefined) {
      return;
    }

    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_23__["default"])('sampling.settings.modal.uniform.rate_read_docs', {
      organization,
      project_id: project.id
    });
  }

  if (activeStep === undefined || loading || error30d) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(Header, {
        closeButton: true,
        children: error30d ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)("h4", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Set a global sample rate')
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_13__["default"], {
          height: "22px"
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(Body, {
        children: error30d ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_10__["default"], {
          onRetry: onRefetch30d
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_11__["default"], {})
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(Footer, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsxs)(FooterActions, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
            href: _utils__WEBPACK_IMPORTED_MODULE_28__.SERVER_SIDE_SAMPLING_DOC_LINK,
            onClick: handleReadDocs,
            external: true,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Read Docs')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_6__["default"], {
            gap: 1,
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
              onClick: closeModal,
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Cancel')
            }), error30d ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
              priority: "primary",
              title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('There was an error loading data'),
              disabled: true,
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Done')
            }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_13__["default"], {
              height: "40px",
              width: "80px"
            })]
          })]
        })
      })]
    });
  }

  if (activeStep === Step.SET_CURRENT_CLIENT_SAMPLE_RATE) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(_specifyClientRateModal__WEBPACK_IMPORTED_MODULE_35__.SpecifyClientRateModal, { ...props,
      Header: Header,
      Body: Body,
      Footer: Footer,
      closeModal: closeModal,
      onReadDocs: onReadDocs,
      organization: organization,
      projectId: project.id,
      value: specifiedClientRate,
      onChange: setSpecifiedClientRate,
      onGoNext: () => setActiveStep(Step.SET_UNIFORM_SAMPLE_RATE)
    });
  }

  if (activeStep === Step.RECOMMENDED_STEPS) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(_recommendedStepsModal__WEBPACK_IMPORTED_MODULE_34__.RecommendedStepsModal, { ...props,
      Header: Header,
      Body: Body,
      Footer: Footer,
      closeModal: closeModal,
      organization: organization,
      recommendedSdkUpgrades: recommendedSdkUpgrades,
      onGoBack: () => setActiveStep(Step.SET_UNIFORM_SAMPLE_RATE),
      onSubmit: onSubmit,
      onReadDocs: onReadDocs,
      clientSampleRate: client,
      serverSampleRate: server,
      uniformRule: uniformRule,
      projectId: project.id,
      recommendedSampleRate: !isEdited,
      onSetRules: setRules
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(Header, {
      closeButton: true,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)("h4", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Set a global sample rate')
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsxs)(Body, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_26__["default"], {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.tct)('Set a server-side sample rate for all transactions using our suggestion as a starting point. To accurately monitor overall performance, we also suggest changing your client(SDK) sample rate to allow more metrics to be processed. [learnMoreLink: Learn more about quota management].', {
          learnMoreLink: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_9__["default"], {
            href: `${_utils__WEBPACK_IMPORTED_MODULE_28__.SERVER_SIDE_SAMPLING_DOC_LINK}getting-started/#2-set-a-uniform-sampling-rate`
          })
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(_uniformRateChart__WEBPACK_IMPORTED_MODULE_36__.UniformRateChart, {
          series: selectedStrategy === Strategy.CURRENT ? (0,_utils_projectStatsToSeries__WEBPACK_IMPORTED_MODULE_31__.projectStatsToSeries)(projectStats30d, specifiedClientRate) : (0,_utils_projectStatsToPredictedSeries__WEBPACK_IMPORTED_MODULE_30__.projectStatsToPredictedSeries)(projectStats30d, client, server, specifiedClientRate)
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsxs)(StyledPanelTable, {
          headers: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(SamplingValuesColumn, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Sampling Values')
          }, "sampling-values"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(ClientColumn, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Client')
          }, "client"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(ClientHelpOrWarningColumn, {}, "client-rate-help"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(ServerColumn, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Server')
          }, "server"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(ServerWarningColumn, {}, "server-warning"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(RefreshRatesColumn, {}, "refresh-rates")],
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(SamplingValuesColumn, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsxs)(Label, {
                htmlFor: "sampling-current",
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_components_radio__WEBPACK_IMPORTED_MODULE_15__["default"], {
                  id: "sampling-current",
                  checked: selectedStrategy === Strategy.CURRENT,
                  onChange: () => {
                    setSelectedStrategy(Strategy.CURRENT);
                  }
                }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Current')]
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(ClientColumn, {
              children: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_22__.defined)(currentClientSampling) ? (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_24__.formatPercentage)(currentClientSampling) : 'N/A'
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(ClientHelpOrWarningColumn, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(ServerColumn, {
              children: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_22__.defined)(currentServerSampling) ? (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_24__.formatPercentage)(currentServerSampling) : 'N/A'
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(ServerWarningColumn, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(RefreshRatesColumn, {})]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(SamplingValuesColumn, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsxs)(Label, {
                htmlFor: "sampling-recommended",
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_components_radio__WEBPACK_IMPORTED_MODULE_15__["default"], {
                  id: "sampling-recommended",
                  checked: selectedStrategy === Strategy.RECOMMENDED,
                  onChange: () => {
                    setSelectedStrategy(Strategy.RECOMMENDED);
                  }
                }), isEdited ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('New') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Suggested'), !isEdited && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_14__["default"], {
                  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Optimal sample rates based on your organization’s usage and quota.'),
                  size: "sm"
                })]
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(ClientColumn, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(StyledNumberField, {
                name: "recommended-client-sampling",
                placeholder: "%",
                step: "10",
                value: clientInput !== null && clientInput !== void 0 ? clientInput : null,
                onChange: value => {
                  setClientInput(value === '' ? undefined : value);
                },
                onFocus: () => setSelectedStrategy(Strategy.RECOMMENDED),
                stacked: true,
                flexibleControlStateSize: true,
                inline: false
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(ClientHelpOrWarningColumn, {
              children: isEdited && !(0,_utils__WEBPACK_IMPORTED_MODULE_28__.isValidSampleRate)(client) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_16__["default"], {
                title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Set a value between 0 and 100'),
                containerDisplayMode: "inline-flex",
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_17__.IconWarning, {
                  color: "red300",
                  size: "sm",
                  "data-test-id": "invalid-client-rate"
                })
              }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_14__["default"], {
                title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Changing the client(SDK) sample rate will require re-deployment.'),
                size: "sm"
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(ServerColumn, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(StyledNumberField, {
                name: "recommended-server-sampling",
                placeholder: "%",
                step: "10",
                value: serverInput !== null && serverInput !== void 0 ? serverInput : null,
                onChange: value => {
                  setServerInput(value === '' ? undefined : value);
                },
                onFocus: () => setSelectedStrategy(Strategy.RECOMMENDED),
                stacked: true,
                flexibleControlStateSize: true,
                inline: false
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(ServerWarningColumn, {
              children: isEdited && !(0,_utils__WEBPACK_IMPORTED_MODULE_28__.isValidSampleRate)(server) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_16__["default"], {
                title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Set a value between 0 and 100'),
                containerDisplayMode: "inline-flex",
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_17__.IconWarning, {
                  color: "red300",
                  size: "sm",
                  "data-test-id": "invalid-server-rate"
                })
              }) : isServerRateHigherThanClientRate && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_16__["default"], {
                title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Server sample rate shall not be higher than client sample rate'),
                containerDisplayMode: "inline-flex",
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_17__.IconWarning, {
                  color: "red300",
                  size: "sm",
                  "data-test-id": "invalid-server-rate"
                })
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(RefreshRatesColumn, {
              children: isEdited && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
                title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Reset to suggested values'),
                icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_17__.IconRefresh, {
                  size: "sm"
                }),
                "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Reset to suggested values'),
                onClick: () => {
                  setClientInput((0,_utils__WEBPACK_IMPORTED_MODULE_28__.rateToPercentage)(recommendedClientSampling));
                  setServerInput((0,_utils__WEBPACK_IMPORTED_MODULE_28__.rateToPercentage)(recommendedServerSampling));
                },
                borderless: true,
                size: "zero"
              })
            })]
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(_samplingProjectIncompatibleAlert__WEBPACK_IMPORTED_MODULE_27__.SamplingProjectIncompatibleAlert, {
          organization: organization,
          projectId: project.id,
          isProjectIncompatible: isProjectIncompatible
        }), shouldUseConservativeSampleRate && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_4__["default"], {
          type: "info",
          showIcon: true,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)("For accurate suggestions, we need at least 48hrs to ingest transactions. Meanwhile, here's a conservative server-side sampling rate which can be changed later on.")
        }), affectedProjects.length > 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsxs)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_4__["default"], {
          "data-test-id": "affected-sdk-alert",
          type: "info",
          showIcon: true,
          trailingItems: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
            href: `${_utils__WEBPACK_IMPORTED_MODULE_28__.SERVER_SIDE_SAMPLING_DOC_LINK}#traces--propagation-of-sampling-decisions`,
            priority: "link",
            borderless: true,
            external: true,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Learn More')
          }),
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('This rate will affect the transactions for the following projects:'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(Projects, {
            children: affectedProjects.map(affectedProject => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_8__["default"], {
              project: affectedProject,
              avatarSize: 16
            }, affectedProject.id))
          })]
        })]
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(Footer, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsxs)(FooterActions, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
          href: _utils__WEBPACK_IMPORTED_MODULE_28__.SERVER_SIDE_SAMPLING_DOC_LINK,
          onClick: handleReadDocs,
          external: true,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Read Docs')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_6__["default"], {
          gap: 1,
          children: [shouldHaveNextStep && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(Stepper, {
            children: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_22__.defined)(specifiedClientRate) ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Step 2 of 3') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Step 1 of 2')
          }), (0,sentry_utils__WEBPACK_IMPORTED_MODULE_22__.defined)(specifiedClientRate) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
            onClick: () => setActiveStep(Step.SET_CURRENT_CLIENT_SAMPLE_RATE),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Back')
          }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
            onClick: closeModal,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Cancel')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
            priority: "primary",
            onClick: handlePrimaryButtonClick,
            disabled: saving || !isValid || selectedStrategy === Strategy.CURRENT || isProjectIncompatible,
            title: selectedStrategy === Strategy.CURRENT ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Current sampling values selected') : !isValid ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Sample rate is not valid') : undefined,
            children: shouldHaveNextStep ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Next') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Done')
          })]
        })]
      })
    })]
  });
}
UniformRateModal.displayName = "UniformRateModal";

const StyledPanelTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelTable,  true ? {
  target: "e12n9nj011"
} : 0)( true ? {
  name: "1bjean5",
  styles: "grid-template-columns:1fr 115px 24px 115px 16px 46px;border-top-left-radius:0;border-top-right-radius:0;>*{padding:0;}"
} : 0);

const Label = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('label',  true ? {
  target: "e12n9nj010"
} : 0)("font-weight:400;display:inline-flex;align-items:center;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(1), ";margin-bottom:0;" + ( true ? "" : 0));

const StyledNumberField = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_forms__WEBPACK_IMPORTED_MODULE_7__.NumberField,  true ? {
  target: "e12n9nj09"
} : 0)( true ? {
  name: "1d3w5wq",
  styles: "width:100%"
} : 0);
const FooterActions = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e12n9nj08"
} : 0)("display:flex;justify-content:space-between;align-items:center;flex:1;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(1), ";" + ( true ? "" : 0));
const Stepper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e12n9nj07"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";color:", p => p.theme.subText, ";" + ( true ? "" : 0));

const SamplingValuesColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e12n9nj06"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(2), ";display:flex;" + ( true ? "" : 0));

const ClientColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e12n9nj05"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(2), ";text-align:right;display:flex;justify-content:flex-end;" + ( true ? "" : 0));

const ClientHelpOrWarningColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e12n9nj04"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(2), " 0;display:flex;align-items:center;" + ( true ? "" : 0));

const ServerColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e12n9nj03"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(2), ";text-align:right;display:flex;justify-content:flex-end;" + ( true ? "" : 0));

const ServerWarningColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e12n9nj02"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(2), " 0;display:flex;align-items:center;" + ( true ? "" : 0));

const RefreshRatesColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e12n9nj01"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(1), ";display:inline-flex;" + ( true ? "" : 0));

const Projects = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e12n9nj00"
} : 0)("display:flex;flex-wrap:wrap;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(1.5), ";justify-content:flex-start;margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(1), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/project/server-side-sampling/rule.tsx":
/*!******************************************************************!*\
  !*** ./app/views/settings/project/server-side-sampling/rule.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ActiveColumn": () => (/* binding */ ActiveColumn),
/* harmony export */   "Column": () => (/* binding */ Column),
/* harmony export */   "ConditionColumn": () => (/* binding */ ConditionColumn),
/* harmony export */   "GrabColumn": () => (/* binding */ GrabColumn),
/* harmony export */   "OperatorColumn": () => (/* binding */ OperatorColumn),
/* harmony export */   "RateColumn": () => (/* binding */ RateColumn),
/* harmony export */   "Rule": () => (/* binding */ Rule)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_components_actions_menuItemActionLink__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/actions/menuItemActionLink */ "./app/components/actions/menuItemActionLink.tsx");
/* harmony import */ var sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/assistant/guideAnchor */ "./app/components/assistant/guideAnchor.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_dropdownLink__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/dropdownLink */ "./app/components/dropdownLink.tsx");
/* harmony import */ var sentry_components_forms_booleanField__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/forms/booleanField */ "./app/components/forms/booleanField.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_icons_iconGrabbable__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/icons/iconGrabbable */ "./app/icons/iconGrabbable.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_types_sampling__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/types/sampling */ "./app/types/sampling.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./utils */ "./app/views/settings/project/server-side-sampling/utils/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


















function Rule(_ref) {
  let {
    dragging,
    rule,
    noPermission,
    onEditRule,
    onDeleteRule,
    onActivate,
    listeners,
    operator,
    grabAttributes,
    hideGrabButton,
    upgradeSdkForProjects
  } = _ref;
  const isUniform = (0,_utils__WEBPACK_IMPORTED_MODULE_15__.isUniformRule)(rule);
  const canDelete = !noPermission && !isUniform;
  const canActivate = !noPermission && !upgradeSdkForProjects.length;
  const canDrag = !isUniform && !noPermission;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(GrabColumn, {
      disabled: !canDrag,
      children: hideGrabButton ? null : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_8__["default"], {
        title: noPermission ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('You do not have permission to reorder rules') : isUniform ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Uniform rules cannot be reordered') : undefined,
        containerDisplayMode: "flex",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(IconGrabbableWrapper, { ...listeners,
          ...grabAttributes,
          "aria-label": dragging ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Drop Rule') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Drag Rule'),
          "aria-disabled": !canDrag,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons_iconGrabbable__WEBPACK_IMPORTED_MODULE_10__.IconGrabbable, {})
        })
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(OperatorColumn, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Operator, {
        children: operator === sentry_types_sampling__WEBPACK_IMPORTED_MODULE_13__.SamplingRuleOperator.IF ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('If') : operator === sentry_types_sampling__WEBPACK_IMPORTED_MODULE_13__.SamplingRuleOperator.ELSE_IF ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Else if') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Else')
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(ConditionColumn, {
      children: hideGrabButton && !rule.condition.inner.length ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('All') : rule.condition.inner.map((condition, index) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(ConditionName, {
          children: (0,_utils__WEBPACK_IMPORTED_MODULE_15__.getInnerNameLabel)(condition.name)
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(ConditionEqualOperator, {
          children: '='
        }), Array.isArray(condition.value) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("div", {
          children: [...condition.value].map((conditionValue, conditionValueIndex) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(ConditionValue, {
              children: conditionValue
            }), conditionValueIndex !== condition.value.length - 1 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(ConditionSeparator, {
              children: '\u002C'
            })]
          }, conditionValue))
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(ConditionValue, {
          children: String(condition.value)
        })]
      }, index))
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(RateColumn, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(SampleRate, {
        children: (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_14__.formatPercentage)(rule.sampleRate)
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(ActiveColumn, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_4__["default"], {
        target: "sampling_rule_toggle",
        onFinish: onActivate,
        disabled: !canActivate || !isUniform,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_8__["default"], {
          disabled: canActivate,
          title: !canActivate ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.tn)('To enable the rule, the recommended sdk version have to be updated', 'To enable the rule, the recommended sdk versions have to be updated', upgradeSdkForProjects.length) : undefined,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(ActiveToggle, {
            inline: false,
            hideControlState: true,
            "aria-label": rule.active ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Deactivate Rule') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Activate Rule'),
            onClick: onActivate,
            name: "active",
            disabled: !canActivate,
            value: rule.active
          })
        })
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Column, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(EllipisDropDownButton, {
        caret: false,
        customTitle: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Actions'),
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconEllipsis, {}),
          size: "sm"
        }),
        anchorRight: true,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_actions_menuItemActionLink__WEBPACK_IMPORTED_MODULE_3__["default"], {
          shouldConfirm: false,
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconDownload, {
            size: "xs"
          }),
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Edit'),
          onClick: !noPermission ? onEditRule : event => {
            event === null || event === void 0 ? void 0 : event.stopPropagation();
          },
          disabled: noPermission,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_8__["default"], {
            disabled: !noPermission,
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('You do not have permission to edit rules'),
            containerDisplayMode: "block",
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Edit')
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_actions_menuItemActionLink__WEBPACK_IMPORTED_MODULE_3__["default"], {
          onAction: onDeleteRule,
          message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Are you sure you wish to delete this rule?'),
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconDownload, {
            size: "xs"
          }),
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Delete'),
          disabled: !canDelete,
          priority: "danger",
          shouldConfirm: true,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_8__["default"], {
            disabled: canDelete,
            title: isUniform ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)("You can't delete the uniform rule") : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('You do not have permission to delete rules'),
            containerDisplayMode: "block",
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Delete')
          })
        })]
      })
    })]
  });
}
Rule.displayName = "Rule";
const Column = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1ouralb14"
} : 0)("display:flex;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(2), ";cursor:default;white-space:pre-wrap;word-break:break-all;" + ( true ? "" : 0));
const GrabColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Column,  true ? {
  target: "e1ouralb13"
} : 0)("[role='button']{cursor:grab;}", p => p.disabled && /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_17__.css)("[role='button']{cursor:not-allowed;}color:", p.theme.disabled, ";" + ( true ? "" : 0),  true ? "" : 0), " display:none;@media (min-width: ", p => p.theme.breakpoints.small, "){display:flex;}" + ( true ? "" : 0));
const OperatorColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Column,  true ? {
  target: "e1ouralb12"
} : 0)("display:none;@media (min-width: ", p => p.theme.breakpoints.small, "){display:flex;}" + ( true ? "" : 0));
const ConditionColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Column,  true ? {
  target: "e1ouralb11"
} : 0)("display:flex;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";align-items:flex-start;flex-wrap:wrap;" + ( true ? "" : 0));
const RateColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Column,  true ? {
  target: "e1ouralb10"
} : 0)( true ? {
  name: "1di2mdl",
  styles: "justify-content:flex-end;text-align:right"
} : 0);
const ActiveColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Column,  true ? {
  target: "e1ouralb9"
} : 0)("justify-content:center;text-align:center;display:none;@media (min-width: ", p => p.theme.breakpoints.small, "){display:flex;}" + ( true ? "" : 0));

const IconGrabbableWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1ouralb8"
} : 0)( true ? {
  name: "cguhaz",
  styles: "outline:none;display:flex;align-items:center;height:34px"
} : 0);

const ConditionEqualOperator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1ouralb7"
} : 0)("color:", p => p.theme.purple300, ";" + ( true ? "" : 0));

const Operator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1ouralb6"
} : 0)("color:", p => p.theme.active, ";" + ( true ? "" : 0));

const SampleRate = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1ouralb5"
} : 0)( true ? {
  name: "1h3cbh4",
  styles: "white-space:pre-wrap;word-break:break-all"
} : 0);

const ActiveToggle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_forms_booleanField__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "e1ouralb4"
} : 0)( true ? {
  name: "n9vzvm",
  styles: "padding:0;height:34px;justify-content:center"
} : 0);

const ConditionName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1ouralb3"
} : 0)("color:", p => p.theme.gray400, ";" + ( true ? "" : 0));

const ConditionValue = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1ouralb2"
} : 0)("color:", p => p.theme.gray300, ";" + ( true ? "" : 0));

const ConditionSeparator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(ConditionValue,  true ? {
  target: "e1ouralb1"
} : 0)("padding-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(0.5), ";" + ( true ? "" : 0));

const EllipisDropDownButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_dropdownLink__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e1ouralb0"
} : 0)( true ? {
  name: "jzcbyy",
  styles: "display:flex;align-items:center;transition:none"
} : 0);

/***/ }),

/***/ "./app/views/settings/project/server-side-sampling/samplingBreakdown.tsx":
/*!*******************************************************************************!*\
  !*** ./app/views/settings/project/server-side-sampling/samplingBreakdown.tsx ***!
  \*******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SamplingBreakdown": () => (/* binding */ SamplingBreakdown)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/idBadge/projectBadge */ "./app/components/idBadge/projectBadge.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_serverSideSamplingStore__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/stores/serverSideSamplingStore */ "./app/stores/serverSideSamplingStore.tsx");
/* harmony import */ var sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/stores/useLegacyStore */ "./app/stores/useLegacyStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/useProjects */ "./app/utils/useProjects.tsx");
/* harmony import */ var sentry_views_performance_vitalDetail_colorBar__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/views/performance/vitalDetail/colorBar */ "./app/views/performance/vitalDetail/colorBar.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ./utils */ "./app/views/settings/project/server-side-sampling/utils/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





















function SamplingBreakdown(_ref) {
  var _projectBreakdown$map;

  let {
    orgSlug
  } = _ref;
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_18__.a)();
  const {
    samplingDistribution,
    fetching
  } = (0,sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_11__.useLegacyStore)(sentry_stores_serverSideSamplingStore__WEBPACK_IMPORTED_MODULE_10__.ServerSideSamplingStore);
  const projectBreakdown = samplingDistribution.project_breakdown;
  const {
    projects
  } = (0,sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_15__["default"])({
    slugs: (_projectBreakdown$map = projectBreakdown === null || projectBreakdown === void 0 ? void 0 : projectBreakdown.map(project => project.project)) !== null && _projectBreakdown$map !== void 0 ? _projectBreakdown$map : [],
    orgId: orgSlug
  });
  const totalCount = projectBreakdown === null || projectBreakdown === void 0 ? void 0 : projectBreakdown.reduce((acc, project) => acc + project['count()'], 0);
  const projectsWithPercentages = projects.map(project => {
    var _projectBreakdown$fin, _projectBreakdown$fin2;

    return {
      project,
      percentage: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_13__.percent)((_projectBreakdown$fin = projectBreakdown === null || projectBreakdown === void 0 ? void 0 : (_projectBreakdown$fin2 = projectBreakdown.find(pb => pb.project === project.slug)) === null || _projectBreakdown$fin2 === void 0 ? void 0 : _projectBreakdown$fin2['count()']) !== null && _projectBreakdown$fin !== void 0 ? _projectBreakdown$fin : 0, totalCount !== null && totalCount !== void 0 ? totalCount : 0)
    };
  }).sort((a, z) => z.percentage - a.percentage);

  function projectWithPercentage(project, percentage) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(ProjectWithPercentage, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_3__["default"], {
        project: project,
        avatarSize: 16
      }), (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_14__.formatPercentage)(percentage / 100)]
    }, project.slug);
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__.Panel, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__.PanelBody, {
      withPadding: true,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(TitleWrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_2__.HeaderTitle, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Transaction Breakdown')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_7__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)('Sampling rules defined here can also affect other projects. [learnMore: Learn more]', {
            learnMore: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_4__["default"], {
              href: `${_utils__WEBPACK_IMPORTED_MODULE_17__.SERVER_SIDE_SAMPLING_DOC_LINK}#traces--propagation-of-sampling-decisions`
            })
          }),
          size: "sm",
          isHoverable: true
        })]
      }), fetching ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_6__["default"], {
          height: "16px",
          bottomGutter: 1.5
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_6__["default"], {
          height: "21px",
          width: "250px"
        })]
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_views_performance_vitalDetail_colorBar__WEBPACK_IMPORTED_MODULE_16__["default"], {
          colorStops: projectsWithPercentages.map((_ref2, index) => {
            let {
              project,
              percentage
            } = _ref2;
            return {
              color: theme.charts.getColorPalette(projectsWithPercentages.length)[index],
              percent: percentage,
              renderBarStatus: (barStatus, key) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_8__["default"], {
                title: projectWithPercentage(project, percentage),
                skipWrapper: true,
                isHoverable: true,
                children: barStatus
              }, key)
            };
          })
        }), projectsWithPercentages.length ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(Projects, {
          children: projectsWithPercentages.map(_ref3 => {
            let {
              project,
              percentage
            } = _ref3;
            return projectWithPercentage(project, percentage);
          })
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(EmptyMessage, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('There were no traces initiated from this project in the last 30 days.')
        })]
      })]
    })
  });
}
SamplingBreakdown.displayName = "SamplingBreakdown";

const TitleWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e11r5sbb3"
} : 0)("display:flex;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";align-items:center;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1.5), ";" + ( true ? "" : 0));

const Projects = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e11r5sbb2"
} : 0)("display:flex;flex-wrap:wrap;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1.5), ";justify-content:flex-start;align-items:center;margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1.5), ";" + ( true ? "" : 0));

const ProjectWithPercentage = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e11r5sbb1"
} : 0)("display:flex;align-items:center;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(0.5), ";color:", p => p.theme.subText, ";" + ( true ? "" : 0));

const EmptyMessage = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e11r5sbb0"
} : 0)("display:flex;align-items:center;min-height:25px;color:", p => p.theme.subText, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/project/server-side-sampling/samplingProjectIncompatibleAlert.tsx":
/*!**********************************************************************************************!*\
  !*** ./app/views/settings/project/server-side-sampling/samplingProjectIncompatibleAlert.tsx ***!
  \**********************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SamplingProjectIncompatibleAlert": () => (/* binding */ SamplingProjectIncompatibleAlert)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./utils */ "./app/views/settings/project/server-side-sampling/utils/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







function SamplingProjectIncompatibleAlert(_ref) {
  let {
    isProjectIncompatible,
    organization,
    projectId
  } = _ref;
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    if (isProjectIncompatible) {
      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_4__["default"])('sampling.sdk.incompatible.alert', {
        organization,
        project_id: projectId
      });
    }
  }, [isProjectIncompatible, organization, projectId]);

  if (!isProjectIncompatible) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__["default"], {
    "data-test-id": "incompatible-project-alert",
    type: "warning",
    showIcon: true,
    trailingItems: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
      href: `${_utils__WEBPACK_IMPORTED_MODULE_5__.SERVER_SIDE_SAMPLING_DOC_LINK}getting-started/#current-limitations`,
      priority: "link",
      borderless: true,
      external: true,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Learn More')
    }),
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Your project is currently incompatible with Server-Side Sampling.')
  });
}
SamplingProjectIncompatibleAlert.displayName = "SamplingProjectIncompatibleAlert";

/***/ }),

/***/ "./app/views/settings/project/server-side-sampling/samplingPromo.tsx":
/*!***************************************************************************!*\
  !*** ./app/views/settings/project/server-side-sampling/samplingPromo.tsx ***!
  \***************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SamplingPromo": () => (/* binding */ SamplingPromo)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_images_spot_onboarding_server_side_sampling_svg__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry-images/spot/onboarding-server-side-sampling.svg */ "./images/spot/onboarding-server-side-sampling.svg");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_onboardingPanel__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/onboardingPanel */ "./app/components/onboardingPanel.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./utils */ "./app/views/settings/project/server-side-sampling/utils/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









function SamplingPromo(_ref) {
  let {
    onGetStarted,
    onReadDocs,
    hasAccess,
    isProjectIncompatible
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(sentry_components_onboardingPanel__WEBPACK_IMPORTED_MODULE_4__["default"], {
    image: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("img", {
      src: sentry_images_spot_onboarding_server_side_sampling_svg__WEBPACK_IMPORTED_MODULE_1__
    }),
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("h3", {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Sample for relevancy')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Paragraph, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Create rules to sample transactions under specific conditions, keeping what you need and dropping what you don’t.')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(ButtonList, {
      gap: 1,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
        priority: "primary",
        onClick: onGetStarted,
        disabled: !hasAccess || isProjectIncompatible,
        title: hasAccess ? undefined : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('You do not have permission to set up rules'),
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Start Setup')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
        href: _utils__WEBPACK_IMPORTED_MODULE_6__.SERVER_SIDE_SAMPLING_DOC_LINK,
        onClick: onReadDocs,
        external: true,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Read Docs')
      })]
    })]
  });
}
SamplingPromo.displayName = "SamplingPromo";

const ButtonList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "ee7lazu1"
} : 0)( true ? {
  name: "vpj881",
  styles: "grid-template-columns:repeat(auto-fit, minmax(130px, max-content))"
} : 0);

const Paragraph = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('p',  true ? {
  target: "ee7lazu0"
} : 0)("font-size:", p => p.theme.fontSizeLarge, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/project/server-side-sampling/samplingSDKClientRateChangeAlert.tsx":
/*!**********************************************************************************************!*\
  !*** ./app/views/settings/project/server-side-sampling/samplingSDKClientRateChangeAlert.tsx ***!
  \**********************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SamplingSDKClientRateChangeAlert": () => (/* binding */ SamplingSDKClientRateChangeAlert)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./utils */ "./app/views/settings/project/server-side-sampling/utils/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








function SamplingSDKClientRateChangeAlert(_ref) {
  let {
    projectStats,
    onReadDocs,
    organization,
    projectId
  } = _ref;
  const {
    diff: clientSamplingDiff
  } = (0,_utils__WEBPACK_IMPORTED_MODULE_6__.getClientSampleRates)(projectStats);
  const recommendChangingClientSdk = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_4__.defined)(clientSamplingDiff) && clientSamplingDiff >= 50;
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    if (!recommendChangingClientSdk) {
      return;
    }

    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_5__["default"])('sampling.sdk.client.rate.change.alert', {
      organization,
      project_id: projectId
    });
  }, [recommendChangingClientSdk, organization, projectId]);

  if (!recommendChangingClientSdk) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__["default"], {
    type: "info",
    showIcon: true,
    trailingItems: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
      href: `${_utils__WEBPACK_IMPORTED_MODULE_6__.SERVER_SIDE_SAMPLING_DOC_LINK}getting-started/#4-increase-your-sdk-transaction-sample-rate`,
      onClick: onReadDocs,
      priority: "link",
      borderless: true,
      external: true,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Learn More')
    }),
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('To allow more metrics to be processed, we suggest changing your client(SDK) sample rate.')
  });
}
SamplingSDKClientRateChangeAlert.displayName = "SamplingSDKClientRateChangeAlert";

/***/ }),

/***/ "./app/views/settings/project/server-side-sampling/samplingSDKUpgradesAlert.tsx":
/*!**************************************************************************************!*\
  !*** ./app/views/settings/project/server-side-sampling/samplingSDKUpgradesAlert.tsx ***!
  \**************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SamplingSDKUpgradesAlert": () => (/* binding */ SamplingSDKUpgradesAlert)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/idBadge/projectBadge */ "./app/components/idBadge/projectBadge.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var _modals_recommendedStepsModal__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./modals/recommendedStepsModal */ "./app/views/settings/project/server-side-sampling/modals/recommendedStepsModal.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












function SamplingSDKUpgradesAlert(_ref) {
  let {
    organization,
    projectId,
    recommendedSdkUpgrades,
    onReadDocs
  } = _ref;
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    if (recommendedSdkUpgrades.length > 0) {
      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__["default"])('sampling.sdk.updgrades.alert', {
        organization,
        project_id: projectId
      });
    }
  }, [recommendedSdkUpgrades.length, organization, projectId]);

  function handleOpenRecommendedSteps() {
    (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_2__.openModal)(modalProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(_modals_recommendedStepsModal__WEBPACK_IMPORTED_MODULE_9__.RecommendedStepsModal, { ...modalProps,
      onReadDocs: onReadDocs,
      organization: organization,
      projectId: projectId,
      recommendedSdkUpgrades: recommendedSdkUpgrades
    }));
  }

  if (recommendedSdkUpgrades.length === 0) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__["default"], {
    "data-test-id": "recommended-sdk-upgrades-alert",
    type: "info",
    showIcon: true,
    trailingItems: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
      onClick: handleOpenRecommendedSteps,
      priority: "link",
      borderless: true,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Learn More')
    }),
    children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('To activate server-side sampling rules, it’s a requirement to update the following project SDK(s):'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(Projects, {
      children: recommendedSdkUpgrades.map(recommendedSdkUpgrade => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_5__["default"], {
        project: recommendedSdkUpgrade.project,
        avatarSize: 16
      }, recommendedSdkUpgrade.project.id))
    })]
  });
}
SamplingSDKUpgradesAlert.displayName = "SamplingSDKUpgradesAlert";

const Projects = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ef73oqh0"
} : 0)("display:flex;flex-wrap:wrap;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1.5), ";justify-content:flex-start;margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/project/server-side-sampling/serverSideSampling.tsx":
/*!********************************************************************************!*\
  !*** ./app/views/settings/project/server-side-sampling/serverSideSampling.tsx ***!
  \********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ServerSideSampling": () => (/* binding */ ServerSideSampling)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_42__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_actionCreators_serverSideSampling__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/actionCreators/serverSideSampling */ "./app/actionCreators/serverSideSampling.tsx");
/* harmony import */ var sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/assistant/guideAnchor */ "./app/components/assistant/guideAnchor.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/featureBadge */ "./app/components/featureBadge.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/stores/projectsStore */ "./app/stores/projectsStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_types_sampling__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/types/sampling */ "./app/types/sampling.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_handleXhrErrorResponse__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/handleXhrErrorResponse */ "./app/utils/handleXhrErrorResponse.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var sentry_utils_usePrevious__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/utils/usePrevious */ "./app/utils/usePrevious.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var sentry_views_settings_organization_permissionAlert__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! sentry/views/settings/organization/permissionAlert */ "./app/views/settings/organization/permissionAlert.tsx");
/* harmony import */ var _modals_specificConditionsModal__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! ./modals/specificConditionsModal */ "./app/views/settings/project/server-side-sampling/modals/specificConditionsModal/index.tsx");
/* harmony import */ var _modals_styles__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! ./modals/styles */ "./app/views/settings/project/server-side-sampling/modals/styles.tsx");
/* harmony import */ var _modals_uniformRateModal__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! ./modals/uniformRateModal */ "./app/views/settings/project/server-side-sampling/modals/uniformRateModal.tsx");
/* harmony import */ var _utils_useProjectStats__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! ./utils/useProjectStats */ "./app/views/settings/project/server-side-sampling/utils/useProjectStats.tsx");
/* harmony import */ var _utils_useRecommendedSdkUpgrades__WEBPACK_IMPORTED_MODULE_32__ = __webpack_require__(/*! ./utils/useRecommendedSdkUpgrades */ "./app/views/settings/project/server-side-sampling/utils/useRecommendedSdkUpgrades.tsx");
/* harmony import */ var _draggableRuleList__WEBPACK_IMPORTED_MODULE_33__ = __webpack_require__(/*! ./draggableRuleList */ "./app/views/settings/project/server-side-sampling/draggableRuleList.tsx");
/* harmony import */ var _rule__WEBPACK_IMPORTED_MODULE_34__ = __webpack_require__(/*! ./rule */ "./app/views/settings/project/server-side-sampling/rule.tsx");
/* harmony import */ var _samplingBreakdown__WEBPACK_IMPORTED_MODULE_35__ = __webpack_require__(/*! ./samplingBreakdown */ "./app/views/settings/project/server-side-sampling/samplingBreakdown.tsx");
/* harmony import */ var _samplingProjectIncompatibleAlert__WEBPACK_IMPORTED_MODULE_36__ = __webpack_require__(/*! ./samplingProjectIncompatibleAlert */ "./app/views/settings/project/server-side-sampling/samplingProjectIncompatibleAlert.tsx");
/* harmony import */ var _samplingPromo__WEBPACK_IMPORTED_MODULE_37__ = __webpack_require__(/*! ./samplingPromo */ "./app/views/settings/project/server-side-sampling/samplingPromo.tsx");
/* harmony import */ var _samplingSDKClientRateChangeAlert__WEBPACK_IMPORTED_MODULE_38__ = __webpack_require__(/*! ./samplingSDKClientRateChangeAlert */ "./app/views/settings/project/server-side-sampling/samplingSDKClientRateChangeAlert.tsx");
/* harmony import */ var _samplingSDKUpgradesAlert__WEBPACK_IMPORTED_MODULE_39__ = __webpack_require__(/*! ./samplingSDKUpgradesAlert */ "./app/views/settings/project/server-side-sampling/samplingSDKUpgradesAlert.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_40__ = __webpack_require__(/*! ./utils */ "./app/views/settings/project/server-side-sampling/utils/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












































function ServerSideSampling(_ref) {
  var _project$dynamicSampl;

  let {
    project
  } = _ref;
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_23__["default"])();
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_22__["default"])();
  const hasAccess = organization.access.includes('project:write');
  const currentRules = (_project$dynamicSampl = project.dynamicSampling) === null || _project$dynamicSampl === void 0 ? void 0 : _project$dynamicSampl.rules;
  const previousRules = (0,sentry_utils_usePrevious__WEBPACK_IMPORTED_MODULE_24__["default"])(currentRules);
  const [rules, setRules] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(currentRules !== null && currentRules !== void 0 ? currentRules : []);
  (0,react__WEBPACK_IMPORTED_MODULE_3__.useEffect)(() => {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_20__["default"])('sampling.settings.view', {
      organization,
      project_id: project.id
    });
  }, [project.id, organization]);
  (0,react__WEBPACK_IMPORTED_MODULE_3__.useEffect)(() => {
    if (!lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default()(previousRules, currentRules)) {
      setRules(currentRules !== null && currentRules !== void 0 ? currentRules : []);
    }
  }, [currentRules, previousRules]);
  (0,react__WEBPACK_IMPORTED_MODULE_3__.useEffect)(() => {
    if (!hasAccess) {
      return;
    }

    async function fetchRecommendedSdkUpgrades() {
      await (0,sentry_actionCreators_serverSideSampling__WEBPACK_IMPORTED_MODULE_7__.fetchSamplingDistribution)({
        orgSlug: organization.slug,
        projSlug: project.slug,
        api
      });
      await (0,sentry_actionCreators_serverSideSampling__WEBPACK_IMPORTED_MODULE_7__.fetchSamplingSdkVersions)({
        orgSlug: organization.slug,
        api,
        projectID: project.id
      });
    }

    fetchRecommendedSdkUpgrades();
  }, [api, organization.slug, project.slug, project.id, hasAccess]);
  const {
    projectStats
  } = (0,_utils_useProjectStats__WEBPACK_IMPORTED_MODULE_31__["default"])({
    orgSlug: organization.slug,
    projectId: project === null || project === void 0 ? void 0 : project.id,
    interval: '1h',
    statsPeriod: '48h',
    groupBy: 'outcome'
  });
  const {
    recommendedSdkUpgrades,
    isProjectIncompatible
  } = (0,_utils_useRecommendedSdkUpgrades__WEBPACK_IMPORTED_MODULE_32__.useRecommendedSdkUpgrades)({
    orgSlug: organization.slug,
    projectId: project.id
  });

  async function handleActivateToggle(rule) {
    if (isProjectIncompatible) {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Your project is currently incompatible with Server-Side Sampling.'));
      return;
    }

    const newRules = rules.map(r => {
      if (r.id === rule.id) {
        return { ...r,
          id: 0,
          active: !r.active
        };
      }

      return r;
    });
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addLoadingMessage)();

    try {
      const result = await api.requestPromise(`/projects/${organization.slug}/${project.slug}/`, {
        method: 'PUT',
        data: {
          dynamicSampling: {
            rules: newRules
          }
        }
      });
      sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_17__["default"].onUpdateSuccess(result);
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Successfully updated the sampling rule'));
    } catch (error) {
      const message = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Unable to update the sampling rule');
      (0,sentry_utils_handleXhrErrorResponse__WEBPACK_IMPORTED_MODULE_21__["default"])(message)(error);
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)(message);
    }

    if ((0,_utils__WEBPACK_IMPORTED_MODULE_40__.isUniformRule)(rule)) {
      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_20__["default"])(rule.active ? 'sampling.settings.rule.uniform_deactivate' : 'sampling.settings.rule.uniform_activate', {
        organization,
        project_id: project.id,
        sampling_rate: rule.sampleRate
      });
    } else {
      const analyticsConditions = rule.condition.inner.map(condition => condition.name);
      const analyticsConditionsStringified = analyticsConditions.sort().join(', ');
      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_20__["default"])(rule.active ? 'sampling.settings.rule.specific_deactivate' : 'sampling.settings.rule.specific_activate', {
        organization,
        project_id: project.id,
        sampling_rate: rule.sampleRate,
        conditions: analyticsConditions,
        conditions_stringified: analyticsConditionsStringified
      });
    }
  }

  function handleGetStarted() {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_20__["default"])('sampling.settings.view_get_started', {
      organization,
      project_id: project.id
    });
    (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_6__.openModal)(modalProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(_modals_uniformRateModal__WEBPACK_IMPORTED_MODULE_30__.UniformRateModal, { ...modalProps,
      organization: organization,
      project: project,
      projectStats: projectStats,
      rules: rules,
      onSubmit: saveUniformRule,
      onReadDocs: handleReadDocs
    }), {
      modalCss: _modals_styles__WEBPACK_IMPORTED_MODULE_29__.responsiveModal
    });
  }

  async function handleSortRules(_ref2) {
    let {
      overIndex,
      reorderedItems: ruleIds
    } = _ref2;

    if (!rules[overIndex].condition.inner.length) {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Specific rules cannot be below uniform rules'));
      return;
    }

    const sortedRules = ruleIds.map(ruleId => rules.find(rule => String(rule.id) === ruleId)).filter(rule => !!rule);
    setRules(sortedRules);

    try {
      const result = await api.requestPromise(`/projects/${organization.slug}/${project.slug}/`, {
        method: 'PUT',
        data: {
          dynamicSampling: {
            rules: sortedRules
          }
        }
      });
      sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_17__["default"].onUpdateSuccess(result);
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Successfully sorted sampling rules'));
    } catch (error) {
      setRules(previousRules !== null && previousRules !== void 0 ? previousRules : []);
      const message = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Unable to sort sampling rules');
      (0,sentry_utils_handleXhrErrorResponse__WEBPACK_IMPORTED_MODULE_21__["default"])(message)(error);
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)(message);
    }
  }

  function handleAddRule() {
    (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_6__.openModal)(modalProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(_modals_specificConditionsModal__WEBPACK_IMPORTED_MODULE_28__.SpecificConditionsModal, { ...modalProps,
      organization: organization,
      project: project,
      rules: rules
    }));
  }

  function handleEditRule(rule) {
    if ((0,_utils__WEBPACK_IMPORTED_MODULE_40__.isUniformRule)(rule)) {
      (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_6__.openModal)(modalProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(_modals_uniformRateModal__WEBPACK_IMPORTED_MODULE_30__.UniformRateModal, { ...modalProps,
        organization: organization,
        project: project,
        projectStats: projectStats,
        uniformRule: rule,
        rules: rules,
        onSubmit: saveUniformRule,
        onReadDocs: handleReadDocs
      }), {
        modalCss: _modals_styles__WEBPACK_IMPORTED_MODULE_29__.responsiveModal
      });
      return;
    }

    (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_6__.openModal)(modalProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(_modals_specificConditionsModal__WEBPACK_IMPORTED_MODULE_28__.SpecificConditionsModal, { ...modalProps,
      organization: organization,
      project: project,
      rule: rule,
      rules: rules
    }));
  }

  async function handleDeleteRule(rule) {
    const conditions = rule.condition.inner.map(_ref3 => {
      let {
        name
      } = _ref3;
      return name;
    });
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_20__["default"])('sampling.settings.rule.specific_delete', {
      organization,
      project_id: project.id,
      sampling_rate: rule.sampleRate,
      conditions,
      conditions_stringified: conditions.sort().join(', ')
    });

    try {
      const result = await api.requestPromise(`/projects/${organization.slug}/${project.slug}/`, {
        method: 'PUT',
        data: {
          dynamicSampling: {
            rules: rules.filter(_ref4 => {
              let {
                id
              } = _ref4;
              return id !== rule.id;
            })
          }
        }
      });
      sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_17__["default"].onUpdateSuccess(result);
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Successfully deleted sampling rule'));
    } catch (error) {
      const message = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Unable to delete sampling rule');
      (0,sentry_utils_handleXhrErrorResponse__WEBPACK_IMPORTED_MODULE_21__["default"])(message)(error);
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)(message);
    }
  }

  function handleReadDocs() {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_20__["default"])('sampling.settings.view_read_docs', {
      organization,
      project_id: project.id
    });
  }

  async function saveUniformRule(_ref5) {
    let {
      sampleRate,
      uniformRateModalOrigin,
      onError,
      onSuccess,
      rule
    } = _ref5;

    if (isProjectIncompatible) {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Your project is currently incompatible with Server-Side Sampling.'));
      return;
    }

    const newRule = {
      // All new/updated rules must have id equal to 0
      id: 0,
      active: rule ? rule.active : false,
      type: sentry_types_sampling__WEBPACK_IMPORTED_MODULE_19__.SamplingRuleType.TRACE,
      condition: {
        op: sentry_types_sampling__WEBPACK_IMPORTED_MODULE_19__.SamplingConditionOperator.AND,
        inner: []
      },
      sampleRate
    };
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_20__["default"])(uniformRateModalOrigin ? 'sampling.settings.modal.uniform.rate_done' : 'sampling.settings.modal.recommended.next.steps_done', {
      organization,
      project_id: project.id
    });
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_20__["default"])(rule ? 'sampling.settings.rule.uniform_update' : 'sampling.settings.rule.uniform_create', {
      organization,
      project_id: project.id,
      sampling_rate: newRule.sampleRate,
      old_sampling_rate: rule ? rule.sampleRate : null
    });
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_20__["default"])('sampling.settings.rule.uniform_save', {
      organization,
      project_id: project.id,
      sampling_rate: newRule.sampleRate,
      old_sampling_rate: rule ? rule.sampleRate : null
    });
    const newRules = rule ? rules.map(existingRule => existingRule.id === rule.id ? newRule : existingRule) : [...rules, newRule];

    try {
      var _response$dynamicSamp, _response$dynamicSamp2;

      const response = await api.requestPromise(`/projects/${organization.slug}/${project.slug}/`, {
        method: 'PUT',
        data: {
          dynamicSampling: {
            rules: newRules
          }
        }
      });
      sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_17__["default"].onUpdateSuccess(response);
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addSuccessMessage)(rule ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Successfully edited sampling rule') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Successfully added sampling rule'));
      onSuccess === null || onSuccess === void 0 ? void 0 : onSuccess((_response$dynamicSamp = (_response$dynamicSamp2 = response.dynamicSampling) === null || _response$dynamicSamp2 === void 0 ? void 0 : _response$dynamicSamp2.rules) !== null && _response$dynamicSamp !== void 0 ? _response$dynamicSamp : []);
    } catch (error) {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)(typeof error === 'string' ? error : error.message || (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Failed to save sampling rule'));
      onError === null || onError === void 0 ? void 0 : onError();
    }
  } // Rules without a condition (Else case) always have to be 'pinned' to the bottom of the list
  // and cannot be sorted


  const items = rules.map(rule => ({ ...rule,
    id: String(rule.id)
  }));
  const uniformRule = rules.find(_utils__WEBPACK_IMPORTED_MODULE_40__.isUniformRule);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_14__["default"], {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Server-Side Sampling'),
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_25__["default"], {
        title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Server-Side Sampling'), " ", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_11__["default"], {
            type: "beta"
          })]
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_26__["default"], {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.tct)('Enhance the Performance monitoring experience by targeting which transactions are most valuable to your organization. To learn more about our beta program, [faqLink: visit our FAQ], for more general information, [docsLink: read our docs].', {
          faqLink: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_12__["default"], {
            href: "https://help.sentry.io/account/account-settings/dynamic-sampling/"
          }),
          docsLink: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_12__["default"], {
            href: _utils__WEBPACK_IMPORTED_MODULE_40__.SERVER_SIDE_SAMPLING_DOC_LINK
          })
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_views_settings_organization_permissionAlert__WEBPACK_IMPORTED_MODULE_27__["default"], {
        access: ['project:write'],
        message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('These settings can only be edited by users with the organization owner, manager, or admin role.')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(_samplingProjectIncompatibleAlert__WEBPACK_IMPORTED_MODULE_36__.SamplingProjectIncompatibleAlert, {
        organization: organization,
        projectId: project.id,
        isProjectIncompatible: isProjectIncompatible
      }), !!rules.length && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(_samplingSDKUpgradesAlert__WEBPACK_IMPORTED_MODULE_39__.SamplingSDKUpgradesAlert, {
        organization: organization,
        projectId: project.id,
        recommendedSdkUpgrades: recommendedSdkUpgrades,
        onReadDocs: handleReadDocs
      }), !!rules.length && !recommendedSdkUpgrades.length && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(_samplingSDKClientRateChangeAlert__WEBPACK_IMPORTED_MODULE_38__.SamplingSDKClientRateChangeAlert, {
        onReadDocs: handleReadDocs,
        projectStats: projectStats,
        organization: organization,
        projectId: project.id
      }), hasAccess && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(_samplingBreakdown__WEBPACK_IMPORTED_MODULE_35__.SamplingBreakdown, {
        orgSlug: organization.slug
      }), !rules.length ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(_samplingPromo__WEBPACK_IMPORTED_MODULE_37__.SamplingPromo, {
        onGetStarted: handleGetStarted,
        onReadDocs: handleReadDocs,
        hasAccess: hasAccess,
        isProjectIncompatible: isProjectIncompatible
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsxs)(RulesPanel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(RulesPanelHeader, {
          lightText: true,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsxs)(RulesPanelLayout, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(_rule__WEBPACK_IMPORTED_MODULE_34__.GrabColumn, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(_rule__WEBPACK_IMPORTED_MODULE_34__.OperatorColumn, {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Operator')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(_rule__WEBPACK_IMPORTED_MODULE_34__.ConditionColumn, {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Condition')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(_rule__WEBPACK_IMPORTED_MODULE_34__.RateColumn, {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Rate')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(_rule__WEBPACK_IMPORTED_MODULE_34__.ActiveColumn, {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Active')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(_rule__WEBPACK_IMPORTED_MODULE_34__.Column, {})]
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(_draggableRuleList__WEBPACK_IMPORTED_MODULE_33__.DraggableRuleList, {
          disabled: !hasAccess,
          items: items,
          onUpdateItems: handleSortRules,
          wrapperStyle: _ref6 => {
            let {
              isDragging,
              isSorting,
              index
            } = _ref6;

            if (isDragging) {
              return {
                cursor: 'grabbing'
              };
            }

            if (isSorting) {
              return {};
            }

            return {
              transform: 'none',
              transformOrigin: '0',
              '--box-shadow': 'none',
              '--box-shadow-picked-up': 'none',
              overflow: 'visible',
              position: 'relative',
              zIndex: rules.length - index,
              cursor: 'default'
            };
          },
          renderItem: _ref7 => {
            let {
              value,
              listeners,
              attributes,
              dragging,
              sorting
            } = _ref7;
            const itemsRuleIndex = items.findIndex(item => item.id === value);

            if (itemsRuleIndex === -1) {
              return null;
            }

            const itemsRule = items[itemsRuleIndex];
            const currentRule = {
              active: itemsRule.active,
              condition: itemsRule.condition,
              sampleRate: itemsRule.sampleRate,
              type: itemsRule.type,
              id: Number(itemsRule.id)
            };
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(RulesPanelLayout, {
              isContent: true,
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(_rule__WEBPACK_IMPORTED_MODULE_34__.Rule, {
                operator: itemsRule.id === items[0].id ? sentry_types_sampling__WEBPACK_IMPORTED_MODULE_19__.SamplingRuleOperator.IF : (0,_utils__WEBPACK_IMPORTED_MODULE_40__.isUniformRule)(currentRule) ? sentry_types_sampling__WEBPACK_IMPORTED_MODULE_19__.SamplingRuleOperator.ELSE : sentry_types_sampling__WEBPACK_IMPORTED_MODULE_19__.SamplingRuleOperator.ELSE_IF,
                hideGrabButton: items.length === 1,
                rule: currentRule,
                onEditRule: () => handleEditRule(currentRule),
                onDeleteRule: () => handleDeleteRule(currentRule),
                onActivate: () => handleActivateToggle(currentRule),
                noPermission: !hasAccess,
                upgradeSdkForProjects: recommendedSdkUpgrades.map(recommendedSdkUpgrade => recommendedSdkUpgrade.project.slug),
                listeners: listeners,
                grabAttributes: attributes,
                dragging: dragging,
                sorting: sorting
              })
            });
          }
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(RulesPanelFooter, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_10__["default"], {
            gap: 1,
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_9__["default"], {
              href: _utils__WEBPACK_IMPORTED_MODULE_40__.SERVER_SIDE_SAMPLING_DOC_LINK,
              onClick: handleReadDocs,
              external: true,
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Read Docs')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_8__["default"], {
              target: "add_conditional_rule",
              disabled: !(uniformRule !== null && uniformRule !== void 0 && uniformRule.active) || !hasAccess || rules.length !== 1,
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(AddRuleButton, {
                disabled: !hasAccess,
                title: !hasAccess ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)("You don't have permission to add a rule") : undefined,
                priority: "primary",
                onClick: handleAddRule,
                icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_15__.IconAdd, {
                  isCircled: true
                }),
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Add Rule')
              })
            })]
          })
        })]
      })]
    })
  });
}
ServerSideSampling.displayName = "ServerSideSampling";

const RulesPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__.Panel,  true ? {
  target: "e7dy4rq4"
} : 0)( true ? "" : 0);

const RulesPanelHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__.PanelHeader,  true ? {
  target: "e7dy4rq3"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(0.5), " 0;font-size:", p => p.theme.fontSizeSmall, ";" + ( true ? "" : 0));

const RulesPanelLayout = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e7dy4rq2"
} : 0)("width:100%;display:grid;grid-template-columns:1fr 0.5fr 74px;@media (min-width: ", p => p.theme.breakpoints.small, "){grid-template-columns:48px 97px 1fr 0.5fr 77px 74px;}", p => p.isContent && /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_42__.css)(">*{line-height:34px;border-bottom:1px solid ", p.theme.border, ";}" + ( true ? "" : 0),  true ? "" : 0), ";" + ( true ? "" : 0));

const RulesPanelFooter = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__.PanelFooter,  true ? {
  target: "e7dy4rq1"
} : 0)("border-top:none;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(1.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(2), ";grid-column:1/-1;display:flex;align-items:center;justify-content:flex-end;" + ( true ? "" : 0));

const AddRuleButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "e7dy4rq0"
} : 0)("@media (max-width: ", p => p.theme.breakpoints.small, "){width:100%;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/project/server-side-sampling/utils/hasFirstBucketsEmpty.tsx":
/*!****************************************************************************************!*\
  !*** ./app/views/settings/project/server-side-sampling/utils/hasFirstBucketsEmpty.tsx ***!
  \****************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "hasFirstBucketsEmpty": () => (/* binding */ hasFirstBucketsEmpty)
/* harmony export */ });
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var ___WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! . */ "./app/views/settings/project/server-side-sampling/utils/index.tsx");

 // Returns true if the first X time buckets are 0 in the series api response

function hasFirstBucketsEmpty(stats) {
  let numberOfLeadingEmptyBuckets = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 3;

  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_0__.defined)(stats)) {
    return false;
  }

  const numberOfEventsInTheFirstBuckets = stats.groups.reduce((acc, group) => {
    let groupAcc = 0;
    const series = group.series[___WEBPACK_IMPORTED_MODULE_1__.quantityField];

    for (let i = 0; i < numberOfLeadingEmptyBuckets; i++) {
      groupAcc += series[i];
    }

    return acc + groupAcc;
  }, 0);
  return numberOfEventsInTheFirstBuckets === 0;
}

/***/ }),

/***/ "./app/views/settings/project/server-side-sampling/utils/index.tsx":
/*!*************************************************************************!*\
  !*** ./app/views/settings/project/server-side-sampling/utils/index.tsx ***!
  \*************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SERVER_SIDE_SAMPLING_DOC_LINK": () => (/* binding */ SERVER_SIDE_SAMPLING_DOC_LINK),
/* harmony export */   "getClientSampleRates": () => (/* binding */ getClientSampleRates),
/* harmony export */   "getInnerNameLabel": () => (/* binding */ getInnerNameLabel),
/* harmony export */   "isUniformRule": () => (/* binding */ isUniformRule),
/* harmony export */   "isValidSampleRate": () => (/* binding */ isValidSampleRate),
/* harmony export */   "percentageToRate": () => (/* binding */ percentageToRate),
/* harmony export */   "quantityField": () => (/* binding */ quantityField),
/* harmony export */   "rateToPercentage": () => (/* binding */ rateToPercentage)
/* harmony export */ });
/* harmony import */ var lodash_round__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash/round */ "../node_modules/lodash/round.js");
/* harmony import */ var lodash_round__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash_round__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_types_sampling__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/types/sampling */ "./app/types/sampling.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _projectStatsToSampleRates__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./projectStatsToSampleRates */ "./app/views/settings/project/server-side-sampling/utils/projectStatsToSampleRates.tsx");





const SERVER_SIDE_SAMPLING_DOC_LINK = 'https://docs.sentry.io/product/data-management-settings/server-side-sampling/';
function getInnerNameLabel(name) {
  switch (name) {
    case sentry_types_sampling__WEBPACK_IMPORTED_MODULE_2__.SamplingInnerName.TRACE_ENVIRONMENT:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Environment');

    case sentry_types_sampling__WEBPACK_IMPORTED_MODULE_2__.SamplingInnerName.TRACE_RELEASE:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Release');

    default:
      return '';
  }
}
const quantityField = 'sum(quantity)';
function isUniformRule(rule) {
  if (!rule) {
    return false;
  }

  return rule.type === sentry_types_sampling__WEBPACK_IMPORTED_MODULE_2__.SamplingRuleType.TRACE && rule.condition.inner.length === 0;
}
function isValidSampleRate(sampleRate) {
  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_3__.defined)(sampleRate)) {
    return false;
  }

  return !isNaN(sampleRate) && sampleRate <= 1 && sampleRate >= 0;
}
function rateToPercentage(rate) {
  let decimalPlaces = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 2;

  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_3__.defined)(rate)) {
    return rate;
  }

  return lodash_round__WEBPACK_IMPORTED_MODULE_0___default()(rate * 100, decimalPlaces);
}
function percentageToRate(rate) {
  let decimalPlaces = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 4;

  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_3__.defined)(rate)) {
    return rate;
  }

  return lodash_round__WEBPACK_IMPORTED_MODULE_0___default()(rate / 100, decimalPlaces);
}
function getClientSampleRates(projectStats, specifiedClientRate) {
  const {
    trueSampleRate,
    maxSafeSampleRate
  } = (0,_projectStatsToSampleRates__WEBPACK_IMPORTED_MODULE_4__.projectStatsToSampleRates)(projectStats);
  const current = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_3__.defined)(specifiedClientRate) && !isNaN(specifiedClientRate) ? specifiedClientRate : (0,sentry_utils__WEBPACK_IMPORTED_MODULE_3__.defined)(trueSampleRate) && !isNaN(trueSampleRate) ? trueSampleRate : undefined;
  const recommended = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_3__.defined)(maxSafeSampleRate) && !isNaN(maxSafeSampleRate) ? maxSafeSampleRate : undefined;
  let diff = undefined;

  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_3__.defined)(recommended) && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_3__.defined)(current)) {
    if (recommended >= current) {
      diff = (recommended - current) / current * 100;
    } else {
      diff = (current - recommended) / recommended * 100;
    }
  }

  return {
    current,
    recommended,
    diff
  };
}

/***/ }),

/***/ "./app/views/settings/project/server-side-sampling/utils/projectStatsToPredictedSeries.tsx":
/*!*************************************************************************************************!*\
  !*** ./app/views/settings/project/server-side-sampling/utils/projectStatsToPredictedSeries.tsx ***!
  \*************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "projectStatsToPredictedSeries": () => (/* binding */ projectStatsToPredictedSeries)
/* harmony export */ });
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var sentry_views_organizationStats_types__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/views/organizationStats/types */ "./app/views/organizationStats/types.tsx");
/* harmony import */ var ___WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! . */ "./app/views/settings/project/server-side-sampling/utils/index.tsx");






function projectStatsToPredictedSeries(projectStats, client, server, specifiedClientRate) {
  if (!projectStats || !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.defined)(client) || !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.defined)(server)) {
    return [];
  }

  const clientRate = Math.max(Math.min(client, 1), 0);
  let serverRate = Math.max(Math.min(server, 1), 0);
  const commonSeriesConfig = {
    barMinHeight: 1,
    type: 'bar',
    stack: 'predictedUsage'
  };
  const seriesData = {
    indexedAndProcessed: [],
    processed: [],
    discarded: []
  };
  projectStats.intervals.map((interval, index) => {
    const result = {
      indexedAndProcessed: 0,
      processed: 0,
      discarded: 0
    };
    projectStats.groups.forEach(group => {
      switch (group.by.outcome) {
        case sentry_views_organizationStats_types__WEBPACK_IMPORTED_MODULE_4__.Outcome.ACCEPTED:
          result.indexedAndProcessed += group.series[___WEBPACK_IMPORTED_MODULE_5__.quantityField][index];
          break;

        case sentry_views_organizationStats_types__WEBPACK_IMPORTED_MODULE_4__.Outcome.CLIENT_DISCARD:
          result.discarded += group.series[___WEBPACK_IMPORTED_MODULE_5__.quantityField][index];
          break;

        case sentry_views_organizationStats_types__WEBPACK_IMPORTED_MODULE_4__.Outcome.FILTERED:
          if (String(group.by.reason).startsWith('Sampled')) {
            result.processed += group.series[___WEBPACK_IMPORTED_MODULE_5__.quantityField][index];
          }

          break;

        default: // We do not take invalid, rate_limited and other filtered into account

      }
    });
    return {
      interval: moment__WEBPACK_IMPORTED_MODULE_0___default()(interval).valueOf(),
      ...result
    };
  }).forEach((bucket, index) => {
    const {
      indexedAndProcessed,
      processed,
      discarded,
      interval
    } = bucket;

    if (clientRate < serverRate) {
      serverRate = clientRate;
    }

    let total = indexedAndProcessed + processed + discarded;

    if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.defined)(specifiedClientRate)) {
      // We assume that the clientDiscard is 0 and
      // calculate the discard client (SDK) bucket according to the specified client rate
      const newClientDiscard = total / specifiedClientRate - total;
      total += newClientDiscard;
    }

    const newSentClient = total * clientRate;
    const newDiscarded = total - newSentClient;
    const newIndexedAndProcessed = clientRate === 0 ? 0 : newSentClient * (serverRate / clientRate);
    const newProcessed = newSentClient - newIndexedAndProcessed;
    seriesData.indexedAndProcessed[index] = {
      name: interval,
      value: Math.round(newIndexedAndProcessed)
    };
    seriesData.processed[index] = {
      name: interval,
      value: Math.round(newProcessed)
    };
    seriesData.discarded[index] = {
      name: interval,
      value: Math.round(newDiscarded)
    };
  });
  return [{
    seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Indexed and Processed'),
    color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_3__["default"].green300,
    ...commonSeriesConfig,
    data: seriesData.indexedAndProcessed
  }, {
    seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Processed'),
    color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_3__["default"].yellow300,
    data: seriesData.processed,
    ...commonSeriesConfig
  }, {
    seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Discarded'),
    color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_3__["default"].red300,
    data: seriesData.discarded,
    ...commonSeriesConfig
  }];
}

/***/ }),

/***/ "./app/views/settings/project/server-side-sampling/utils/projectStatsToSampleRates.tsx":
/*!*********************************************************************************************!*\
  !*** ./app/views/settings/project/server-side-sampling/utils/projectStatsToSampleRates.tsx ***!
  \*********************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "projectStatsToSampleRates": () => (/* binding */ projectStatsToSampleRates)
/* harmony export */ });
/* harmony import */ var lodash_round__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash/round */ "../node_modules/lodash/round.js");
/* harmony import */ var lodash_round__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash_round__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils_findClosestNumber__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/findClosestNumber */ "./app/utils/findClosestNumber.tsx");
/* harmony import */ var sentry_views_organizationStats_types__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/views/organizationStats/types */ "./app/views/organizationStats/types.tsx");
/* harmony import */ var ___WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! . */ "./app/views/settings/project/server-side-sampling/utils/index.tsx");




const MAX_PER_HOUR = 300 * 60 * 60;
const COMMON_SAMPLE_RATES = [0.01, 0.015, 0.02, 0.025, 0.03, 0.035, 0.04, 0.045, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1].sort((a, z) => a - z);
function projectStatsToSampleRates(stats) {
  var _groups$find, _groups$find2, _groups$find3;

  if (!stats) {
    return {
      trueSampleRate: undefined,
      maxSafeSampleRate: undefined,
      hoursOverLimit: undefined
    };
  }

  const {
    groups,
    intervals
  } = stats;
  const hours = [];
  const trueSampleRates = [];
  const safeSampleRates = [];
  let hoursOverLimit = 0; // We do not take filtered and invalid into account

  const accepted = (_groups$find = groups.find(g => g.by.outcome === sentry_views_organizationStats_types__WEBPACK_IMPORTED_MODULE_2__.Outcome.ACCEPTED)) === null || _groups$find === void 0 ? void 0 : _groups$find.series[___WEBPACK_IMPORTED_MODULE_3__.quantityField];
  const clientDiscard = (_groups$find2 = groups.find(g => g.by.outcome === sentry_views_organizationStats_types__WEBPACK_IMPORTED_MODULE_2__.Outcome.CLIENT_DISCARD)) === null || _groups$find2 === void 0 ? void 0 : _groups$find2.series[___WEBPACK_IMPORTED_MODULE_3__.quantityField];
  const rateLimited = (_groups$find3 = groups.find(g => g.by.outcome === sentry_views_organizationStats_types__WEBPACK_IMPORTED_MODULE_2__.Outcome.RATE_LIMITED)) === null || _groups$find3 === void 0 ? void 0 : _groups$find3.series[___WEBPACK_IMPORTED_MODULE_3__.quantityField];
  intervals.forEach((_interval, index) => {
    var _accepted$index, _clientDiscard$index, _rateLimited$index;

    const hourAccepted = (_accepted$index = accepted === null || accepted === void 0 ? void 0 : accepted[index]) !== null && _accepted$index !== void 0 ? _accepted$index : 0;
    const hourClientDiscard = (_clientDiscard$index = clientDiscard === null || clientDiscard === void 0 ? void 0 : clientDiscard[index]) !== null && _clientDiscard$index !== void 0 ? _clientDiscard$index : 0;
    const hourRateLimited = (_rateLimited$index = rateLimited === null || rateLimited === void 0 ? void 0 : rateLimited[index]) !== null && _rateLimited$index !== void 0 ? _rateLimited$index : 0;
    const hourRejected = hourClientDiscard + hourRateLimited;
    const hourTotal = hourAccepted + hourRejected;
    const hourTotalCapped = Math.min(hourTotal, MAX_PER_HOUR);
    const trueSampleRate = hourTotal === 0 ? 1 : 1 - hourRejected / hourTotal;
    const safeSampleRate = hourTotal === 0 ? 1 : hourTotalCapped / hourTotal;
    hours.push(hourTotal);
    trueSampleRates.push(trueSampleRate);
    safeSampleRates.push(safeSampleRate);

    if (hourTotal > MAX_PER_HOUR) {
      hoursOverLimit += 1;
    }
  });
  hours.sort((a, z) => a - z);
  trueSampleRates.sort((a, z) => a - z);
  safeSampleRates.sort((a, z) => a - z);
  let trueSampleRate = trueSampleRates[Math.floor(trueSampleRates.length / 2)];

  if (trueSampleRate > COMMON_SAMPLE_RATES[0]) {
    trueSampleRate = (0,sentry_utils_findClosestNumber__WEBPACK_IMPORTED_MODULE_1__.findClosestNumber)(trueSampleRate, COMMON_SAMPLE_RATES);
  }

  let maxSafeSampleRate = safeSampleRates[0];

  if (maxSafeSampleRate > COMMON_SAMPLE_RATES[0]) {
    maxSafeSampleRate = (0,sentry_utils_findClosestNumber__WEBPACK_IMPORTED_MODULE_1__.findClosestNumber)(maxSafeSampleRate, COMMON_SAMPLE_RATES);
  }

  return {
    trueSampleRate: lodash_round__WEBPACK_IMPORTED_MODULE_0___default()(trueSampleRate, 4),
    maxSafeSampleRate: lodash_round__WEBPACK_IMPORTED_MODULE_0___default()(maxSafeSampleRate, 4),
    hoursOverLimit
  };
}

/***/ }),

/***/ "./app/views/settings/project/server-side-sampling/utils/projectStatsToSeries.tsx":
/*!****************************************************************************************!*\
  !*** ./app/views/settings/project/server-side-sampling/utils/projectStatsToSeries.tsx ***!
  \****************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "projectStatsToSeries": () => (/* binding */ projectStatsToSeries)
/* harmony export */ });
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash/cloneDeep */ "../node_modules/lodash/cloneDeep.js");
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var sentry_views_organizationStats_types__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/organizationStats/types */ "./app/views/organizationStats/types.tsx");
/* harmony import */ var ___WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! . */ "./app/views/settings/project/server-side-sampling/utils/index.tsx");







function projectStatsToSeries(projectStats, specifiedClientRate) {
  if (!projectStats) {
    return [];
  }

  const commonSeriesConfig = {
    barMinHeight: 1,
    type: 'bar',
    stack: 'usage'
  };
  const emptySeries = projectStats.intervals.map(interval => ({
    name: moment__WEBPACK_IMPORTED_MODULE_1___default()(interval).valueOf(),
    value: 0
  }));
  const seriesData = {
    indexedAndProcessed: lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_0___default()(emptySeries),
    processed: lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_0___default()(emptySeries),
    discarded: lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_0___default()(emptySeries)
  };
  projectStats.intervals.forEach((_interval, index) => {
    projectStats.groups.forEach(group => {
      switch (group.by.outcome) {
        case sentry_views_organizationStats_types__WEBPACK_IMPORTED_MODULE_5__.Outcome.ACCEPTED:
          seriesData.indexedAndProcessed[index].value += group.series[___WEBPACK_IMPORTED_MODULE_6__.quantityField][index];
          break;

        case sentry_views_organizationStats_types__WEBPACK_IMPORTED_MODULE_5__.Outcome.CLIENT_DISCARD:
          seriesData.discarded[index].value += group.series[___WEBPACK_IMPORTED_MODULE_6__.quantityField][index];
          break;

        case sentry_views_organizationStats_types__WEBPACK_IMPORTED_MODULE_5__.Outcome.FILTERED:
          if (String(group.by.reason).startsWith('Sampled')) {
            seriesData.processed[index].value += group.series[___WEBPACK_IMPORTED_MODULE_6__.quantityField][index];
          }

          break;

        default: // We do not take invalid, rate_limited and other filtered into account

      }
    });
  });

  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_3__.defined)(specifiedClientRate)) {
    // We assume that the clientDiscard is 0 and
    // calculate the discard client (SDK) bucket according to the specified client rate
    seriesData.discarded = seriesData.discarded.map((bucket, index) => {
      const totalHitServer = seriesData.indexedAndProcessed[index].value + seriesData.processed[index].value;
      return { ...bucket,
        value: totalHitServer / specifiedClientRate - totalHitServer
      };
    });
  }

  return [{
    seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Indexed and Processed'),
    color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_4__["default"].green300,
    ...commonSeriesConfig,
    data: seriesData.indexedAndProcessed
  }, {
    seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Processed'),
    color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_4__["default"].yellow300,
    data: seriesData.processed,
    ...commonSeriesConfig
  }, {
    seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Discarded'),
    color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_4__["default"].red300,
    data: seriesData.discarded,
    ...commonSeriesConfig
  }];
}

/***/ }),

/***/ "./app/views/settings/project/server-side-sampling/utils/useProjectStats.tsx":
/*!***********************************************************************************!*\
  !*** ./app/views/settings/project/server-side-sampling/utils/useProjectStats.tsx ***!
  \***********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_handleXhrErrorResponse__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/handleXhrErrorResponse */ "./app/utils/handleXhrErrorResponse.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var _projectStatsToSeries__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./projectStatsToSeries */ "./app/views/settings/project/server-side-sampling/utils/projectStatsToSeries.tsx");







function useProjectStats(_ref) {
  let {
    orgSlug,
    projectId,
    interval,
    groupBy,
    statsPeriod,
    disable = false
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_4__["default"])();
  const [loading, setLoading] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
  const [error, setError] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(undefined);
  const [projectStats, setProjectStats] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(undefined);
  const [refetch, setRefetch] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        setError(undefined);
        const response = await api.requestPromise(`/organizations/${orgSlug}/stats_v2/`, {
          query: {
            category: 'transaction',
            field: 'sum(quantity)',
            groupBy,
            project: projectId,
            interval,
            statsPeriod
          }
        });
        setProjectStats(response);
        setLoading(false);
        setRefetch(false);
      } catch (err) {
        const errorMessage = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Unable to load project stats');
        (0,sentry_utils_handleXhrErrorResponse__WEBPACK_IMPORTED_MODULE_3__["default"])(errorMessage)(err);
        setError(errorMessage);
        setLoading(false);
        setRefetch(false);
      }
    }

    if (!disable || refetch) {
      fetchStats();
    }
  }, [api, projectId, orgSlug, interval, statsPeriod, disable, groupBy, refetch]);
  return {
    loading,
    error,
    projectStats,
    projectStatsSeries: (0,_projectStatsToSeries__WEBPACK_IMPORTED_MODULE_5__.projectStatsToSeries)(projectStats),
    onRefetch: () => setRefetch(true)
  };
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (useProjectStats);

/***/ }),

/***/ "./app/views/settings/project/server-side-sampling/utils/useRecommendedSdkUpgrades.tsx":
/*!*********************************************************************************************!*\
  !*** ./app/views/settings/project/server-side-sampling/utils/useRecommendedSdkUpgrades.tsx ***!
  \*********************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useRecommendedSdkUpgrades": () => (/* binding */ useRecommendedSdkUpgrades)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_stores_serverSideSamplingStore__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/stores/serverSideSamplingStore */ "./app/stores/serverSideSamplingStore.tsx");
/* harmony import */ var sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/stores/useLegacyStore */ "./app/stores/useLegacyStore.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/useProjects */ "./app/utils/useProjects.tsx");





function useRecommendedSdkUpgrades(_ref) {
  let {
    orgSlug,
    projectId
  } = _ref;
  const {
    samplingSdkVersions,
    fetching
  } = (0,sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_2__.useLegacyStore)(sentry_stores_serverSideSamplingStore__WEBPACK_IMPORTED_MODULE_1__.ServerSideSamplingStore);
  const sdksToUpdate = samplingSdkVersions.filter(_ref2 => {
    let {
      isSendingSource,
      isSendingSampleRate,
      isSupportedPlatform
    } = _ref2;
    return (!isSendingSource || !isSendingSampleRate) && isSupportedPlatform;
  });
  const incompatibleSDKs = samplingSdkVersions.filter(_ref3 => {
    let {
      isSupportedPlatform
    } = _ref3;
    return !isSupportedPlatform;
  });
  const {
    projects
  } = (0,sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_4__["default"])({
    slugs: [...sdksToUpdate, ...incompatibleSDKs].map(_ref4 => {
      let {
        project
      } = _ref4;
      return project;
    }),
    orgId: orgSlug
  });
  const recommendedSdkUpgrades = projects.map(project => {
    const sdkInfo = sdksToUpdate.find(sdkToUpdate => sdkToUpdate.project === project.slug);

    if (!sdkInfo) {
      return undefined;
    }

    return {
      project,
      latestSDKName: sdkInfo.latestSDKName,
      latestSDKVersion: sdkInfo.latestSDKVersion
    };
  }).filter(sentry_utils__WEBPACK_IMPORTED_MODULE_3__.defined);
  const incompatibleProjects = projects.filter(project => incompatibleSDKs.find(incompatibleSDK => incompatibleSDK.project === project.slug));
  const isProjectIncompatible = incompatibleProjects.some(incompatibleProject => incompatibleProject.id === projectId);
  const affectedProjects = [...recommendedSdkUpgrades.map(_ref5 => {
    let {
      project
    } = _ref5;
    return project;
  }), ...incompatibleProjects];
  return {
    recommendedSdkUpgrades,
    incompatibleProjects,
    affectedProjects,
    fetching,
    isProjectIncompatible
  };
}

/***/ }),

/***/ "../node_modules/core-js/internals/new-promise-capability.js":
/*!*******************************************************************!*\
  !*** ../node_modules/core-js/internals/new-promise-capability.js ***!
  \*******************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";

var aCallable = __webpack_require__(/*! ../internals/a-callable */ "../node_modules/core-js/internals/a-callable.js");

var PromiseCapability = function (C) {
  var resolve, reject;
  this.promise = new C(function ($$resolve, $$reject) {
    if (resolve !== undefined || reject !== undefined) throw TypeError('Bad Promise constructor');
    resolve = $$resolve;
    reject = $$reject;
  });
  this.resolve = aCallable(resolve);
  this.reject = aCallable(reject);
};

// `NewPromiseCapability` abstract operation
// https://tc39.es/ecma262/#sec-newpromisecapability
module.exports.f = function (C) {
  return new PromiseCapability(C);
};


/***/ }),

/***/ "../node_modules/core-js/internals/promise-native-constructor.js":
/*!***********************************************************************!*\
  !*** ../node_modules/core-js/internals/promise-native-constructor.js ***!
  \***********************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var global = __webpack_require__(/*! ../internals/global */ "../node_modules/core-js/internals/global.js");

module.exports = global.Promise;


/***/ }),

/***/ "../node_modules/core-js/internals/promise-resolve.js":
/*!************************************************************!*\
  !*** ../node_modules/core-js/internals/promise-resolve.js ***!
  \************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var anObject = __webpack_require__(/*! ../internals/an-object */ "../node_modules/core-js/internals/an-object.js");
var isObject = __webpack_require__(/*! ../internals/is-object */ "../node_modules/core-js/internals/is-object.js");
var newPromiseCapability = __webpack_require__(/*! ../internals/new-promise-capability */ "../node_modules/core-js/internals/new-promise-capability.js");

module.exports = function (C, x) {
  anObject(C);
  if (isObject(x) && x.constructor === C) return x;
  var promiseCapability = newPromiseCapability.f(C);
  var resolve = promiseCapability.resolve;
  resolve(x);
  return promiseCapability.promise;
};


/***/ }),

/***/ "../node_modules/core-js/modules/es.promise.finally.js":
/*!*************************************************************!*\
  !*** ../node_modules/core-js/modules/es.promise.finally.js ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __unused_webpack_exports, __webpack_require__) => {

"use strict";

var $ = __webpack_require__(/*! ../internals/export */ "../node_modules/core-js/internals/export.js");
var IS_PURE = __webpack_require__(/*! ../internals/is-pure */ "../node_modules/core-js/internals/is-pure.js");
var NativePromiseConstructor = __webpack_require__(/*! ../internals/promise-native-constructor */ "../node_modules/core-js/internals/promise-native-constructor.js");
var fails = __webpack_require__(/*! ../internals/fails */ "../node_modules/core-js/internals/fails.js");
var getBuiltIn = __webpack_require__(/*! ../internals/get-built-in */ "../node_modules/core-js/internals/get-built-in.js");
var isCallable = __webpack_require__(/*! ../internals/is-callable */ "../node_modules/core-js/internals/is-callable.js");
var speciesConstructor = __webpack_require__(/*! ../internals/species-constructor */ "../node_modules/core-js/internals/species-constructor.js");
var promiseResolve = __webpack_require__(/*! ../internals/promise-resolve */ "../node_modules/core-js/internals/promise-resolve.js");
var defineBuiltIn = __webpack_require__(/*! ../internals/define-built-in */ "../node_modules/core-js/internals/define-built-in.js");

var NativePromisePrototype = NativePromiseConstructor && NativePromiseConstructor.prototype;

// Safari bug https://bugs.webkit.org/show_bug.cgi?id=200829
var NON_GENERIC = !!NativePromiseConstructor && fails(function () {
  // eslint-disable-next-line unicorn/no-thenable -- required for testing
  NativePromisePrototype['finally'].call({ then: function () { /* empty */ } }, function () { /* empty */ });
});

// `Promise.prototype.finally` method
// https://tc39.es/ecma262/#sec-promise.prototype.finally
$({ target: 'Promise', proto: true, real: true, forced: NON_GENERIC }, {
  'finally': function (onFinally) {
    var C = speciesConstructor(this, getBuiltIn('Promise'));
    var isFunction = isCallable(onFinally);
    return this.then(
      isFunction ? function (x) {
        return promiseResolve(C, onFinally()).then(function () { return x; });
      } : onFinally,
      isFunction ? function (e) {
        return promiseResolve(C, onFinally()).then(function () { throw e; });
      } : onFinally
    );
  }
});

// makes sure that native promise-based APIs `Promise#finally` properly works with patched `Promise#then`
if (!IS_PURE && isCallable(NativePromiseConstructor)) {
  var method = getBuiltIn('Promise').prototype['finally'];
  if (NativePromisePrototype['finally'] !== method) {
    defineBuiltIn(NativePromisePrototype, 'finally', method, { unsafe: true });
  }
}


/***/ }),

/***/ "./images/spot/onboarding-server-side-sampling.svg":
/*!*********************************************************!*\
  !*** ./images/spot/onboarding-server-side-sampling.svg ***!
  \*********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";
module.exports = __webpack_require__.p + "assets/onboarding-server-side-sampling.e9598095a03d7b36e67c.svg";

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_project_server-side-sampling_index_tsx.d15c72ef3dfa9acf2e5c0ef166100c62.js.map