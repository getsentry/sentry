"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_events_eventTags_eventTagsPill_tsx-app_components_events_interfaces_spans_anch-85b5a4"],{

/***/ "./app/components/deviceName.tsx":
/*!***************************************!*\
  !*** ./app/components/deviceName.tsx ***!
  \***************************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DeviceName": () => (/* binding */ DeviceName),
/* harmony export */   "deviceNameMapper": () => (/* binding */ deviceNameMapper)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_constants_ios_device_list__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/constants/ios-device-list */ "./app/constants/ios-device-list.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
/* module decorator */ module = __webpack_require__.hmd(module);




function deviceNameMapper(model) {
  // If we have no model, render nothing
  if (typeof model !== 'string') {
    return null;
  } // If module has not loaded yet, render the unparsed model


  if (module === null) {
    return model;
  }

  const [identifier, ...rest] = model.split(' ');
  const modelName = sentry_constants_ios_device_list__WEBPACK_IMPORTED_MODULE_2__.iOSDeviceMapping[identifier];
  return modelName === undefined ? model : `${modelName} ${rest.join(' ')}`;
}

/**
 * This is used to map iOS Device Names to model name.
 * This asynchronously loads the ios-device-list library because of its size
 */
function DeviceName(_ref) {
  let {
    value,
    children
  } = _ref;
  const deviceName = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => deviceNameMapper(value), [value]);
  return deviceName ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
    "data-test-id": "loaded-device-name",
    children: children ? children(deviceName) : deviceName
  }) : null;
}



/***/ }),

/***/ "./app/components/events/eventTags/eventTagsPill.tsx":
/*!***********************************************************!*\
  !*** ./app/components/events/eventTags/eventTagsPill.tsx ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var sentry_components_events_meta_annotatedText__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/events/meta/annotatedText */ "./app/components/events/meta/annotatedText/index.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_pill__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/pill */ "./app/components/pill.tsx");
/* harmony import */ var sentry_components_version__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/version */ "./app/components/version.tsx");
/* harmony import */ var sentry_components_versionHoverCard__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/versionHoverCard */ "./app/components/versionHoverCard.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _eventTagsPillValue__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./eventTagsPillValue */ "./app/components/events/eventTags/eventTagsPillValue.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }













const iconStyle =  true ? {
  name: "1w4n49d",
  styles: "position:relative;top:1px"
} : 0;

const EventTagsPill = _ref => {
  var _meta$key, _meta$value;

  let {
    tag,
    query,
    organization,
    projectId,
    streamPath,
    meta
  } = _ref;
  const locationSearch = `?${query_string__WEBPACK_IMPORTED_MODULE_0__.stringify(query)}`;
  const {
    key,
    value
  } = tag;
  const name = !key ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_events_meta_annotatedText__WEBPACK_IMPORTED_MODULE_1__["default"], {
    value: key,
    meta: meta === null || meta === void 0 ? void 0 : (_meta$key = meta.key) === null || _meta$key === void 0 ? void 0 : _meta$key['']
  }) : key;
  const type = !key ? 'error' : undefined;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(sentry_components_pill__WEBPACK_IMPORTED_MODULE_3__["default"], {
    name: name,
    value: value,
    type: type,
    children: [key === 'release' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_versionHoverCard__WEBPACK_IMPORTED_MODULE_5__["default"], {
      organization: organization,
      projectSlug: projectId,
      releaseVersion: value,
      showUnderline: true,
      underlineColor: "linkUnderline",
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_version__WEBPACK_IMPORTED_MODULE_4__["default"], {
        version: String(value),
        truncate: true
      })
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_eventTagsPillValue__WEBPACK_IMPORTED_MODULE_8__["default"], {
      tag: tag,
      meta: meta === null || meta === void 0 ? void 0 : (_meta$value = meta.value) === null || _meta$value === void 0 ? void 0 : _meta$value[''],
      streamPath: streamPath,
      locationSearch: locationSearch
    }), (0,sentry_utils__WEBPACK_IMPORTED_MODULE_7__.isUrl)(value) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_2__["default"], {
      href: value,
      className: "external-icon",
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_6__.IconOpen, {
        size: "xs",
        css: iconStyle
      })
    })]
  });
};

EventTagsPill.displayName = "EventTagsPill";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EventTagsPill);

/***/ }),

/***/ "./app/components/events/eventTags/eventTagsPillValue.tsx":
/*!****************************************************************!*\
  !*** ./app/components/events/eventTags/eventTagsPillValue.tsx ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_deviceName__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/deviceName */ "./app/components/deviceName.tsx");
/* harmony import */ var sentry_components_events_meta_annotatedText__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/events/meta/annotatedText */ "./app/components/events/meta/annotatedText/index.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






const EventTagsPillValue = _ref => {
  var _meta$err;

  let {
    tag: {
      key,
      value
    },
    meta,
    streamPath,
    locationSearch
  } = _ref;
  const content = !!meta && !value ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_events_meta_annotatedText__WEBPACK_IMPORTED_MODULE_1__["default"], {
    value: value,
    meta: meta
  }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_deviceName__WEBPACK_IMPORTED_MODULE_0__.DeviceName, {
    value: String(value)
  });

  if (!(meta !== null && meta !== void 0 && (_meta$err = meta.err) !== null && _meta$err !== void 0 && _meta$err.length) && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_3__.defined)(key)) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_2__["default"], {
      to: {
        pathname: streamPath,
        search: locationSearch
      },
      children: content
    });
  }

  return content;
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EventTagsPillValue);

/***/ }),

/***/ "./app/components/events/interfaces/spans/anchorLinkManager.tsx":
/*!**********************************************************************!*\
  !*** ./app/components/events/interfaces/spans/anchorLinkManager.tsx ***!
  \**********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Consumer": () => (/* binding */ Consumer),
/* harmony export */   "Provider": () => (/* binding */ Provider)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




const AnchorLinkManagerContext = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_2__.createContext)({
  registerScrollFn: () => () => undefined,
  scrollToHash: () => undefined
});
class Provider extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "scrollFns", new Map());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "scrollToHash", hash => {
      if (this.scrollFns.has(hash)) {
        const {
          fn,
          isSpanInGroup
        } = this.scrollFns.get(hash);
        fn(); // If the anchored span is part of a group, need to call scrollToHash again, since the initial fn() call will only expand the group.
        // The function gets registered again after the group is expanded, which will allow the page to scroll to the span

        if (isSpanInGroup) {
          // TODO: There's a possibility that this trick may not work when we upgrade to React 18
          setTimeout(() => {
            var _this$scrollFns$get;

            return (_this$scrollFns$get = this.scrollFns.get(hash)) === null || _this$scrollFns$get === void 0 ? void 0 : _this$scrollFns$get.fn();
          });
        }
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "registerScrollFn", (hash, fn, isSpanInGroup) => {
      this.scrollFns.set(hash, {
        fn,
        isSpanInGroup
      });
    });
  }

  componentDidMount() {
    this.scrollToHash(location.hash);
  }

  render() {
    const childrenProps = {
      registerScrollFn: this.registerScrollFn,
      scrollToHash: this.scrollToHash
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(AnchorLinkManagerContext.Provider, {
      value: childrenProps,
      children: this.props.children
    });
  }

}
Provider.displayName = "Provider";
const Consumer = AnchorLinkManagerContext.Consumer;

/***/ }),

/***/ "./app/components/events/interfaces/spans/context.tsx":
/*!************************************************************!*\
  !*** ./app/components/events/interfaces/spans/context.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Consumer": () => (/* binding */ Consumer),
/* harmony export */   "Provider": () => (/* binding */ Provider)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");

const SpanEntryContext = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_0__.createContext)({
  getViewChildTransactionTarget: () => undefined
});
const Provider = SpanEntryContext.Provider;
const Consumer = SpanEntryContext.Consumer;

/***/ }),

/***/ "./app/components/events/interfaces/spans/cursorGuideHandler.tsx":
/*!***********************************************************************!*\
  !*** ./app/components/events/interfaces/spans/cursorGuideHandler.tsx ***!
  \***********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Consumer": () => (/* binding */ Consumer),
/* harmony export */   "Provider": () => (/* binding */ Provider)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/performance/waterfall/utils */ "./app/components/performance/waterfall/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





const CursorGuideManagerContext = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_2__.createContext)({
  showCursorGuide: false,
  mouseLeft: void 0,
  traceViewMouseLeft: void 0,
  displayCursorGuide: () => {},
  hideCursorGuide: () => {}
});
class Provider extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      showCursorGuide: false,
      mouseLeft: void 0,
      traceViewMouseLeft: void 0
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "hasInteractiveLayer", () => !!this.props.interactiveLayerRef.current);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "displayCursorGuide", mousePageX => {
      if (!this.hasInteractiveLayer()) {
        return;
      }

      const {
        trace,
        dragProps
      } = this.props;
      const interactiveLayer = this.props.interactiveLayerRef.current;
      const rect = (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_3__.rectOfContent)(interactiveLayer); // duration of the entire trace in seconds

      const traceDuration = trace.traceEndTimestamp - trace.traceStartTimestamp;
      const viewStart = dragProps.viewWindowStart;
      const viewEnd = dragProps.viewWindowEnd;
      const viewStartTimestamp = trace.traceStartTimestamp + viewStart * traceDuration;
      const viewEndTimestamp = trace.traceEndTimestamp - (1 - viewEnd) * traceDuration;
      const viewDuration = viewEndTimestamp - viewStartTimestamp; // clamp mouseLeft to be within [0, 1]

      const mouseLeft = (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_3__.clamp)((mousePageX - rect.x) / rect.width, 0, 1);
      const duration = mouseLeft * Math.abs(trace.traceEndTimestamp - trace.traceStartTimestamp);
      const startTimestamp = trace.traceStartTimestamp + duration;
      const start = (startTimestamp - viewStartTimestamp) / viewDuration;
      this.setState({
        showCursorGuide: true,
        mouseLeft,
        traceViewMouseLeft: start
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "hideCursorGuide", () => {
      if (!this.hasInteractiveLayer()) {
        return;
      }

      this.setState({
        showCursorGuide: false,
        mouseLeft: void 0,
        traceViewMouseLeft: void 0
      });
    });
  }

  render() {
    const childrenProps = {
      showCursorGuide: this.state.showCursorGuide,
      mouseLeft: this.state.mouseLeft,
      traceViewMouseLeft: this.state.traceViewMouseLeft,
      displayCursorGuide: this.displayCursorGuide,
      hideCursorGuide: this.hideCursorGuide
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(CursorGuideManagerContext.Provider, {
      value: childrenProps,
      children: this.props.children
    });
  }

}
Provider.displayName = "Provider";
const Consumer = CursorGuideManagerContext.Consumer;

/***/ }),

/***/ "./app/components/events/interfaces/spans/dividerHandlerManager.tsx":
/*!**************************************************************************!*\
  !*** ./app/components/events/interfaces/spans/dividerHandlerManager.tsx ***!
  \**************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Consumer": () => (/* binding */ Consumer),
/* harmony export */   "Provider": () => (/* binding */ Provider)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/performance/waterfall/utils */ "./app/components/performance/waterfall/utils.tsx");
/* harmony import */ var sentry_utils_userselect__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/userselect */ "./app/utils/userselect.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




 // divider handle is positioned at 50% width from the left-hand side


const DEFAULT_DIVIDER_POSITION = 0.4;

const selectRefs = (refs, transform) => {
  refs.forEach(ref => {
    if (ref.current) {
      transform(ref.current);
    }
  });
};

const DividerManagerContext = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_2__.createContext)({
  dividerPosition: DEFAULT_DIVIDER_POSITION,
  onDragStart: () => {},
  setHover: () => {},
  addDividerLineRef: () => /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_2__.createRef)(),
  addGhostDividerLineRef: () => /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_2__.createRef)()
});
class Provider extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      dividerPosition: DEFAULT_DIVIDER_POSITION
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "previousUserSelect", null);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "dividerHandlePosition", DEFAULT_DIVIDER_POSITION);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "isDragging", false);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "dividerLineRefs", []);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "ghostDividerLineRefs", []);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "hasInteractiveLayer", () => !!this.props.interactiveLayerRef.current);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "addDividerLineRef", () => {
      const ref = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_2__.createRef)();
      this.dividerLineRefs.push(ref);
      return ref;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "addGhostDividerLineRef", () => {
      const ref = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_2__.createRef)();
      this.ghostDividerLineRefs.push(ref);
      return ref;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "setHover", nextHover => {
      if (this.isDragging) {
        return;
      }

      selectRefs(this.dividerLineRefs, dividerDOM => {
        if (nextHover) {
          dividerDOM.classList.add('hovering');
          return;
        }

        dividerDOM.classList.remove('hovering');
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onDragStart", event => {
      if (this.isDragging || event.type !== 'mousedown' || !this.hasInteractiveLayer()) {
        return;
      }

      event.stopPropagation(); // prevent the user from selecting things outside the minimap when dragging
      // the mouse cursor inside the minimap

      this.previousUserSelect = (0,sentry_utils_userselect__WEBPACK_IMPORTED_MODULE_4__.setBodyUserSelect)({
        userSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        webkitUserSelect: 'none'
      }); // attach event listeners so that the mouse cursor does not select text during a drag

      window.addEventListener('mousemove', this.onDragMove);
      window.addEventListener('mouseup', this.onDragEnd);
      this.setHover(true); // indicate drag has begun

      this.isDragging = true;
      selectRefs(this.dividerLineRefs, dividerDOM => {
        dividerDOM.style.backgroundColor = 'rgba(73,80,87,0.75)';
        dividerDOM.style.cursor = 'col-resize';
      });
      selectRefs(this.ghostDividerLineRefs, dividerDOM => {
        dividerDOM.style.cursor = 'col-resize';
        const {
          parentNode
        } = dividerDOM;

        if (!parentNode) {
          return;
        }

        const container = parentNode;
        container.style.display = 'block';
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onDragMove", event => {
      if (!this.isDragging || event.type !== 'mousemove' || !this.hasInteractiveLayer()) {
        return;
      }

      const rect = (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_3__.rectOfContent)(this.props.interactiveLayerRef.current); // mouse x-coordinate relative to the interactive layer's left side

      const rawMouseX = (event.pageX - rect.x) / rect.width;
      const min = 0;
      const max = 1; // clamp rawMouseX to be within [0, 1]

      this.dividerHandlePosition = (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_3__.clamp)(rawMouseX, min, max);
      const dividerHandlePositionString = (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_3__.toPercent)(this.dividerHandlePosition);
      selectRefs(this.ghostDividerLineRefs, dividerDOM => {
        const {
          parentNode
        } = dividerDOM;

        if (!parentNode) {
          return;
        }

        const container = parentNode;
        container.style.width = `calc(${dividerHandlePositionString} + 0.5px)`;
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onDragEnd", event => {
      if (!this.isDragging || event.type !== 'mouseup' || !this.hasInteractiveLayer()) {
        return;
      } // remove listeners that were attached in onDragStart


      this.cleanUpListeners(); // restore body styles

      if (this.previousUserSelect) {
        (0,sentry_utils_userselect__WEBPACK_IMPORTED_MODULE_4__.setBodyUserSelect)(this.previousUserSelect);
        this.previousUserSelect = null;
      } // indicate drag has ended


      this.isDragging = false;
      this.setHover(false);
      selectRefs(this.dividerLineRefs, dividerDOM => {
        dividerDOM.style.backgroundColor = '';
        dividerDOM.style.cursor = '';
      });
      selectRefs(this.ghostDividerLineRefs, dividerDOM => {
        dividerDOM.style.cursor = '';
        const {
          parentNode
        } = dividerDOM;

        if (!parentNode) {
          return;
        }

        const container = parentNode;
        container.style.display = 'none';
      });
      this.setState({
        // commit dividerHandlePosition to be dividerPosition
        dividerPosition: this.dividerHandlePosition
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "cleanUpListeners", () => {
      if (this.isDragging) {
        // we only remove listeners during a drag
        window.removeEventListener('mousemove', this.onDragMove);
        window.removeEventListener('mouseup', this.onDragEnd);
      }
    });
  }

  componentWillUnmount() {
    this.cleanUpListeners();
  }

  render() {
    const childrenProps = {
      dividerPosition: this.state.dividerPosition,
      setHover: this.setHover,
      onDragStart: this.onDragStart,
      addDividerLineRef: this.addDividerLineRef,
      addGhostDividerLineRef: this.addGhostDividerLineRef
    }; // NOTE: <DividerManagerContext.Provider /> will not re-render its children
    // - if the `value` prop changes, and
    // - if the `children` prop stays the same
    //
    // Thus, only <DividerManagerContext.Consumer /> components will re-render.
    // This is an optimization for when childrenProps changes, but this.props does not change.
    //
    // We prefer to minimize the amount of top-down prop drilling from this component
    // to the respective divider components.

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(DividerManagerContext.Provider, {
      value: childrenProps,
      children: this.props.children
    });
  }

}
Provider.displayName = "Provider";
const Consumer = DividerManagerContext.Consumer;

/***/ }),

/***/ "./app/components/events/interfaces/spans/header.tsx":
/*!***********************************************************!*\
  !*** ./app/components/events/interfaces/spans/header.tsx ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "HeaderContainer": () => (/* binding */ HeaderContainer),
/* harmony export */   "SecondaryHeader": () => (/* binding */ SecondaryHeader),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_events_opsBreakdown__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/events/opsBreakdown */ "./app/components/events/opsBreakdown.tsx");
/* harmony import */ var sentry_components_performance_waterfall_miniHeader__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/performance/waterfall/miniHeader */ "./app/components/performance/waterfall/miniHeader.tsx");
/* harmony import */ var sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/performance/waterfall/utils */ "./app/components/performance/waterfall/utils.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./constants */ "./app/components/events/interfaces/spans/constants.tsx");
/* harmony import */ var _cursorGuideHandler__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./cursorGuideHandler */ "./app/components/events/interfaces/spans/cursorGuideHandler.tsx");
/* harmony import */ var _dividerHandlerManager__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./dividerHandlerManager */ "./app/components/events/interfaces/spans/dividerHandlerManager.tsx");
/* harmony import */ var _measurementsPanel__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./measurementsPanel */ "./app/components/events/interfaces/spans/measurementsPanel.tsx");
/* harmony import */ var _scrollbarManager__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./scrollbarManager */ "./app/components/events/interfaces/spans/scrollbarManager.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ./types */ "./app/components/events/interfaces/spans/types.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ./utils */ "./app/components/events/interfaces/spans/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


















class TraceViewHeader extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      minimapWidth: undefined
    });
  }

  componentDidMount() {
    this.fetchMinimapWidth();
  }

  componentDidUpdate() {
    this.fetchMinimapWidth();
  }

  fetchMinimapWidth() {
    const {
      minimapInteractiveRef
    } = this.props;

    if (minimapInteractiveRef.current) {
      const minimapWidth = minimapInteractiveRef.current.getBoundingClientRect().width;

      if (minimapWidth !== this.state.minimapWidth) {
        // eslint-disable-next-line react/no-did-update-set-state
        this.setState({
          minimapWidth
        });
      }
    }
  }

  renderCursorGuide(_ref) {
    let {
      cursorGuideHeight,
      showCursorGuide,
      mouseLeft
    } = _ref;

    if (!showCursorGuide || !mouseLeft) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(CursorGuide, {
      style: {
        left: (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_7__.toPercent)(mouseLeft),
        height: `${cursorGuideHeight}px`
      }
    });
  }

  renderViewHandles(_ref2) {
    let {
      isDragging,
      onLeftHandleDragStart,
      leftHandlePosition,
      onRightHandleDragStart,
      rightHandlePosition,
      viewWindowStart,
      viewWindowEnd
    } = _ref2;
    const leftHandleGhost = isDragging ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(Handle, {
      left: viewWindowStart,
      onMouseDown: () => {// do nothing
      },
      isDragging: false
    }) : null;

    const leftHandle = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(Handle, {
      left: leftHandlePosition,
      onMouseDown: onLeftHandleDragStart,
      isDragging: isDragging
    });

    const rightHandle = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(Handle, {
      left: rightHandlePosition,
      onMouseDown: onRightHandleDragStart,
      isDragging: isDragging
    });

    const rightHandleGhost = isDragging ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(Handle, {
      left: viewWindowEnd,
      onMouseDown: () => {// do nothing
      },
      isDragging: false
    }) : null;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [leftHandleGhost, rightHandleGhost, leftHandle, rightHandle]
    });
  }

  renderFog(dragProps) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(Fog, {
        style: {
          height: '100%',
          width: (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_7__.toPercent)(dragProps.viewWindowStart)
        }
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(Fog, {
        style: {
          height: '100%',
          width: (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_7__.toPercent)(1 - dragProps.viewWindowEnd),
          left: (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_7__.toPercent)(dragProps.viewWindowEnd)
        }
      })]
    });
  }

  renderDurationGuide(_ref3) {
    let {
      showCursorGuide,
      mouseLeft
    } = _ref3;

    if (!showCursorGuide || !mouseLeft) {
      return null;
    }

    const interactiveLayer = this.props.minimapInteractiveRef.current;

    if (!interactiveLayer) {
      return null;
    }

    const rect = (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_7__.rectOfContent)(interactiveLayer);
    const {
      trace
    } = this.props;
    const duration = mouseLeft * Math.abs(trace.traceEndTimestamp - trace.traceStartTimestamp);
    const style = {
      top: 0,
      left: `calc(${mouseLeft * 100}% + 4px)`
    };
    const alignLeft = (1 - mouseLeft) * rect.width <= 100;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(DurationGuideBox, {
      style: style,
      alignLeft: alignLeft,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("span", {
        children: (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_7__.getHumanDuration)(duration)
      })
    });
  }

  renderTicks() {
    const {
      trace
    } = this.props;
    const {
      minimapWidth
    } = this.state;
    const duration = Math.abs(trace.traceEndTimestamp - trace.traceStartTimestamp);
    let numberOfParts = 5;

    if (minimapWidth) {
      if (minimapWidth <= 350) {
        numberOfParts = 4;
      }

      if (minimapWidth <= 280) {
        numberOfParts = 3;
      }

      if (minimapWidth <= 160) {
        numberOfParts = 2;
      }

      if (minimapWidth <= 130) {
        numberOfParts = 1;
      }
    }

    if (numberOfParts === 1) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(TickLabel, {
        duration: duration * 0.5,
        style: {
          left: (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_7__.toPercent)(0.5)
        }
      }, "1");
    }

    const segment = 1 / (numberOfParts - 1);
    const ticks = [];

    for (let currentPart = 0; currentPart < numberOfParts; currentPart++) {
      if (currentPart === 0) {
        ticks.push((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(TickLabel, {
          align: _types__WEBPACK_IMPORTED_MODULE_16__.TickAlignment.Left,
          hideTickMarker: true,
          duration: 0,
          style: {
            left: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1)
          }
        }, "first"));
        continue;
      }

      if (currentPart === numberOfParts - 1) {
        ticks.push((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(TickLabel, {
          duration: duration,
          align: _types__WEBPACK_IMPORTED_MODULE_16__.TickAlignment.Right,
          hideTickMarker: true,
          style: {
            right: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1)
          }
        }, "last"));
        continue;
      }

      const progress = segment * currentPart;
      ticks.push((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(TickLabel, {
        duration: duration * progress,
        style: {
          left: (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_7__.toPercent)(progress)
        }
      }, String(currentPart)));
    }

    return ticks;
  }

  renderTimeAxis(_ref4) {
    let {
      showCursorGuide,
      mouseLeft
    } = _ref4;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(TimeAxis, {
      children: [this.renderTicks(), this.renderCursorGuide({
        showCursorGuide,
        mouseLeft,
        cursorGuideHeight: _constants__WEBPACK_IMPORTED_MODULE_11__.TIME_AXIS_HEIGHT
      }), this.renderDurationGuide({
        showCursorGuide,
        mouseLeft
      })]
    });
  }

  renderWindowSelection(dragProps) {
    if (!dragProps.isWindowSelectionDragging) {
      return null;
    }

    const left = Math.min(dragProps.windowSelectionInitial, dragProps.windowSelectionCurrent);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(WindowSelection, {
      style: {
        left: (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_7__.toPercent)(left),
        width: (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_7__.toPercent)(dragProps.windowSelectionSize)
      }
    });
  }

  generateBounds() {
    const {
      dragProps,
      trace
    } = this.props;
    return (0,_utils__WEBPACK_IMPORTED_MODULE_17__.boundsGenerator)({
      traceStartTimestamp: trace.traceStartTimestamp,
      traceEndTimestamp: trace.traceEndTimestamp,
      viewStart: dragProps.viewWindowStart,
      viewEnd: dragProps.viewWindowEnd
    });
  }

  renderSecondaryHeader() {
    var _event$measurements;

    const {
      event
    } = this.props;
    const hasMeasurements = Object.keys((_event$measurements = event.measurements) !== null && _event$measurements !== void 0 ? _event$measurements : {}).length > 0;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(_dividerHandlerManager__WEBPACK_IMPORTED_MODULE_13__.Consumer, {
      children: dividerHandlerChildrenProps => {
        const {
          dividerPosition
        } = dividerHandlerChildrenProps;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(SecondaryHeader, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(_scrollbarManager__WEBPACK_IMPORTED_MODULE_15__.Consumer, {
            children: _ref5 => {
              let {
                virtualScrollbarRef,
                scrollBarAreaRef,
                onDragStart,
                onScroll
              } = _ref5;
              return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(sentry_components_performance_waterfall_miniHeader__WEBPACK_IMPORTED_MODULE_6__.ScrollbarContainer, {
                ref: this.props.virtualScrollBarContainerRef,
                style: {
                  // the width of this component is shrunk to compensate for half of the width of the divider line
                  width: `calc(${(0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_7__.toPercent)(dividerPosition)} - 0.5px)`
                },
                onScroll: onScroll,
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("div", {
                  style: {
                    width: 0,
                    height: '1px'
                  },
                  ref: scrollBarAreaRef
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_performance_waterfall_miniHeader__WEBPACK_IMPORTED_MODULE_6__.VirtualScrollbar, {
                  "data-type": "virtual-scrollbar",
                  ref: virtualScrollbarRef,
                  onMouseDown: onDragStart,
                  children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_performance_waterfall_miniHeader__WEBPACK_IMPORTED_MODULE_6__.VirtualScrollbarGrip, {})
                })]
              });
            }
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_performance_waterfall_miniHeader__WEBPACK_IMPORTED_MODULE_6__.DividerSpacer, {}), hasMeasurements ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(_measurementsPanel__WEBPACK_IMPORTED_MODULE_14__["default"], {
            event: event,
            generateBounds: this.generateBounds(),
            dividerPosition: dividerPosition
          }) : null]
        });
      }
    });
  }

  render() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(HeaderContainer, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(_dividerHandlerManager__WEBPACK_IMPORTED_MODULE_13__.Consumer, {
        children: dividerHandlerChildrenProps => {
          const {
            dividerPosition
          } = dividerHandlerChildrenProps;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(OperationsBreakdown, {
              style: {
                width: `calc(${(0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_7__.toPercent)(dividerPosition)} - 0.5px)`
              },
              children: this.props.event && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_events_opsBreakdown__WEBPACK_IMPORTED_MODULE_5__["default"], {
                operationNameFilters: this.props.operationNameFilters,
                event: this.props.event,
                topN: 3,
                hideHeader: true
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_performance_waterfall_miniHeader__WEBPACK_IMPORTED_MODULE_6__.DividerSpacer, {
              style: {
                position: 'absolute',
                top: 0,
                left: `calc(${(0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_7__.toPercent)(dividerPosition)} - 0.5px)`,
                height: `${_constants__WEBPACK_IMPORTED_MODULE_11__.MINIMAP_HEIGHT + _constants__WEBPACK_IMPORTED_MODULE_11__.TIME_AXIS_HEIGHT}px`
              }
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(ActualMinimap, {
              spans: this.props.spans,
              generateBounds: this.props.generateBounds,
              dividerPosition: dividerPosition,
              rootSpan: this.props.rootSpan
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(_cursorGuideHandler__WEBPACK_IMPORTED_MODULE_12__.Consumer, {
              children: _ref6 => {
                let {
                  displayCursorGuide,
                  hideCursorGuide,
                  mouseLeft,
                  showCursorGuide
                } = _ref6;
                return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(RightSidePane, {
                  ref: this.props.minimapInteractiveRef,
                  style: {
                    width: `calc(${(0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_7__.toPercent)(1 - dividerPosition)} - 0.5px)`,
                    left: `calc(${(0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_7__.toPercent)(dividerPosition)} + 0.5px)`
                  },
                  onMouseEnter: event => {
                    displayCursorGuide(event.pageX);
                  },
                  onMouseLeave: () => {
                    hideCursorGuide();
                  },
                  onMouseMove: event => {
                    displayCursorGuide(event.pageX);
                  },
                  onMouseDown: event => {
                    const target = event.target;

                    if (target instanceof Element && target.getAttribute && target.getAttribute('data-ignore')) {
                      // ignore this event if we need to
                      return;
                    }

                    this.props.dragProps.onWindowSelectionDragStart(event);
                  },
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(MinimapContainer, {
                    children: [this.renderFog(this.props.dragProps), this.renderCursorGuide({
                      showCursorGuide,
                      mouseLeft,
                      cursorGuideHeight: _constants__WEBPACK_IMPORTED_MODULE_11__.MINIMAP_HEIGHT
                    }), this.renderViewHandles(this.props.dragProps), this.renderWindowSelection(this.props.dragProps)]
                  }), this.renderTimeAxis({
                    showCursorGuide,
                    mouseLeft
                  })]
                });
              }
            }), this.renderSecondaryHeader()]
          });
        }
      })
    });
  }

}

TraceViewHeader.displayName = "TraceViewHeader";

class ActualMinimap extends react__WEBPACK_IMPORTED_MODULE_4__.PureComponent {
  renderRootSpan() {
    const {
      spans,
      generateBounds
    } = this.props;
    return spans.map((payload, i) => {
      switch (payload.type) {
        case 'root_span':
        case 'span':
        case 'span_group_chain':
          {
            const {
              span
            } = payload;
            const spanBarColor = (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_7__.pickBarColor)((0,_utils__WEBPACK_IMPORTED_MODULE_17__.getSpanOperation)(span));
            const bounds = generateBounds({
              startTimestamp: span.start_timestamp,
              endTimestamp: span.timestamp
            });
            const {
              left: spanLeft,
              width: spanWidth
            } = this.getBounds(bounds);
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(MinimapSpanBar, {
              style: {
                backgroundColor: payload.type === 'span_group_chain' ? sentry_utils_theme__WEBPACK_IMPORTED_MODULE_10__["default"].blue300 : spanBarColor,
                left: spanLeft,
                width: spanWidth
              }
            }, `${payload.type}-${i}`);
          }

        case 'span_group_siblings':
          {
            const {
              spanSiblingGrouping
            } = payload;
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(MinimapSiblingGroupBar, {
              "data-test-id": "minimap-sibling-group-bar",
              children: spanSiblingGrouping === null || spanSiblingGrouping === void 0 ? void 0 : spanSiblingGrouping.map((_ref7, index) => {
                let {
                  span
                } = _ref7;
                const bounds = generateBounds({
                  startTimestamp: span.start_timestamp,
                  endTimestamp: span.timestamp
                });
                const {
                  left: spanLeft,
                  width: spanWidth
                } = this.getBounds(bounds);
                return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(MinimapSpanBar, {
                  style: {
                    backgroundColor: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_10__["default"].blue300,
                    left: spanLeft,
                    width: spanWidth,
                    minWidth: 0,
                    position: 'absolute'
                  }
                }, index);
              })
            }, `${payload.type}-${i}`);
          }

        default:
          {
            return null;
          }
      }
    });
  }

  getBounds(bounds) {
    switch (bounds.type) {
      case 'TRACE_TIMESTAMPS_EQUAL':
      case 'INVALID_VIEW_WINDOW':
        {
          return {
            left: (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_7__.toPercent)(0),
            width: '0px'
          };
        }

      case 'TIMESTAMPS_EQUAL':
        {
          return {
            left: (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_7__.toPercent)(bounds.start),
            width: `${bounds.width}px`
          };
        }

      case 'TIMESTAMPS_REVERSED':
      case 'TIMESTAMPS_STABLE':
        {
          return {
            left: (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_7__.toPercent)(bounds.start),
            width: (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_7__.toPercent)(bounds.end - bounds.start)
          };
        }

      default:
        {
          const _exhaustiveCheck = bounds;
          return _exhaustiveCheck;
        }
    }
  }

  render() {
    const {
      dividerPosition
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(MinimapBackground, {
      style: {
        // the width of this component is shrunk to compensate for half of the width of the divider line
        width: `calc(${(0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_7__.toPercent)(1 - dividerPosition)} - 0.5px)`,
        left: `calc(${(0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_7__.toPercent)(dividerPosition)} + 0.5px)`
      },
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(BackgroundSlider, {
        id: "minimap-background-slider",
        children: this.renderRootSpan()
      })
    });
  }

}

ActualMinimap.displayName = "ActualMinimap";

const TimeAxis = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1jbvrxt19"
} : 0)("width:100%;position:absolute;left:0;top:", _constants__WEBPACK_IMPORTED_MODULE_11__.MINIMAP_HEIGHT, "px;border-top:1px solid ", p => p.theme.border, ";height:", _constants__WEBPACK_IMPORTED_MODULE_11__.TIME_AXIS_HEIGHT, "px;background-color:", p => p.theme.background, ";color:", p => p.theme.gray300, ";font-size:10px;font-weight:500;font-variant-numeric:tabular-nums;overflow:hidden;" + ( true ? "" : 0));

const TickLabelContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1jbvrxt18"
} : 0)("height:", _constants__WEBPACK_IMPORTED_MODULE_11__.TIME_AXIS_HEIGHT, "px;position:absolute;top:0;display:flex;align-items:center;user-select:none;" + ( true ? "" : 0));

const TickText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e1jbvrxt17"
} : 0)("position:absolute;line-height:1;white-space:nowrap;", _ref8 => {
  let {
    align
  } = _ref8;

  switch (align) {
    case _types__WEBPACK_IMPORTED_MODULE_16__.TickAlignment.Center:
      {
        return 'transform: translateX(-50%)';
      }

    case _types__WEBPACK_IMPORTED_MODULE_16__.TickAlignment.Left:
      {
        return null;
      }

    case _types__WEBPACK_IMPORTED_MODULE_16__.TickAlignment.Right:
      {
        return 'transform: translateX(-100%)';
      }

    default:
      {
        throw Error(`Invalid tick alignment: ${align}`);
      }
  }
}, ";" + ( true ? "" : 0));

const TickMarker = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1jbvrxt16"
} : 0)("width:1px;height:4px;background-color:", p => p.theme.gray200, ";position:absolute;top:0;left:0;transform:translateX(-50%);" + ( true ? "" : 0));

const TickLabel = props => {
  const {
    style,
    duration,
    hideTickMarker = false,
    align = _types__WEBPACK_IMPORTED_MODULE_16__.TickAlignment.Center
  } = props;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(TickLabelContainer, {
    style: style,
    children: [hideTickMarker ? null : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(TickMarker, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(TickText, {
      align: align,
      children: (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_7__.getHumanDuration)(duration)
    })]
  });
};

TickLabel.displayName = "TickLabel";

const DurationGuideBox = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1jbvrxt15"
} : 0)("position:absolute;background-color:", p => p.theme.background, ";padding:4px;height:100%;border-radius:3px;border:1px solid rgba(0, 0, 0, 0.1);line-height:1;white-space:nowrap;", _ref9 => {
  let {
    alignLeft
  } = _ref9;

  if (!alignLeft) {
    return null;
  }

  return 'transform: translateX(-100%) translateX(-8px);';
}, ";" + ( true ? "" : 0));

const HeaderContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1jbvrxt14"
} : 0)("width:100%;position:sticky;left:0;top:", p => sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_8__["default"].get('demoMode') ? p.theme.demo.headerSize : 0, ";z-index:", p => p.theme.zIndex.traceView.minimapContainer, ";background-color:", p => p.theme.background, ";border-bottom:1px solid ", p => p.theme.border, ";height:", _constants__WEBPACK_IMPORTED_MODULE_11__.MINIMAP_CONTAINER_HEIGHT, "px;border-top-left-radius:", p => p.theme.borderRadius, ";border-top-right-radius:", p => p.theme.borderRadius, ";" + ( true ? "" : 0));

const MinimapBackground = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1jbvrxt13"
} : 0)("height:", _constants__WEBPACK_IMPORTED_MODULE_11__.MINIMAP_HEIGHT, "px;max-height:", _constants__WEBPACK_IMPORTED_MODULE_11__.MINIMAP_HEIGHT, "px;overflow:hidden;position:absolute;top:0;" + ( true ? "" : 0));

const MinimapContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1jbvrxt12"
} : 0)("height:", _constants__WEBPACK_IMPORTED_MODULE_11__.MINIMAP_HEIGHT, "px;width:100%;position:relative;left:0;" + ( true ? "" : 0));

const ViewHandleContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1jbvrxt11"
} : 0)("position:absolute;top:0;height:", _constants__WEBPACK_IMPORTED_MODULE_11__.MINIMAP_HEIGHT, "px;" + ( true ? "" : 0));

const ViewHandleLine = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1jbvrxt10"
} : 0)("height:", _constants__WEBPACK_IMPORTED_MODULE_11__.MINIMAP_HEIGHT - _constants__WEBPACK_IMPORTED_MODULE_11__.VIEW_HANDLE_HEIGHT, "px;width:2px;background-color:", p => p.theme.textColor, ";" + ( true ? "" : 0));

const ViewHandle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1jbvrxt9"
} : 0)("position:absolute;background-color:", p => p.theme.textColor, ";cursor:col-resize;width:8px;height:", _constants__WEBPACK_IMPORTED_MODULE_11__.VIEW_HANDLE_HEIGHT, "px;bottom:0;left:-3px;" + ( true ? "" : 0));

const Fog = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1jbvrxt8"
} : 0)("background-color:", p => p.theme.textColor, ";opacity:0.1;position:absolute;top:0;" + ( true ? "" : 0));

const MinimapSpanBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1jbvrxt7"
} : 0)( true ? {
  name: "qf74iz",
  styles: "position:relative;height:2px;min-height:2px;max-height:2px;margin:2px 0;min-width:1px;border-radius:1px;box-sizing:border-box"
} : 0);

const MinimapSiblingGroupBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1jbvrxt6"
} : 0)( true ? {
  name: "1iwhu92",
  styles: "display:flex;position:relative;height:2px;min-height:2px;max-height:2px;top:-2px"
} : 0);

const BackgroundSlider = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1jbvrxt5"
} : 0)( true ? {
  name: "bjn8wh",
  styles: "position:relative"
} : 0);

const CursorGuide = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1jbvrxt4"
} : 0)("position:absolute;top:0;width:1px;background-color:", p => p.theme.red300, ";transform:translateX(-50%);" + ( true ? "" : 0));

const Handle = _ref10 => {
  let {
    left,
    onMouseDown,
    isDragging
  } = _ref10;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(ViewHandleContainer, {
    style: {
      left: (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_7__.toPercent)(left)
    },
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(ViewHandleLine, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(ViewHandle, {
      "data-ignore": "true",
      onMouseDown: onMouseDown,
      isDragging: isDragging,
      style: {
        height: `${_constants__WEBPACK_IMPORTED_MODULE_11__.VIEW_HANDLE_HEIGHT}px`
      }
    })]
  });
};

Handle.displayName = "Handle";

const WindowSelection = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1jbvrxt3"
} : 0)("position:absolute;top:0;height:", _constants__WEBPACK_IMPORTED_MODULE_11__.MINIMAP_HEIGHT, "px;background-color:", p => p.theme.textColor, ";opacity:0.1;" + ( true ? "" : 0));

const SecondaryHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1jbvrxt2"
} : 0)("position:absolute;top:", _constants__WEBPACK_IMPORTED_MODULE_11__.MINIMAP_HEIGHT + _constants__WEBPACK_IMPORTED_MODULE_11__.TIME_AXIS_HEIGHT, "px;left:0;height:", _constants__WEBPACK_IMPORTED_MODULE_11__.TIME_AXIS_HEIGHT, "px;width:100%;background-color:", p => p.theme.backgroundSecondary, ";display:flex;border-top:1px solid ", p => p.theme.border, ";overflow:hidden;" + ( true ? "" : 0));

const OperationsBreakdown = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1jbvrxt1"
} : 0)("height:", _constants__WEBPACK_IMPORTED_MODULE_11__.MINIMAP_HEIGHT + _constants__WEBPACK_IMPORTED_MODULE_11__.TIME_AXIS_HEIGHT, "px;position:absolute;left:0;top:0;overflow:hidden;" + ( true ? "" : 0));

const RightSidePane = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1jbvrxt0"
} : 0)("height:", _constants__WEBPACK_IMPORTED_MODULE_11__.MINIMAP_HEIGHT + _constants__WEBPACK_IMPORTED_MODULE_11__.TIME_AXIS_HEIGHT, "px;position:absolute;top:0;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TraceViewHeader);

/***/ }),

/***/ "./app/components/events/interfaces/spans/inlineDocs.tsx":
/*!***************************************************************!*\
  !*** ./app/components/events/interfaces/spans/inlineDocs.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var prism_sentry_index_css__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! prism-sentry/index.css */ "../node_modules/prism-sentry/index.css");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_actionCreators_projects__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/projects */ "./app/actionCreators/projects.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }












class InlineDocs extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      loading: true,
      html: undefined,
      link: undefined
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchData", async () => {
      const {
        platform,
        api,
        orgSlug,
        projectSlug
      } = this.props;

      if (!platform) {
        return;
      }

      this.setState({
        loading: true
      });
      let tracingPlatform;

      switch (platform) {
        case 'sentry.python':
          {
            tracingPlatform = 'python-tracing';
            break;
          }

        case 'sentry.javascript.node':
          {
            tracingPlatform = 'node-tracing';
            break;
          }

        case 'sentry.javascript.react-native':
          {
            tracingPlatform = 'react-native-tracing';
            break;
          }

        default:
          {
            this.setState({
              loading: false
            });
            return;
          }
      }

      try {
        const {
          html,
          link
        } = await (0,sentry_actionCreators_projects__WEBPACK_IMPORTED_MODULE_5__.loadDocs)(api, orgSlug, projectSlug, tracingPlatform);
        this.setState({
          html,
          link
        });
      } catch (error) {
        _sentry_react__WEBPACK_IMPORTED_MODULE_10__.captureException(error);
        this.setState({
          html: undefined,
          link: undefined
        });
      }

      this.setState({
        loading: false
      });
    });
  }

  componentDidMount() {
    this.fetchData();
  }

  render() {
    const {
      platform
    } = this.props;

    if (!platform) {
      return null;
    }

    if (this.state.loading) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)("div", {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_7__["default"], {})
      });
    }

    if (this.state.html) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)("div", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)("h4", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Requires Manual Instrumentation')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(DocumentationWrapper, {
          dangerouslySetInnerHTML: {
            __html: this.state.html
          }
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)("p", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)(`For in-depth instructions on setting up tracing, view [docLink:our documentation].`, {
            docLink: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)("a", {
              href: this.state.link
            })
          })
        })]
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)("h4", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Requires Manual Instrumentation')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)(`To manually instrument certain regions of your code, view [docLink:our documentation].`, {
          docLink: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_6__["default"], {
            href: "https://docs.sentry.io/product/performance/getting-started/"
          })
        })
      })]
    });
  }

}

InlineDocs.displayName = "InlineDocs";

const DocumentationWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1p2d0fm0"
} : 0)( true ? {
  name: "196c2e",
  styles: "p{line-height:1.5;}pre{word-break:break-all;white-space:pre-wrap;}"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_9__["default"])(InlineDocs));

/***/ }),

/***/ "./app/components/events/interfaces/spans/measurementsPanel.tsx":
/*!**********************************************************************!*\
  !*** ./app/components/events/interfaces/spans/measurementsPanel.tsx ***!
  \**********************************************************************/
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
/* harmony import */ var sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/performance/waterfall/utils */ "./app/components/performance/waterfall/utils.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/performance/vitals/constants */ "./app/utils/performance/vitals/constants.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./utils */ "./app/components/events/interfaces/spans/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }










function MeasurementsPanel(props) {
  const {
    event,
    generateBounds,
    dividerPosition
  } = props;
  const measurements = (0,_utils__WEBPACK_IMPORTED_MODULE_9__.getMeasurements)(event, generateBounds);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(Container, {
    style: {
      // the width of this component is shrunk to compensate for half of the width of the divider line
      width: `calc(${(0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_4__.toPercent)(1 - dividerPosition)} - 0.5px)`
    },
    children: Array.from(measurements.values()).map(verticalMark => {
      const mark = Object.values(verticalMark.marks)[0];
      const {
        timestamp
      } = mark;
      const bounds = (0,_utils__WEBPACK_IMPORTED_MODULE_9__.getMeasurementBounds)(timestamp, generateBounds);
      const shouldDisplay = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_7__.defined)(bounds.left) && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_7__.defined)(bounds.width);

      if (!shouldDisplay || !bounds.isSpanVisibleInView) {
        return null;
      }

      const vitalLabels = Object.keys(verticalMark.marks).map(name => ({
        vital: sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_8__.WEB_VITAL_DETAILS[`measurements.${name}`],
        isPoorValue: verticalMark.marks[name].failedThreshold
      }));

      if (vitalLabels.length > 1) {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(MultiLabelContainer, {
          left: (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_4__.toPercent)(bounds.left || 0),
          vitalLabels: vitalLabels
        }, String(timestamp));
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(LabelContainer, {
        left: (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_4__.toPercent)(bounds.left || 0),
        vitalLabel: vitalLabels[0]
      }, String(timestamp));
    })
  });
}

MeasurementsPanel.displayName = "MeasurementsPanel";

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ebsav3l3"
} : 0)( true ? {
  name: "1ite3ux",
  styles: "position:relative;overflow:hidden;height:20px"
} : 0);

const StyledMultiLabelContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ebsav3l2"
} : 0)( true ? {
  name: "eceuti",
  styles: "transform:translateX(-50%);position:absolute;display:flex;top:0;height:100%;user-select:none;white-space:nowrap"
} : 0);

const StyledLabelContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ebsav3l1"
} : 0)( true ? {
  name: "snm0j3",
  styles: "position:absolute;top:0;height:100%;user-select:none;white-space:nowrap"
} : 0);

const Label = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ebsav3l0"
} : 0)("transform:", p => p.isSingleLabel ? `translate(-50%, 15%)` : `translateY(15%)`, ";font-size:", p => p.theme.fontSizeExtraSmall, ";font-weight:600;color:", p => p.failedThreshold ? `${p.theme.red300}` : `${p.theme.gray500}`, ";background:", p => p.theme.white, ";border:1px solid;border-color:", p => p.failedThreshold ? p.theme.red300 : p.theme.gray100, ";border-radius:", p => p.theme.borderRadius, ";height:75%;display:flex;justify-content:center;align-items:center;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(0.25), ";margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(0.25), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MeasurementsPanel);

class LabelContainer extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      width: 1
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "elementDOMRef", /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_3__.createRef)());
  }

  componentDidMount() {
    const {
      current
    } = this.elementDOMRef;

    if (current) {
      // eslint-disable-next-line react/no-did-mount-set-state
      this.setState({
        width: current.clientWidth
      });
    }
  }

  render() {
    const {
      left,
      vitalLabel
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(StyledLabelContainer, {
      ref: this.elementDOMRef,
      style: {
        left: `clamp(calc(0.5 * ${this.state.width}px), ${left}, calc(100% - 0.5 * ${this.state.width}px))`
      },
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(Label, {
        failedThreshold: vitalLabel.isPoorValue,
        isSingleLabel: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_5__["default"], {
          title: vitalLabel.vital.name,
          position: "top",
          containerDisplayMode: "inline-block",
          children: vitalLabel.vital.acronym
        })
      })
    });
  }

}

LabelContainer.displayName = "LabelContainer";

class MultiLabelContainer extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      width: 1
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "elementDOMRef", /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_3__.createRef)());
  }

  componentDidMount() {
    const {
      current
    } = this.elementDOMRef;

    if (current) {
      // eslint-disable-next-line react/no-did-mount-set-state
      this.setState({
        width: current.clientWidth
      });
    }
  }

  render() {
    const {
      left,
      vitalLabels
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(StyledMultiLabelContainer, {
      ref: this.elementDOMRef,
      style: {
        left: `clamp(calc(0.5 * ${this.state.width}px), ${left}, calc(100% - 0.5 * ${this.state.width}px))`
      },
      children: vitalLabels.map(label => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(Label, {
        failedThreshold: label.isPoorValue,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_5__["default"], {
          title: label.vital.name,
          position: "top",
          containerDisplayMode: "inline-block",
          children: label.vital.acronym
        })
      }, `${label.vital.name}-label`))
    });
  }

}

MultiLabelContainer.displayName = "MultiLabelContainer";

/***/ }),

/***/ "./app/components/events/interfaces/spans/scrollbarManager.tsx":
/*!*********************************************************************!*\
  !*** ./app/components/events/interfaces/spans/scrollbarManager.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Consumer": () => (/* binding */ Consumer),
/* harmony export */   "Provider": () => (/* binding */ Provider),
/* harmony export */   "withScrollbarManager": () => (/* binding */ withScrollbarManager)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_throttle__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/throttle */ "../node_modules/lodash/throttle.js");
/* harmony import */ var lodash_throttle__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_throttle__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/performance/waterfall/utils */ "./app/components/performance/waterfall/utils.tsx");
/* harmony import */ var sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/getDisplayName */ "./app/utils/getDisplayName.tsx");
/* harmony import */ var sentry_utils_userselect__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/userselect */ "./app/utils/userselect.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./utils */ "./app/components/events/interfaces/spans/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










const ScrollbarManagerContext = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_3__.createContext)({
  generateContentSpanBarRef: () => () => undefined,
  virtualScrollbarRef: /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_3__.createRef)(),
  scrollBarAreaRef: /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_3__.createRef)(),
  onDragStart: () => {},
  onScroll: () => {},
  onWheel: () => {},
  updateScrollState: () => {},
  markSpanOutOfView: () => {},
  markSpanInView: () => {},
  storeSpanBar: () => {}
});

const selectRefs = (refs, transform) => {
  if (!(refs instanceof Set)) {
    if (refs.current) {
      transform(refs.current);
    }

    return;
  }

  refs.forEach(element => {
    if (document.body.contains(element)) {
      transform(element);
    }
  });
}; // simple linear interpolation between start and end such that needle is between [0, 1]


const lerp = (start, end, needle) => {
  return start + needle * (end - start);
};

class Provider extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      maxContentWidth: undefined
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "anchorCheckInterval", null);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "contentSpanBar", new Set());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "virtualScrollbar", /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_3__.createRef)());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "scrollBarArea", /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_3__.createRef)());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "isDragging", false);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "isWheeling", false);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "wheelTimeout", null);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "animationTimeout", null);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "previousUserSelect", null);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "spansInView", new _utils__WEBPACK_IMPORTED_MODULE_8__.SpansInViewMap(!this.props.isEmbedded));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "spanBars", []);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "initializeScrollState", () => {
      if (this.contentSpanBar.size === 0 || !this.hasInteractiveLayer()) {
        return;
      } // reset all span bar content containers to their natural widths


      selectRefs(this.contentSpanBar, spanBarDOM => {
        spanBarDOM.style.removeProperty('width');
        spanBarDOM.style.removeProperty('max-width');
        spanBarDOM.style.removeProperty('overflow');
        spanBarDOM.style.removeProperty('transform');
      }); // Find the maximum content width. We set each content spanbar to be this maximum width,
      // such that all content spanbar widths are uniform.

      const maxContentWidth = Array.from(this.contentSpanBar).reduce((currentMaxWidth, currentSpanBar) => {
        const isHidden = currentSpanBar.offsetParent === null;

        if (!document.body.contains(currentSpanBar) || isHidden) {
          return currentMaxWidth;
        }

        const maybeMaxWidth = currentSpanBar.scrollWidth;

        if (maybeMaxWidth > currentMaxWidth) {
          return maybeMaxWidth;
        }

        return currentMaxWidth;
      }, 0);
      selectRefs(this.contentSpanBar, spanBarDOM => {
        spanBarDOM.style.width = `${maxContentWidth}px`;
        spanBarDOM.style.maxWidth = `${maxContentWidth}px`;
        spanBarDOM.style.overflow = 'hidden';
      }); // set inner width of scrollbar area

      selectRefs(this.scrollBarArea, scrollBarArea => {
        scrollBarArea.style.width = `${maxContentWidth}px`;
        scrollBarArea.style.maxWidth = `${maxContentWidth}px`;
      });
      selectRefs(this.props.interactiveLayerRef, interactiveLayerRefDOM => {
        interactiveLayerRefDOM.scrollLeft = 0;
      });
      const spanBarDOM = this.getReferenceSpanBar();

      if (spanBarDOM) {
        this.syncVirtualScrollbar(spanBarDOM);
      }

      const left = this.spansInView.getScrollVal();
      this.performScroll(left);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "syncVirtualScrollbar", spanBar => {
      // sync the virtual scrollbar's width to the spanBar's width
      if (!this.virtualScrollbar.current || !this.hasInteractiveLayer()) {
        return;
      }

      const virtualScrollbarDOM = this.virtualScrollbar.current;
      const maxContentWidth = spanBar.getBoundingClientRect().width;

      if (maxContentWidth === undefined || maxContentWidth <= 0) {
        virtualScrollbarDOM.style.width = '0';
        return;
      }

      const visibleWidth = this.props.interactiveLayerRef.current.getBoundingClientRect().width; // This is the width of the content not visible.

      const maxScrollDistance = maxContentWidth - visibleWidth;
      const virtualScrollbarWidth = visibleWidth / (visibleWidth + maxScrollDistance);

      if (virtualScrollbarWidth >= 1) {
        virtualScrollbarDOM.style.width = '0';
        return;
      }

      virtualScrollbarDOM.style.width = `max(50px, ${(0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_5__.toPercent)(virtualScrollbarWidth)})`;
      virtualScrollbarDOM.style.removeProperty('transform');
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "generateContentSpanBarRef", () => {
      let previousInstance = null;

      const addContentSpanBarRef = instance => {
        if (previousInstance) {
          this.contentSpanBar.delete(previousInstance);
          previousInstance = null;
        }

        if (instance) {
          this.contentSpanBar.add(instance);
          previousInstance = instance;
        }
      };

      return addContentSpanBarRef;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "hasInteractiveLayer", () => !!this.props.interactiveLayerRef.current);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "initialMouseClickX", undefined);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "performScroll", (scrollLeft, isAnimated) => {
      const {
        interactiveLayerRef
      } = this.props;

      if (!interactiveLayerRef.current) {
        return;
      }

      if (isAnimated) {
        this.startAnimation();
      }

      const interactiveLayerRefDOM = interactiveLayerRef.current;
      const interactiveLayerRect = interactiveLayerRefDOM.getBoundingClientRect();
      interactiveLayerRefDOM.scrollLeft = scrollLeft; // Update scroll position of the virtual scroll bar

      selectRefs(this.scrollBarArea, scrollBarAreaDOM => {
        selectRefs(this.virtualScrollbar, virtualScrollbarDOM => {
          const scrollBarAreaRect = scrollBarAreaDOM.getBoundingClientRect();
          const virtualScrollbarPosition = scrollLeft / scrollBarAreaRect.width;
          const virtualScrollBarRect = (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_5__.rectOfContent)(virtualScrollbarDOM);
          const maxVirtualScrollableArea = 1 - virtualScrollBarRect.width / interactiveLayerRect.width;
          const virtualLeft = (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_5__.clamp)(virtualScrollbarPosition, 0, maxVirtualScrollableArea) * interactiveLayerRect.width;
          virtualScrollbarDOM.style.transform = `translateX(${virtualLeft}px)`;
          virtualScrollbarDOM.style.transformOrigin = 'left';
        });
      }); // Update scroll positions of all the span bars

      selectRefs(this.contentSpanBar, spanBarDOM => {
        const left = -scrollLeft;
        spanBarDOM.style.transform = `translateX(${left}px)`;
        spanBarDOM.style.transformOrigin = 'left';
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "throttledScroll", lodash_throttle__WEBPACK_IMPORTED_MODULE_4___default()(this.performScroll, 300, {
      trailing: true
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onWheel", deltaX => {
      if (this.isDragging || !this.hasInteractiveLayer()) {
        return;
      }

      this.disableAnimation(); // Setting this here is necessary, since updating the virtual scrollbar position will also trigger the onScroll function

      this.isWheeling = true;

      if (this.wheelTimeout) {
        clearTimeout(this.wheelTimeout);
      }

      this.wheelTimeout = setTimeout(() => {
        this.isWheeling = false;
        this.wheelTimeout = null;
      }, 200);
      const interactiveLayerRefDOM = this.props.interactiveLayerRef.current;
      const maxScrollLeft = interactiveLayerRefDOM.scrollWidth - interactiveLayerRefDOM.clientWidth;
      const scrollLeft = (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_5__.clamp)(interactiveLayerRefDOM.scrollLeft + deltaX, 0, maxScrollLeft);
      this.performScroll(scrollLeft);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onScroll", () => {
      if (this.isDragging || this.isWheeling || !this.hasInteractiveLayer()) {
        return;
      }

      const interactiveLayerRefDOM = this.props.interactiveLayerRef.current;
      const scrollLeft = interactiveLayerRefDOM.scrollLeft;
      this.performScroll(scrollLeft);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onDragStart", event => {
      if (this.isDragging || event.type !== 'mousedown' || !this.hasInteractiveLayer() || !this.virtualScrollbar.current) {
        return;
      }

      event.stopPropagation();
      const virtualScrollbarRect = (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_5__.rectOfContent)(this.virtualScrollbar.current); // get initial x-coordinate of the mouse click on the virtual scrollbar

      this.initialMouseClickX = Math.abs(event.clientX - virtualScrollbarRect.x); // prevent the user from selecting things outside the minimap when dragging
      // the mouse cursor inside the minimap

      this.previousUserSelect = (0,sentry_utils_userselect__WEBPACK_IMPORTED_MODULE_7__.setBodyUserSelect)({
        userSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        webkitUserSelect: 'none'
      }); // attach event listeners so that the mouse cursor does not select text during a drag

      window.addEventListener('mousemove', this.onDragMove);
      window.addEventListener('mouseup', this.onDragEnd); // indicate drag has begun

      this.isDragging = true;
      selectRefs(this.virtualScrollbar, scrollbarDOM => {
        scrollbarDOM.classList.add('dragging');
        document.body.style.setProperty('cursor', 'grabbing', 'important');
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onDragMove", event => {
      if (!this.isDragging || event.type !== 'mousemove' || !this.hasInteractiveLayer() || !this.virtualScrollbar.current || this.initialMouseClickX === undefined) {
        return;
      }

      const virtualScrollbarDOM = this.virtualScrollbar.current;
      const interactiveLayerRect = this.props.interactiveLayerRef.current.getBoundingClientRect();
      const virtualScrollBarRect = (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_5__.rectOfContent)(virtualScrollbarDOM); // Mouse x-coordinate relative to the interactive layer's left side

      const localDragX = event.pageX - interactiveLayerRect.x; // The drag movement with respect to the interactive layer's width.

      const rawMouseX = (localDragX - this.initialMouseClickX) / interactiveLayerRect.width;
      const maxVirtualScrollableArea = 1 - virtualScrollBarRect.width / interactiveLayerRect.width; // clamp rawMouseX to be within [0, 1]

      const virtualScrollbarPosition = (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_5__.clamp)(rawMouseX, 0, 1);
      const virtualLeft = (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_5__.clamp)(virtualScrollbarPosition, 0, maxVirtualScrollableArea) * interactiveLayerRect.width;
      virtualScrollbarDOM.style.transform = `translate3d(${virtualLeft}px, 0, 0)`;
      virtualScrollbarDOM.style.transformOrigin = 'left';
      const virtualScrollPercentage = (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_5__.clamp)(rawMouseX / maxVirtualScrollableArea, 0, 1); // Update scroll positions of all the span bars

      selectRefs(this.contentSpanBar, spanBarDOM => {
        const maxScrollDistance = spanBarDOM.getBoundingClientRect().width - interactiveLayerRect.width;
        const left = -lerp(0, maxScrollDistance, virtualScrollPercentage);
        spanBarDOM.style.transform = `translate3d(${left}px, 0, 0)`;
        spanBarDOM.style.transformOrigin = 'left';
      }); // Update the scroll position of the scroll bar area

      selectRefs(this.props.interactiveLayerRef, interactiveLayerRefDOM => {
        selectRefs(this.scrollBarArea, scrollBarAreaDOM => {
          const maxScrollDistance = scrollBarAreaDOM.getBoundingClientRect().width - interactiveLayerRect.width;
          const left = lerp(0, maxScrollDistance, virtualScrollPercentage);
          interactiveLayerRefDOM.scrollLeft = left;
        });
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onDragEnd", event => {
      if (!this.isDragging || event.type !== 'mouseup' || !this.hasInteractiveLayer()) {
        return;
      } // remove listeners that were attached in onDragStart


      this.cleanUpListeners(); // restore body styles

      if (this.previousUserSelect) {
        (0,sentry_utils_userselect__WEBPACK_IMPORTED_MODULE_7__.setBodyUserSelect)(this.previousUserSelect);
        this.previousUserSelect = null;
      } // indicate drag has ended


      this.isDragging = false;
      selectRefs(this.virtualScrollbar, scrollbarDOM => {
        scrollbarDOM.classList.remove('dragging');
        document.body.style.removeProperty('cursor');
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "cleanUpListeners", () => {
      if (this.isDragging) {
        // we only remove listeners during a drag
        window.removeEventListener('mousemove', this.onDragMove);
        window.removeEventListener('mouseup', this.onDragEnd);
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "markSpanOutOfView", spanId => {
      if (!this.spansInView.removeSpan(spanId)) {
        return;
      }

      const left = this.spansInView.getScrollVal();
      this.throttledScroll(left, true);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "markSpanInView", (spanId, treeDepth) => {
      if (!this.spansInView.addSpan(spanId, treeDepth)) {
        return;
      }

      const left = this.spansInView.getScrollVal();
      this.throttledScroll(left, true);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "storeSpanBar", spanBar => {
      this.spanBars.push(spanBar);
    });
  }

  componentDidMount() {
    // React will guarantee that refs are set before componentDidMount() is called;
    // but only for DOM elements that actually got rendered
    this.initializeScrollState();
    const anchoredSpanHash = window.location.hash.split('#')[1]; // If the user is opening the span tree with an anchor link provided, we need to continuously reconnect the observers.
    // This is because we need to wait for the window to scroll to the anchored span first, or there will be inconsistencies in
    // the spans that are actually considered in the view. The IntersectionObserver API cannot keep up with the speed
    // at which the window scrolls to the anchored span, and will be unable to register the spans that went out of the view.
    // We stop reconnecting the observers once we've confirmed that the anchored span is in the view (or after a timeout).

    if (anchoredSpanHash) {
      // We cannot assume the root is in view to start off, if there is an anchored span
      this.spansInView.isRootSpanInView = false;
      const anchoredSpanId = window.location.hash.replace((0,_utils__WEBPACK_IMPORTED_MODULE_8__.spanTargetHash)(''), ''); // Continuously check to see if the anchored span is in the view

      this.anchorCheckInterval = setInterval(() => {
        this.spanBars.forEach(spanBar => spanBar.connectObservers());

        if (this.spansInView.has(anchoredSpanId)) {
          clearInterval(this.anchorCheckInterval);
          this.anchorCheckInterval = null;
        }
      }, 50); // If the anchored span is never found in the view (malformed ID), cancel the interval

      setTimeout(() => {
        if (this.anchorCheckInterval) {
          clearInterval(this.anchorCheckInterval);
          this.anchorCheckInterval = null;
        }
      }, 1000);
      return;
    }

    this.spanBars.forEach(spanBar => spanBar.connectObservers());
  }

  componentDidUpdate(prevProps) {
    // Re-initialize the scroll state whenever:
    // - the window was selected via the minimap or,
    // - the divider was re-positioned.
    const dividerPositionChanged = this.props.dividerPosition !== prevProps.dividerPosition;
    const viewWindowChanged = prevProps.dragProps && this.props.dragProps && (prevProps.dragProps.viewWindowStart !== this.props.dragProps.viewWindowStart || prevProps.dragProps.viewWindowEnd !== this.props.dragProps.viewWindowEnd);

    if (dividerPositionChanged || viewWindowChanged) {
      this.initializeScrollState();
    }
  }

  componentWillUnmount() {
    this.cleanUpListeners();

    if (this.anchorCheckInterval) {
      clearInterval(this.anchorCheckInterval);
    }
  }

  getReferenceSpanBar() {
    for (const currentSpanBar of this.contentSpanBar) {
      const isHidden = currentSpanBar.offsetParent === null;

      if (!document.body.contains(currentSpanBar) || isHidden) {
        continue;
      }

      return currentSpanBar;
    }

    return undefined;
  }

  startAnimation() {
    selectRefs(this.contentSpanBar, spanBarDOM => {
      spanBarDOM.style.transition = 'transform 0.3s';
    });

    if (this.animationTimeout) {
      clearTimeout(this.animationTimeout);
    } // This timeout is set to trigger immediately after the animation ends, to disable the animation.
    // The animation needs to be cleared, otherwise manual horizontal scrolling will be animated


    this.animationTimeout = setTimeout(() => {
      selectRefs(this.contentSpanBar, spanBarDOM => {
        spanBarDOM.style.transition = '';
      });
      this.animationTimeout = null;
    }, 300);
  }

  disableAnimation() {
    selectRefs(this.contentSpanBar, spanBarDOM => {
      spanBarDOM.style.transition = '';
    });
  }

  render() {
    const childrenProps = {
      generateContentSpanBarRef: this.generateContentSpanBarRef,
      onDragStart: this.onDragStart,
      onScroll: this.onScroll,
      onWheel: this.onWheel,
      virtualScrollbarRef: this.virtualScrollbar,
      scrollBarAreaRef: this.scrollBarArea,
      updateScrollState: this.initializeScrollState,
      markSpanOutOfView: this.markSpanOutOfView,
      markSpanInView: this.markSpanInView,
      storeSpanBar: this.storeSpanBar
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(ScrollbarManagerContext.Provider, {
      value: childrenProps,
      children: this.props.children
    });
  }

}
Provider.displayName = "Provider";
const Consumer = ScrollbarManagerContext.Consumer;
const withScrollbarManager = WrappedComponent => {
  var _class;

  return _class = class extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
    render() {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(ScrollbarManagerContext.Consumer, {
        children: context => {
          const props = { ...this.props,
            ...context
          };
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(WrappedComponent, { ...props
          });
        }
      });
    }

  }, (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(_class, "displayName", `withScrollbarManager(${(0,sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_6__["default"])(WrappedComponent)})`), _class;
};

/***/ }),

/***/ "./app/components/events/interfaces/spans/spanDetail.tsx":
/*!***************************************************************!*\
  !*** ./app/components/events/interfaces/spans/spanDetail.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Row": () => (/* binding */ Row),
/* harmony export */   "SpanDetailContainer": () => (/* binding */ SpanDetailContainer),
/* harmony export */   "SpanDetails": () => (/* binding */ SpanDetails),
/* harmony export */   "Tags": () => (/* binding */ Tags),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_map__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/map */ "../node_modules/lodash/map.js");
/* harmony import */ var lodash_map__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_map__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_clipboard__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/clipboard */ "./app/components/clipboard.tsx");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_discoverButton__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/discoverButton */ "./app/components/discoverButton.tsx");
/* harmony import */ var sentry_components_fileSize__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/fileSize */ "./app/components/fileSize.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_performance_waterfall_rowDetails__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/components/performance/waterfall/rowDetails */ "./app/components/performance/waterfall/rowDetails.tsx");
/* harmony import */ var sentry_components_pill__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/components/pill */ "./app/components/pill.tsx");
/* harmony import */ var sentry_components_pills__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/components/pills */ "./app/components/pills.tsx");
/* harmony import */ var sentry_components_quickTrace_utils__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/components/quickTrace/utils */ "./app/components/quickTrace/utils.tsx");
/* harmony import */ var sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/constants/pageFilters */ "./app/constants/pageFilters.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_types_utils__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/types/utils */ "./app/types/utils.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_discover_urls__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! sentry/utils/discover/urls */ "./app/utils/discover/urls.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_32__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_views_performance_transactionSummary_transactionSpans_spanDetails_utils__WEBPACK_IMPORTED_MODULE_33__ = __webpack_require__(/*! sentry/views/performance/transactionSummary/transactionSpans/spanDetails/utils */ "./app/views/performance/transactionSummary/transactionSpans/spanDetails/utils.tsx");
/* harmony import */ var sentry_views_performance_transactionSummary_utils__WEBPACK_IMPORTED_MODULE_34__ = __webpack_require__(/*! sentry/views/performance/transactionSummary/utils */ "./app/views/performance/transactionSummary/utils.tsx");
/* harmony import */ var _context__WEBPACK_IMPORTED_MODULE_35__ = __webpack_require__(/*! ./context */ "./app/components/events/interfaces/spans/context.tsx");
/* harmony import */ var _inlineDocs__WEBPACK_IMPORTED_MODULE_36__ = __webpack_require__(/*! ./inlineDocs */ "./app/components/events/interfaces/spans/inlineDocs.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_37__ = __webpack_require__(/*! ./types */ "./app/components/events/interfaces/spans/types.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_38__ = __webpack_require__(/*! ./utils */ "./app/components/events/interfaces/spans/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

 // eslint-disable-next-line no-restricted-imports





































const DEFAULT_ERRORS_VISIBLE = 5;
const SIZE_DATA_KEYS = ['Encoded Body Size', 'Decoded Body Size', 'Transfer Size'];

class SpanDetail extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      errorsOpened: false
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "toggleErrors", () => {
      this.setState(_ref => {
        let {
          errorsOpened
        } = _ref;
        return {
          errorsOpened: !errorsOpened
        };
      });
    });
  }

  componentDidMount() {
    var _span$op;

    const {
      span,
      organization
    } = this.props;

    if ('type' in span) {
      return;
    }

    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_28__["default"])('performance_views.event_details.open_span_details', {
      organization,
      operation: (_span$op = span.op) !== null && _span$op !== void 0 ? _span$op : 'undefined'
    });
  }

  renderTraversalButton() {
    if (!this.props.childTransactions) {
      // TODO: Amend size to use theme when we eventually refactor LoadingIndicator
      // 12px is consistent with theme.iconSizes['xs'] but theme returns a string.
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(StyledDiscoverButton, {
        size: "xs",
        disabled: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(StyledLoadingIndicator, {
          size: 12
        })
      });
    }

    if (this.props.childTransactions.length <= 0) {
      return null;
    }

    const {
      span,
      trace,
      event,
      organization
    } = this.props;
    (0,sentry_types_utils__WEBPACK_IMPORTED_MODULE_26__.assert)(!(0,_utils__WEBPACK_IMPORTED_MODULE_38__.isGapSpan)(span));

    if (this.props.childTransactions.length === 1) {
      // Note: This is rendered by this.renderSpanChild() as a dedicated row
      return null;
    }

    const orgFeatures = new Set(organization.features);
    const {
      start,
      end
    } = (0,_utils__WEBPACK_IMPORTED_MODULE_38__.getTraceDateTimeRange)({
      start: trace.traceStartTimestamp,
      end: trace.traceEndTimestamp
    });
    const childrenEventView = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_29__["default"].fromSavedQuery({
      id: undefined,
      name: `Children from Span ID ${span.span_id}`,
      fields: ['transaction', 'project', 'trace.span', 'transaction.duration', 'timestamp'],
      orderby: '-timestamp',
      query: `event.type:transaction trace:${span.trace_id} trace.parent_span:${span.span_id}`,
      projects: orgFeatures.has('global-views') ? [sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_22__.ALL_ACCESS_PROJECTS] : [Number(event.projectID)],
      version: 2,
      start,
      end
    });
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(StyledDiscoverButton, {
      "data-test-id": "view-child-transactions",
      size: "xs",
      to: childrenEventView.getResultsViewUrlTarget(organization.slug),
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_24__.t)('View Children')
    });
  }

  renderSpanChild() {
    const {
      childTransactions,
      organization,
      location
    } = this.props;

    if (!childTransactions || childTransactions.length !== 1) {
      return null;
    }

    const childTransaction = childTransactions[0];
    const transactionResult = {
      'project.name': childTransaction.project_slug,
      transaction: childTransaction.transaction,
      'trace.span': childTransaction.span_id,
      id: childTransaction.event_id
    };
    const eventSlug = generateSlug(transactionResult);

    const viewChildButton = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(_context__WEBPACK_IMPORTED_MODULE_35__.Consumer, {
      children: _ref2 => {
        let {
          getViewChildTransactionTarget
        } = _ref2;
        const to = getViewChildTransactionTarget({ ...transactionResult,
          eventSlug
        });

        if (!to) {
          return null;
        }

        const target = (0,sentry_views_performance_transactionSummary_utils__WEBPACK_IMPORTED_MODULE_34__.transactionSummaryRouteWithQuery)({
          orgSlug: organization.slug,
          transaction: transactionResult.transaction,
          query: lodash_omit__WEBPACK_IMPORTED_MODULE_7___default()(location.query, Object.values(sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_22__.PAGE_URL_PARAM)),
          projectID: String(childTransaction.project_id)
        });
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsxs)(ButtonGroup, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(StyledButton, {
            "data-test-id": "view-child-transaction",
            size: "xs",
            to: to,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_24__.t)('View Transaction')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(StyledButton, {
            size: "xs",
            to: target,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_24__.t)('View Summary')
          })]
        });
      }
    });

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(Row, {
      title: "Child Transaction",
      extra: viewChildButton,
      children: `${transactionResult.transaction} (${transactionResult['project.name']})`
    });
  }

  renderTraceButton() {
    const {
      span,
      organization,
      event
    } = this.props;

    if ((0,_utils__WEBPACK_IMPORTED_MODULE_38__.isGapSpan)(span)) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(StyledButton, {
      size: "xs",
      to: (0,sentry_components_quickTrace_utils__WEBPACK_IMPORTED_MODULE_21__.generateTraceTarget)(event, organization),
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_24__.t)('View Trace')
    });
  }

  renderViewSimilarSpansButton() {
    const {
      span,
      organization,
      location,
      event
    } = this.props;

    if ((0,_utils__WEBPACK_IMPORTED_MODULE_38__.isGapSpan)(span) || !span.op || !span.hash) {
      return null;
    }

    const transactionName = event.title;
    const target = (0,sentry_views_performance_transactionSummary_transactionSpans_spanDetails_utils__WEBPACK_IMPORTED_MODULE_33__.spanDetailsRouteWithQuery)({
      orgSlug: organization.slug,
      transaction: transactionName,
      query: location.query,
      spanSlug: {
        op: span.op,
        group: span.hash
      },
      projectID: event.projectID
    });
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(StyledButton, {
      size: "xs",
      to: target,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_24__.t)('View Similar Spans')
    });
  }

  renderOrphanSpanMessage() {
    const {
      span
    } = this.props;

    if (!(0,_utils__WEBPACK_IMPORTED_MODULE_38__.isOrphanSpan)(span)) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_9__["default"], {
      type: "info",
      showIcon: true,
      system: true,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_24__.t)('This is a span that has no parent span within this transaction. It has been attached to the transaction root span by default.')
    });
  }

  renderSpanErrorMessage() {
    const {
      span,
      organization,
      relatedErrors
    } = this.props;
    const {
      errorsOpened
    } = this.state;

    if (!relatedErrors || relatedErrors.length <= 0 || (0,_utils__WEBPACK_IMPORTED_MODULE_38__.isGapSpan)(span)) {
      return null;
    }

    const visibleErrors = errorsOpened ? relatedErrors : relatedErrors.slice(0, DEFAULT_ERRORS_VISIBLE);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsxs)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_9__["default"], {
      type: (0,_utils__WEBPACK_IMPORTED_MODULE_38__.getCumulativeAlertLevelFromErrors)(relatedErrors),
      system: true,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(sentry_components_performance_waterfall_rowDetails__WEBPACK_IMPORTED_MODULE_18__.ErrorMessageTitle, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_24__.tn)('An error event occurred in this span.', '%s error events occurred in this span.', relatedErrors.length)
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(sentry_components_performance_waterfall_rowDetails__WEBPACK_IMPORTED_MODULE_18__.ErrorMessageContent, {
        children: visibleErrors.map(error => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(sentry_components_performance_waterfall_rowDetails__WEBPACK_IMPORTED_MODULE_18__.ErrorDot, {
            level: error.level
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(sentry_components_performance_waterfall_rowDetails__WEBPACK_IMPORTED_MODULE_18__.ErrorLevel, {
            children: error.level
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(sentry_components_performance_waterfall_rowDetails__WEBPACK_IMPORTED_MODULE_18__.ErrorTitle, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_16__["default"], {
              to: (0,sentry_components_quickTrace_utils__WEBPACK_IMPORTED_MODULE_21__.generateIssueEventTarget)(error, organization),
              children: error.title
            })
          })]
        }, error.event_id))
      }), relatedErrors.length > DEFAULT_ERRORS_VISIBLE && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(ErrorToggle, {
        size: "xs",
        onClick: this.toggleErrors,
        children: errorsOpened ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_24__.t)('Show less') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_24__.t)('Show more')
      })]
    });
  }

  partitionSizes(data) {
    const sizeKeys = SIZE_DATA_KEYS.reduce((keys, key) => {
      if (data.hasOwnProperty(key)) {
        keys[key] = data[key];
      }

      return keys;
    }, {});
    const nonSizeKeys = { ...data
    };
    SIZE_DATA_KEYS.forEach(key => delete nonSizeKeys[key]);
    return {
      sizeKeys,
      nonSizeKeys
    };
  }

  renderSpanDetails() {
    var _span$data, _span$description;

    const {
      span,
      event,
      location,
      organization,
      scrollToHash
    } = this.props;

    if ((0,_utils__WEBPACK_IMPORTED_MODULE_38__.isGapSpan)(span)) {
      var _event$sdk, _event$projectSlug;

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(SpanDetails, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(_inlineDocs__WEBPACK_IMPORTED_MODULE_36__["default"], {
          platform: ((_event$sdk = event.sdk) === null || _event$sdk === void 0 ? void 0 : _event$sdk.name) || '',
          orgSlug: organization.slug,
          projectSlug: (_event$projectSlug = event === null || event === void 0 ? void 0 : event.projectSlug) !== null && _event$projectSlug !== void 0 ? _event$projectSlug : ''
        })
      });
    }

    const startTimestamp = span.start_timestamp;
    const endTimestamp = span.timestamp;
    const duration = (endTimestamp - startTimestamp) * 1000;
    const durationString = `${Number(duration.toFixed(3)).toLocaleString()}ms`;
    const unknownKeys = Object.keys(span).filter(key => {
      return !_types__WEBPACK_IMPORTED_MODULE_37__.rawSpanKeys.has(key);
    });
    const {
      sizeKeys,
      nonSizeKeys
    } = this.partitionSizes((_span$data = span === null || span === void 0 ? void 0 : span.data) !== null && _span$data !== void 0 ? _span$data : {});
    const allZeroSizes = SIZE_DATA_KEYS.map(key => sizeKeys[key]).every(value => value === 0);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [this.renderOrphanSpanMessage(), this.renderSpanErrorMessage(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(SpanDetails, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)("table", {
          className: "table key-value",
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsxs)("tbody", {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(Row, {
              title: (0,_utils__WEBPACK_IMPORTED_MODULE_38__.isGapSpan)(span) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(SpanIdTitle, {
                children: "Span ID"
              }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsxs)(SpanIdTitle, {
                onClick: (0,_utils__WEBPACK_IMPORTED_MODULE_38__.scrollToSpan)(span.span_id, scrollToHash, location, organization),
                children: ["Span ID", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(sentry_components_clipboard__WEBPACK_IMPORTED_MODULE_11__["default"], {
                  value: `${window.location.href.replace(window.location.hash, '')}#span-${span.span_id}`,
                  children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(StyledIconLink, {})
                })]
              }),
              extra: this.renderTraversalButton(),
              children: span.span_id
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(Row, {
              title: "Parent Span ID",
              children: span.parent_span_id || ''
            }), this.renderSpanChild(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(Row, {
              title: "Trace ID",
              extra: this.renderTraceButton(),
              children: span.trace_id
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(Row, {
              title: "Description",
              extra: this.renderViewSimilarSpansButton(),
              children: (_span$description = span === null || span === void 0 ? void 0 : span.description) !== null && _span$description !== void 0 ? _span$description : ''
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(Row, {
              title: "Status",
              children: span.status || ''
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(Row, {
              title: "Start Date",
              children: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_31__["default"])({
                fixed: 'Mar 16, 2020 9:10:12 AM UTC',
                value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_12__["default"], {
                    date: startTimestamp * 1000,
                    year: true,
                    seconds: true,
                    timeZone: true
                  }), ` (${startTimestamp})`]
                })
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(Row, {
              title: "End Date",
              children: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_31__["default"])({
                fixed: 'Mar 16, 2020 9:10:13 AM UTC',
                value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_12__["default"], {
                    date: endTimestamp * 1000,
                    year: true,
                    seconds: true,
                    timeZone: true
                  }), ` (${endTimestamp})`]
                })
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(Row, {
              title: "Duration",
              children: durationString
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(Row, {
              title: "Operation",
              children: span.op || ''
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(Row, {
              title: "Same Process as Parent",
              children: span.same_process_as_parent !== undefined ? String(span.same_process_as_parent) : null
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsxs)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_8__["default"], {
              organization: organization,
              features: ['organizations:performance-suspect-spans-view'],
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(Row, {
                title: "Span Group",
                children: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_27__.defined)(span.hash) ? String(span.hash) : null
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(Row, {
                title: "Span Self Time",
                children: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_27__.defined)(span.exclusive_time) ? `${Number(span.exclusive_time.toFixed(3)).toLocaleString()}ms` : null
              })]
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(Tags, {
              span: span
            }), allZeroSizes && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsxs)(TextTr, {
              children: ["The following sizes were not collected for security reasons. Check if the host serves the appropriate", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_15__["default"], {
                href: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Timing-Allow-Origin",
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)("span", {
                  className: "val-string",
                  children: "Timing-Allow-Origin"
                })
              }), "header. You may have to enable this collection manually."]
            }), lodash_map__WEBPACK_IMPORTED_MODULE_6___default()(sizeKeys, (value, key) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(Row, {
              title: key,
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(sentry_components_fileSize__WEBPACK_IMPORTED_MODULE_14__["default"], {
                  bytes: value
                }), value >= 1024 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)("span", {
                  children: ` (${JSON.stringify(value, null, 4) || ''} B)`
                })]
              })
            }, key)), lodash_map__WEBPACK_IMPORTED_MODULE_6___default()(nonSizeKeys, (value, key) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(Row, {
              title: key,
              children: JSON.stringify(value, null, 4) || ''
            }, key)), unknownKeys.map(key => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(Row, {
              title: key,
              children: JSON.stringify(span[key], null, 4) || ''
            }, key))]
          })
        })
      })]
    });
  }

  render() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(SpanDetailContainer, {
      "data-component": "span-detail",
      onClick: event => {
        // prevent toggling the span detail
        event.stopPropagation();
      },
      children: this.renderSpanDetails()
    });
  }

}

SpanDetail.displayName = "SpanDetail";

const StyledDiscoverButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_discoverButton__WEBPACK_IMPORTED_MODULE_13__["default"],  true ? {
  target: "eb56mm213"
} : 0)("position:absolute;top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_25__["default"])(0.75), ";right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_25__["default"])(0.5), ";" + ( true ? "" : 0));

const StyledButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "eb56mm212"
} : 0)( true ? "" : 0);

const SpanDetailContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eb56mm211"
} : 0)("border-bottom:1px solid ", p => p.theme.border, ";cursor:auto;" + ( true ? "" : 0));
const SpanDetails = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eb56mm210"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_25__["default"])(2), ";" + ( true ? "" : 0));

const ValueTd = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('td',  true ? {
  target: "eb56mm29"
} : 0)( true ? {
  name: "bjn8wh",
  styles: "position:relative"
} : 0);

const StyledLoadingIndicator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_17__["default"],  true ? {
  target: "eb56mm28"
} : 0)("display:flex;align-items:center;height:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_25__["default"])(2), ";margin:0;" + ( true ? "" : 0));

const StyledText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('p',  true ? {
  target: "eb56mm27"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_25__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_25__["default"])(0), ";" + ( true ? "" : 0));

const TextTr = _ref3 => {
  let {
    children
  } = _ref3;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsxs)("tr", {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)("td", {
      className: "key"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(ValueTd, {
      className: "value",
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(StyledText, {
        children: children
      })
    })]
  });
};

TextTr.displayName = "TextTr";

const ErrorToggle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "eb56mm26"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_25__["default"])(0.75), ";" + ( true ? "" : 0));

const SpanIdTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('a',  true ? {
  target: "eb56mm25"
} : 0)("display:flex;color:", p => p.theme.textColor, ";:hover{color:", p => p.theme.textColor, ";}" + ( true ? "" : 0));

const StyledIconLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_23__.IconLink,  true ? {
  target: "eb56mm24"
} : 0)("display:block;color:", p => p.theme.gray300, ";margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_25__["default"])(1), ";" + ( true ? "" : 0));

const Row = _ref4 => {
  let {
    title,
    keep,
    children,
    extra = null
  } = _ref4;

  if (!keep && !children) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsxs)("tr", {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)("td", {
      className: "key",
      children: title
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(ValueTd, {
      className: "value",
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsxs)(ValueRow, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(StyledPre, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)("span", {
            className: "val-string",
            children: children
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(ButtonContainer, {
          children: extra
        })]
      })
    })]
  });
};
Row.displayName = "Row";
const Tags = _ref5 => {
  let {
    span
  } = _ref5;
  const tags = span === null || span === void 0 ? void 0 : span.tags;

  if (!tags) {
    return null;
  }

  const keys = Object.keys(tags);

  if (keys.length <= 0) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsxs)("tr", {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)("td", {
      className: "key",
      children: "Tags"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)("td", {
      className: "value",
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(sentry_components_pills__WEBPACK_IMPORTED_MODULE_20__["default"], {
        style: {
          padding: '8px'
        },
        children: keys.map((key, index) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(sentry_components_pill__WEBPACK_IMPORTED_MODULE_19__["default"], {
          name: key,
          value: String(tags[key]) || ''
        }, index))
      })
    })]
  });
};
Tags.displayName = "Tags";

function generateSlug(result) {
  return (0,sentry_utils_discover_urls__WEBPACK_IMPORTED_MODULE_30__.generateEventSlug)({
    id: result.id,
    'project.name': result['project.name']
  });
}

const ButtonGroup = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eb56mm23"
} : 0)("display:flex;flex-direction:column;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_25__["default"])(0.5), ";" + ( true ? "" : 0));

const ValueRow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eb56mm22"
} : 0)("display:grid;grid-template-columns:auto min-content;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_25__["default"])(1), ";border-radius:4px;background-color:", p => p.theme.surface100, ";margin:2px;" + ( true ? "" : 0));

const StyledPre = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('pre',  true ? {
  target: "eb56mm21"
} : 0)( true ? {
  name: "100r3j",
  styles: "margin:0!important;background-color:transparent!important"
} : 0);

const ButtonContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eb56mm20"
} : 0)( true ? {
  name: "16h96lx",
  styles: "padding:8px 10px"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_32__["default"])((0,react_router__WEBPACK_IMPORTED_MODULE_5__.withRouter)(SpanDetail)));

/***/ }),

/***/ "./app/components/events/interfaces/spans/types.tsx":
/*!**********************************************************!*\
  !*** ./app/components/events/interfaces/spans/types.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "GroupType": () => (/* binding */ GroupType),
/* harmony export */   "TickAlignment": () => (/* binding */ TickAlignment),
/* harmony export */   "rawSpanKeys": () => (/* binding */ rawSpanKeys)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);

const rawSpanKeys = new Set(['trace_id', 'parent_span_id', 'span_id', 'start_timestamp', 'timestamp', 'same_process_as_parent', 'op', 'description', 'status', 'data', 'tags', 'hash', 'exclusive_time']);
let TickAlignment;

(function (TickAlignment) {
  TickAlignment[TickAlignment["Left"] = 0] = "Left";
  TickAlignment[TickAlignment["Right"] = 1] = "Right";
  TickAlignment[TickAlignment["Center"] = 2] = "Center";
})(TickAlignment || (TickAlignment = {}));

let GroupType;

(function (GroupType) {
  GroupType[GroupType["DESCENDANTS"] = 0] = "DESCENDANTS";
  GroupType[GroupType["SIBLINGS"] = 1] = "SIBLINGS";
})(GroupType || (GroupType = {}));

/***/ }),

/***/ "./app/components/events/opsBreakdown.tsx":
/*!************************************************!*\
  !*** ./app/components/events/opsBreakdown.tsx ***!
  \************************************************/
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
/* harmony import */ var lodash_isFinite__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/isFinite */ "../node_modules/lodash/isFinite.js");
/* harmony import */ var lodash_isFinite__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_isFinite__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_events_interfaces_spans_utils__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/events/interfaces/spans/utils */ "./app/components/events/interfaces/spans/utils.tsx");
/* harmony import */ var sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/performance/waterfall/utils */ "./app/components/performance/waterfall/utils.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_types_event__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/types/event */ "./app/types/event.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }












const OtherOperation = Symbol('Other');
const TOP_N_SPANS = 4;

class OpsBreakdown extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  getTransactionEvent() {
    const {
      event
    } = this.props;

    if (event.type === 'transaction') {
      return event;
    }

    return undefined;
  }

  generateStats() {
    var _event$contexts, _spanEntry$data;

    const {
      topN,
      operationNameFilters
    } = this.props;
    const event = this.getTransactionEvent();

    if (!event) {
      return [];
    }

    const traceContext = event === null || event === void 0 ? void 0 : (_event$contexts = event.contexts) === null || _event$contexts === void 0 ? void 0 : _event$contexts.trace;

    if (!traceContext) {
      return [];
    }

    const spanEntry = event.entries.find(entry => {
      return entry.type === sentry_types_event__WEBPACK_IMPORTED_MODULE_11__.EntryType.SPANS;
    });
    let spans = (_spanEntry$data = spanEntry === null || spanEntry === void 0 ? void 0 : spanEntry.data) !== null && _spanEntry$data !== void 0 ? _spanEntry$data : [];
    const rootSpan = {
      op: traceContext.op,
      timestamp: event.endTimestamp,
      start_timestamp: event.startTimestamp,
      trace_id: traceContext.trace_id || '',
      span_id: traceContext.span_id || '',
      data: {}
    };
    spans = spans.length > 0 ? spans : // if there are no descendent spans, then use the transaction root span
    [rootSpan]; // Filter spans by operation name

    if (operationNameFilters.type === 'active_filter') {
      spans = [...spans, rootSpan];
      spans = spans.filter(span => {
        const operationName = (0,sentry_components_events_interfaces_spans_utils__WEBPACK_IMPORTED_MODULE_6__.getSpanOperation)(span);
        const shouldFilterOut = typeof operationName === 'string' && !operationNameFilters.operationNames.has(operationName);
        return !shouldFilterOut;
      });
    }

    const operationNameIntervals = spans.reduce((intervals, span) => {
      let startTimestamp = span.start_timestamp;
      let endTimestamp = span.timestamp;

      if (endTimestamp < startTimestamp) {
        // reverse timestamps
        startTimestamp = span.timestamp;
        endTimestamp = span.start_timestamp;
      } // invariant: startTimestamp <= endTimestamp


      let operationName = span.op;

      if (typeof operationName !== 'string') {
        // a span with no operation name is considered an 'unknown' op
        operationName = 'unknown';
      }

      const cover = [startTimestamp, endTimestamp];
      const operationNameInterval = intervals[operationName];

      if (!Array.isArray(operationNameInterval)) {
        intervals[operationName] = [cover];
        return intervals;
      }

      operationNameInterval.push(cover);
      intervals[operationName] = mergeInterval(operationNameInterval);
      return intervals;
    }, {});
    const operationNameCoverage = Object.entries(operationNameIntervals).reduce((acc, _ref) => {
      let [operationName, intervals] = _ref;
      const duration = intervals.reduce((sum, _ref2) => {
        let [start, end] = _ref2;
        return sum + Math.abs(end - start);
      }, 0);
      acc[operationName] = duration;
      return acc;
    }, {});
    const sortedOpsBreakdown = Object.entries(operationNameCoverage).sort((first, second) => {
      const firstDuration = first[1];
      const secondDuration = second[1];

      if (firstDuration === secondDuration) {
        return 0;
      }

      if (firstDuration < secondDuration) {
        // sort second before first
        return 1;
      } // otherwise, sort first before second


      return -1;
    });
    const breakdown = sortedOpsBreakdown.slice(0, topN).map(_ref3 => {
      let [operationName, duration] = _ref3;
      return {
        name: operationName,
        // percentage to be recalculated after the ops breakdown group is decided
        percentage: 0,
        totalInterval: duration
      };
    });
    const other = sortedOpsBreakdown.slice(topN).reduce((accOther, _ref4) => {
      let [_operationName, duration] = _ref4;
      accOther.totalInterval += duration;
      return accOther;
    }, {
      name: OtherOperation,
      // percentage to be recalculated after the ops breakdown group is decided
      percentage: 0,
      totalInterval: 0
    });

    if (other.totalInterval > 0) {
      breakdown.push(other);
    } // calculate breakdown total duration


    const total = breakdown.reduce((sum, operationNameGroup) => {
      return sum + operationNameGroup.totalInterval;
    }, 0); // recalculate percentage values

    breakdown.forEach(operationNameGroup => {
      operationNameGroup.percentage = operationNameGroup.totalInterval / total;
    });
    return breakdown;
  }

  render() {
    const {
      hideHeader
    } = this.props;
    const event = this.getTransactionEvent();

    if (!event) {
      return null;
    }

    const breakdown = this.generateStats();
    const contents = breakdown.map(currOp => {
      const {
        name,
        percentage,
        totalInterval
      } = currOp;
      const isOther = name === OtherOperation;
      const operationName = typeof name === 'string' ? name : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Other');
      const durLabel = Math.round(totalInterval * 1000 * 100) / 100;
      const pctLabel = lodash_isFinite__WEBPACK_IMPORTED_MODULE_4___default()(percentage) ? Math.round(percentage * 100) : '∞';
      const opsColor = (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_7__.pickBarColor)(operationName);
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(OpsLine, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(OpsNameContainer, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(OpsDot, {
            style: {
              backgroundColor: isOther ? 'transparent' : opsColor
            }
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(OpsName, {
            children: operationName
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(OpsContent, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(Dur, {
            children: [durLabel, "ms"]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(Pct, {
            children: [pctLabel, "%"]
          })]
        })]
      }, operationName);
    });

    if (!hideHeader) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(StyledBreakdown, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_5__.SectionHeading, {
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Operation Breakdown'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_8__["default"], {
            position: "top",
            size: "sm",
            containerDisplayMode: "block",
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Span durations are summed over the course of an entire transaction. Any overlapping spans are only counted once. Percentages are calculated by dividing the summed span durations by the total of all span durations.')
          })]
        }), contents]
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(StyledBreakdownNoHeader, {
      children: contents
    });
  }

}

OpsBreakdown.displayName = "OpsBreakdown";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(OpsBreakdown, "defaultProps", {
  topN: TOP_N_SPANS,
  hideHeader: false
});

const StyledBreakdown = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ebxobs98"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(4), ";" + ( true ? "" : 0));

const StyledBreakdownNoHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ebxobs97"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(3), ";" + ( true ? "" : 0));

const OpsLine = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ebxobs96"
} : 0)("display:flex;justify-content:space-between;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(0.5), ";*+*{margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(0.5), ";}" + ( true ? "" : 0));

const OpsDot = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ebxobs95"
} : 0)("content:'';display:block;width:8px;min-width:8px;height:8px;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";border-radius:100%;" + ( true ? "" : 0));

const OpsContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ebxobs94"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const OpsNameContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(OpsContent,  true ? {
  target: "ebxobs93"
} : 0)( true ? {
  name: "d3v9zr",
  styles: "overflow:hidden"
} : 0);

const OpsName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ebxobs92"
} : 0)( true ? {
  name: "l8l8b8",
  styles: "white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
} : 0);

const Dur = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ebxobs91"
} : 0)("color:", p => p.theme.gray300, ";font-variant-numeric:tabular-nums;" + ( true ? "" : 0));

const Pct = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ebxobs90"
} : 0)( true ? {
  name: "sw7g73",
  styles: "min-width:40px;text-align:right;font-variant-numeric:tabular-nums"
} : 0);

function mergeInterval(intervals) {
  // sort intervals by start timestamps
  intervals.sort((first, second) => {
    if (first[0] < second[0]) {
      // sort first before second
      return -1;
    }

    if (second[0] < first[0]) {
      // sort second before first
      return 1;
    }

    return 0;
  }); // array of disjoint intervals

  const merged = [];

  for (const currentInterval of intervals) {
    if (merged.length === 0) {
      merged.push(currentInterval);
      continue;
    }

    const lastInterval = merged[merged.length - 1];
    const lastIntervalEnd = lastInterval[1];
    const [currentIntervalStart, currentIntervalEnd] = currentInterval;

    if (lastIntervalEnd < currentIntervalStart) {
      // if currentInterval does not overlap with lastInterval,
      // then add currentInterval
      merged.push(currentInterval);
      continue;
    } // currentInterval and lastInterval overlaps; so we merge these intervals
    // invariant: lastIntervalStart <= currentIntervalStart


    lastInterval[1] = Math.max(lastIntervalEnd, currentIntervalEnd);
  }

  return merged;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OpsBreakdown);

/***/ }),

/***/ "./app/components/performance/waterfall/messageRow.tsx":
/*!*************************************************************!*\
  !*** ./app/components/performance/waterfall/messageRow.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "MessageRow": () => (/* binding */ MessageRow)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_performance_waterfall_constants__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/performance/waterfall/constants */ "./app/components/performance/waterfall/constants.tsx");
/* harmony import */ var sentry_components_performance_waterfall_row__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/performance/waterfall/row */ "./app/components/performance/waterfall/row.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");




const MessageRow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_performance_waterfall_row__WEBPACK_IMPORTED_MODULE_2__.Row,  true ? {
  target: "e1khbnog0"
} : 0)("display:block;cursor:auto;line-height:", sentry_components_performance_waterfall_constants__WEBPACK_IMPORTED_MODULE_1__.ROW_HEIGHT, "px;padding-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(1), ";padding-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(1), ";color:", p => p.theme.gray300, ";background-color:", p => p.theme.backgroundSecondary, ";outline:1px solid ", p => p.theme.border, ";font-size:", p => p.theme.fontSizeSmall, ";z-index:", p => p.theme.zIndex.traceView.rowInfoMessage, ";>*+*{margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(2), ";}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/performance/waterfall/miniHeader.tsx":
/*!*************************************************************!*\
  !*** ./app/components/performance/waterfall/miniHeader.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DividerSpacer": () => (/* binding */ DividerSpacer),
/* harmony export */   "ScrollbarContainer": () => (/* binding */ ScrollbarContainer),
/* harmony export */   "VirtualScrollbar": () => (/* binding */ VirtualScrollbar),
/* harmony export */   "VirtualScrollbarGrip": () => (/* binding */ VirtualScrollbarGrip)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");

const DividerSpacer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1663mch3"
} : 0)("width:1px;background-color:", p => p.theme.border, ";" + ( true ? "" : 0));
const MINI_HEADER_HEIGHT = 20;
const ScrollbarContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1663mch2"
} : 0)("display:block;width:100%;height:", MINI_HEADER_HEIGHT + 50, "px;&>div[data-type='virtual-scrollbar'].dragging>div{background-color:", p => p.theme.textColor, ";opacity:0.8;cursor:grabbing;}overflow-x:scroll;" + ( true ? "" : 0));
const VirtualScrollbar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1663mch1"
} : 0)("height:8px;width:0;padding-left:4px;padding-right:4px;position:sticky;top:", (MINI_HEADER_HEIGHT - 8) / 2, "px;left:0;cursor:grab;" + ( true ? "" : 0));
const VirtualScrollbarGrip = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1663mch0"
} : 0)("height:8px;width:100%;border-radius:20px;transition:background-color 150ms ease;background-color:", p => p.theme.textColor, ";opacity:0.5;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/performance/waterfall/row.tsx":
/*!******************************************************!*\
  !*** ./app/components/performance/waterfall/row.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Row": () => (/* binding */ Row),
/* harmony export */   "RowCell": () => (/* binding */ RowCell),
/* harmony export */   "RowCellContainer": () => (/* binding */ RowCellContainer)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_performance_waterfall_constants__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/performance/waterfall/constants */ "./app/components/performance/waterfall/constants.tsx");
/* harmony import */ var sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/performance/waterfall/utils */ "./app/components/performance/waterfall/utils.tsx");



const Row = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1wrqgcn2"
} : 0)("display:", p => p.visible ? 'block' : 'none', ";border-top:", p => p.showBorder ? `1px solid ${p.theme.border}` : null, ";margin-top:", p => p.showBorder ? '-1px' : null, ";position:relative;overflow:hidden;min-height:", sentry_components_performance_waterfall_constants__WEBPACK_IMPORTED_MODULE_1__.ROW_HEIGHT, "px;cursor:", p => {
  var _p$cursor;

  return (_p$cursor = p.cursor) !== null && _p$cursor !== void 0 ? _p$cursor : 'pointer';
}, ";transition:background-color 0.15s ease-in-out;&:last-child{&>[data-component='span-detail']{border-bottom:none!important;}}" + ( true ? "" : 0));
const RowCellContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1wrqgcn1"
} : 0)("display:flex;position:relative;height:", sentry_components_performance_waterfall_constants__WEBPACK_IMPORTED_MODULE_1__.ROW_HEIGHT, "px;overflow:hidden;user-select:none;&:hover>div[data-type='span-row-cell']{background-color:", p => p.showDetail ? p.theme.textColor : p.theme.backgroundSecondary, ";}" + ( true ? "" : 0));
const RowCell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1wrqgcn0"
} : 0)("position:relative;height:100%;overflow:hidden;background-color:", p => (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_2__.getBackgroundColor)(p), ";transition:background-color 125ms ease-in-out;color:", p => p.showDetail ? p.theme.background : 'inherit', ";display:flex;align-items:center;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/performance/waterfall/rowDetails.tsx":
/*!*************************************************************!*\
  !*** ./app/components/performance/waterfall/rowDetails.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ErrorDot": () => (/* binding */ ErrorDot),
/* harmony export */   "ErrorLevel": () => (/* binding */ ErrorLevel),
/* harmony export */   "ErrorMessageContent": () => (/* binding */ ErrorMessageContent),
/* harmony export */   "ErrorMessageTitle": () => (/* binding */ ErrorMessageTitle),
/* harmony export */   "ErrorTitle": () => (/* binding */ ErrorTitle)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


const ErrorMessageTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1j8ceje4"
} : 0)( true ? {
  name: "1eoy87d",
  styles: "display:flex;justify-content:space-between"
} : 0);
const ErrorMessageContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1j8ceje3"
} : 0)("display:grid;align-items:center;grid-template-columns:16px 72px auto;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(0.75), ";margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(0.75), ";" + ( true ? "" : 0));
const ErrorDot = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1j8ceje2"
} : 0)("background-color:", p => p.theme.level[p.level], ";content:'';width:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1), ";min-width:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1), ";height:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1), ";margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1), ";border-radius:100%;flex:1;" + ( true ? "" : 0));
const ErrorLevel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1j8ceje1"
} : 0)( true ? {
  name: "m0jwvv",
  styles: "width:80px"
} : 0);
const ErrorTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1j8ceje0"
} : 0)(p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/performance/waterfall/rowDivider.tsx":
/*!*************************************************************!*\
  !*** ./app/components/performance/waterfall/rowDivider.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DividerContainer": () => (/* binding */ DividerContainer),
/* harmony export */   "DividerLine": () => (/* binding */ DividerLine),
/* harmony export */   "DividerLineGhostContainer": () => (/* binding */ DividerLineGhostContainer),
/* harmony export */   "EmbeddedTransactionBadge": () => (/* binding */ EmbeddedTransactionBadge),
/* harmony export */   "ErrorBadge": () => (/* binding */ ErrorBadge)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }




const DividerContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1hoco293"
} : 0)( true ? {
  name: "zxn8uc",
  styles: "position:relative;min-width:1px"
} : 0);
const DividerLine = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1hoco292"
} : 0)("background-color:", p => p.showDetail ? p.theme.textColor : p.theme.border, ";position:absolute;height:100%;width:1px;transition:background-color 125ms ease-in-out;z-index:", p => p.theme.zIndex.traceView.dividerLine, ";&:after{content:'';z-index:-1;position:absolute;left:-2px;top:0;width:5px;height:100%;}&.hovering{background-color:", p => p.theme.textColor, ";width:3px;transform:translateX(-1px);margin-right:-2px;cursor:ew-resize;&:after{left:-2px;width:7px;}}" + ( true ? "" : 0));
const DividerLineGhostContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1hoco291"
} : 0)( true ? {
  name: "19s8nj4",
  styles: "position:absolute;width:100%;height:100%"
} : 0);

const BadgeBorder = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1hoco290"
} : 0)("position:absolute;margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(0.25), ";left:-11px;background:", p => p.theme.background, ";width:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(3), ";height:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(3), ";border:1px solid ", p => p.theme[p.borderColor], ";border-radius:50%;z-index:", p => p.theme.zIndex.traceView.dividerLine, ";display:flex;align-items:center;justify-content:center;" + ( true ? "" : 0));

function ErrorBadge() {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(BadgeBorder, {
    borderColor: "red300",
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_1__.IconFire, {
      color: "red300",
      size: "xs"
    })
  });
}
ErrorBadge.displayName = "ErrorBadge";
function EmbeddedTransactionBadge(_ref) {
  let {
    expanded,
    onClick
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(BadgeBorder, {
    "data-test-id": "embedded-transaction-badge",
    borderColor: "border",
    onClick: event => {
      event.stopPropagation();
      event.preventDefault();
      onClick();
    },
    children: expanded ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_1__.IconSubtract, {
      color: "textColor",
      size: "xs"
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_1__.IconAdd, {
      color: "textColor",
      size: "xs"
    })
  });
}
EmbeddedTransactionBadge.displayName = "EmbeddedTransactionBadge";

/***/ }),

/***/ "./app/components/performance/waterfall/rowTitle.tsx":
/*!***********************************************************!*\
  !*** ./app/components/performance/waterfall/rowTitle.tsx ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "RowTitle": () => (/* binding */ RowTitle),
/* harmony export */   "RowTitleContainer": () => (/* binding */ RowTitleContainer),
/* harmony export */   "RowTitleContent": () => (/* binding */ RowTitleContent),
/* harmony export */   "SpanGroupRowTitleContent": () => (/* binding */ SpanGroupRowTitleContent)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_performance_waterfall_constants__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/performance/waterfall/constants */ "./app/components/performance/waterfall/constants.tsx");


const RowTitleContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1z0v4to3"
} : 0)("display:flex;align-items:center;height:", sentry_components_performance_waterfall_constants__WEBPACK_IMPORTED_MODULE_1__.ROW_HEIGHT, "px;position:absolute;left:0;top:0;width:100%;user-select:none;" + ( true ? "" : 0));
const RowTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1z0v4to2"
} : 0)("position:relative;height:100%;font-size:", p => p.theme.fontSizeSmall, ";white-space:nowrap;display:flex;flex:1;align-items:center;" + ( true ? "" : 0));
const RowTitleContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1z0v4to1"
} : 0)("color:", p => p.errored ? p.theme.error : 'inherit', ";" + ( true ? "" : 0));
const SpanGroupRowTitleContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1z0v4to0"
} : 0)("color:", p => p.theme.linkColor, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/pill.tsx":
/*!*********************************!*\
  !*** ./app/components/pill.tsx ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





const Pill = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.memo)(_ref => {
  let {
    name,
    value,
    children,
    type,
    className
  } = _ref;

  const getTypeAndValue = () => {
    if (value === undefined) {
      return {};
    }

    switch (value) {
      case 'true':
      case true:
        return {
          valueType: 'positive',
          renderValue: 'true'
        };

      case 'false':
      case false:
        return {
          valueType: 'negative',
          renderValue: 'false'
        };

      case null:
      case undefined:
        return {
          valueType: 'error',
          renderValue: 'n/a'
        };

      default:
        return {
          valueType: undefined,
          renderValue: String(value)
        };
    }
  };

  const {
    valueType,
    renderValue
  } = getTypeAndValue();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(StyledPill, {
    type: type !== null && type !== void 0 ? type : valueType,
    className: className,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(PillName, {
      children: name
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(PillValue, {
      children: children !== null && children !== void 0 ? children : renderValue
    })]
  });
});

const getPillStyle = _ref2 => {
  let {
    type,
    theme
  } = _ref2;

  switch (type) {
    case 'error':
      return `
        background: ${theme.red100};
        border: 1px solid ${theme.red300};
      `;

    default:
      return `
        border: 1px solid ${theme.border};
      `;
  }
};

const getPillValueStyle = _ref3 => {
  let {
    type,
    theme
  } = _ref3;

  switch (type) {
    case 'positive':
      return `
        background: ${theme.green100};
        border: 1px solid ${theme.green300};
        border-left-color: ${theme.green300};
        font-family: ${theme.text.familyMono};
        margin: -1px;
      `;

    case 'error':
      return `
        border-left-color: ${theme.red300};
        background: ${theme.red100};
        border: 1px solid ${theme.red300};
        margin: -1px;
      `;

    case 'negative':
      return `
        border-left-color: ${theme.red300};
        background: ${theme.red100};
        border: 1px solid ${theme.red300};
        font-family: ${theme.text.familyMono};
        margin: -1px;
      `;

    default:
      return `
        background: ${theme.backgroundSecondary};
        font-family: ${theme.text.familyMono};
      `;
  }
};

const PillName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1qdl66w2"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(0.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), ";min-width:0;white-space:nowrap;display:flex;align-items:center;" + ( true ? "" : 0));

const PillValue = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(PillName,  true ? {
  target: "e1qdl66w1"
} : 0)("border-left:1px solid ", p => p.theme.border, ";border-radius:", p => `0 ${p.theme.button.borderRadius} ${p.theme.button.borderRadius} 0`, ";max-width:100%;display:flex;align-items:center;>a{max-width:100%;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;display:inline-block;vertical-align:text-bottom;}.pill-icon,.external-icon{display:inline;margin:0 0 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), ";color:", p => p.theme.gray300, ";&:hover{color:", p => p.theme.textColor, ";}}" + ( true ? "" : 0));

const StyledPill = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('li',  true ? {
  target: "e1qdl66w0"
} : 0)("white-space:nowrap;margin:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), " 0;display:flex;border-radius:", p => p.theme.button.borderRadius, ";box-shadow:", p => p.theme.dropShadowLightest, ";line-height:1.2;max-width:100%;:last-child{margin-right:0;}", getPillStyle, ";", PillValue, "{", getPillValueStyle, ";}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Pill);

/***/ }),

/***/ "./app/components/pills.tsx":
/*!**********************************!*\
  !*** ./app/components/pills.tsx ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");


const Pills = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1nyfzl40"
} : 0)("display:flex;flex-wrap:wrap;font-size:", p => p.theme.fontSizeSmall, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Pills);

/***/ }),

/***/ "./app/components/quickTrace/utils.tsx":
/*!*********************************************!*\
  !*** ./app/components/quickTrace/utils.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "generateIssueEventTarget": () => (/* binding */ generateIssueEventTarget),
/* harmony export */   "generateMultiTransactionsTarget": () => (/* binding */ generateMultiTransactionsTarget),
/* harmony export */   "generateSingleErrorTarget": () => (/* binding */ generateSingleErrorTarget),
/* harmony export */   "generateSingleTransactionTarget": () => (/* binding */ generateSingleTransactionTarget),
/* harmony export */   "generateTraceTarget": () => (/* binding */ generateTraceTarget),
/* harmony export */   "isQuickTraceEvent": () => (/* binding */ isQuickTraceEvent)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/constants/pageFilters */ "./app/constants/pageFilters.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_discover_urls__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/discover/urls */ "./app/utils/discover/urls.tsx");
/* harmony import */ var sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/performance/quickTrace/utils */ "./app/utils/performance/quickTrace/utils.tsx");
/* harmony import */ var sentry_utils_performance_urls__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/performance/urls */ "./app/utils/performance/urls.ts");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_views_performance_traceDetails_utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/performance/traceDetails/utils */ "./app/views/performance/traceDetails/utils.tsx");











function isQuickTraceEvent(event) {
  return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_4__.defined)(event['transaction.duration']);
}
function generateIssueEventTarget(event, organization) {
  return `/organizations/${organization.slug}/issues/${event.issue_id}/events/${event.event_id}`;
}

function generatePerformanceEventTarget(event, organization, location) {
  const eventSlug = (0,sentry_utils_discover_urls__WEBPACK_IMPORTED_MODULE_6__.generateEventSlug)({
    id: event.event_id,
    project: event.project_slug
  });
  const query = { ...location.query,
    project: String(event.project_id)
  };
  return (0,sentry_utils_performance_urls__WEBPACK_IMPORTED_MODULE_8__.getTransactionDetailsUrl)(organization.slug, eventSlug, event.transaction, query);
}

function generateDiscoverEventTarget(event, organization, location) {
  const eventSlug = (0,sentry_utils_discover_urls__WEBPACK_IMPORTED_MODULE_6__.generateEventSlug)({
    id: event.event_id,
    project: event.project_slug
  });
  const newLocation = { ...location,
    query: { ...location.query,
      project: String(event.project_id)
    }
  };
  return (0,sentry_utils_discover_urls__WEBPACK_IMPORTED_MODULE_6__.eventDetailsRouteWithEventView)({
    orgSlug: organization.slug,
    eventSlug,
    eventView: sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_5__["default"].fromLocation(newLocation)
  });
}

function generateSingleErrorTarget(event, organization, location, destination) {
  switch (destination) {
    case 'issue':
      return generateIssueEventTarget(event, organization);

    case 'discover':
    default:
      return generateDiscoverEventTarget(event, organization, location);
  }
}
function generateSingleTransactionTarget(event, organization, location, destination) {
  switch (destination) {
    case 'performance':
      return generatePerformanceEventTarget(event, organization, location);

    case 'discover':
    default:
      return generateDiscoverEventTarget(event, organization, location);
  }
}
function generateMultiTransactionsTarget(currentEvent, events, organization, groupType) {
  const queryResults = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_9__.MutableSearch([]);
  const eventIds = events.map(child => child.event_id);

  for (let i = 0; i < eventIds.length; i++) {
    queryResults.addOp(i === 0 ? '(' : 'OR');
    queryResults.addFreeText(`id:${eventIds[i]}`);

    if (i === eventIds.length - 1) {
      queryResults.addOp(')');
    }
  }

  const {
    start,
    end
  } = (0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_7__.getTraceTimeRangeFromEvent)(currentEvent);
  const traceEventView = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_5__["default"].fromSavedQuery({
    id: undefined,
    name: `${groupType} Transactions of Event ID ${currentEvent.id}`,
    fields: ['transaction', 'project', 'trace.span', 'transaction.duration', 'timestamp'],
    orderby: '-timestamp',
    query: queryResults.formatString(),
    projects: [...new Set(events.map(child => child.project_id))],
    version: 2,
    start,
    end
  });
  return traceEventView.getResultsViewUrlTarget(organization.slug);
}
function generateTraceTarget(event, organization) {
  var _event$contexts$trace, _event$contexts, _event$contexts$trace2;

  const traceId = (_event$contexts$trace = (_event$contexts = event.contexts) === null || _event$contexts === void 0 ? void 0 : (_event$contexts$trace2 = _event$contexts.trace) === null || _event$contexts$trace2 === void 0 ? void 0 : _event$contexts$trace2.trace_id) !== null && _event$contexts$trace !== void 0 ? _event$contexts$trace : '';
  const dateSelection = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_2__.normalizeDateTimeParams)((0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_7__.getTraceTimeRangeFromEvent)(event));

  if (organization.features.includes('performance-view')) {
    // TODO(txiao): Should this persist the current query when going to trace view?
    return (0,sentry_views_performance_traceDetails_utils__WEBPACK_IMPORTED_MODULE_10__.getTraceDetailsUrl)(organization, traceId, dateSelection, {});
  }

  const eventView = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_5__["default"].fromSavedQuery({
    id: undefined,
    name: `Events with Trace ID ${traceId}`,
    fields: ['title', 'event.type', 'project', 'trace.span', 'timestamp'],
    orderby: '-timestamp',
    query: `trace:${traceId}`,
    projects: organization.features.includes('global-views') ? [sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_3__.ALL_ACCESS_PROJECTS] : [Number(event.projectID)],
    version: 2,
    ...dateSelection
  });
  return eventView.getResultsViewUrlTarget(organization.slug);
}

/***/ }),

/***/ "./app/constants/ios-device-list.tsx":
/*!*******************************************!*\
  !*** ./app/constants/ios-device-list.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "iOSDeviceMapping": () => (/* binding */ iOSDeviceMapping)
/* harmony export */ });
// THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
// generated using scripts/extract-ios-device-names.ts as part of build step.
// the purpose of the script is to extract only the iOS information that Sentry cares about
// and discard the rest of the JSON so we do not end up bloating bundle size.
const iOSDeviceMapping = {
  'iPod1,1': 'iPod touch',
  'iPod2,1': 'iPod touch (2nd generation)',
  'iPod3,1': 'iPod touch (3rd generation)',
  'iPod4,1': 'iPod touch (4th generation)',
  'iPod5,1': 'iPod touch (5th generation)',
  'iPod7,1': 'iPod touch (6th generation)',
  'iPod9,1': 'iPod touch (7th generation)',
  'iPhone1,1': 'iPhone',
  'iPhone1,2': 'iPhone 3G',
  'iPhone2,1': 'iPhone 3GS',
  'iPhone3,1': 'iPhone 4',
  'iPhone3,2': 'iPhone 4',
  'iPhone3,3': 'iPhone 4',
  'iPhone4,1': 'iPhone 4S',
  'iPhone5,1': 'iPhone 5',
  'iPhone5,2': 'iPhone 5',
  'iPhone5,3': 'iPhone 5c',
  'iPhone5,4': 'iPhone 5c',
  'iPhone6,1': 'iPhone 5s',
  'iPhone6,2': 'iPhone 5s',
  'iPhone8,4': 'iPhone SE (1st generation)',
  'iPhone7,2': 'iPhone 6',
  'iPhone7,1': 'iPhone 6 Plus',
  'iPhone8,1': 'iPhone 6s',
  'iPhone8,2': 'iPhone 6s Plus',
  'iPhone9,1': 'iPhone 7',
  'iPhone9,3': 'iPhone 7',
  'iPhone9,2': 'iPhone 7 Plus',
  'iPhone9,4': 'iPhone 7 Plus',
  'iPhone10,1': 'iPhone 8',
  'iPhone10,4': 'iPhone 8',
  'iPhone10,2': 'iPhone 8 Plus',
  'iPhone10,5': 'iPhone 8 Plus',
  'iPhone10,3': 'iPhone X',
  'iPhone10,6': 'iPhone X',
  'iPhone11,8': 'iPhone XR',
  'iPhone11,2': 'iPhone XS',
  'iPhone11,4': 'iPhone XS Max',
  'iPhone11,6': 'iPhone XS Max',
  'iPhone12,1': 'iPhone 11',
  'iPhone12,3': 'iPhone 11 Pro',
  'iPhone12,5': 'iPhone 11 Pro Max',
  'iPhone12,8': 'iPhone SE (2nd generation)',
  'iPhone13,1': 'iPhone 12 mini',
  'iPhone13,2': 'iPhone 12',
  'iPhone13,3': 'iPhone 12 Pro',
  'iPhone13,4': 'iPhone 12 Pro Max',
  'iPad6,7': 'iPad Pro (12.9-inch)',
  'iPad6,8': 'iPad Pro (12.9-inch)',
  'iPad6,3': 'iPad Pro (9.7-inch)',
  'iPad6,4': 'iPad Pro (9.7-inch)',
  'iPad7,1': 'iPad Pro (12.9-inch, 2nd generation)',
  'iPad7,2': 'iPad Pro (12.9-inch, 2nd generation)',
  'iPad7,3': 'iPad Pro (10.5-inch)',
  'iPad7,4': 'iPad Pro (10.5-inch)',
  'iPad8,1': 'iPad Pro (11-inch)',
  'iPad8,2': 'iPad Pro (11-inch)',
  'iPad8,3': 'iPad Pro (11-inch)',
  'iPad8,4': 'iPad Pro (11-inch)',
  'iPad8,5': 'iPad Pro (12.9-inch) (3rd generation)',
  'iPad8,6': 'iPad Pro (12.9-inch) (3rd generation)',
  'iPad8,7': 'iPad Pro (12.9-inch) (3rd generation)',
  'iPad8,8': 'iPad Pro (12.9-inch) (3rd generation)',
  'iPad8,9': 'iPad Pro (11-inch) (2nd generation)',
  'iPad8,10': 'iPad Pro (11-inch) (2nd generation)',
  'iPad8,11': 'iPad Pro (12.9-inch) (4th generation)',
  'iPad8,12': 'iPad Pro (12.9-inch) (4th generation)',
  'iPad2,5': 'iPad mini',
  'iPad2,6': 'iPad mini',
  'iPad2,7': 'iPad mini',
  'iPad4,4': 'iPad mini 2',
  'iPad4,5': 'iPad mini 2',
  'iPad4,6': 'iPad mini 2',
  'iPad4,7': 'iPad mini 3',
  'iPad4,8': 'iPad mini 3',
  'iPad4,9': 'iPad mini 3',
  'iPad5,1': 'iPad mini 4',
  'iPad5,2': 'iPad mini 4',
  'iPad11,1': 'iPad mini (5th generation)',
  'iPad11,2': 'iPad mini (5th generation)',
  'iPad4,1': 'iPad Air',
  'iPad4,2': 'iPad Air',
  'iPad4,3': 'iPad Air',
  'iPad5,3': 'iPad Air 2',
  'iPad5,4': 'iPad Air 2',
  'iPad11,3': 'iPad Air (3rd generation)',
  'iPad11,4': 'iPad Air (3rd generation)',
  'iPad13,1': 'iPad Air (4th generation)',
  'iPad13,2': 'iPad Air (4th generation)',
  'iPad1,1': 'iPad',
  'iPad2,1': 'iPad 2',
  'iPad2,2': 'iPad 2',
  'iPad2,3': 'iPad 2',
  'iPad2,4': 'iPad 2',
  'iPad3,1': 'iPad (3rd generation)',
  'iPad3,2': 'iPad (3rd generation)',
  'iPad3,3': 'iPad (3rd generation)',
  'iPad3,4': 'iPad (4th generation)',
  'iPad3,5': 'iPad (4th generation)',
  'iPad3,6': 'iPad (4th generation)',
  'iPad6,11': 'iPad (5th generation)',
  'iPad6,12': 'iPad (5th generation)',
  'iPad7,5': 'iPad (6th generation)',
  'iPad7,6': 'iPad (6th generation)',
  'iPad7,11': 'iPad (7th generation)',
  'iPad7,12': 'iPad (7th generation)',
  'iPad11,6': 'iPad (8th generation)',
  'iPad11,7': 'iPad (8th generation)',
  'AudioAccessory1,1': 'HomePod',
  'AudioAccessory1,2': 'HomePod',
  'AudioAccessory5,1': 'HomePod mini',
  'Watch1,1': 'Apple Watch (1st generation)',
  'Watch1,2': 'Apple Watch (1st generation)',
  'Watch2,6': 'Apple Watch Series 1',
  'Watch2,7': 'Apple Watch Series 1',
  'Watch2,3': 'Apple Watch Series 2',
  'Watch2,4': 'Apple Watch Series 2',
  'Watch3,1': 'Apple Watch Series 3',
  'Watch3,2': 'Apple Watch Series 3',
  'Watch3,3': 'Apple Watch Series 3',
  'Watch3,4': 'Apple Watch Series 3',
  'Watch4,1': 'Apple Watch Series 4',
  'Watch4,2': 'Apple Watch Series 4',
  'Watch4,3': 'Apple Watch Series 4',
  'Watch4,4': 'Apple Watch Series 4',
  'Watch5,1': 'Apple Watch Series 5',
  'Watch5,2': 'Apple Watch Series 5',
  'Watch5,3': 'Apple Watch Series 5',
  'Watch5,4': 'Apple Watch Series 5',
  'Watch5,9': 'Apple Watch SE',
  'Watch5,10': 'Apple Watch SE',
  'Watch5,11': 'Apple Watch SE',
  'Watch5,12': 'Apple Watch SE',
  'Watch6,1': 'Apple Watch Series 6',
  'Watch6,2': 'Apple Watch Series 6',
  'Watch6,3': 'Apple Watch Series 6',
  'Watch6,4': 'Apple Watch Series 6',
  'AppleTV1,1': 'Apple TV (1st generation)',
  'AppleTV2,1': 'Apple TV (2nd generation)',
  'AppleTV3,1': 'Apple TV (3rd generation)',
  'AppleTV3,2': 'Apple TV (3rd generation)',
  'AppleTV5,3': 'Apple TV (4th generation)',
  'AppleTV6,2': 'Apple TV 4K',
  'AirPods1,1': 'AirPods (1st generation)',
  'AirPods2,1': 'AirPods (2nd generation)',
  'iProd8,1': 'AirPods Pro'
};


/***/ }),

/***/ "./app/utils/userselect.tsx":
/*!**********************************!*\
  !*** ./app/utils/userselect.tsx ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "setBodyUserSelect": () => (/* binding */ setBodyUserSelect)
/* harmony export */ });
const setBodyUserSelect = nextValues => {
  // NOTE: Vendor prefixes other than `ms` should begin with a capital letter.
  // ref: https://reactjs.org/docs/dom-elements.html#style
  const previousValues = {
    userSelect: document.body.style.userSelect,
    // MozUserSelect is not typed in TS
    // @ts-expect-error
    MozUserSelect: document.body.style.MozUserSelect,
    // msUserSelect is not typed in TS
    // @ts-expect-error
    msUserSelect: document.body.style.msUserSelect,
    webkitUserSelect: document.body.style.webkitUserSelect
  };
  document.body.style.userSelect = nextValues.userSelect || ''; // MozUserSelect is not typed in TS
  // @ts-expect-error

  document.body.style.MozUserSelect = nextValues.MozUserSelect || ''; // msUserSelect is not typed in TS
  // @ts-expect-error

  document.body.style.msUserSelect = nextValues.msUserSelect || '';
  document.body.style.webkitUserSelect = nextValues.webkitUserSelect || '';
  return previousValues;
};

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionSpans/spanDetails/utils.tsx":
/*!*****************************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionSpans/spanDetails/utils.tsx ***!
  \*****************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ZoomKeys": () => (/* binding */ ZoomKeys),
/* harmony export */   "generateSpanDetailsRoute": () => (/* binding */ generateSpanDetailsRoute),
/* harmony export */   "spanDetailsRouteWithQuery": () => (/* binding */ spanDetailsRouteWithQuery)
/* harmony export */ });
function generateSpanDetailsRoute(_ref) {
  let {
    orgSlug,
    spanSlug
  } = _ref;
  const spanComponent = `${encodeURIComponent(spanSlug.op)}:${spanSlug.group}`;
  return `/organizations/${orgSlug}/performance/summary/spans/${spanComponent}/`;
}
function spanDetailsRouteWithQuery(_ref2) {
  let {
    orgSlug,
    transaction,
    query,
    spanSlug,
    projectID
  } = _ref2;
  const pathname = generateSpanDetailsRoute({
    orgSlug,
    spanSlug
  });
  return {
    pathname,
    query: {
      transaction,
      project: projectID,
      environment: query.environment,
      statsPeriod: query.statsPeriod,
      start: query.start,
      end: query.end,
      query: query.query
    }
  };
}
let ZoomKeys;

(function (ZoomKeys) {
  ZoomKeys["MIN"] = "min";
  ZoomKeys["MAX"] = "max";
})(ZoomKeys || (ZoomKeys = {}));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_events_eventTags_eventTagsPill_tsx-app_components_events_interfaces_spans_anch-85b5a4.804b51ab53282d83da1842658d09d32e.js.map