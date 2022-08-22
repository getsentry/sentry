"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_profiling_profileHeader_tsx-app_views_profiling_profileGroupProvider_tsx"],{

/***/ "./app/components/profiling/breadcrumb.tsx":
/*!*************************************************!*\
  !*** ./app/components/profiling/breadcrumb.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Breadcrumb": () => (/* binding */ Breadcrumb)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_breadcrumbs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/breadcrumbs */ "./app/components/breadcrumbs.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_profiling_routes__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/profiling/routes */ "./app/utils/profiling/routes.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }







function Breadcrumb(_ref) {
  let {
    location,
    organization,
    trails
  } = _ref;
  const crumbs = (0,react__WEBPACK_IMPORTED_MODULE_2__.useMemo)(() => trails.map(trail => trailToCrumb(trail, {
    location,
    organization
  })), [location, organization, trails]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(StyledBreadcrumbs, {
    crumbs: crumbs
  });
}

Breadcrumb.displayName = "Breadcrumb";

function trailToCrumb(trail, _ref2) {
  let {
    location,
    organization
  } = _ref2;

  switch (trail.type) {
    case 'landing':
      {
        return {
          to: (0,sentry_utils_profiling_routes__WEBPACK_IMPORTED_MODULE_5__.generateProfilingRouteWithQuery)({
            location,
            orgSlug: organization.slug
          }),
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Profiling'),
          preservePageFilters: true
        };
      }

    case 'profile summary':
      {
        return {
          to: (0,sentry_utils_profiling_routes__WEBPACK_IMPORTED_MODULE_5__.generateProfileSummaryRouteWithQuery)({
            location,
            orgSlug: organization.slug,
            projectSlug: trail.payload.projectSlug,
            transaction: trail.payload.transaction
          }),
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Profile Summary'),
          preservePageFilters: true
        };
      }

    case 'flamechart':
      {
        const generateRouteWithQuery = trail.payload.tab === 'flamechart' ? sentry_utils_profiling_routes__WEBPACK_IMPORTED_MODULE_5__.generateProfileFlamechartRouteWithQuery : sentry_utils_profiling_routes__WEBPACK_IMPORTED_MODULE_5__.generateProfileDetailsRouteWithQuery;
        return {
          to: generateRouteWithQuery({
            location,
            orgSlug: organization.slug,
            projectSlug: trail.payload.projectSlug,
            profileId: trail.payload.profileId
          }),
          label: trail.payload.transaction,
          preservePageFilters: true
        };
      }

    default:
      throw new Error(`Unknown breadcrumb type: ${JSON.stringify(trail)}`);
  }
}

const StyledBreadcrumbs = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_breadcrumbs__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "edt2s550"
} : 0)( true ? {
  name: "1hcx8jb",
  styles: "padding:0"
} : 0);



/***/ }),

/***/ "./app/components/profiling/profileHeader.tsx":
/*!****************************************************!*\
  !*** ./app/components/profiling/profileHeader.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ProfileHeader": () => (/* binding */ ProfileHeader)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_profiling_breadcrumb__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/profiling/breadcrumb */ "./app/components/profiling/breadcrumb.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_profiling_routes__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/profiling/routes */ "./app/utils/profiling/routes.tsx");
/* harmony import */ var sentry_utils_useLocation__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/useLocation */ "./app/utils/useLocation.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var sentry_utils_useParams__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/useParams */ "./app/utils/useParams.tsx");
/* harmony import */ var sentry_views_profiling_profileGroupProvider__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/views/profiling/profileGroupProvider */ "./app/views/profiling/profileGroupProvider.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













function ProfileHeader() {
  var _params$eventId, _params$projectId;

  const params = (0,sentry_utils_useParams__WEBPACK_IMPORTED_MODULE_8__.useParams)();
  const location = (0,sentry_utils_useLocation__WEBPACK_IMPORTED_MODULE_6__.useLocation)();
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_7__["default"])();
  const [profileGroup] = (0,sentry_views_profiling_profileGroupProvider__WEBPACK_IMPORTED_MODULE_9__.useProfileGroup)();
  const transaction = profileGroup.type === 'resolved' ? profileGroup.data.name : '';
  const profileId = (_params$eventId = params.eventId) !== null && _params$eventId !== void 0 ? _params$eventId : '';
  const projectSlug = (_params$projectId = params.projectId) !== null && _params$projectId !== void 0 ? _params$projectId : '';
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_2__.Header, {
    style: {
      gridTemplateColumns: 'minmax(0, 1fr)'
    },
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_2__.HeaderContent, {
      style: {
        marginBottom: 0
      },
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_profiling_breadcrumb__WEBPACK_IMPORTED_MODULE_3__.Breadcrumb, {
        location: location,
        organization: organization,
        trails: [{
          type: 'landing'
        }, {
          type: 'profile summary',
          payload: {
            projectSlug,
            transaction
          }
        }, {
          type: 'flamechart',
          payload: {
            transaction,
            profileId,
            projectSlug,
            tab: location.pathname.endsWith('details/') ? 'details' : 'flamechart'
          }
        }]
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_2__.HeaderNavTabs, {
      underlined: true,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("li", {
        className: location.pathname.endsWith('flamechart/') ? 'active' : undefined,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(react_router__WEBPACK_IMPORTED_MODULE_1__.Link, {
          to: (0,sentry_utils_profiling_routes__WEBPACK_IMPORTED_MODULE_5__.generateProfileFlamechartRouteWithQuery)({
            orgSlug: organization.slug,
            projectSlug,
            profileId,
            location
          }),
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Flamechart')
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("li", {
        className: location.pathname.endsWith('details/') ? 'active' : undefined,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(react_router__WEBPACK_IMPORTED_MODULE_1__.Link, {
          to: (0,sentry_utils_profiling_routes__WEBPACK_IMPORTED_MODULE_5__.generateProfileDetailsRouteWithQuery)({
            orgSlug: organization.slug,
            projectSlug,
            profileId,
            location
          }),
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Details')
        })
      })]
    })]
  });
}

ProfileHeader.displayName = "ProfileHeader";


/***/ }),

/***/ "./app/utils/profiling/callTreeNode.tsx":
/*!**********************************************!*\
  !*** ./app/utils/profiling/callTreeNode.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CallTreeNode": () => (/* binding */ CallTreeNode)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _frame__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./frame */ "./app/utils/profiling/frame.tsx");
/* harmony import */ var _weightedNode__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./weightedNode */ "./app/utils/profiling/weightedNode.tsx");



class CallTreeNode extends _weightedNode__WEBPACK_IMPORTED_MODULE_2__.WeightedNode {
  constructor(frame, parent) {
    super();

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "frame", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "locked", false);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "parent", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "recursive", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "children", []);

    this.recursive = null;
    this.parent = parent;
    this.frame = frame;
  }

  setParent(parent) {
    this.parent = parent;
  }

  setRecursiveThroughNode(node) {
    this.recursive = node;
  }

  isRecursive() {
    return !!this.recursive;
  }

  isDirectRecursive() {
    if (!this.parent) {
      return false;
    }

    return this.parent.frame === this.frame;
  }

  isLocked() {
    return this.locked;
  }

  lock() {
    this.locked = true;
  }

  isRoot() {
    return _frame__WEBPACK_IMPORTED_MODULE_1__.Frame.Root.name === this.frame.name;
  }

}

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(CallTreeNode, "Root", new CallTreeNode(_frame__WEBPACK_IMPORTED_MODULE_1__.Frame.Root, null));

/***/ }),

/***/ "./app/utils/profiling/formatters/stackMarkerToHumanReadable.tsx":
/*!***********************************************************************!*\
  !*** ./app/utils/profiling/formatters/stackMarkerToHumanReadable.tsx ***!
  \***********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "stackMarkerToHumanReadable": () => (/* binding */ stackMarkerToHumanReadable)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
 // This is the formatter for the stack marker spec https://github.com/WICG/js-self-profiling/blob/main/markers.md

function stackMarkerToHumanReadable(marker) {
  switch (marker) {
    case 'gc':
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Garbage Collection');

    case 'style':
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Style');

    case 'layout':
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Layout');

    case 'paint':
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Paint');

    case 'script':
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Script');

    case 'other':
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Other');

    default:
      // since spec is still in dev, just gracefully return whatever we received.
      return marker;
  }
}

/***/ }),

/***/ "./app/utils/profiling/frame.tsx":
/*!***************************************!*\
  !*** ./app/utils/profiling/frame.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Frame": () => (/* binding */ Frame)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _weightedNode__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./weightedNode */ "./app/utils/profiling/weightedNode.tsx");



class Frame extends _weightedNode__WEBPACK_IMPORTED_MODULE_2__.WeightedNode {
  constructor(frameInfo, type) {
    super();

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "key", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "name", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "file", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "line", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "column", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "is_application", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "image", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "resource", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "threadId", void 0);

    this.key = frameInfo.key;
    this.file = frameInfo.file;
    this.name = frameInfo.name;
    this.resource = frameInfo.resource;
    this.line = frameInfo.line;
    this.column = frameInfo.column;
    this.is_application = type === 'web' ? frameInfo.line === undefined && frameInfo.column === undefined : !!frameInfo.is_application;
    this.image = frameInfo.image;
    this.threadId = frameInfo.threadId;

    if (type === 'web') {
      // If the frame is a web frame and there is no name associated to it, then it was likely invoked as an iife or anonymous callback as
      // most modern browser engines properly show anonymous functions when they are assigned to references (e.g. `let foo = function() {};`)
      if (!frameInfo.name) {
        this.name = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('anonymous');
      } // If the frame had no line or column, it was part of the native code, (e.g. calling String.fromCharCode)


      if (frameInfo.line === undefined && frameInfo.column === undefined) {
        this.name += ` ${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('[native code]')}`;
      }
    }
  }

  isRoot() {
    return this.name === Frame.Root.name;
  }

}

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(Frame, "Root", new Frame({
  key: 'sentry root',
  name: 'sentry root',
  is_application: false
}, 'mobile'));

/***/ }),

/***/ "./app/utils/profiling/guards/profile.tsx":
/*!************************************************!*\
  !*** ./app/utils/profiling/guards/profile.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "isChromeTraceArrayFormat": () => (/* binding */ isChromeTraceArrayFormat),
/* harmony export */   "isChromeTraceFormat": () => (/* binding */ isChromeTraceFormat),
/* harmony export */   "isChromeTraceObjectFormat": () => (/* binding */ isChromeTraceObjectFormat),
/* harmony export */   "isEventedProfile": () => (/* binding */ isEventedProfile),
/* harmony export */   "isJSProfile": () => (/* binding */ isJSProfile),
/* harmony export */   "isSampledProfile": () => (/* binding */ isSampledProfile),
/* harmony export */   "isSchema": () => (/* binding */ isSchema),
/* harmony export */   "isTypescriptChromeTraceArrayFormat": () => (/* binding */ isTypescriptChromeTraceArrayFormat)
/* harmony export */ });
function isSchema(input) {
  return typeof input === 'object' && 'transactionName' in input && 'profiles' in input && Array.isArray(input.profiles) && 'shared' in input;
}
function isEventedProfile(profile) {
  return 'type' in profile && profile.type === 'evented';
}
function isSampledProfile(profile) {
  return 'type' in profile && profile.type === 'sampled';
}
function isJSProfile(profile) {
  return !('type' in profile) && Array.isArray(profile.resources);
}
function isChromeTraceObjectFormat(input) {
  return typeof input === 'object' && 'traceEvents' in input;
} // We check for the presence of at least one ProfileChunk event in the trace

function isChromeTraceArrayFormat(input) {
  return Array.isArray(input) && input.some(p => p.ph === 'P' && p.name === 'ProfileChunk');
} // Typescript uses only a subset of the event types (only B and E cat),
// so we need to inspect the contents of the trace to determine the type of the profile.
// The TS trace can still contain other event types like metadata events, meaning we cannot
// use array.every() and need to check all the events to make sure no P events are present

function isTypescriptChromeTraceArrayFormat(input) {
  return Array.isArray(input) && !input.some(p => p.ph === 'P' && p.name === 'ProfileChunk');
}
function isChromeTraceFormat(input) {
  return isTypescriptChromeTraceArrayFormat(input) || isChromeTraceObjectFormat(input) || isChromeTraceArrayFormat(input);
}

/***/ }),

/***/ "./app/utils/profiling/jsSelfProfiling.tsx":
/*!*************************************************!*\
  !*** ./app/utils/profiling/jsSelfProfiling.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "resolveJSSelfProfilingStack": () => (/* binding */ resolveJSSelfProfilingStack)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _formatters_stackMarkerToHumanReadable__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./formatters/stackMarkerToHumanReadable */ "./app/utils/profiling/formatters/stackMarkerToHumanReadable.tsx");
/* harmony import */ var _frame__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./frame */ "./app/utils/profiling/frame.tsx");




function createMarkerFrame(marker) {
  return {
    name: (0,_formatters_stackMarkerToHumanReadable__WEBPACK_IMPORTED_MODULE_1__.stackMarkerToHumanReadable)(marker),
    resourceId: undefined,
    line: undefined,
    column: undefined
  };
}
/**
 * Utility fn to resolve stack frames starting from the top most frame.
 * Each frame points to it's parent, with the initial stackId pointer pointing to the top of the frame.
 * We walk down the stack until no more frames are found, appending the parent frame to the list.
 * As a result we end up with a list of frames starting from the root most frame.
 *
 * There is a caching opportunity here, as stackId's point to the same parts of the stack, resolving it once is sufficient
 * and all subsequent calls could be cached. Some instrumentation and testing would be required, leaving as is for now.
 */


function resolveJSSelfProfilingStack(trace, stackId, frameIndex, marker) {
  // If there is no stack associated with a sample, it means the thread was idle
  const callStack = []; // There can only be one marker per callStack, so prepend it to the start of the stack

  if (marker && marker !== 'script') {
    callStack.unshift(new _frame__WEBPACK_IMPORTED_MODULE_2__.Frame({ ...createMarkerFrame(marker),
      key: marker
    }));
  }

  if (stackId === undefined) {
    return callStack;
  }

  let stack = trace.stacks[stackId]; // If the stackId cannot be resolved from the stacks dict, it means the format is corrupt or partial (possibly due to termination reasons).
  // This should never happen, but in the offchance that it somehow does, it should be handled.

  if (!stack) {
    throw new Error(`Missing stackId ${stackId} in trace, cannot resolve stack`);
  }

  while (stack !== undefined) {
    // If the frameId pointer cannot be resolved, it means the format is corrupt or partial (possibly due to termination reasons).
    // This should never happen, but in the offchance that it somehow does, it should be handled.
    if (trace.frames[stack.frameId] === undefined) {
      return callStack;
    }

    callStack.unshift(frameIndex[stack.frameId]);

    if (stack.parentId !== undefined) {
      stack = trace.stacks[stack.parentId];
    } else {
      stack = undefined;
    }
  }

  return callStack;
}

/***/ }),

/***/ "./app/utils/profiling/profile/chromeTraceProfile.tsx":
/*!************************************************************!*\
  !*** ./app/utils/profiling/profile/chromeTraceProfile.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ChromeTraceProfile": () => (/* binding */ ChromeTraceProfile),
/* harmony export */   "collapseSamples": () => (/* binding */ collapseSamples),
/* harmony export */   "parseChromeTraceFormat": () => (/* binding */ parseChromeTraceFormat),
/* harmony export */   "parseTypescriptChromeTraceArrayFormat": () => (/* binding */ parseTypescriptChromeTraceArrayFormat),
/* harmony export */   "splitEventsByProcessAndTraceId": () => (/* binding */ splitEventsByProcessAndTraceId)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_utils_profiling_frame__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/profiling/frame */ "./app/utils/profiling/frame.tsx");
/* harmony import */ var sentry_utils_profiling_profile_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/profiling/profile/utils */ "./app/utils/profiling/profile/utils.tsx");
/* harmony import */ var _eventedProfile__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./eventedProfile */ "./app/utils/profiling/profile/eventedProfile.tsx");



/**
 * The import code is very similar to speedscope's import code. The queue approach works well and allows us
 * to easily split the X events and handle them. There are some small differences when it comes to building
 * profiles where we opted to throw instead of closing a frame that was never opened.
 *
 * Overall, it seems that mostly typescript compiler uses this output, so we could possibly do a bit more
 * in order to detect if this is a tsc trace and mark the different compiler phases and give users the preference
 * to color encode by the program/bind/check/emit phases.
 */



class ChromeTraceProfile extends _eventedProfile__WEBPACK_IMPORTED_MODULE_4__.EventedProfile {}
function splitEventsByProcessAndTraceId(trace) {
  const collections = new Map();

  for (let i = 0; i < trace.length; i++) {
    const event = trace[i];

    if (typeof event.pid !== 'number') {
      continue;
    }

    if (typeof event.tid !== 'number') {
      continue;
    }

    let processes = collections.get(event.pid);

    if (!processes) {
      processes = new Map();
      collections.set(event.pid, processes);
    }

    let threads = processes.get(event.tid);

    if (!threads) {
      threads = [];
      processes.set(event.tid, threads);
    }

    threads.push(event);
  }

  return collections;
}

function chronologicalSort(a, b) {
  return a.ts - b.ts;
}

function reverseChronologicalSort(a, b) {
  return b.ts - a.ts;
}

function getNextQueue(beginQueue, endQueue) {
  if (!beginQueue.length && !endQueue.length) {
    throw new Error('Profile contains no events');
  }

  const nextBegin = beginQueue[beginQueue.length - 1];
  const nextEnd = endQueue[endQueue.length - 1];

  if (!nextEnd) {
    return 'B';
  }

  if (!nextBegin) {
    return 'E';
  }

  if (nextBegin.ts < nextEnd.ts) {
    return 'B';
  }

  if (nextEnd.ts < nextBegin.ts) {
    return 'E';
  }

  return 'B';
}

function buildProfile(processId, threadId, events) {
  var _endQueue$0$ts, _endQueue$;

  let processName = `pid (${processId})`;
  let threadName = `tid (${threadId})`; // We dont care about other events besides begin, end, instant events and metadata events

  const timelineEvents = events.filter(e => e.ph === 'B' || e.ph === 'E' || e.ph === 'X' || e.ph === 'M');
  const beginQueue = [];
  const endQueue = [];

  for (let i = 0; i < timelineEvents.length; i++) {
    const event = timelineEvents[i]; // M events are not pushed to the queue, we just store their information

    if (event.ph === 'M') {
      if (event.name === 'thread_name' && typeof event.args.name === 'string') {
        threadName = `${event.args.name} (${threadId})`;
        continue;
      }

      if (event.name === 'process_name' && typeof event.args.name === 'string') {
        processName = `${event.args.name} (${processId})`;
        continue;
      }
    } // B, E and X events are pushed to the timeline. We transform all X events into
    // B and E event, so that they can be pushed onto the queue and handled


    if (event.ph === 'B') {
      beginQueue.push(event);
      continue;
    }

    if (event.ph === 'E') {
      endQueue.push(event);
      continue;
    }

    if (event.ph === 'X') {
      if (typeof event.dur === 'number' || typeof event.tdur === 'number') {
        var _ref, _event$dur;

        beginQueue.push({ ...event,
          ph: 'B'
        });
        endQueue.push({ ...event,
          ph: 'E',
          ts: event.ts + ((_ref = (_event$dur = event.dur) !== null && _event$dur !== void 0 ? _event$dur : event.tdur) !== null && _ref !== void 0 ? _ref : 0)
        });
        continue;
      }
    }
  }

  beginQueue.sort(reverseChronologicalSort);
  endQueue.sort(reverseChronologicalSort);

  if (!beginQueue.length) {
    throw new Error('Profile does not contain any frame events');
  }

  const firstTimestamp = beginQueue[beginQueue.length - 1].ts;
  const lastTimestamp = (_endQueue$0$ts = (_endQueue$ = endQueue[0]) === null || _endQueue$ === void 0 ? void 0 : _endQueue$.ts) !== null && _endQueue$0$ts !== void 0 ? _endQueue$0$ts : beginQueue[0].ts;

  if (typeof firstTimestamp !== 'number') {
    throw new Error('First begin event contains no timestamp');
  }

  if (typeof lastTimestamp !== 'number') {
    throw new Error('Last end event contains no timestamp');
  }

  const profile = new ChromeTraceProfile(lastTimestamp - firstTimestamp, firstTimestamp, lastTimestamp, `${processName}: ${threadName}`, 'microseconds', // the trace event format provides timestamps in microseconds
  threadId);
  const stack = [];
  const frameCache = new Map();

  while (beginQueue.length > 0 || endQueue.length > 0) {
    const next = getNextQueue(beginQueue, endQueue);

    if (next === 'B') {
      const item = beginQueue.pop();

      if (!item) {
        throw new Error('Nothing to take from begin queue');
      }

      const frameInfo = createFrameInfoFromEvent(item);

      if (!frameCache.has(frameInfo.key)) {
        frameCache.set(frameInfo.key, new sentry_utils_profiling_frame__WEBPACK_IMPORTED_MODULE_2__.Frame(frameInfo));
      }

      const frame = frameCache.get(frameInfo.key);
      profile.enterFrame(frame, item.ts - firstTimestamp);
      stack.push(item);
      continue;
    }

    if (next === 'E') {
      const item = endQueue.pop();
      let frameInfo = createFrameInfoFromEvent(item);

      if (stack[stack.length - 1] === undefined) {
        throw new Error(`Unable to close frame from an empty stack, attempting to close ${JSON.stringify(item)}`);
      }

      const topFrameInfo = createFrameInfoFromEvent(stack[stack.length - 1]); // We check frames with the same ts and look for a match. We do this because
      // chronological sort will not break ties on frames that end at the same time,
      // but may not be in the same order as they were opened.

      for (let i = endQueue.length - 2; i > 0; i--) {
        if (endQueue[i].ts > endQueue[endQueue.length - 1].ts) {
          break;
        }

        const nextEndInfo = createFrameInfoFromEvent(endQueue[i]);

        if (topFrameInfo.key === nextEndInfo.key) {
          const tmp = endQueue[endQueue.length - 1];
          endQueue[endQueue.length - 1] = endQueue[i];
          endQueue[i] = tmp;
          frameInfo = nextEndInfo;
          break;
        }
      }

      if (!frameCache.has(frameInfo.key)) {
        throw new Error(`Cannot leave frame that was never entered, leaving ${frameInfo.key}`);
      }

      const frame = frameCache.get(frameInfo.key);
      profile.leaveFrame(frame, item.ts - firstTimestamp);
      stack.pop();
      continue;
    }
  } // Close the leftover frames in stack


  while (stack.length) {
    const item = stack.pop();
    const frameInfo = createFrameInfoFromEvent(item);
    const frame = frameCache.get(frameInfo.key);

    if (!frame) {
      throw new Error(`Cannot leave frame that was never entered, leaving ${frameInfo.key}`);
    }

    profile.leaveFrame(frame, frame.totalWeight);
  }

  return profile.build();
}

function createFrameInfoFromEvent(event) {
  const key = JSON.stringify(event.args);
  return {
    key,
    name: `${(event === null || event === void 0 ? void 0 : event.name) || 'Unknown'} ${key}`.trim()
  };
}

function parseTypescriptChromeTraceArrayFormat(input, traceID, options) {
  const profiles = [];
  const eventsByProcessAndThreadID = splitEventsByProcessAndTraceId(input);

  for (const [processId, threads] of eventsByProcessAndThreadID) {
    for (const [threadId, events] of threads) {
      (0,sentry_utils_profiling_profile_utils__WEBPACK_IMPORTED_MODULE_3__.wrapWithSpan)(options === null || options === void 0 ? void 0 : options.transaction, () => profiles.push(buildProfile(processId, threadId, events !== null && events !== void 0 ? events : [])), {
        op: 'profile.import',
        description: 'chrometrace'
      });
    }
  }

  return {
    name: 'chrometrace',
    traceID,
    activeProfileIndex: 0,
    profiles
  };
}

function isProfileEvent(event) {
  return event.ph === 'P' && event.name === 'Profile';
}

function isProfileChunk(event) {
  return event.ph === 'P' && event.name === 'ProfileChunk';
}

function isThreadmetaData(event) {
  event.name === 'Thread';
  return event.ph === 'M' && event.name === 'Thread';
}

// This mostly follows what speedscope does for the Chrome Trace format, but we do minor adjustments (not sure if they are correct atm),
// but the protocol format seems out of date and is not well documented, so this is a best effort.
function collectEventsByProfile(input) {
  const sorted = input.sort(chronologicalSort);
  const threadNames = new Map();
  const profileIdToProcessAndThreadIds = new Map();
  const cpuProfiles = new Map();

  for (let i = 0; i < sorted.length; i++) {
    const event = sorted[i];

    if (isThreadmetaData(event)) {
      threadNames.set(`${event.pid}:${event.tid}`, event.args.name);
      continue;
    } // A profile entry will happen before we see any ProfileChunks, so the order here matters


    if (isProfileEvent(event)) {
      profileIdToProcessAndThreadIds.set(event.id, [event.pid, event.tid]);

      if (cpuProfiles.has(event.id)) {
        continue;
      } // Judging by https://github.com/v8/v8/blob/b8626ca445554b8376b5a01f651b70cb8c01b7dd/src/inspector/js_protocol.json#L1453,
      // the only optional properties of a profile event are the samples and the timeDelta, however looking at a few sample traces
      // this does not seem to be the case. For example, in our chrometrace/trace.json there is a profile entry where only startTime is present


      cpuProfiles.set(event.id, {
        samples: [],
        timeDeltas: [],
        // @ts-ignore
        startTime: 0,
        // @ts-ignore
        endTime: 0,
        // @ts-ignore
        nodes: [],
        ...event.args.data
      });
      continue;
    }

    if (isProfileChunk(event)) {
      const profile = cpuProfiles.get(event.id);

      if (!profile) {
        throw new Error('No entry for Profile was found before ProfileChunk');
      } // If we have a chunk, then append our values to it. Eventually we end up with a single profile with all of the chunks and samples merged


      const cpuProfile = event.args.data.cpuProfile;

      if (cpuProfile.nodes) {
        var _cpuProfile$nodes;

        profile.nodes = profile.nodes.concat((_cpuProfile$nodes = cpuProfile.nodes) !== null && _cpuProfile$nodes !== void 0 ? _cpuProfile$nodes : []);
      }

      if (cpuProfile.samples) {
        var _cpuProfile$samples;

        profile.samples = profile.samples.concat((_cpuProfile$samples = cpuProfile.samples) !== null && _cpuProfile$samples !== void 0 ? _cpuProfile$samples : []);
      }

      if (cpuProfile.timeDeltas) {
        var _cpuProfile$timeDelta;

        profile.timeDeltas = profile.timeDeltas.concat((_cpuProfile$timeDelta = cpuProfile.timeDeltas) !== null && _cpuProfile$timeDelta !== void 0 ? _cpuProfile$timeDelta : []);
      }

      if (cpuProfile.startTime !== null) {
        // Make sure we dont overwrite the startTime if it is already set
        if (typeof profile.startTime === 'number') {
          profile.startTime = Math.min(profile.startTime, cpuProfile.startTime);
        } else {
          profile.startTime = cpuProfile.startTime;
        }
      } // Make sure we dont overwrite the endTime if it is already set


      if (cpuProfile.endTime !== null) {
        if (typeof profile.endTime === 'number') {
          profile.endTime = Math.max(profile.endTime, cpuProfile.endTime);
        } else {
          profile.endTime = cpuProfile.endTime;
        }
      }
    }

    continue;
  }

  return {
    cpuProfiles,
    threadNames
  };
}

function createFramesIndex(profile) {
  const frames = new Map();

  for (let i = 0; i < profile.nodes.length; i++) {
    frames.set(profile.nodes[i].id, { ...profile.nodes[i]
    });
  }

  for (let i = 0; i < profile.nodes.length; i++) {
    const profileNode = profile.nodes[i];

    if (typeof profileNode.parent === 'number') {
      const parent = frames.get(profileNode.parent);

      if (parent === undefined) {
        throw new Error('Missing frame parent in profile');
      }
    }

    if (!profileNode.children) {
      continue;
    }

    for (let j = 0; j < profileNode.children.length; j++) {
      const child = frames.get(profileNode.children[j]);

      if (child === undefined) {
        throw new Error('Missing frame child in profile');
      }

      child.parent = profileNode;
    }
  }

  return frames;
} // Cpu profiles can often contain a lot of sequential samples that point to the same stack.
// It's wasteful to process these one by one, we can instead collapse them and just update the time delta.
// We should consider a similar approach for the backend sample storage. I expect we will remove
// this code from the frontend once we have backend support and a unified format for these.
// Effectively, samples like [1,1,2,1] and timedeltas [1,2,1,1] to sample [1,2,1] and timedeltas [3,1,1]


function collapseSamples(profile) {
  const samples = [];
  const sampleTimes = []; // If we have no samples, then we can't collapse anything

  if (!profile.samples || !profile.samples.length) {
    throw new Error('Profile is missing samples');
  } // If we have no time deltas then the format may be corrupt


  if (!profile.timeDeltas || !profile.timeDeltas.length) {
    throw new Error('Profile is missing timeDeltas');
  } // If timedeltas does not match samples, then the format may be corrupt


  if (profile.timeDeltas.length !== profile.samples.length) {
    throw new Error("Profile's samples and timeDeltas don't match");
  }

  if (profile.samples.length === 1 && profile.timeDeltas.length === 1) {
    return {
      samples: [profile.samples[0]],
      sampleTimes: [profile.timeDeltas[0]]
    };
  } // First delta is relative to profile start
  // https://github.com/v8/v8/blob/44bd8fd7/src/inspector/js_protocol.json#L1485


  let elapsed = profile.timeDeltas[0]; // This is quite significantly changed from speedscope's implementation.
  // We iterate over all samples and check if we can collapse them or not.
  // A sample should be collapsed when there are more that 2 consecutive samples
  // that are pointing to the same stack.

  for (let i = 0; i < profile.samples.length; i++) {
    const nodeId = profile.samples[i]; // Initialize the delta to 0, so we can accumulate the deltas of any collapsed samples

    let delta = 0; // Start at i

    let j = i; // While we are not at the end and next sample is the same as current

    while (j < profile.samples.length && profile.samples[j + 1] === nodeId) {
      // Update the delta and advance j. In some cases, v8 reports deltas
      // as negative. We will just ignore these deltas and make sure that
      // we never go back in time when updating the delta.
      delta = Math.max(delta + profile.timeDeltas[j + 1], delta);
      j++;
    } // Check if we skipped more than 1 element


    if (j - i > 1) {
      // We skipped more than 1 element, so we should collapse the samples,
      // push the first element where we started with the elapsed time
      // and last element where we started with the elapsed time + delta
      samples.push(nodeId);
      sampleTimes.push(elapsed);
      samples.push(nodeId);
      sampleTimes.push(elapsed + delta);
      elapsed += delta;
      i = j;
    } else {
      // If we have not skipped samples, then we just push the sample and the delta to the list
      samples.push(nodeId);
      sampleTimes.push(elapsed); // In some cases, v8 reports deltas as negative. We will just ignore
      // these deltas and make sure that we never go back in time when updating the delta.

      elapsed = Math.max(elapsed + profile.timeDeltas[i + 1], elapsed);
    }
  }

  return {
    samples,
    sampleTimes
  };
}
function parseChromeTraceFormat(input, traceID, _options) {
  const {
    cpuProfiles,
    threadNames: _threadNames
  } = collectEventsByProfile(input);

  for (const [_profileId, profile] of cpuProfiles.entries()) {
    // @ts-ignore
    // eslint-disable-next-line
    const index = createFramesIndex(profile);
    const {
      samples: _samples,
      sampleTimes: _sampleTimes
    } = collapseSamples(profile);
  }

  return {
    name: 'chrometrace',
    traceID,
    activeProfileIndex: 0,
    profiles: []
  };
}

/***/ }),

/***/ "./app/utils/profiling/profile/eventedProfile.tsx":
/*!********************************************************!*\
  !*** ./app/utils/profiling/profile/eventedProfile.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "EventedProfile": () => (/* binding */ EventedProfile)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_at_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.at.js */ "../node_modules/core-js/modules/es.array.at.js");
/* harmony import */ var core_js_modules_es_array_at_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_at_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var core_js_modules_es_string_at_alternative_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! core-js/modules/es.string.at-alternative.js */ "../node_modules/core-js/modules/es.string.at-alternative.js");
/* harmony import */ var core_js_modules_es_string_at_alternative_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_at_alternative_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_profiling_callTreeNode__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/profiling/callTreeNode */ "./app/utils/profiling/callTreeNode.tsx");
/* harmony import */ var _profile__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./profile */ "./app/utils/profiling/profile/profile.tsx");








class EventedProfile extends _profile__WEBPACK_IMPORTED_MODULE_7__.Profile {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "appendOrderStack", [this.appendOrderTree]);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "stack", []);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "lastValue", 0);
  }

  static FromProfile(eventedProfile, frameIndex) {
    const profile = new EventedProfile(eventedProfile.endValue - eventedProfile.startValue, eventedProfile.startValue, eventedProfile.endValue, eventedProfile.name, eventedProfile.unit, eventedProfile.threadID); // If frames are offset, we need to set lastValue to profile start, so that delta between
    // samples is correctly offset by the start value.

    profile.lastValue = Math.max(0, eventedProfile.startValue);

    for (const event of eventedProfile.events) {
      const frame = frameIndex[event.frame];

      if (!frame) {
        throw new Error(`Cannot retrieve event: ${event.frame} from frame index`);
      }

      switch (event.type) {
        // Open a new frame
        case 'O':
          {
            profile.enterFrame(frame, event.at);
            break;
          }
        // Close a frame

        case 'C':
          {
            profile.leaveFrame(frame, event.at);
            break;
          }

        default:
          {
            throw new TypeError(`Unknown event type ${event.type}`);
          }
      }
    }

    return profile.build();
  }

  addWeightToFrames(weight) {
    const weightDelta = weight - this.lastValue;

    for (const frame of this.stack) {
      frame.addToTotalWeight(weightDelta);
    }

    const top = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_5__.lastOfArray)(this.stack);

    if (top) {
      top.addToSelfWeight(weight);
    }
  }

  addWeightsToNodes(value) {
    const delta = value - this.lastValue;

    for (const node of this.appendOrderStack) {
      node.addToTotalWeight(delta);
    }

    const stackTop = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_5__.lastOfArray)(this.appendOrderStack);

    if (stackTop) {
      stackTop.addToSelfWeight(delta);
    }
  }

  enterFrame(frame, at) {
    this.addWeightToFrames(at);
    this.addWeightsToNodes(at);
    const lastTop = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_5__.lastOfArray)(this.appendOrderStack);

    if (lastTop) {
      const sampleDelta = at - this.lastValue;

      if (sampleDelta < 0) {
        throw new Error('Sample delta cannot be negative, samples may be corrupt or out of order');
      } // If the sample timestamp is not the same as the same as of previous frame,
      // we can deduce that this is a new sample and need to push it on the stack


      if (sampleDelta > 0) {
        this.samples.push(lastTop);
        this.weights.push(sampleDelta);
      }

      const last = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_5__.lastOfArray)(lastTop.children);
      let node;

      if (last && !last.isLocked() && last.frame === frame) {
        node = last;
      } else {
        node = new sentry_utils_profiling_callTreeNode__WEBPACK_IMPORTED_MODULE_6__.CallTreeNode(frame, lastTop);
        lastTop.children.push(node);
      } // TODO: This is On^2, because we iterate over all frames in the stack to check if our
      // frame is a recursive frame. We could do this in O(1) by keeping a map of frames in the stack with their respective indexes
      // We check the stack in a top-down order to find the first recursive frame.


      let start = this.appendOrderStack.length - 1;

      while (start >= 0) {
        if (this.appendOrderStack[start].frame === node.frame) {
          // The recursion edge is bidirectional
          this.appendOrderStack[start].setRecursiveThroughNode(node);
          node.setRecursiveThroughNode(this.appendOrderStack[start]);
          break;
        }

        start--;
      }

      this.appendOrderStack.push(node);
    }

    this.stack.push(frame);
    this.lastValue = at;
  }

  leaveFrame(_event, at) {
    this.addWeightToFrames(at);
    this.addWeightsToNodes(at);
    this.trackSampleStats(at);
    const leavingStackTop = this.appendOrderStack.pop();

    if (leavingStackTop === undefined) {
      throw new Error('Unbalanced stack');
    } // Lock the stack node, so we make sure we dont mutate it in the future.
    // The samples should be ordered by timestamp when processed so we should never
    // iterate over them again in the future.


    leavingStackTop.lock();
    const sampleDelta = at - this.lastValue;

    if (sampleDelta > 0) {
      this.samples.push(leavingStackTop);
      this.weights.push(sampleDelta); // Keep track of the minFrameDuration

      this.minFrameDuration = Math.min(sampleDelta, this.minFrameDuration);
    }

    this.stack.pop();
    this.lastValue = at;
  }

  build() {
    if (this.appendOrderStack.length > 1) {
      throw new Error('Unbalanced append order stack');
    }

    this.duration = Math.max(this.duration, this.weights.reduce((a, b) => a + b, 0)); // We had no frames with duration > 0, so set min duration to timeline duration
    // which effectively disables any zooming on the flamegraphs

    if (this.minFrameDuration === Number.POSITIVE_INFINITY || this.minFrameDuration === 0) {
      this.minFrameDuration = this.duration;
    }

    return this;
  }

}

/***/ }),

/***/ "./app/utils/profiling/profile/importProfile.tsx":
/*!*******************************************************!*\
  !*** ./app/utils/profiling/profile/importProfile.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "importDroppedProfile": () => (/* binding */ importDroppedProfile),
/* harmony export */   "importProfile": () => (/* binding */ importProfile)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var _guards_profile__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../guards/profile */ "./app/utils/profiling/guards/profile.tsx");
/* harmony import */ var _chromeTraceProfile__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./chromeTraceProfile */ "./app/utils/profiling/profile/chromeTraceProfile.tsx");
/* harmony import */ var _eventedProfile__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./eventedProfile */ "./app/utils/profiling/profile/eventedProfile.tsx");
/* harmony import */ var _jsSelfProfile__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./jsSelfProfile */ "./app/utils/profiling/profile/jsSelfProfile.tsx");
/* harmony import */ var _sampledProfile__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./sampledProfile */ "./app/utils/profiling/profile/sampledProfile.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./utils */ "./app/utils/profiling/profile/utils.tsx");









function importProfile(input, traceID) {
  const transaction = _sentry_react__WEBPACK_IMPORTED_MODULE_8__.startTransaction({
    op: 'import',
    name: 'profiles.import'
  });

  try {
    if ((0,_guards_profile__WEBPACK_IMPORTED_MODULE_2__.isJSProfile)(input)) {
      // In some cases, the SDK may return transaction as undefined and we dont want to throw there.
      if (transaction) {
        transaction.setTag('profile.type', 'js-self-profile');
      }

      return importJSSelfProfile(input, traceID, {
        transaction
      });
    }

    if ((0,_guards_profile__WEBPACK_IMPORTED_MODULE_2__.isChromeTraceFormat)(input)) {
      // In some cases, the SDK may return transaction as undefined and we dont want to throw there.
      if (transaction) {
        transaction.setTag('profile.type', 'chrometrace');
      }

      return importChromeTrace(input, traceID, {
        transaction
      });
    }

    if ((0,_guards_profile__WEBPACK_IMPORTED_MODULE_2__.isSchema)(input)) {
      // In some cases, the SDK may return transaction as undefined and we dont want to throw there.
      if (transaction) {
        transaction.setTag('profile.type', 'schema');
      }

      return importSchema(input, traceID, {
        transaction
      });
    }

    throw new Error('Unsupported trace format');
  } catch (error) {
    if (transaction) {
      transaction.setStatus('internal_error');
    }

    throw error;
  } finally {
    if (transaction) {
      transaction.finish();
    }
  }
}

function importJSSelfProfile(input, traceID, options) {
  const frameIndex = (0,_utils__WEBPACK_IMPORTED_MODULE_7__.createFrameIndex)(input.frames);
  return {
    traceID,
    name: traceID,
    activeProfileIndex: 0,
    profiles: [importSingleProfile(input, frameIndex, options)]
  };
}

function importChromeTrace(input, traceID, options) {
  if ((0,_guards_profile__WEBPACK_IMPORTED_MODULE_2__.isChromeTraceObjectFormat)(input)) {
    throw new Error('Chrometrace object format is not yet supported');
  }

  if ((0,_guards_profile__WEBPACK_IMPORTED_MODULE_2__.isTypescriptChromeTraceArrayFormat)(input)) {
    return (0,_chromeTraceProfile__WEBPACK_IMPORTED_MODULE_3__.parseTypescriptChromeTraceArrayFormat)(input, traceID, options);
  }

  throw new Error('Failed to parse trace input format');
}

function importSchema(input, traceID, options) {
  var _input$activeProfileI;

  const frameIndex = (0,_utils__WEBPACK_IMPORTED_MODULE_7__.createFrameIndex)(input.shared.frames);
  return {
    traceID,
    name: input.transactionName,
    activeProfileIndex: (_input$activeProfileI = input.activeProfileIndex) !== null && _input$activeProfileI !== void 0 ? _input$activeProfileI : 0,
    profiles: input.profiles.map(profile => importSingleProfile(profile, frameIndex, options))
  };
}

function importSingleProfile(profile, frameIndex, _ref) {
  let {
    transaction
  } = _ref;

  if ((0,_guards_profile__WEBPACK_IMPORTED_MODULE_2__.isEventedProfile)(profile)) {
    // In some cases, the SDK may return transaction as undefined and we dont want to throw there.
    if (!transaction) {
      return _eventedProfile__WEBPACK_IMPORTED_MODULE_4__.EventedProfile.FromProfile(profile, frameIndex);
    }

    return (0,_utils__WEBPACK_IMPORTED_MODULE_7__.wrapWithSpan)(transaction, () => _eventedProfile__WEBPACK_IMPORTED_MODULE_4__.EventedProfile.FromProfile(profile, frameIndex), {
      op: 'profile.import',
      description: 'evented'
    });
  }

  if ((0,_guards_profile__WEBPACK_IMPORTED_MODULE_2__.isSampledProfile)(profile)) {
    // In some cases, the SDK may return transaction as undefined and we dont want to throw there.
    if (!transaction) {
      return _sampledProfile__WEBPACK_IMPORTED_MODULE_6__.SampledProfile.FromProfile(profile, frameIndex);
    }

    return (0,_utils__WEBPACK_IMPORTED_MODULE_7__.wrapWithSpan)(transaction, () => _sampledProfile__WEBPACK_IMPORTED_MODULE_6__.SampledProfile.FromProfile(profile, frameIndex), {
      op: 'profile.import',
      description: 'sampled'
    });
  }

  if ((0,_guards_profile__WEBPACK_IMPORTED_MODULE_2__.isJSProfile)(profile)) {
    // In some cases, the SDK may return transaction as undefined and we dont want to throw there.
    if (!transaction) {
      return _jsSelfProfile__WEBPACK_IMPORTED_MODULE_5__.JSSelfProfile.FromProfile(profile, (0,_utils__WEBPACK_IMPORTED_MODULE_7__.createFrameIndex)(profile.frames));
    }

    return (0,_utils__WEBPACK_IMPORTED_MODULE_7__.wrapWithSpan)(transaction, () => _jsSelfProfile__WEBPACK_IMPORTED_MODULE_5__.JSSelfProfile.FromProfile(profile, (0,_utils__WEBPACK_IMPORTED_MODULE_7__.createFrameIndex)(profile.frames)), {
      op: 'profile.import',
      description: 'js-self-profile'
    });
  }

  throw new Error('Unrecognized trace format');
}

const tryParseInputString = input => {
  try {
    return [JSON.parse(input), null];
  } catch (e) {
    return [null, e];
  }
};

const TRACE_JSON_PARSERS = [input => tryParseInputString(input), input => tryParseInputString(input + ']')];

function readFileAsString(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', e => {
      var _e$target;

      if (typeof ((_e$target = e.target) === null || _e$target === void 0 ? void 0 : _e$target.result) === 'string') {
        resolve(e.target.result);
        return;
      }

      reject('Failed to read string contents of input file');
    });
    reader.addEventListener('error', () => {
      reject('Failed to read string contents of input file');
    });
    reader.readAsText(file);
  });
}

async function importDroppedProfile(file) {
  let parsers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : TRACE_JSON_PARSERS;
  const fileContents = await readFileAsString(file);

  for (const parser of parsers) {
    const [json] = parser(fileContents);

    if (json) {
      if (typeof json !== 'object' || json === null) {
        throw new TypeError('Input JSON is not an object');
      }

      return importProfile(json, file.name);
    }
  }

  throw new Error('Failed to parse input JSON');
}

/***/ }),

/***/ "./app/utils/profiling/profile/jsSelfProfile.tsx":
/*!*******************************************************!*\
  !*** ./app/utils/profiling/profile/jsSelfProfile.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "JSSelfProfile": () => (/* binding */ JSSelfProfile)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_profiling_callTreeNode__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/profiling/callTreeNode */ "./app/utils/profiling/callTreeNode.tsx");
/* harmony import */ var sentry_utils_profiling_frame__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/profiling/frame */ "./app/utils/profiling/frame.tsx");
/* harmony import */ var _formatters_stackMarkerToHumanReadable__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./../formatters/stackMarkerToHumanReadable */ "./app/utils/profiling/formatters/stackMarkerToHumanReadable.tsx");
/* harmony import */ var _jsSelfProfiling__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./../jsSelfProfiling */ "./app/utils/profiling/jsSelfProfiling.tsx");
/* harmony import */ var _profile__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./profile */ "./app/utils/profiling/profile/profile.tsx");







class JSSelfProfile extends _profile__WEBPACK_IMPORTED_MODULE_6__.Profile {
  static FromProfile(profile, frameIndex) {
    // In the case of JSSelfProfiling, we need to index the abstract marker frames
    // as they will otherwise not be present in the ProfilerStack.
    const markers = ['gc', 'layout', 'other', 'paint', 'script', 'style'];

    for (const marker of markers) {
      frameIndex[marker] = new sentry_utils_profiling_frame__WEBPACK_IMPORTED_MODULE_3__.Frame({
        key: marker,
        name: (0,_formatters_stackMarkerToHumanReadable__WEBPACK_IMPORTED_MODULE_4__.stackMarkerToHumanReadable)(marker),
        line: undefined,
        column: undefined,
        is_application: false
      }, 'web');
    }

    const startedAt = profile.samples[0].timestamp;
    const endedAt = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.lastOfArray)(profile.samples).timestamp;
    const jsSelfProfile = new JSSelfProfile(endedAt - startedAt, startedAt, endedAt, 'JSSelfProfiling', 'milliseconds', 0); // Because JS self profiling takes an initial sample when we call new Profiler(),
    // it means that the first sample weight will always be zero. We want to append the sample with 0 weight,
    //  because the 2nd sample may part of the first sample's stack. This way we keep the most information we can of the stack trace

    jsSelfProfile.appendSample((0,_jsSelfProfiling__WEBPACK_IMPORTED_MODULE_5__.resolveJSSelfProfilingStack)(profile, profile.samples[0].stackId, frameIndex, profile.samples[0].marker), 0); // We start at stack 1, because we've already appended stack 0 above. The weight of each sample is the
    // difference between the current sample and the previous one.

    for (let i = 1; i < profile.samples.length; i++) {
      // When gc is triggered, the stack may be indicated as empty. In that case, the thread was not idle
      // and we should append gc to the top of the previous stack.
      // https://github.com/WICG/js-self-profiling/issues/59
      if (profile.samples[i].marker === 'gc') {
        jsSelfProfile.appendSample((0,_jsSelfProfiling__WEBPACK_IMPORTED_MODULE_5__.resolveJSSelfProfilingStack)(profile, // use the previous sample
        profile.samples[i - 1].stackId, frameIndex, profile.samples[i].marker), profile.samples[i].timestamp - profile.samples[i - 1].timestamp);
      } else {
        jsSelfProfile.appendSample((0,_jsSelfProfiling__WEBPACK_IMPORTED_MODULE_5__.resolveJSSelfProfilingStack)(profile, profile.samples[i].stackId, frameIndex, profile.samples[i].marker), profile.samples[i].timestamp - profile.samples[i - 1].timestamp);
      }
    }

    return jsSelfProfile.build();
  }

  appendSample(stack, weight) {
    this.trackSampleStats(weight);
    let node = this.appendOrderTree;
    const framesInStack = [];

    for (const frame of stack) {
      const last = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.lastOfArray)(node.children);

      if (last && !last.isLocked() && last.frame === frame) {
        node = last;
      } else {
        const parent = node;
        node = new sentry_utils_profiling_callTreeNode__WEBPACK_IMPORTED_MODULE_2__.CallTreeNode(frame, node);
        parent.children.push(node);
      }

      node.addToTotalWeight(weight); // TODO: This is On^2, because we iterate over all frames in the stack to check if our
      // frame is a recursive frame. We could do this in O(1) by keeping a map of frames in the stack
      // We check the stack in a top-down order to find the first recursive frame.

      let stackHeight = framesInStack.length - 1;

      while (stackHeight >= 0) {
        if (framesInStack[stackHeight].frame === node.frame) {
          // The recursion edge is bidirectional
          framesInStack[stackHeight].setRecursiveThroughNode(node);
          node.setRecursiveThroughNode(framesInStack[stackHeight]);
          break;
        }

        stackHeight--;
      }

      framesInStack.push(node);
    }

    node.addToSelfWeight(weight);

    if (weight > 0) {
      this.minFrameDuration = Math.min(weight, this.minFrameDuration);
    } // Lock the stack node, so we make sure we dont mutate it in the future.
    // The samples should be ordered by timestamp when processed so we should never
    // iterate over them again in the future.


    for (const child of node.children) {
      child.lock();
    }

    node.frame.addToSelfWeight(weight);

    for (const stackNode of framesInStack) {
      stackNode.frame.addToTotalWeight(weight);
    } // If node is the same as the previous sample, add the weight to the previous sample


    if (node === (0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.lastOfArray)(this.samples)) {
      this.weights[this.weights.length - 1] += weight;
    } else {
      this.samples.push(node);
      this.weights.push(weight);
    }
  }

  build() {
    this.duration = Math.max(this.duration, this.weights.reduce((a, b) => a + b, 0)); // We had no frames with duration > 0, so set min duration to timeline duration
    // which effectively disables any zooming on the flamegraphs

    if (this.minFrameDuration === Number.POSITIVE_INFINITY || this.minFrameDuration === 0) {
      this.minFrameDuration = this.duration;
    }

    return this;
  }

}

/***/ }),

/***/ "./app/utils/profiling/profile/profile.tsx":
/*!*************************************************!*\
  !*** ./app/utils/profiling/profile/profile.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Profile": () => (/* binding */ Profile)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _callTreeNode__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../callTreeNode */ "./app/utils/profiling/callTreeNode.tsx");
/* harmony import */ var _frame__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../frame */ "./app/utils/profiling/frame.tsx");





// This is a simplified port of speedscope's profile with a few simplifications and some removed functionality + some added functionality.
// head at commit e37f6fa7c38c110205e22081560b99cb89ce885e
// We should try and remove these as we adopt our own profile format and only rely on the sampled format.
class Profile {
  // Duration of the profile
  // Started at ts of the profile - varies between implementations of the profiler.
  // For JS self profiles, this is the time origin (https://www.w3.org/TR/hr-time-2/#dfn-time-origin), for others it's epoch time
  // Ended at ts of the profile - varies between implementations of the profiler.
  // For JS self profiles, this is the time origin (https://www.w3.org/TR/hr-time-2/#dfn-time-origin), for others it's epoch time
  // Unit in which the timings are reported in
  // Name of the profile
  // Min duration of the profile
  constructor(duration, startedAt, endedAt, name, unit, threadId) {
    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "duration", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "startedAt", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "endedAt", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "threadId", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "unit", 'microseconds');

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "name", 'Unknown');

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "appendOrderTree", new _callTreeNode__WEBPACK_IMPORTED_MODULE_3__.CallTreeNode(_frame__WEBPACK_IMPORTED_MODULE_4__.Frame.Root, null));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "framesInStack", new Set());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "minFrameDuration", Number.POSITIVE_INFINITY);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "samples", []);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "weights", []);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "stats", {
      discardedSamplesCount: 0,
      negativeSamplesCount: 0
    });

    this.threadId = threadId;
    this.duration = duration;
    this.startedAt = startedAt;
    this.endedAt = endedAt;
    this.name = name;
    this.unit = unit;
  }

  static Empty() {
    return new Profile(1000, 0, 1000, '', 'milliseconds', 0).build();
  }

  trackSampleStats(duration) {
    // Keep track of discarded samples and ones that may have negative weights
    if (duration === 0) {
      this.stats.discardedSamplesCount++;
    }

    if (duration < 0) {
      this.stats.negativeSamplesCount++;
    }
  }

  forEach(openFrame, closeFrame) {
    let prevStack = [];
    let value = 0;
    let sampleIndex = 0;

    for (const stackTop of this.samples) {
      let top = stackTop;

      while (top && !top.isRoot() && prevStack.indexOf(top) === -1) {
        top = top.parent;
      }

      while (prevStack.length > 0 && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.lastOfArray)(prevStack) !== top) {
        const node = prevStack.pop();
        closeFrame(node, value);
      }

      const toOpen = [];
      let node = stackTop;

      while (node && !node.isRoot() && node !== top) {
        toOpen.unshift(node);
        node = node.parent;
      }

      for (const toOpenNode of toOpen) {
        openFrame(toOpenNode, value);
      }

      prevStack = prevStack.concat(toOpen);
      value += this.weights[sampleIndex++];
    }

    for (let i = prevStack.length - 1; i >= 0; i--) {
      closeFrame(prevStack[i], value);
    }
  }

  build() {
    this.duration = Math.max(this.duration, this.weights.reduce((a, b) => a + b, 0)); // We had no frames with duration > 0, so set min duration to timeline duration
    // which effectively disables any zooming on the flamegraphs

    if (this.minFrameDuration === Number.POSITIVE_INFINITY || this.minFrameDuration === 0) {
      this.minFrameDuration = this.duration;
    }

    return this;
  }

}

/***/ }),

/***/ "./app/utils/profiling/profile/sampledProfile.tsx":
/*!********************************************************!*\
  !*** ./app/utils/profiling/profile/sampledProfile.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SampledProfile": () => (/* binding */ SampledProfile)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_profiling_callTreeNode__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/profiling/callTreeNode */ "./app/utils/profiling/callTreeNode.tsx");
/* harmony import */ var _profile__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./profile */ "./app/utils/profiling/profile/profile.tsx");





// This is a simplified port of speedscope's profile with a few simplifications and some removed functionality.
// head at commit e37f6fa7c38c110205e22081560b99cb89ce885e
// We should try and remove these as we adopt our own profile format and only rely on the sampled format.
class SampledProfile extends _profile__WEBPACK_IMPORTED_MODULE_4__.Profile {
  static FromProfile(sampledProfile, frameIndex) {
    const profile = new SampledProfile(sampledProfile.endValue - sampledProfile.startValue, sampledProfile.startValue, sampledProfile.endValue, sampledProfile.name, sampledProfile.unit, sampledProfile.threadID);

    if (sampledProfile.samples.length !== sampledProfile.weights.length) {
      throw new Error(`Expected samples.length (${sampledProfile.samples.length}) to equal weights.length (${sampledProfile.weights.length})`);
    }

    for (let i = 0; i < sampledProfile.samples.length; i++) {
      const stack = sampledProfile.samples[i];
      const weight = sampledProfile.weights[i];
      profile.appendSampleWithWeight(stack.map(n => {
        if (!frameIndex[n]) {
          throw new Error(`Could not resolve frame ${n} in frame index`);
        }

        return frameIndex[n];
      }), weight);
    }

    return profile.build();
  }

  appendSampleWithWeight(stack, weight) {
    // Keep track of discarded samples and ones that may have negative weights
    this.trackSampleStats(weight); // Ignore samples with 0 weight

    if (weight === 0) {
      return;
    }

    let node = this.appendOrderTree;
    const framesInStack = [];

    for (const frame of stack) {
      const last = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.lastOfArray)(node.children); // Find common frame between two stacks

      if (last && !last.isLocked() && last.frame === frame) {
        node = last;
      } else {
        const parent = node;
        node = new sentry_utils_profiling_callTreeNode__WEBPACK_IMPORTED_MODULE_3__.CallTreeNode(frame, node);
        parent.children.push(node);
      }

      node.addToTotalWeight(weight); // TODO: This is On^2, because we iterate over all frames in the stack to check if our
      // frame is a recursive frame. We could do this in O(1) by keeping a map of frames in the stack
      // We check the stack in a top-down order to find the first recursive frame.

      let start = framesInStack.length - 1;

      while (start >= 0) {
        if (framesInStack[start].frame === node.frame) {
          // The recursion edge is bidirectional
          framesInStack[start].setRecursiveThroughNode(node);
          node.setRecursiveThroughNode(framesInStack[start]);
          break;
        }

        start--;
      }

      framesInStack.push(node);
    }

    node.addToSelfWeight(weight);
    this.minFrameDuration = Math.min(weight, this.minFrameDuration); // Lock the stack node, so we make sure we dont mutate it in the future.
    // The samples should be ordered by timestamp when processed so we should never
    // iterate over them again in the future.

    for (const child of node.children) {
      child.lock();
    }

    node.frame.addToSelfWeight(weight);

    for (const stackNode of framesInStack) {
      stackNode.frame.addToTotalWeight(weight);
    } // If node is the same as the previous sample, add the weight to the previous sample


    if (node === (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.lastOfArray)(this.samples)) {
      this.weights[this.weights.length - 1] += weight;
    } else {
      this.samples.push(node);
      this.weights.push(weight);
    }
  }

  build() {
    this.duration = Math.max(this.duration, this.weights.reduce((a, b) => a + b, 0)); // We had no frames with duration > 0, so set min duration to timeline duration
    // which effectively disables any zooming on the flamegraphs

    if (this.minFrameDuration === Number.POSITIVE_INFINITY || this.minFrameDuration === 0) {
      this.minFrameDuration = this.duration;
    }

    return this;
  }

}

/***/ }),

/***/ "./app/utils/profiling/profile/utils.tsx":
/*!***********************************************!*\
  !*** ./app/utils/profiling/profile/utils.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "createFrameIndex": () => (/* binding */ createFrameIndex),
/* harmony export */   "invertCallTree": () => (/* binding */ invertCallTree),
/* harmony export */   "isApplicationCall": () => (/* binding */ isApplicationCall),
/* harmony export */   "isSystemCall": () => (/* binding */ isSystemCall),
/* harmony export */   "memoizeByReference": () => (/* binding */ memoizeByReference),
/* harmony export */   "memoizeVariadicByReference": () => (/* binding */ memoizeVariadicByReference),
/* harmony export */   "wrapWithSpan": () => (/* binding */ wrapWithSpan)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_profiling_frame__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/profiling/frame */ "./app/utils/profiling/frame.tsx");



function createFrameIndex(frames, trace) {
  if (trace) {
    return frames.reduce((acc, frame, index) => {
      acc[index] = new sentry_utils_profiling_frame__WEBPACK_IMPORTED_MODULE_2__.Frame({
        key: index,
        resource: frame.resourceId !== undefined ? trace.resources[frame.resourceId] : undefined,
        ...frame
      }, 'web');
      return acc;
    }, {});
  }

  return frames.reduce((acc, frame, index) => {
    acc[index] = new sentry_utils_profiling_frame__WEBPACK_IMPORTED_MODULE_2__.Frame({
      key: index,
      ...frame
    });
    return acc;
  }, {});
}
function memoizeByReference(fn) {
  let cache = null;
  return function memoizeByReferenceCallback(args) {
    // If this is the first run then eval the fn and cache the result
    if (!cache) {
      cache = {
        args,
        value: fn(args)
      };
      return cache.value;
    } // If args match by reference, then return cached value


    if (cache.args === args && cache.args !== undefined && args !== undefined) {
      return cache.value;
    } // Else eval the fn and store the new value


    cache.args = args;
    cache.value = fn(args);
    return cache.value;
  };
}
function memoizeVariadicByReference(fn) {
  let cache = null;
  return function memoizeByReferenceCallback() {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    // If this is the first run then eval the fn and cache the result
    if (!cache) {
      cache = {
        args,
        value: fn(...args)
      };
      return cache.value;
    } // If args match by reference, then return cached value


    if (cache.args.length === args.length && cache.args.length !== 0 && args.length !== 0 && args.every((arg, i) => {
      var _cache;

      return arg === ((_cache = cache) === null || _cache === void 0 ? void 0 : _cache.args[i]);
    })) {
      return cache.value;
    } // Else eval the fn and store the new value


    cache.args = args;
    cache.value = fn(...args);
    return cache.value;
  };
}
function wrapWithSpan(parentSpan, fn, options) {
  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(parentSpan)) {
    return fn();
  }

  const sentrySpan = parentSpan.startChild(options);

  try {
    return fn();
  } catch (error) {
    sentrySpan.setStatus('internal_error');
    throw error;
  } finally {
    sentrySpan.finish();
  }
}
const isSystemCall = node => {
  return !node.frame.is_application;
};
const isApplicationCall = node => {
  return !!node.frame.is_application;
};

function indexNodeToParents(roots, map, leafs) {
  // Index each child node to its parent
  function indexNode(node, parent) {
    if (!map[node.key]) {
      map[node.key] = [];
    }

    map[node.key].push(parent);

    if (!node.children.length) {
      leafs.push(node);
      return;
    }

    for (let i = 0; i < node.children.length; i++) {
      indexNode(node.children[i], node);
    }
  } // Begin in each root node


  for (let i = 0; i < roots.length; i++) {
    var _roots$i$children;

    // If the root is a leaf node, push it to the leafs array
    if (!((_roots$i$children = roots[i].children) !== null && _roots$i$children !== void 0 && _roots$i$children.length)) {
      leafs.push(roots[i]);
    } // Init the map for the root in case we havent yet


    if (!map[roots[i].key]) {
      map[roots[i].key] = [];
    } // descend down to each child and index them


    for (let j = 0; j < roots[i].children.length; j++) {
      indexNode(roots[i].children[j], roots[i]);
    }
  }
}

function reverseTrail(nodes, parentMap) {
  const splits = [];

  for (const n of nodes) {
    const nc = { ...n,
      parent: null,
      children: []
    };

    if (!parentMap[n.key]) {
      continue;
    }

    for (const parent of parentMap[n.key]) {
      nc.children.push(...reverseTrail([parent], parentMap));
    }

    splits.push(nc);
  }

  return splits;
}

const invertCallTree = roots => {
  const nodeToParentIndex = {};
  const leafNodes = [];
  indexNodeToParents(roots, nodeToParentIndex, leafNodes);
  const reversed = reverseTrail(leafNodes, nodeToParentIndex);
  return reversed;
};

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

/***/ "./app/utils/profiling/weightedNode.tsx":
/*!**********************************************!*\
  !*** ./app/utils/profiling/weightedNode.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "WeightedNode": () => (/* binding */ WeightedNode)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");


/**
 * This is a utility class for profiling (inspired from Speedscope) - we extend it in order to be able to construct
 * a stack of nodes (or call trees) and append weights to them.
 */
class WeightedNode {
  constructor() {
    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "totalWeight", 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "selfWeight", 0);
  }

  addToTotalWeight(delta) {
    this.totalWeight += delta;
    return this.totalWeight;
  }

  addToSelfWeight(delta) {
    this.selfWeight += delta;
    return this.selfWeight;
  }

}

/***/ }),

/***/ "./app/utils/useLocation.tsx":
/*!***********************************!*\
  !*** ./app/utils/useLocation.tsx ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useLocation": () => (/* binding */ useLocation)
/* harmony export */ });
/* harmony import */ var sentry_utils_useRouteContext__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/useRouteContext */ "./app/utils/useRouteContext.tsx");

function useLocation() {
  const route = (0,sentry_utils_useRouteContext__WEBPACK_IMPORTED_MODULE_0__.useRouteContext)();
  return route.location;
}

/***/ }),

/***/ "./app/utils/useParams.tsx":
/*!*********************************!*\
  !*** ./app/utils/useParams.tsx ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useParams": () => (/* binding */ useParams)
/* harmony export */ });
/* harmony import */ var sentry_utils_useRouteContext__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/useRouteContext */ "./app/utils/useRouteContext.tsx");

function useParams() {
  const route = (0,sentry_utils_useRouteContext__WEBPACK_IMPORTED_MODULE_0__.useRouteContext)();
  return route.params;
}

/***/ }),

/***/ "./app/views/profiling/profileGroupProvider.tsx":
/*!******************************************************!*\
  !*** ./app/views/profiling/profileGroupProvider.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "useProfileGroup": () => (/* binding */ useProfileGroup)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_components_profiling_profileHeader__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/profiling/profileHeader */ "./app/components/profiling/profileHeader.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_profiling_profile_importProfile__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/profiling/profile/importProfile */ "./app/utils/profiling/profile/importProfile.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var sentry_utils_useParams__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/useParams */ "./app/utils/useParams.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













function fetchFlamegraphs(api, eventId, projectId, organization) {
  return api.requestPromise(`/projects/${organization.slug}/${projectId}/profiling/profiles/${eventId}/`, {
    method: 'GET',
    includeAllArgs: true
  }).then(_ref => {
    let [data] = _ref;
    return (0,sentry_utils_profiling_profile_importProfile__WEBPACK_IMPORTED_MODULE_5__.importProfile)(data, eventId);
  });
}

const ProfileGroupContext = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_2__.createContext)(null);
const useProfileGroup = () => {
  const context = (0,react__WEBPACK_IMPORTED_MODULE_2__.useContext)(ProfileGroupContext);

  if (!context) {
    throw new Error('useProfileGroup was called outside of ProfileGroupProvider');
  }

  return context;
};

function ProfileGroupProvider(props) {
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_6__["default"])();
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_7__["default"])();
  const params = (0,sentry_utils_useParams__WEBPACK_IMPORTED_MODULE_8__.useParams)();
  const [profileGroupState, setProfileGroupState] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)({
    type: 'initial'
  });
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (!params.eventId || !params.projectId) {
      return undefined;
    }

    setProfileGroupState({
      type: 'loading'
    });
    fetchFlamegraphs(api, params.eventId, params.projectId, organization).then(importedFlamegraphs => {
      setProfileGroupState({
        type: 'resolved',
        data: importedFlamegraphs
      });
    }).catch(err => {
      const message = err.toString() || (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Error: Unable to load profiles');
      setProfileGroupState({
        type: 'errored',
        error: message
      });
      _sentry_react__WEBPACK_IMPORTED_MODULE_9__.captureException(err);
    });
    return () => {
      api.clear();
    };
  }, [params.eventId, params.projectId, api, organization]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(ProfileGroupContext.Provider, {
    value: [profileGroupState, setProfileGroupState],
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_profiling_profileHeader__WEBPACK_IMPORTED_MODULE_3__.ProfileHeader, {}), props.children]
  });
}

ProfileGroupProvider.displayName = "ProfileGroupProvider";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProfileGroupProvider);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_profiling_profileHeader_tsx-app_views_profiling_profileGroupProvider_tsx.1fb7de83192924ab3d11e976fa82f143.js.map