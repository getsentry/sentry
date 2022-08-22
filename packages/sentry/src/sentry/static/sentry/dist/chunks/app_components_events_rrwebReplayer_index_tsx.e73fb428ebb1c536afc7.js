"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_events_rrwebReplayer_index_tsx"],{

/***/ "./app/components/events/rrwebReplayer/baseRRWebReplayer.tsx":
/*!*******************************************************************!*\
  !*** ./app/components/events/rrwebReplayer/baseRRWebReplayer.tsx ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var rrweb_player__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! rrweb-player */ "../node_modules/rrweb-player/dist/index.mjs");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






const BaseRRWebReplayerComponent = _ref => {
  let {
    events,
    className
  } = _ref;
  const playerEl = (0,react__WEBPACK_IMPORTED_MODULE_1__.useRef)(null);

  const initPlayer = () => {
    if (events === undefined) {
      return;
    }

    if (playerEl.current === null) {
      return;
    } // eslint-disable-next-line no-new


    new rrweb_player__WEBPACK_IMPORTED_MODULE_2__["default"]({
      target: playerEl.current,
      props: {
        events,
        autoPlay: false
      }
    });
  };

  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => void initPlayer(), [events]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
    ref: playerEl,
    className: className
  });
};

BaseRRWebReplayerComponent.displayName = "BaseRRWebReplayerComponent";

const BaseRRWebReplayer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(BaseRRWebReplayerComponent,  true ? {
  target: "enpzvyc0"
} : 0)(".replayer-mouse{position:absolute;width:32px;height:32px;transition:left 0.05s linear,top 0.05s linear;background-size:contain;background-repeat:no-repeat;background-image:url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iMTkiIHZpZXdCb3g9IjAgMCAxMiAxOSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTAgMTZWMEwxMS42IDExLjZINC44TDQuNCAxMS43TDAgMTZaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNOS4xIDE2LjdMNS41IDE4LjJMMC43OTk5OTkgNy4xTDQuNSA1LjZMOS4xIDE2LjdaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNNC42NzQ1MSA4LjYxODUxTDIuODMwMzEgOS4zOTI3MUw1LjkyNzExIDE2Ljc2OTVMNy43NzEzMSAxNS45OTUzTDQuNjc0NTEgOC42MTg1MVoiIGZpbGw9ImJsYWNrIi8+CjxwYXRoIGQ9Ik0xIDIuNFYxMy42TDQgMTAuN0w0LjQgMTAuNkg5LjJMMSAyLjRaIiBmaWxsPSJibGFjayIvPgo8L3N2Zz4K');border-color:transparent;}.replayer-mouse:after{content:'';display:inline-block;width:32px;height:32px;background:", p => p.theme.purple300, ";border-radius:100%;transform:translate(-50%, -50%);opacity:0.3;}.replayer-mouse.active:after{animation:click 0.2s ease-in-out 1;}.replayer-mouse.touch-device{background-image:none;width:70px;height:70px;border-radius:100%;margin-left:-37px;margin-top:-37px;border:4px solid rgba(73, 80, 246, 0);transition:left 0s linear,top 0s linear,border-color 0.2s ease-in-out;}.replayer-mouse.touch-device.touch-active{border-color:", p => p.theme.purple200, ";transition:left 0.25s linear,top 0.25s linear,border-color 0.2s ease-in-out;}.replayer-mouse.touch-device:after{opacity:0;}.replayer-mouse.touch-device.active:after{animation:touch-click 0.2s ease-in-out 1;}.replayer-mouse-tail{position:absolute;pointer-events:none;}@keyframes click{0%{opacity:0.3;width:20px;height:20px;}50%{opacity:0.5;width:10px;height:10px;}}@keyframes touch-click{0%{opacity:0;width:20px;height:20px;}50%{opacity:0.5;width:10px;height:10px;}}.replayer-wrapper>iframe{border:none;}.rr-player{width:auto!important;height:auto!important;}.rr-player__frame{width:100%!important;border-radius:3px 3px 0 0;border:1px solid ", p => p.theme.border, ";overflow:hidden;}.rr-player iframe{width:100%!important;height:100%!important;position:absolute;top:0;right:0;bottom:0;left:0;border:0;}.replayer-wrapper{transform:scale(0.6) translate(0, 0)!important;transform-origin:top left;width:166.66%;height:166.66%;overflow:hidden;position:relative;box-shadow:inset 0 -1px 3px rgba(0, 0, 0, 0.08);}.replayer-mouse,.replayer-mouse:after{z-index:", p => p.theme.zIndex.tooltip, ";}.rr-controller{width:100%;display:block;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(2), " 0;background:", p => p.theme.background, ";border-radius:0 0 3px 3px;border:1px solid ", p => p.theme.border, ";border-top:none;position:relative;color:", p => p.theme.textColor, ";}.rr-timeline{width:100%;display:grid;grid-template-columns:90px 1fr 90px;align-items:center;}.rr-timeline__time{text-align:center;color:", p => p.theme.textColor, ";}.rr-progress{width:100%;height:12px;position:relative;cursor:pointer;&:before{content:'';background:", p => p.theme.innerBorder, ";border-radius:3px;display:block;height:6px;position:absolute;left:0;right:0;top:3px;}}.rr-progress.disabled{cursor:not-allowed;}.rr-progress__step{height:6px;position:absolute;left:0;top:3px;border-radius:3px;background:", p => p.theme.purple200, ";}.rr-progress__handler{width:20px;height:20px;border-radius:50%;position:absolute;top:6px;transform:translate(-50%, -50%);background:", p => p.theme.purple300, ";}.rr-controller__btns{display:grid;grid-auto-flow:column;grid-auto-columns:max-content;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(0.75), ";align-items:center;justify-content:center;font-size:", p => p.theme.fontSizeSmall, ";}.rr-controller__btns button{color:", p => p.theme.textColor, ";width:28px;height:28px;display:flex;padding:0;align-items:center;justify-content:center;background:none;border:none;border-radius:50%;cursor:pointer;transition:background 200ms ease;>svg{fill:", p => p.theme.textColor, ";}}.rr-controller__btns button:active{background:", p => p.theme.innerBorder, ";}.rr-controller__btns button.active{color:", p => p.theme.white, ";background:", p => p.theme.active, ";}.rr-controller__btns button:disabled{cursor:not-allowed;}.switch{height:1em;display:flex;align-items:center;}.switch.disabled{opacity:0.5;}.label{margin:0 8px;}.switch input[type='checkbox']{position:absolute;visibility:hidden;}.switch label{width:32px;height:16px;position:relative;cursor:pointer;display:flex;align-items:center;margin:0;padding:2px 3px;}.switch.disabled label{cursor:not-allowed;}.switch label:before{content:'';position:absolute;top:0;left:0;right:0;bottom:0;border:1px solid ", p => p.theme.border, ";border-radius:16px;}.switch label:after{content:'';width:10px;height:10px;border-radius:50%;transition:all 200ms ease;background:", p => p.theme.border, ";z-index:2;}.switch input[type='checkbox']:checked+label:after{background:", p => p.theme.active, ";transform:translateX(16px);}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (BaseRRWebReplayer);

/***/ }),

/***/ "./app/components/events/rrwebReplayer/index.tsx":
/*!*******************************************************!*\
  !*** ./app/components/events/rrwebReplayer/index.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var _baseRRWebReplayer__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./baseRRWebReplayer */ "./app/components/events/rrwebReplayer/baseRRWebReplayer.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






/**
 * Downloads a list of replay JSONs, merges the resulting events within the
 * JSON and passes it to the replayer.
 */
function RRWebReplayer(_ref) {
  let {
    urls
  } = _ref;
  const [events, setEvents] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)();

  const loadEvents = async () => {
    try {
      // rrweb's recordings consist of:
      // 1) "checkout" phase that essentially records the entire DOM
      // 2) incremental updates (DOM changes/events)
      //
      // The "checkout" phase can be configured to happen at a time interval or
      // an event interval. We want to support SDK clients that record a
      // single, large JSON, but also clients that record the checkout and
      // incremental updates in separate JSON files.
      //
      // Below we download all of the JSON files and merge them into a large
      // list of events for the replayer. The replayer supports having a
      // list that has multiple "checkouts".
      const data = await Promise.all(urls.map(async url => {
        const resp = await fetch(url);
        const json = await resp.json();
        return json.events;
      }));
      setEvents(data.flat());
    } catch (err) {
      _sentry_react__WEBPACK_IMPORTED_MODULE_3__.captureException(err);
    }
  };

  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => void loadEvents(), [urls]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_baseRRWebReplayer__WEBPACK_IMPORTED_MODULE_2__["default"], {
    events: events
  });
}

RRWebReplayer.displayName = "RRWebReplayer";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (RRWebReplayer);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_events_rrwebReplayer_index_tsx.6aaf71e5e2ddafdb7da44de102b9155a.js.map