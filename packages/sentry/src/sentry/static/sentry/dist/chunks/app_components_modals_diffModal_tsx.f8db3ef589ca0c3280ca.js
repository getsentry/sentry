"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_modals_diffModal_tsx"],{

/***/ "./app/components/events/interfaces/crashContent/stackTrace/rawContent.tsx":
/*!*********************************************************************************!*\
  !*** ./app/components/events/interfaces/crashContent/stackTrace/rawContent.tsx ***!
  \*********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ render),
/* harmony export */   "getJavaFrame": () => (/* binding */ getJavaFrame),
/* harmony export */   "getJavaPreamble": () => (/* binding */ getJavaPreamble),
/* harmony export */   "getNativeFrame": () => (/* binding */ getNativeFrame),
/* harmony export */   "getPHPFrame": () => (/* binding */ getPHPFrame),
/* harmony export */   "getPythonFrame": () => (/* binding */ getPythonFrame)
/* harmony export */ });
/* harmony import */ var sentry_components_events_interfaces_frame_utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/events/interfaces/frame/utils */ "./app/components/events/interfaces/frame/utils.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");



function getJavaScriptFrame(frame) {
  let result = '';

  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(frame.function)) {
    result += '  at ' + frame.function + '(';
  } else {
    result += '  at ? (';
  }

  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(frame.filename)) {
    result += frame.filename;
  } else if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(frame.module)) {
    result += frame.module;
  }

  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(frame.lineNo) && frame.lineNo >= 0) {
    result += ':' + frame.lineNo;
  }

  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(frame.colNo) && frame.colNo >= 0) {
    result += ':' + frame.colNo;
  }

  result += ')';
  return result;
}

function getRubyFrame(frame) {
  let result = '  from ';

  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(frame.filename)) {
    result += frame.filename;
  } else if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(frame.module)) {
    result += '(' + frame.module + ')';
  } else {
    result += '?';
  }

  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(frame.lineNo) && frame.lineNo >= 0) {
    result += ':' + frame.lineNo;
  }

  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(frame.colNo) && frame.colNo >= 0) {
    result += ':' + frame.colNo;
  }

  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(frame.function)) {
    result += ':in `' + frame.function + "'";
  }

  return result;
}

function getPHPFrame(frame, idx) {
  const funcName = frame.function === 'null' ? '{main}' : frame.function;
  return `#${idx} ${frame.filename || frame.module}(${frame.lineNo}): ${funcName}`;
}
function getPythonFrame(frame) {
  let result = '';

  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(frame.filename)) {
    result += '  File "' + frame.filename + '"';
  } else if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(frame.module)) {
    result += '  Module "' + frame.module + '"';
  } else {
    result += '  ?';
  }

  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(frame.lineNo) && frame.lineNo >= 0) {
    result += ', line ' + frame.lineNo;
  }

  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(frame.colNo) && frame.colNo >= 0) {
    result += ', col ' + frame.colNo;
  }

  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(frame.function)) {
    result += ', in ' + frame.function;
  }

  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(frame.context)) {
    frame.context.forEach(item => {
      if (item[0] === frame.lineNo) {
        result += '\n    ' + (0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.trim)(item[1]);
      }
    });
  }

  return result;
}
function getJavaFrame(frame) {
  let result = '    at';

  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(frame.module)) {
    result += ' ' + frame.module + '.';
  }

  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(frame.function)) {
    result += frame.function;
  }

  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(frame.filename)) {
    result += '(' + frame.filename;

    if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(frame.lineNo) && frame.lineNo >= 0) {
      result += ':' + frame.lineNo;
    }

    result += ')';
  }

  return result;
}

function ljust(str, len) {
  return str + Array(Math.max(0, len - str.length) + 1).join(' ');
}

function getNativeFrame(frame) {
  let result = '  ';

  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(frame.package)) {
    result += ljust((0,sentry_components_events_interfaces_frame_utils__WEBPACK_IMPORTED_MODULE_0__.trimPackage)(frame.package), 20);
  }

  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(frame.instructionAddr)) {
    result += ljust(frame.instructionAddr, 12);
  }

  result += ' ' + (frame.function || frame.symbolAddr);

  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(frame.filename)) {
    result += ' (' + frame.filename;

    if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(frame.lineNo) && frame.lineNo >= 0) {
      result += ':' + frame.lineNo;
    }

    result += ')';
  }

  return result;
}
function getJavaPreamble(exception) {
  let result = `${exception.type}: ${exception.value}`;

  if (exception.module) {
    result = `${exception.module}.${result}`;
  }

  return result;
}

function getPreamble(exception, platform) {
  switch (platform) {
    case 'java':
      return getJavaPreamble(exception);

    default:
      return exception.type + ': ' + exception.value;
  }
}

function getFrame(frame, frameIdx, platform) {
  if (frame.platform) {
    platform = frame.platform;
  }

  switch (platform) {
    case 'javascript':
      return getJavaScriptFrame(frame);

    case 'ruby':
      return getRubyFrame(frame);

    case 'php':
      return getPHPFrame(frame, frameIdx);

    case 'python':
      return getPythonFrame(frame);

    case 'java':
      return getJavaFrame(frame);

    case 'objc': // fallthrough

    case 'cocoa': // fallthrough

    case 'native':
      return getNativeFrame(frame);

    default:
      return getPythonFrame(frame);
  }
}

function render(data, platform, exception) {
  var _data$frames;

  const frames = [];
  ((_data$frames = data === null || data === void 0 ? void 0 : data.frames) !== null && _data$frames !== void 0 ? _data$frames : []).forEach((frame, frameIdx) => {
    frames.push(getFrame(frame, frameIdx, platform));
  });

  if (platform !== 'python') {
    frames.reverse();
  }

  if (exception) {
    frames.unshift(getPreamble(exception, platform));
  }

  return frames.join('\n');
}

/***/ }),

/***/ "./app/components/events/interfaces/frame/utils.tsx":
/*!**********************************************************!*\
  !*** ./app/components/events/interfaces/frame/utils.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getFrameHint": () => (/* binding */ getFrameHint),
/* harmony export */   "getPlatform": () => (/* binding */ getPlatform),
/* harmony export */   "hasAssembly": () => (/* binding */ hasAssembly),
/* harmony export */   "hasContextRegisters": () => (/* binding */ hasContextRegisters),
/* harmony export */   "hasContextSource": () => (/* binding */ hasContextSource),
/* harmony export */   "hasContextVars": () => (/* binding */ hasContextVars),
/* harmony export */   "isDotnet": () => (/* binding */ isDotnet),
/* harmony export */   "isExpandable": () => (/* binding */ isExpandable),
/* harmony export */   "trimPackage": () => (/* binding */ trimPackage)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../types */ "./app/components/events/interfaces/types.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function trimPackage(pkg) {
  const pieces = pkg.split(/^([a-z]:\\|\\\\)/i.test(pkg) ? '\\' : '/');
  const filename = pieces[pieces.length - 1] || pieces[pieces.length - 2] || pkg;
  return filename.replace(/\.(dylib|so|a|dll|exe)$/, '');
}
function getPlatform(dataPlatform, platform) {
  // prioritize the frame platform but fall back to the platform
  // of the stack trace / exception
  return dataPlatform || platform;
}
function getFrameHint(frame) {
  // returning [hintText, hintIcon]
  const {
    symbolicatorStatus
  } = frame;
  const func = frame.function || '<unknown>'; // Custom color used to match adjacent text.

  const warningIcon = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_1__.IconQuestion, {
    size: "xs",
    color: '#2c45a8'
  });

  const errorIcon = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_1__.IconWarning, {
    size: "xs",
    color: "red300"
  });

  if (func.match(/^@objc\s/)) {
    return [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Objective-C -> Swift shim frame'), warningIcon];
  }

  if (func.match(/^__?hidden#\d+/)) {
    return [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Hidden function from bitcode build'), errorIcon];
  }

  if (!symbolicatorStatus && func === '<unknown>') {
    // Only render this if the event was not symbolicated.
    return [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('No function name was supplied by the client SDK.'), warningIcon];
  }

  if (func === '<unknown>' || func === '<redacted>' && symbolicatorStatus === _types__WEBPACK_IMPORTED_MODULE_4__.SymbolicatorStatus.MISSING_SYMBOL) {
    switch (symbolicatorStatus) {
      case _types__WEBPACK_IMPORTED_MODULE_4__.SymbolicatorStatus.MISSING_SYMBOL:
        return [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('The symbol was not found within the debug file.'), warningIcon];

      case _types__WEBPACK_IMPORTED_MODULE_4__.SymbolicatorStatus.UNKNOWN_IMAGE:
        return [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('No image is specified for the address of the frame.'), warningIcon];

      case _types__WEBPACK_IMPORTED_MODULE_4__.SymbolicatorStatus.MISSING:
        return [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('The debug file could not be retrieved from any of the sources.'), errorIcon];

      case _types__WEBPACK_IMPORTED_MODULE_4__.SymbolicatorStatus.MALFORMED:
        return [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('The retrieved debug file could not be processed.'), errorIcon];

      default:
    }
  }

  if (func === '<redacted>') {
    return [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Unknown system frame. Usually from beta SDKs'), warningIcon];
  }

  return [null, null];
}
function isDotnet(platform) {
  // csharp platform represents .NET and can be F#, VB or any language targeting CLS (the Common Language Specification)
  return platform === 'csharp';
}
function hasContextSource(frame) {
  return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_3__.defined)(frame.context) && !!frame.context.length;
}
function hasContextVars(frame) {
  return !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_3__.objectIsEmpty)(frame.vars || {});
}
function hasContextRegisters(registers) {
  return !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_3__.objectIsEmpty)(registers);
}
function hasAssembly(frame, platform) {
  return isDotnet(getPlatform(frame.platform, platform !== null && platform !== void 0 ? platform : 'other')) && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_3__.defined)(frame.package);
}
function isExpandable(_ref) {
  let {
    frame,
    registers,
    emptySourceNotation,
    platform,
    isOnlyFrame
  } = _ref;
  return !isOnlyFrame && emptySourceNotation || hasContextSource(frame) || hasContextVars(frame) || hasContextRegisters(registers) || hasAssembly(frame, platform);
}

/***/ }),

/***/ "./app/components/events/interfaces/types.tsx":
/*!****************************************************!*\
  !*** ./app/components/events/interfaces/types.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SymbolicatorStatus": () => (/* binding */ SymbolicatorStatus)
/* harmony export */ });
let SymbolicatorStatus;

(function (SymbolicatorStatus) {
  SymbolicatorStatus["SYMBOLICATED"] = "symbolicated";
  SymbolicatorStatus["MISSING_SYMBOL"] = "missing_symbol";
  SymbolicatorStatus["UNKNOWN_IMAGE"] = "unknown_image";
  SymbolicatorStatus["MISSING"] = "missing";
  SymbolicatorStatus["MALFORMED"] = "malformed";
})(SymbolicatorStatus || (SymbolicatorStatus = {}));

/***/ }),

/***/ "./app/components/issueDiff/index.tsx":
/*!********************************************!*\
  !*** ./app/components/issueDiff/index.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "IssueDiff": () => (/* binding */ IssueDiff),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_is_prop_valid__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/is-prop-valid */ "../node_modules/@emotion/is-prop-valid/dist/is-prop-valid.browser.esm.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_getStacktraceBody__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/getStacktraceBody */ "./app/utils/getStacktraceBody.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _renderGroupingInfo__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./renderGroupingInfo */ "./app/components/issueDiff/renderGroupingInfo.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");

















const defaultProps = {
  baseEventId: 'latest',
  targetEventId: 'latest'
};

class IssueDiff extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      loading: true,
      groupingDiff: false,
      baseEvent: [],
      targetEvent: [],
      // `SplitDiffAsync` is an async-loaded component
      // This will eventually contain a reference to the exported component from `./splitDiff`
      SplitDiffAsync: undefined
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "toggleDiffMode", () => {
      this.setState(state => ({
        groupingDiff: !state.groupingDiff,
        loading: true
      }), this.fetchData);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchEventData", async (issueId, eventId) => {
      const {
        orgId,
        project,
        api
      } = this.props;
      const {
        groupingDiff
      } = this.state;
      let paramEventId = eventId;

      if (eventId === 'latest') {
        const event = await api.requestPromise(`/issues/${issueId}/events/latest/`);
        paramEventId = event.eventID;
      }

      if (groupingDiff) {
        const groupingInfo = await api.requestPromise(`/projects/${orgId}/${project.slug}/events/${paramEventId}/grouping-info/`);
        return (0,_renderGroupingInfo__WEBPACK_IMPORTED_MODULE_14__["default"])(groupingInfo);
      }

      const event = await api.requestPromise(`/projects/${orgId}/${project.slug}/events/${paramEventId}/`);
      return (0,sentry_utils_getStacktraceBody__WEBPACK_IMPORTED_MODULE_12__["default"])(event);
    });
  }

  componentDidMount() {
    this.fetchData();
  }

  fetchData() {
    const {
      baseIssueId,
      targetIssueId,
      baseEventId,
      targetEventId
    } = this.props; // Fetch component and event data

    Promise.all([Promise.all(/*! import() */[__webpack_require__.e("vendors-node_modules_diff_lib_index_mjs"), __webpack_require__.e("app_components_splitDiff_tsx")]).then(__webpack_require__.bind(__webpack_require__, /*! ../splitDiff */ "./app/components/splitDiff.tsx")), this.fetchEventData(baseIssueId, baseEventId !== null && baseEventId !== void 0 ? baseEventId : 'latest'), this.fetchEventData(targetIssueId, targetEventId !== null && targetEventId !== void 0 ? targetEventId : 'latest')]).then(_ref => {
      let [{
        default: SplitDiffAsync
      }, baseEvent, targetEvent] = _ref;
      this.setState({
        SplitDiffAsync,
        baseEvent,
        targetEvent,
        loading: false
      });
    }).catch(() => {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Error loading events'));
    });
  }

  render() {
    const {
      className,
      project
    } = this.props;
    const {
      SplitDiffAsync: DiffComponent,
      loading,
      groupingDiff,
      baseEvent,
      targetEvent
    } = this.state;
    const showDiffToggle = project.features.includes('similarity-view-v2');
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(StyledIssueDiff, {
      className: className,
      loading: loading,
      children: [loading && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_9__["default"], {}), !loading && showDiffToggle && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(HeaderWrapper, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_8__["default"], {
          merged: true,
          active: groupingDiff ? 'grouping' : 'event',
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
            barId: "event",
            size: "sm",
            onClick: this.toggleDiffMode,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Diff stack trace and message')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
            barId: "grouping",
            size: "sm",
            onClick: this.toggleDiffMode,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Diff grouping information')
          })]
        })
      }), !loading && DiffComponent && baseEvent.map((value, i) => {
        var _targetEvent$i;

        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(DiffComponent, {
          base: value,
          target: (_targetEvent$i = targetEvent[i]) !== null && _targetEvent$i !== void 0 ? _targetEvent$i : '',
          type: "words"
        }, i);
      })]
    });
  }

}

IssueDiff.displayName = "IssueDiff";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(IssueDiff, "defaultProps", defaultProps);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_13__["default"])(IssueDiff)); // required for tests which do not provide API as context



const StyledIssueDiff = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  shouldForwardProp: p => typeof p === 'string' && (0,_emotion_is_prop_valid__WEBPACK_IMPORTED_MODULE_5__["default"])(p) && p !== 'loading',
  target: "ectlbkf1"
} : 0)("background-color:", p => p.theme.backgroundSecondary, ";overflow:auto;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(1), ";flex:1;display:flex;flex-direction:column;", p => p.loading && `
        background-color: ${p.theme.background};
        justify-content: center;
        align-items: center;
      `, ";" + ( true ? "" : 0));

const HeaderWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ectlbkf0"
} : 0)("display:flex;align-items:center;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(2), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/issueDiff/renderGroupingInfo.tsx":
/*!*********************************************************!*\
  !*** ./app/components/issueDiff/renderGroupingInfo.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");



function renderGroupingInfo(groupingInfo) {
  return Object.values(groupingInfo).map(renderGroupVariant).flat();
}

function renderGroupVariant(variant) {
  const title = [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Type: %s', variant.type)];

  if (variant.hash) {
    title.push((0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Hash: %s', variant.hash));
  }

  if (variant.description) {
    title.push((0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Description: %s', variant.description));
  }

  const rv = [title.join('\n')];

  if (variant.component) {
    rv.push(renderComponent(variant.component).join('\n'));
  }

  return rv;
}

function renderComponent(component) {
  if (!component.contributes) {
    return [];
  }

  const {
    name,
    id,
    hint
  } = component;
  const name_or_id = name || id;
  const title = name_or_id && hint ? `${name_or_id} (${hint})` : name_or_id;
  const rv = title ? [title] : [];

  if (component.values) {
    for (const value of component.values) {
      if (typeof value === 'string') {
        rv.push(`  ${value}`);
        continue;
      }

      for (const line of renderComponent(value)) {
        rv.push(`  ${line}`);
      }
    }
  }

  return rv;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (renderGroupingInfo);

/***/ }),

/***/ "./app/components/modals/diffModal.tsx":
/*!*********************************************!*\
  !*** ./app/components/modals/diffModal.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "modalCss": () => (/* binding */ modalCss)
/* harmony export */ });
/* harmony import */ var sentry_components_issueDiff__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/issueDiff */ "./app/components/issueDiff/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






const DiffModal = _ref => {
  let {
    className,
    Body,
    CloseButton,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxs)(Body, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)(CloseButton, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)(sentry_components_issueDiff__WEBPACK_IMPORTED_MODULE_0__["default"], {
      className: className,
      ...props
    })]
  });
};

DiffModal.displayName = "DiffModal";
const modalCss =  true ? {
  name: "1s9ys09",
  styles: "position:absolute;left:20px;right:20px;top:20px;bottom:20px;display:flex;padding:0;width:auto;[role='document']{overflow:scroll;height:100%;display:flex;flex:1;}section{display:flex;width:100%;}"
} : 0;

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DiffModal);

/***/ }),

/***/ "./app/utils/getStacktraceBody.tsx":
/*!*****************************************!*\
  !*** ./app/utils/getStacktraceBody.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ getStacktraceBody)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_components_events_interfaces_crashContent_stackTrace_rawContent__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/events/interfaces/crashContent/stackTrace/rawContent */ "./app/components/events/interfaces/crashContent/stackTrace/rawContent.tsx");


function getStacktraceBody(event) {
  if (!event || !event.entries) {
    return [];
  } // TODO(billyvg): This only accounts for the first exception, will need navigation to be able to
  // diff multiple exceptions
  //
  // See: https://github.com/getsentry/sentry/issues/6055


  const exc = event.entries.find(_ref => {
    let {
      type
    } = _ref;
    return type === 'exception';
  });

  if (!exc) {
    var _msg$data;

    // Look for a message if not an exception
    const msg = event.entries.find(_ref2 => {
      let {
        type
      } = _ref2;
      return type === 'message';
    });

    if (!msg) {
      return [];
    }

    return (msg === null || msg === void 0 ? void 0 : (_msg$data = msg.data) === null || _msg$data === void 0 ? void 0 : _msg$data.formatted) && [msg.data.formatted];
  }

  if (!exc.data) {
    return [];
  } // TODO(ts): This should be verified when EntryData has the correct type


  return exc.data.values.filter(value => !!value.stacktrace).map(value => (0,sentry_components_events_interfaces_crashContent_stackTrace_rawContent__WEBPACK_IMPORTED_MODULE_1__["default"])(value.stacktrace, event.platform, value)).reduce((acc, value) => acc.concat(value), []);
}

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
//# sourceMappingURL=../sourcemaps/app_components_modals_diffModal_tsx.44e952d7fbe70fbce6a6fbd1e67ce3b4.js.map