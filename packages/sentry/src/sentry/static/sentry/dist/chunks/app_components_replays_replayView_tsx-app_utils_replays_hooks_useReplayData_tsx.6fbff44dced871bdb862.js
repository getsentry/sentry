"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_replays_replayView_tsx-app_utils_replays_hooks_useReplayData_tsx"],{

/***/ "./app/components/replays/player/bufferingOverlay.tsx":
/*!************************************************************!*\
  !*** ./app/components/replays/player/bufferingOverlay.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }







function BufferingOverlay(_ref) {
  let {
    className
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(Overlay, {
    className: className,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(Message, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_1__.IconClock, {
        size: "sm"
      }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Buffering...')]
    })
  });
}

BufferingOverlay.displayName = "BufferingOverlay";

/* Position the badge in the corner */
const Overlay = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1tth60i1"
} : 0)( true ? {
  name: "1p9eycc",
  styles: "user-select:none;display:grid;place-items:center"
} : 0);
/* Badge layout and style */


const Message = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1tth60i0"
} : 0)("display:grid;grid-template-columns:max-content max-content;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(0.75), ";place-items:center;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(3), ";background:", p => p.theme.gray300, ";border-radius:", p => p.theme.borderRadius, ";color:", p => p.theme.white, ";z-index:", p => p.theme.zIndex.initial, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (BufferingOverlay);

/***/ }),

/***/ "./app/components/replays/player/fastForwardBadge.tsx":
/*!************************************************************!*\
  !*** ./app/components/replays/player/fastForwardBadge.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }








function FastForwardBadge(_ref) {
  let {
    speed,
    className
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Badge, {
    className: className,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(FastForwardTooltip, {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Fast forwarding'),
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_2__.IconArrow, {
        size: "sm",
        direction: "right"
      }), speed, "x"]
    })
  });
}

FastForwardBadge.displayName = "FastForwardBadge";

/* Position the badge in the corner */
const Badge = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1135tm81"
} : 0)( true ? {
  name: "8y7axy",
  styles: "user-select:none;display:grid;align-items:end;justify-items:start"
} : 0);
/* Badge layout and style */


const FastForwardTooltip = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "e1135tm80"
} : 0)("display:grid;grid-template-columns:max-content max-content;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(0.5), ";align-items:center;background:", p => p.theme.gray300, ";color:", p => p.theme.white, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(2), ";border-top-right-radius:", p => p.theme.borderRadius, ";z-index:", p => p.theme.zIndex.initial, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (FastForwardBadge);

/***/ }),

/***/ "./app/components/replays/player/scrubber.tsx":
/*!****************************************************!*\
  !*** ./app/components/replays/player/scrubber.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "PlayerScrubber": () => (/* binding */ PlayerScrubber),
/* harmony export */   "TimelineScrubber": () => (/* binding */ TimelineScrubber)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_forms_controls_rangeSlider__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/forms/controls/rangeSlider */ "./app/components/forms/controls/rangeSlider/index.tsx");
/* harmony import */ var sentry_components_forms_controls_rangeSlider_sliderAndInputWrapper__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/forms/controls/rangeSlider/sliderAndInputWrapper */ "./app/components/forms/controls/rangeSlider/sliderAndInputWrapper.tsx");
/* harmony import */ var sentry_components_replays_progress__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/replays/progress */ "./app/components/replays/progress.tsx");
/* harmony import */ var sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/replays/replayContext */ "./app/components/replays/replayContext.tsx");
/* harmony import */ var sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/replays/utils */ "./app/components/replays/utils.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }










function Scrubber(_ref) {
  let {
    className
  } = _ref;
  const {
    currentHoverTime,
    currentTime,
    replay,
    setCurrentTime
  } = (0,sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_4__.useReplayContext)();
  const durationMs = replay === null || replay === void 0 ? void 0 : replay.getDurationMs();
  const percentComplete = (0,sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_5__.divide)(currentTime, durationMs);
  const hoverPlace = (0,sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_5__.divide)(currentHoverTime || 0, durationMs);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(Wrapper, {
    className: className,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(Meter, {
      children: [currentHoverTime ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(MouseTrackingValue, {
        percent: hoverPlace
      }) : null, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(PlaybackTimeValue, {
        percent: percentComplete
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(RangeWrapper, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Range, {
        name: "replay-timeline",
        min: 0,
        max: durationMs,
        value: Math.round(currentTime),
        onChange: value => setCurrentTime(value || 0),
        showLabel: false
      })
    })]
  });
}

Scrubber.displayName = "Scrubber";

const Meter = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_replays_progress__WEBPACK_IMPORTED_MODULE_3__.Meter,  true ? {
  target: "e138nie77"
} : 0)("background:", p => p.theme.gray200, ";" + ( true ? "" : 0));

const RangeWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e138nie76"
} : 0)( true ? {
  name: "1aubja5",
  styles: "overflow:hidden;width:100%"
} : 0);

const Range = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_forms_controls_rangeSlider__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "e138nie75"
} : 0)( true ? {
  name: "rjtouz",
  styles: "input{cursor:pointer;opacity:0;height:100%;&::-webkit-slider-thumb{height:0px;width:0px;}&::-moz-range-thumb{height:0px;width:0px;}&::-ms-thumb{height:0px;width:0px;}}"
} : 0); // Need the named value so we can target it separatly from PlaybackTimeValue


const PlaybackTimeValue = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_replays_progress__WEBPACK_IMPORTED_MODULE_3__.Value,  true ? {
  target: "e138nie74"
} : 0)( true ? "" : 0);

const MouseTrackingValue = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_replays_progress__WEBPACK_IMPORTED_MODULE_3__.Value,  true ? {
  target: "e138nie73"
} : 0)( true ? "" : 0);

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e138nie72"
} : 0)( true ? {
  name: "1n0uila",
  styles: "position:relative;width:100%;&>*{position:absolute;top:0;left:0;}"
} : 0);

const TimelineScrubber = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Scrubber,  true ? {
  target: "e138nie71"
} : 0)("height:100%;", Meter, "{background:transparent;}", RangeWrapper, ",", Range, ",", sentry_components_forms_controls_rangeSlider_sliderAndInputWrapper__WEBPACK_IMPORTED_MODULE_2__["default"], "{height:100%;}", PlaybackTimeValue, "{background:", p => p.theme.purple100, ";border-top-left-radius:3px;border-bottom-left-radius:3px;}/**\n   * Draw lines so users can see the currenTime & their mouse position\n   * \"----|----|--------------------- duration = 1:00\"\n   *      ^    ^\n   *      |    PlaybackTimeValue @ 20s\n   *      MouseTrackingValue @ 10s\n   */", PlaybackTimeValue, ",", MouseTrackingValue, "{border-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(0.25), " solid ", p => p.theme.purple300, ";}" + ( true ? "" : 0));
const PlayerScrubber = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Scrubber,  true ? {
  target: "e138nie70"
} : 0)("height:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(0.5), ";:hover{margin-block:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(0.25), ";height:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1), ";}", Meter, "{border-radius:", p => p.theme.borderRadiusBottom, ";}", RangeWrapper, "{height:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(0.5), ";}:hover ", RangeWrapper, "{height:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(0.75), ";}", PlaybackTimeValue, "{background:", p => p.theme.purple200, ";border-bottom-left-radius:", p => p.theme.borderRadius, ";}/**\n   * Draw the circle (appears on hover) to mark the currentTime of the video\n   * \"---------o-------------------- duration = 1:00\"\n   *           ^\n   *           PlaybackTimeValue @ 20s\n   */", PlaybackTimeValue, ":after{content:'';display:block;width:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(2), ";height:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(2), ";z-index:", p => p.theme.zIndex.initial, ";pointer-events:none;background:", p => p.theme.purple300, ";box-sizing:content-box;border-radius:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(2), ";border:solid ", p => p.theme.white, ";border-width:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(0.5), ";position:absolute;top:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1), ";right:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1.5), ";opacity:0;transition:opacity 0.1s ease;}:hover ", PlaybackTimeValue, ":after{opacity:1;}/*\n   * Draw a square so users can see their mouse position when it is left or right of the currentTime\n   * \"----\u25A1----o--------------------- duration = 1:00\"\n   *      ^    ^\n   *      |    PlaybackTimeValue @ 20s\n   *      MouseTrackingValue @ 10s\n   */", MouseTrackingValue, ":after{content:'';display:block;width:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(0.5), ";height:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1.5), ";pointer-events:none;background:", p => p.theme.purple200, ";box-sizing:content-box;position:absolute;top:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(0.5), ";right:-1px;}:hover ", MouseTrackingValue, ":after{height:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(2), ";top:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(0.5), ";}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/replays/player/scrubberMouseTracking.tsx":
/*!*****************************************************************!*\
  !*** ./app/components/replays/player/scrubberMouseTracking.tsx ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/replays/replayContext */ "./app/components/replays/replayContext.tsx");
/* harmony import */ var sentry_utils_replays_hooks_useMouseTracking__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/replays/hooks/useMouseTracking */ "./app/utils/replays/hooks/useMouseTracking.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function ScrubberMouseTracking(_ref) {
  let {
    children
  } = _ref;
  const {
    replay,
    setCurrentHoverTime
  } = (0,sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_1__.useReplayContext)();
  const durationMs = replay === null || replay === void 0 ? void 0 : replay.getDurationMs();
  const handlePositionChange = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(params => {
    if (!params || durationMs === undefined) {
      setCurrentHoverTime(undefined);
      return;
    }

    const {
      left,
      width
    } = params;

    if (left >= 0) {
      const percent = left / width;
      const time = percent * durationMs;
      setCurrentHoverTime(time);
    } else {
      setCurrentHoverTime(undefined);
    }
  }, [durationMs, setCurrentHoverTime]);
  const mouseTrackingProps = (0,sentry_utils_replays_hooks_useMouseTracking__WEBPACK_IMPORTED_MODULE_2__["default"])({
    onPositionChange: handlePositionChange
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("div", { ...mouseTrackingProps,
    children: children
  });
}

ScrubberMouseTracking.displayName = "ScrubberMouseTracking";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ScrubberMouseTracking);

/***/ }),

/***/ "./app/components/replays/progress.tsx":
/*!*********************************************!*\
  !*** ./app/components/replays/progress.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Meter": () => (/* binding */ Meter),
/* harmony export */   "Value": () => (/* binding */ Value)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

/**
 * A simple progress bar.
 * ```
 * <Meter>
 *   <Value percent={0.75} />
 * </Meter>
 * ```
 *
 * Extend the components to set a background color.
 *
 * Return multiple <Value /> components to render multiple bars directly on top
 * of each other with `position:absolute;`.
 */
const Meter = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1f3gzxp1"
} : 0)( true ? {
  name: "1pv11yg",
  styles: "position:relative;height:100%;width:100%;pointer-events:none"
} : 0);
const Value = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1f3gzxp0"
} : 0)("position:absolute;height:100%;width:", p => p.percent * 100, "%;pointer-events:none;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/replays/replayController.tsx":
/*!*****************************************************!*\
  !*** ./app/components/replays/replayController.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _react_aria_utils__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @react-aria/utils */ "../node_modules/@react-aria/utils/dist/module.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_forms_compositeSelect__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/compositeSelect */ "./app/components/forms/compositeSelect.tsx");
/* harmony import */ var sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/replays/replayContext */ "./app/components/replays/replayContext.tsx");
/* harmony import */ var sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/replays/utils */ "./app/components/replays/utils.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_types_breadcrumbs__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/types/breadcrumbs */ "./app/types/breadcrumbs.tsx");
/* harmony import */ var sentry_utils_replays_getBreadcrumb__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/replays/getBreadcrumb */ "./app/utils/replays/getBreadcrumb.tsx");
/* harmony import */ var sentry_utils_replays_hooks_useFullscreen__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/replays/hooks/useFullscreen */ "./app/utils/replays/hooks/useFullscreen.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


















const SECOND = 1000;
const USER_ACTIONS = [sentry_types_breadcrumbs__WEBPACK_IMPORTED_MODULE_12__.BreadcrumbType.ERROR, sentry_types_breadcrumbs__WEBPACK_IMPORTED_MODULE_12__.BreadcrumbType.INIT, sentry_types_breadcrumbs__WEBPACK_IMPORTED_MODULE_12__.BreadcrumbType.NAVIGATION, sentry_types_breadcrumbs__WEBPACK_IMPORTED_MODULE_12__.BreadcrumbType.UI, sentry_types_breadcrumbs__WEBPACK_IMPORTED_MODULE_12__.BreadcrumbType.USER];

function ReplayPlayPauseBar(_ref) {
  let {
    isCompact
  } = _ref;
  const {
    currentTime,
    isFinished,
    isPlaying,
    replay,
    restart,
    setCurrentTime,
    togglePlayPause
  } = (0,sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_7__.useReplayContext)();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_5__["default"], {
    merged: true,
    children: [!isCompact && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
      size: "sm",
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Rewind 10s'),
      icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconRewind10, {
        size: "sm"
      }),
      onClick: () => setCurrentTime(currentTime - 10 * SECOND),
      "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Rewind 10 seconds')
    }), isFinished ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
      size: "sm",
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Restart Replay'),
      icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconPrevious, {
        size: "sm"
      }),
      onClick: restart,
      "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Restart Replay')
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
      size: "sm",
      title: isPlaying ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Pause') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Play'),
      icon: isPlaying ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconPause, {
        size: "sm"
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconPlay, {
        size: "sm"
      }),
      onClick: () => togglePlayPause(!isPlaying),
      "aria-label": isPlaying ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Pause') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Play')
    }), !isCompact && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
      size: "sm",
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Next breadcrumb'),
      icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconNext, {
        size: "sm"
      }),
      onClick: () => {
        var _replay$getReplay$sta;

        const startTimestampMs = replay === null || replay === void 0 ? void 0 : (_replay$getReplay$sta = replay.getReplay().startedAt) === null || _replay$getReplay$sta === void 0 ? void 0 : _replay$getReplay$sta.getTime();

        if (!startTimestampMs) {
          return;
        }

        const transformedCrumbs = (replay === null || replay === void 0 ? void 0 : replay.getRawCrumbs()) || [];
        const next = (0,sentry_utils_replays_getBreadcrumb__WEBPACK_IMPORTED_MODULE_13__.getNextBreadcrumb)({
          crumbs: transformedCrumbs.filter(crumb => USER_ACTIONS.includes(crumb.type)),
          targetTimestampMs: startTimestampMs + currentTime
        });

        if (startTimestampMs !== undefined && next !== null && next !== void 0 && next.timestamp) {
          setCurrentTime((0,sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_8__.relativeTimeInMs)(next.timestamp, startTimestampMs));
        }
      },
      "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Fast-forward to next breadcrumb')
    })]
  });
}

ReplayPlayPauseBar.displayName = "ReplayPlayPauseBar";

function ReplayCurrentTime() {
  const {
    currentTime,
    replay
  } = (0,sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_7__.useReplayContext)();
  const durationMs = replay === null || replay === void 0 ? void 0 : replay.getDurationMs();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)("span", {
    children: [(0,sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_8__.formatTime)(currentTime), " / ", durationMs ? (0,sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_8__.formatTime)(durationMs) : '--:--']
  });
}

ReplayCurrentTime.displayName = "ReplayCurrentTime";

function ReplayOptionsMenu(_ref2) {
  let {
    speedOptions
  } = _ref2;
  const {
    setSpeed,
    speed,
    isSkippingInactive,
    toggleSkipInactive
  } = (0,sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_7__.useReplayContext)();
  const SKIP_OPTION_VALUE = 'skip';
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_forms_compositeSelect__WEBPACK_IMPORTED_MODULE_6__["default"], {
    placement: "bottom",
    trigger: _ref3 => {
      let {
        props,
        ref
      } = _ref3;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
        ref: ref,
        ...props,
        size: "sm",
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Settings'),
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Settings'),
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconSettings, {
          size: "sm"
        })
      });
    },
    sections: [{
      defaultValue: speed,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Playback Speed'),
      value: 'playback_speed',
      onChange: setSpeed,
      options: speedOptions.map(option => ({
        label: `${option}x`,
        value: option
      }))
    }, {
      multiple: true,
      defaultValue: isSkippingInactive ? SKIP_OPTION_VALUE : undefined,
      label: '',
      value: 'fast_forward',
      onChange: value => {
        toggleSkipInactive(value.length > 0);
      },
      options: [{
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Fast-forward inactivity'),
        value: SKIP_OPTION_VALUE
      }]
    }]
  });
}

ReplayOptionsMenu.displayName = "ReplayOptionsMenu";

const ReplayControls = _ref4 => {
  let {
    toggleFullscreen = () => {},
    speedOptions = [0.1, 0.25, 0.5, 1, 2, 4]
  } = _ref4;
  const barRef = (0,react__WEBPACK_IMPORTED_MODULE_3__.useRef)(null);
  const [compactLevel, setCompactLevel] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(0);
  const {
    isFullscreen
  } = (0,sentry_utils_replays_hooks_useFullscreen__WEBPACK_IMPORTED_MODULE_14__["default"])();
  const updateCompactLevel = (0,react__WEBPACK_IMPORTED_MODULE_3__.useCallback)(() => {
    var _barRef$current$getBo, _barRef$current;

    const {
      width
    } = (_barRef$current$getBo = (_barRef$current = barRef.current) === null || _barRef$current === void 0 ? void 0 : _barRef$current.getBoundingClientRect()) !== null && _barRef$current$getBo !== void 0 ? _barRef$current$getBo : {
      width: 500
    };

    if (width < 400) {
      setCompactLevel(1);
    } else {
      setCompactLevel(0);
    }
  }, []);
  (0,_react_aria_utils__WEBPACK_IMPORTED_MODULE_16__.useResizeObserver)({
    ref: barRef,
    onResize: updateCompactLevel
  });
  (0,react__WEBPACK_IMPORTED_MODULE_3__.useLayoutEffect)(() => updateCompactLevel, [updateCompactLevel]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(ButtonGrid, {
    ref: barRef,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(ReplayPlayPauseBar, {
      isCompact: compactLevel > 0
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(ReplayCurrentTime, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(ReplayOptionsMenu, {
      speedOptions: speedOptions
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
      size: "sm",
      title: isFullscreen ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Exit full screen') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Enter full screen'),
      "aria-label": isFullscreen ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Exit full screen') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Enter full screen'),
      icon: isFullscreen ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconContract, {
        size: "sm"
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconExpand, {
        size: "sm"
      }),
      onClick: toggleFullscreen
    })]
  });
};

ReplayControls.displayName = "ReplayControls";

const ButtonGrid = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1ryc6sl0"
} : 0)("display:grid;grid-column-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(1), ";grid-template-columns:max-content auto max-content max-content;align-items:center;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReplayControls);

/***/ }),

/***/ "./app/components/replays/replayCurrentUrl.tsx":
/*!*****************************************************!*\
  !*** ./app/components/replays/replayCurrentUrl.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/forms/textCopyInput */ "./app/components/forms/textCopyInput.tsx");
/* harmony import */ var sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/replays/replayContext */ "./app/components/replays/replayContext.tsx");
/* harmony import */ var sentry_utils_replays_getCurrentUrl__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/replays/getCurrentUrl */ "./app/utils/replays/getCurrentUrl.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







function ReplayCurrentUrl() {
  const {
    currentTime,
    replay
  } = (0,sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_3__.useReplayContext)();

  if (!replay) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(UrlCopyInput, {
      disabled: true,
      children: ''
    });
  }

  const replayRecord = replay.getReplay();
  const crumbs = replay.getRawCrumbs();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(UrlCopyInput, {
    children: (0,sentry_utils_replays_getCurrentUrl__WEBPACK_IMPORTED_MODULE_4__["default"])(replayRecord, crumbs, currentTime)
  });
}

ReplayCurrentUrl.displayName = "ReplayCurrentUrl";

const UrlCopyInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_2__["default"],  true ? {
  target: "evzcn0b0"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReplayCurrentUrl);

/***/ }),

/***/ "./app/components/replays/replayPlayer.tsx":
/*!*************************************************!*\
  !*** ./app/components/replays/replayPlayer.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _react_aria_utils__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @react-aria/utils */ "../node_modules/@react-aria/utils/dist/module.js");
/* harmony import */ var sentry_components_replays_player_bufferingOverlay__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/replays/player/bufferingOverlay */ "./app/components/replays/player/bufferingOverlay.tsx");
/* harmony import */ var sentry_components_replays_player_fastForwardBadge__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/replays/player/fastForwardBadge */ "./app/components/replays/player/fastForwardBadge.tsx");
/* harmony import */ var sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/replays/replayContext */ "./app/components/replays/replayContext.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









function BasePlayerRoot(_ref) {
  let {
    className
  } = _ref;
  const {
    initRoot,
    dimensions: videoDimensions,
    fastForwardSpeed,
    isBuffering
  } = (0,sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_5__.useReplayContext)();
  const windowEl = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(null);
  const viewEl = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(null);
  const [windowDimensions, setWindowDimensions] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)({
    width: 0,
    height: 0
  }); // Create the `rrweb` instance which creates an iframe inside `viewEl`

  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => initRoot(viewEl.current), [initRoot]); // Read the initial width & height where the player will be inserted, this is
  // so we can shrink the video into the available space.
  // If the size of the container changes, we can re-calculate the scaling factor

  const updateWindowDimensions = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(() => {
    var _windowEl$current, _windowEl$current2;

    return setWindowDimensions({
      width: ((_windowEl$current = windowEl.current) === null || _windowEl$current === void 0 ? void 0 : _windowEl$current.clientWidth) || 0,
      height: ((_windowEl$current2 = windowEl.current) === null || _windowEl$current2 === void 0 ? void 0 : _windowEl$current2.clientHeight) || 0
    });
  }, [setWindowDimensions]);
  (0,_react_aria_utils__WEBPACK_IMPORTED_MODULE_6__.useResizeObserver)({
    ref: windowEl,
    onResize: updateWindowDimensions
  }); // If your browser doesn't have ResizeObserver then set the size once.

  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (typeof window.ResizeObserver !== 'undefined') {
      return;
    }

    updateWindowDimensions();
  }, [updateWindowDimensions]); // Update the scale of the view whenever dimensions have changed.

  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (viewEl.current) {
      const scale = Math.min(windowDimensions.width / videoDimensions.width, windowDimensions.height / videoDimensions.height, 1);

      if (scale) {
        viewEl.current.style['transform-origin'] = 'top left';
        viewEl.current.style.transform = `scale(${scale})`;
        viewEl.current.style.width = `${videoDimensions.width * scale}px`;
        viewEl.current.style.height = `${videoDimensions.height * scale}px`;
      }
    }
  }, [windowDimensions, videoDimensions]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(SizingWindow, {
    ref: windowEl,
    className: "sr-block",
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("div", {
      ref: viewEl,
      className: className
    }), fastForwardSpeed ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(PositionedFastForward, {
      speed: fastForwardSpeed
    }) : null, isBuffering ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(PositionedBuffering, {}) : null]
  });
}

BasePlayerRoot.displayName = "BasePlayerRoot";

// Center the viewEl inside the windowEl.
// This is useful when the window is inside a container that has large fixed
// dimensions, like when in fullscreen mode.
// If the container has a dimensions that can grow/shrink then it is
// important to also set `overflow: hidden` on the container, so that the
// SizingWindow can calculate size as things shrink.
const SizingWindow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "elabtru4"
} : 0)("width:100%;display:flex;flex-grow:1;justify-content:center;align-items:center;position:relative;overflow:hidden;background-color:", p => p.theme.backgroundSecondary, ";background-image:repeating-linear-gradient(\n      -145deg,\n      transparent,\n      transparent 8px,\n      ", p => p.theme.backgroundSecondary, " 8px,\n      ", p => p.theme.backgroundSecondary, " 11px\n    ),repeating-linear-gradient(\n      -45deg,\n      transparent,\n      transparent 15px,\n      ", p => p.theme.gray100, " 15px,\n      ", p => p.theme.gray100, " 16px\n    );" + ( true ? "" : 0));

const PositionedFastForward = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_replays_player_fastForwardBadge__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "elabtru3"
} : 0)( true ? {
  name: "m4y3yb",
  styles: "position:absolute;left:0;bottom:0"
} : 0);

const PositionedBuffering = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_replays_player_bufferingOverlay__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "elabtru2"
} : 0)( true ? {
  name: "j2pfbl",
  styles: "position:absolute;top:0;left:0;right:0;bottom:0"
} : 0); // Base styles, to make the Replayer instance work


const PlayerRoot = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(BasePlayerRoot,  true ? {
  target: "elabtru1"
} : 0)( true ? {
  name: "1nx655q",
  styles: ".replayer-wrapper{user-select:none;}.replayer-wrapper>.replayer-mouse-tail{position:absolute;pointer-events:none;}.replayer-wrapper>iframe{border:none;background:white;}"
} : 0); // Sentry-specific styles for the player.
// The elements we have to work with are:
// ```css
// div.replayer-wrapper {}
// div.replayer-wrapper > div.replayer-mouse {}
// div.replayer-wrapper > canvas.replayer-mouse-tail {}
// div.replayer-wrapper > iframe {}
// ```
// The mouse-tail is also configured for color/size in `app/components/replays/replayContext.tsx`


const SentryPlayerRoot = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(PlayerRoot,  true ? {
  target: "elabtru0"
} : 0)(".replayer-mouse{position:absolute;width:32px;height:32px;transition:left 0.05s linear,top 0.05s linear;background-size:contain;background-repeat:no-repeat;background-image:url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iMTkiIHZpZXdCb3g9IjAgMCAxMiAxOSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTAgMTZWMEwxMS42IDExLjZINC44TDQuNCAxMS43TDAgMTZaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNOS4xIDE2LjdMNS41IDE4LjJMMC43OTk5OTkgNy4xTDQuNSA1LjZMOS4xIDE2LjdaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNNC42NzQ1MSA4LjYxODUxTDIuODMwMzEgOS4zOTI3MUw1LjkyNzExIDE2Ljc2OTVMNy43NzEzMSAxNS45OTUzTDQuNjc0NTEgOC42MTg1MVoiIGZpbGw9ImJsYWNrIi8+CjxwYXRoIGQ9Ik0xIDIuNFYxMy42TDQgMTAuN0w0LjQgMTAuNkg5LjJMMSAyLjRaIiBmaWxsPSJibGFjayIvPgo8L3N2Zz4K');border-color:transparent;}.replayer-mouse:after{content:'';display:inline-block;width:32px;height:32px;background:", p => p.theme.purple300, ";border-radius:100%;transform:translate(-50%, -50%);opacity:0.3;}.replayer-mouse.active:after{animation:click 0.2s ease-in-out 1;}.replayer-mouse.touch-device{background-image:none;width:70px;height:70px;border-radius:100%;margin-left:-37px;margin-top:-37px;border:4px solid rgba(73, 80, 246, 0);transition:left 0s linear,top 0s linear,border-color 0.2s ease-in-out;}.replayer-mouse.touch-device.touch-active{border-color:", p => p.theme.purple200, ";transition:left 0.25s linear,top 0.25s linear,border-color 0.2s ease-in-out;}.replayer-mouse.touch-device:after{opacity:0;}.replayer-mouse.touch-device.active:after{animation:touch-click 0.2s ease-in-out 1;}@keyframes click{0%{opacity:0.3;width:20px;height:20px;}50%{opacity:0.5;width:10px;height:10px;}}@keyframes touch-click{0%{opacity:0;width:20px;height:20px;}50%{opacity:0.5;width:10px;height:10px;}}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SentryPlayerRoot);

/***/ }),

/***/ "./app/components/replays/replayView.tsx":
/*!***********************************************!*\
  !*** ./app/components/replays/replayView.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_replays_player_scrubber__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/replays/player/scrubber */ "./app/components/replays/player/scrubber.tsx");
/* harmony import */ var sentry_components_replays_player_scrubberMouseTracking__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/replays/player/scrubberMouseTracking */ "./app/components/replays/player/scrubberMouseTracking.tsx");
/* harmony import */ var sentry_components_replays_replayController__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/replays/replayController */ "./app/components/replays/replayController.tsx");
/* harmony import */ var sentry_components_replays_replayCurrentUrl__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/replays/replayCurrentUrl */ "./app/components/replays/replayCurrentUrl.tsx");
/* harmony import */ var sentry_components_replays_replayPlayer__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/replays/replayPlayer */ "./app/components/replays/replayPlayer.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_replays_detail_layout_fluidHeight__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/views/replays/detail/layout/fluidHeight */ "./app/views/replays/detail/layout/fluidHeight.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












function ReplayView(_ref) {
  let {
    toggleFullscreen,
    showAddressBar = true
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [showAddressBar && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_replays_replayCurrentUrl__WEBPACK_IMPORTED_MODULE_5__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(PlayerContainer, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(Panel, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_replays_replayPlayer__WEBPACK_IMPORTED_MODULE_6__["default"], {})
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_replays_player_scrubberMouseTracking__WEBPACK_IMPORTED_MODULE_3__["default"], {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_replays_player_scrubber__WEBPACK_IMPORTED_MODULE_2__.PlayerScrubber, {})
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_replays_replayController__WEBPACK_IMPORTED_MODULE_4__["default"], {
      toggleFullscreen: toggleFullscreen
    })]
  });
}

ReplayView.displayName = "ReplayView";

const PlayerContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_views_replays_detail_layout_fluidHeight__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "e185m34i1"
} : 0)("padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";margin-bottom:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";" + ( true ? "" : 0));

const Panel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_views_replays_detail_layout_fluidHeight__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "e185m34i0"
} : 0)("background:", p => p.theme.background, ";border-radius:", p => p.theme.borderRadiusTop, ";border:1px solid ", p => p.theme.border, ";border-bottom:none;box-shadow:", p => p.theme.dropShadowLight, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReplayView);

/***/ }),

/***/ "./app/utils/replays/flattenListOfObjects.tsx":
/*!****************************************************!*\
  !*** ./app/utils/replays/flattenListOfObjects.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ flattenListOfObjects)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);



/**
 * Given a list of objects (or maps) of `string` -> `any[]`,
 * merge the arrays of each key in the object.
 *
 * e.g. [{a: [1]}, {a: [2]}, {b: [3]}] ==> {a: [1, 2], b: {3}}
 *
 * Any non-array values will throw an exception
 */
function flattenListOfObjects(objs) {
  return objs.reduce((acc, obj) => {
    Object.entries(obj).forEach(_ref => {
      let [key, value] = _ref;

      if (!Array.isArray(value)) {
        // e.g. if value is undefined (otherwise, a non-Array type will get caught by ts)
        // TS doesn't like our test where object keys are no equivalent, so we
        // need to allow `undefined` as a valid type in the Record.
        throw new Error('Invalid value');
      }

      acc[key] = (acc[key] || []).concat(value);
    });
    return acc;
  }, {});
}

/***/ }),

/***/ "./app/utils/replays/getBreadcrumb.tsx":
/*!*********************************************!*\
  !*** ./app/utils/replays/getBreadcrumb.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getNextBreadcrumb": () => (/* binding */ getNextBreadcrumb),
/* harmony export */   "getPrevBreadcrumb": () => (/* binding */ getPrevBreadcrumb)
/* harmony export */ });
function getPrevBreadcrumb(_ref) {
  let {
    crumbs,
    targetTimestampMs,
    allowExact = false
  } = _ref;
  return crumbs.reduce((prev, crumb) => {
    const crumbTimestampMS = +new Date(crumb.timestamp || '');

    if (crumbTimestampMS > targetTimestampMs || !allowExact && crumbTimestampMS === targetTimestampMs) {
      return prev;
    }

    if (!prev || crumbTimestampMS > +new Date(prev.timestamp || '')) {
      return crumb;
    }

    return prev;
  }, undefined);
}
function getNextBreadcrumb(_ref2) {
  let {
    crumbs,
    targetTimestampMs,
    allowExact = false
  } = _ref2;
  return crumbs.reduce((found, crumb) => {
    const crumbTimestampMS = +new Date(crumb.timestamp || '');

    if (crumbTimestampMS < targetTimestampMs || !allowExact && crumbTimestampMS === targetTimestampMs) {
      return found;
    }

    if (!found || crumbTimestampMS < +new Date(found.timestamp || '')) {
      return crumb;
    }

    return found;
  }, undefined);
}

/***/ }),

/***/ "./app/utils/replays/getCurrentUrl.tsx":
/*!*********************************************!*\
  !*** ./app/utils/replays/getCurrentUrl.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_web_url_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.url.js */ "../node_modules/core-js/modules/web.url.js");
/* harmony import */ var core_js_modules_web_url_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_url_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_web_url_search_params_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.url-search-params.js */ "../node_modules/core-js/modules/web.url-search-params.js");
/* harmony import */ var core_js_modules_web_url_search_params_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_url_search_params_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var lodash_last__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/last */ "../node_modules/lodash/last.js");
/* harmony import */ var lodash_last__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_last__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_types_breadcrumbs__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/types/breadcrumbs */ "./app/types/breadcrumbs.tsx");






function getCurrentUrl(replayRecord, crumbs, currentOffsetMS) {
  var _last, _last$data;

  const startTimestampMs = replayRecord.startedAt.getTime();
  const currentTimeMs = startTimestampMs + Math.floor(currentOffsetMS);
  const navigationCrumbs = crumbs.filter(crumb => crumb.type === sentry_types_breadcrumbs__WEBPACK_IMPORTED_MODULE_4__.BreadcrumbType.NAVIGATION);
  const initialUrl = replayRecord.tags.url;
  const origin = initialUrl ? new URL(initialUrl).origin : '';
  const mostRecentNavigation = (_last = lodash_last__WEBPACK_IMPORTED_MODULE_3___default()(navigationCrumbs.filter(_ref => {
    let {
      timestamp
    } = _ref;
    return +new Date(timestamp || 0) < currentTimeMs;
  }))) === null || _last === void 0 ? void 0 : (_last$data = _last.data) === null || _last$data === void 0 ? void 0 : _last$data.to;

  if (!mostRecentNavigation) {
    return initialUrl;
  }

  try {
    // If `mostRecentNavigation` has the origin then we can parse it as a URL
    const url = new URL(mostRecentNavigation);
    return String(url);
  } catch {
    // Otherwise we need to add the origin manually and hope the suffix makes sense.
    return origin + mostRecentNavigation;
  }
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (getCurrentUrl);

/***/ }),

/***/ "./app/utils/replays/hooks/useDiscoveryQuery.tsx":
/*!*******************************************************!*\
  !*** ./app/utils/replays/hooks/useDiscoveryQuery.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ useDiscoverQuery)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");





const INITIAL_STATE = {
  isLoading: true,
  error: undefined,
  data: undefined,
  pageLinks: undefined
};
const FAKE_LOCATION = {
  query: {}
};
/**
 * Simple custom hook to perform a Discover query.
 *
 * Note this does *not* handle URL parameters like the render component `<DiscoverQuery>`.
 * It will need to be handled in a parent.
 */

function useDiscoverQuery(_ref) {
  let {
    endpoint,
    discoverQuery,
    ignoreCursor
  } = _ref;
  const [state, setState] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(INITIAL_STATE);
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_3__["default"])();
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_4__["default"])();
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    async function runQuery() {
      const url = endpoint || `/organizations/${organization.slug}/eventsv2/`;
      const eventView = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_2__["default"].fromNewQueryWithLocation({
        environment: [],
        projects: [],
        id: '',
        name: '',
        version: 2,
        ...discoverQuery
      }, FAKE_LOCATION);
      const query = eventView.getEventsAPIPayload(FAKE_LOCATION);
      setState(prevState => ({ ...prevState,
        isLoading: true,
        error: undefined
      }));
      api.clear();

      try {
        const [data,, resp] = await api.requestPromise(url, {
          includeAllArgs: true,
          query
        });
        setState(prevState => {
          var _resp$getResponseHead;

          return { ...prevState,
            isLoading: false,
            error: undefined,
            pageLinks: (_resp$getResponseHead = resp === null || resp === void 0 ? void 0 : resp.getResponseHeader('Link')) !== null && _resp$getResponseHead !== void 0 ? _resp$getResponseHead : prevState.pageLinks,
            data: data.data
          };
        });
      } catch (error) {
        setState(prevState => ({ ...prevState,
          isLoading: false,
          error,
          data: undefined
        }));
      }
    }

    runQuery(); // location is ignored in deps array, see getEventView comments
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, discoverQuery, organization.slug, ignoreCursor]);
  return state;
}

/***/ }),

/***/ "./app/utils/replays/hooks/useFullscreen.tsx":
/*!***************************************************!*\
  !*** ./app/utils/replays/hooks/useFullscreen.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ useFullscreen)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var screenfull__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! screenfull */ "../node_modules/screenfull/index.js");


 // See: https://developer.mozilla.org/en-US/docs/web/api/element/requestfullscreen#options_2

// TODO(replay): move into app/utils/*
function useFullscreen() {
  const ref = (0,react__WEBPACK_IMPORTED_MODULE_1__.useRef)(null);
  const [isFullscreen, setIsFullscreen] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
  const enter = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async function () {
    let opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {
      navigationUI: 'auto'
    };

    if (screenfull__WEBPACK_IMPORTED_MODULE_2__["default"].isEnabled && ref.current) {
      await screenfull__WEBPACK_IMPORTED_MODULE_2__["default"].request(ref.current, opts);
    }
  }, []);
  const exit = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async () => {
    if (screenfull__WEBPACK_IMPORTED_MODULE_2__["default"].isEnabled) {
      await screenfull__WEBPACK_IMPORTED_MODULE_2__["default"].exit();
    }
  }, []);
  const toggle = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => isFullscreen ? exit() : enter(), [enter, exit, isFullscreen]);

  const onChange = () => {
    setIsFullscreen(screenfull__WEBPACK_IMPORTED_MODULE_2__["default"].isFullscreen);
  };

  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    screenfull__WEBPACK_IMPORTED_MODULE_2__["default"].on('change', onChange);
    return () => screenfull__WEBPACK_IMPORTED_MODULE_2__["default"].off('change', onChange);
  }, []);
  return {
    enter,
    exit,
    isEnabled: screenfull__WEBPACK_IMPORTED_MODULE_2__["default"].isEnabled,
    isFullscreen,
    ref,
    toggle
  };
}

/***/ }),

/***/ "./app/utils/replays/hooks/useMouseTracking.tsx":
/*!******************************************************!*\
  !*** ./app/utils/replays/hooks/useMouseTracking.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");





class AbortError extends Error {}
/**
 * Replace `elem.getBoundingClientRect()` which is too laggy for onPositionChange
 */


function getBoundingRect(elem, _ref) {
  let {
    signal
  } = _ref;
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new AbortError());
    }

    const abortHandler = () => {
      reject(new AbortError());
    };

    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const bounds = entry.boundingClientRect;
        resolve(bounds);
        signal.removeEventListener('abort', abortHandler);
      }

      observer.disconnect();
    });
    signal.addEventListener('abort', abortHandler);
    observer.observe(elem);
  });
}

function useMouseTracking(_ref2) {
  let {
    onPositionChange,
    onMouseEnter,
    onMouseMove,
    onMouseLeave,
    ...rest
  } = _ref2;
  const elem = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(null);
  const controller = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(new AbortController());
  const handlePositionChange = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(async e => {
    if (!elem.current) {
      onPositionChange(undefined);
      return;
    }

    try {
      const rect = await getBoundingRect(elem.current, {
        signal: controller.current.signal
      });
      onPositionChange({
        height: rect.height,
        left: Math.min(e.clientX - rect.left, rect.width),
        top: Math.min(e.clientY - rect.top, rect.height),
        width: rect.width
      });
    } catch (err) {
      if (err instanceof AbortError) {
        // Ignore cancelled getBoundingRect calls
        return;
      }

      _sentry_react__WEBPACK_IMPORTED_MODULE_3__.captureException(err);
    }
  }, [onPositionChange, controller]);
  const handleOnMouseLeave = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(() => {
    if (controller.current) {
      controller.current.abort();
      controller.current = new AbortController();
    }

    onPositionChange(undefined);
  }, [onPositionChange, controller]);
  return {
    ref: elem,
    ...rest,
    onMouseEnter: e => {
      handlePositionChange(e);
      onMouseEnter === null || onMouseEnter === void 0 ? void 0 : onMouseEnter(e);
    },
    onMouseMove: e => {
      handlePositionChange(e);
      onMouseMove === null || onMouseMove === void 0 ? void 0 : onMouseMove(e);
    },
    onMouseLeave: e => {
      handleOnMouseLeave();
      onMouseLeave === null || onMouseLeave === void 0 ? void 0 : onMouseLeave(e);
    }
  };
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (useMouseTracking);

/***/ }),

/***/ "./app/utils/replays/hooks/useReplayData.tsx":
/*!***************************************************!*\
  !*** ./app/utils/replays/hooks/useReplayData.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "mapRRWebAttachments": () => (/* binding */ mapRRWebAttachments)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var pako__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! pako */ "../node_modules/pako/dist/pako.esm.mjs");
/* harmony import */ var sentry_utils_replays_flattenListOfObjects__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/replays/flattenListOfObjects */ "./app/utils/replays/flattenListOfObjects.tsx");
/* harmony import */ var sentry_utils_replays_hooks_useReplayErrors__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/replays/hooks/useReplayErrors */ "./app/utils/replays/hooks/useReplayErrors.tsx");
/* harmony import */ var sentry_utils_replays_replayDataUtils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/replays/replayDataUtils */ "./app/utils/replays/replayDataUtils.tsx");
/* harmony import */ var sentry_utils_replays_replayReader__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/replays/replayReader */ "./app/utils/replays/replayReader.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");









function mapRRWebAttachments(unsortedReplayAttachments) {
  const replayAttachments = {
    breadcrumbs: [],
    replaySpans: [],
    recording: []
  };
  unsortedReplayAttachments.forEach(attachment => {
    var _attachment$data, _attachment$data2;

    if (((_attachment$data = attachment.data) === null || _attachment$data === void 0 ? void 0 : _attachment$data.tag) === 'performanceSpan') {
      replayAttachments.replaySpans.push(attachment.data.payload);
    } else if ((attachment === null || attachment === void 0 ? void 0 : (_attachment$data2 = attachment.data) === null || _attachment$data2 === void 0 ? void 0 : _attachment$data2.tag) === 'breadcrumb') {
      replayAttachments.breadcrumbs.push(attachment.data.payload);
    } else {
      replayAttachments.recording.push(attachment);
    }
  });
  return replayAttachments;
}
const INITIAL_STATE = Object.freeze({
  breadcrumbs: undefined,
  errors: undefined,
  fetchError: undefined,
  fetching: true,
  isErrorsFetching: true,
  replayRecord: undefined,
  rrwebEvents: undefined,
  spans: undefined
});

async function decompressSegmentData(data, _textStatus, resp) {
  // for non-compressed events, parse and return
  try {
    return mapRRWebAttachments(JSON.parse(data));
  } catch (error) {// swallow exception.. if we can't parse it, it's going to be compressed
  } // for non-compressed events, parse and return


  try {
    // for compressed events, inflate the blob and map the events
    const responseBlob = await (resp === null || resp === void 0 ? void 0 : resp.rawResponse.blob());
    const responseArray = await (responseBlob === null || responseBlob === void 0 ? void 0 : responseBlob.arrayBuffer());
    const parsedPayload = JSON.parse((0,pako__WEBPACK_IMPORTED_MODULE_2__.inflate)(responseArray, {
      to: 'string'
    }));
    return mapRRWebAttachments(parsedPayload);
  } catch (error) {
    return {};
  }
}
/**
 * A react hook to load core replay data over the network.
 *
 * Core replay data includes:
 * 1. The root replay EventTransaction object
 *    - This includes `startTimestamp` and `tags` data
 * 2. Breadcrumb and Span data from all the related Event objects
 *    - Data is merged for consumption
 * 3. RRWeb payloads for the replayer video stream
 *    - TODO(replay): incrementally load the stream to speedup pageload
 *
 * This function should stay focused on loading data over the network.
 * Front-end processing, filtering and re-mixing of the different data streams
 * must be delegated to the `ReplayReader` class.
 *
 * @param {orgSlug, replaySlug} Where to find the root replay event
 * @returns An object representing a unified result of the network requests. Either a single `ReplayReader` data object or fetch errors.
 */


function useReplayData(_ref) {
  let {
    replaySlug,
    orgSlug
  } = _ref;
  const [projectSlug, replayId] = replaySlug.split(':');
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_7__["default"])();
  const [state, setState] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(INITIAL_STATE); // Fetch every field of the replay. We're overfetching, not every field is needed

  const fetchReplay = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async () => {
    const response = await api.requestPromise(`/projects/${orgSlug}/${projectSlug}/replays/${replayId}/`);
    return response.data;
  }, [api, orgSlug, projectSlug, replayId]);
  const fetchSegmentList = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async () => {
    const response = await api.requestPromise(`/projects/${orgSlug}/${projectSlug}/replays/${replayId}/recording-segments/`);
    return response.data;
  }, [api, orgSlug, projectSlug, replayId]);
  const fetchRRWebEvents = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async segmentIds => {
    const attachments = await Promise.all(segmentIds.map(async segmentId => {
      const response = await api.requestPromise(`/projects/${orgSlug}/${projectSlug}/replays/${replayId}/recording-segments/${segmentId}/?download`, {
        includeAllArgs: true
      });
      return decompressSegmentData(...response);
    })); // ReplayAttachment[] => ReplayAttachment (merge each key of ReplayAttachment)

    return (0,sentry_utils_replays_flattenListOfObjects__WEBPACK_IMPORTED_MODULE_3__["default"])(attachments);
  }, [api, replayId, orgSlug, projectSlug]);
  const {
    isLoading: isErrorsFetching,
    data: errors
  } = (0,sentry_utils_replays_hooks_useReplayErrors__WEBPACK_IMPORTED_MODULE_4__["default"])({
    replayId
  });
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    if (!isErrorsFetching) {
      setState(prevState => ({ ...prevState,
        fetching: prevState.fetching || isErrorsFetching,
        isErrorsFetching,
        errors
      }));
    }
  }, [isErrorsFetching, errors]);
  const loadEvents = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async () => {
    setState(INITIAL_STATE);

    try {
      const [record, segments] = await Promise.all([fetchReplay(), fetchSegmentList()]); // TODO(replays): Something like `range(record.countSegments)` could work
      // once we make sure that segments have sequential id's and are not dropped.

      const segmentIds = segments.map(segment => segment.segmentId);
      const attachments = await fetchRRWebEvents(segmentIds);
      setState(prev => ({ ...prev,
        replayRecord: (0,sentry_utils_replays_replayDataUtils__WEBPACK_IMPORTED_MODULE_5__.mapResponseToReplayRecord)(record),
        fetchError: undefined,
        fetching: prev.isErrorsFetching || false,
        rrwebEvents: attachments.recording,
        spans: attachments.replaySpans,
        breadcrumbs: attachments.breadcrumbs
      }));
    } catch (error) {
      _sentry_react__WEBPACK_IMPORTED_MODULE_8__.captureException(error);
      setState({ ...INITIAL_STATE,
        fetchError: error,
        fetching: false
      });
    }
  }, [fetchReplay, fetchSegmentList, fetchRRWebEvents]);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    loadEvents();
  }, [loadEvents]);
  const replay = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    return sentry_utils_replays_replayReader__WEBPACK_IMPORTED_MODULE_6__["default"].factory({
      replayRecord: state.replayRecord,
      errors: state.errors,
      rrwebEvents: state.rrwebEvents,
      breadcrumbs: state.breadcrumbs,
      spans: state.spans
    });
  }, [state.replayRecord, state.rrwebEvents, state.breadcrumbs, state.spans, state.errors]);
  return {
    fetchError: state.fetchError,
    fetching: state.fetching,
    onRetry: loadEvents,
    replay
  };
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (useReplayData);

/***/ }),

/***/ "./app/utils/replays/hooks/useReplayErrors.tsx":
/*!*****************************************************!*\
  !*** ./app/utils/replays/hooks/useReplayErrors.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ useReplayErrors)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_utils_replays_hooks_useDiscoveryQuery__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/replays/hooks/useDiscoveryQuery */ "./app/utils/replays/hooks/useDiscoveryQuery.tsx");



/**
 * Fetches a list of errors that occurred in a replay
 */
function useReplayErrors(_ref) {
  let {
    replayId,
    ...props
  } = _ref;
  const discoverQuery = (0,react__WEBPACK_IMPORTED_MODULE_0__.useMemo)(() => ({
    query: `replayId:${replayId} AND event.type:error`,
    fields: ['event.id', 'error.value', 'timestamp', 'error.type', 'issue.id'],
    // environment and project shouldn't matter because having a replayId
    // assumes we have already filtered down to proper env/project
    environment: [],
    projects: []
  }), [replayId]);
  return (0,sentry_utils_replays_hooks_useDiscoveryQuery__WEBPACK_IMPORTED_MODULE_1__["default"])({
    discoverQuery,
    ...props
  });
}

/***/ }),

/***/ "./app/utils/replays/replayReader.tsx":
/*!********************************************!*\
  !*** ./app/utils/replays/replayReader.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ ReplayReader)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_utils_replays_replayDataUtils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/replays/replayDataUtils */ "./app/utils/replays/replayDataUtils.tsx");



class ReplayReader {
  static factory(_ref) {
    let {
      breadcrumbs,
      replayRecord,
      errors,
      rrwebEvents,
      spans
    } = _ref;

    if (!breadcrumbs || !replayRecord || !rrwebEvents || !spans || !errors) {
      return null;
    }

    return new ReplayReader({
      breadcrumbs,
      replayRecord,
      errors,
      rrwebEvents,
      spans
    });
  }

  constructor(_ref2) {
    let {
      breadcrumbs,
      replayRecord,
      errors,
      rrwebEvents,
      spans
    } = _ref2;

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "replayRecord", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "rrwebEvents", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "breadcrumbs", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "spans", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getDurationMs", () => {
      return this.replayRecord.duration * 1000;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getReplay", () => {
      return this.replayRecord;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getRRWebEvents", () => {
      return this.rrwebEvents;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getRawCrumbs", () => {
      return this.breadcrumbs;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getRawSpans", () => {
      return this.spans;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "isMemorySpan", span => {
      return span.op === 'memory';
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "isNetworkSpan", span => {
      return !this.isMemorySpan(span) && !span.op.includes('paint');
    });

    // TODO(replays): We should get correct timestamps from the backend instead
    // of having to fix them up here.
    const {
      startTimestampMs,
      endTimestampMs
    } = (0,sentry_utils_replays_replayDataUtils__WEBPACK_IMPORTED_MODULE_2__.replayTimestamps)(rrwebEvents, breadcrumbs, spans);
    replayRecord.startedAt = new Date(startTimestampMs);
    replayRecord.finishedAt = new Date(endTimestampMs);
    this.spans = (0,sentry_utils_replays_replayDataUtils__WEBPACK_IMPORTED_MODULE_2__.spansFactory)(spans);
    this.breadcrumbs = (0,sentry_utils_replays_replayDataUtils__WEBPACK_IMPORTED_MODULE_2__.breadcrumbFactory)(replayRecord, errors, breadcrumbs, this.spans);
    this.rrwebEvents = (0,sentry_utils_replays_replayDataUtils__WEBPACK_IMPORTED_MODULE_2__.rrwebEventListFactory)(replayRecord, rrwebEvents);
    this.replayRecord = replayRecord;
  }

}

/***/ }),

/***/ "./app/views/replays/detail/layout/fluidHeight.tsx":
/*!*********************************************************!*\
  !*** ./app/views/replays/detail/layout/fluidHeight.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

const FluidHeight = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e42v6lb0"
} : 0)( true ? {
  name: "oie2px",
  styles: "display:flex;flex-direction:column;flex-wrap:nowrap;flex-grow:1;overflow:hidden"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (FluidHeight);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_replays_replayView_tsx-app_utils_replays_hooks_useReplayData_tsx.7393b34b2fd758f622fe1899e28bf97d.js.map