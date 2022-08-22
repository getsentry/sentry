"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_issueList_noGroupsHandler_congratsRobots_tsx"],{

/***/ "./app/components/autoplayVideo.tsx":
/*!******************************************!*\
  !*** ./app/components/autoplayVideo.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AutoplayVideo": () => (/* binding */ AutoplayVideo)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



/**
 * Wrapper for autoplaying video.
 *
 * Because of react limitations and browser controls we need to
 * use refs.
 *
 * Note, video needs `muted` for `autoplay` to work on Chrome
 * See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video
 */
function AutoplayVideo(props) {
  const videoRef = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(null);
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    if (videoRef.current) {
      var _videoRef$current$pla;

      // Set muted as more browsers allow autoplay with muted video.
      // We can't use the muted prop because of a react bug.
      // https://github.com/facebook/react/issues/10389
      // So we need to set the muted property then trigger play.
      videoRef.current.muted = true; // non-chromium Edge and jsdom don't return a promise.

      (_videoRef$current$pla = videoRef.current.play()) === null || _videoRef$current$pla === void 0 ? void 0 : _videoRef$current$pla.catch(() => {// Do nothing. Interrupting this playback is fine.
      });
    }
  }, []);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)("video", {
    ref: videoRef,
    playsInline: true,
    disablePictureInPicture: true,
    loop: true,
    ...props
  });
}

AutoplayVideo.displayName = "AutoplayVideo";


/***/ }),

/***/ "./app/views/issueList/noGroupsHandler/congratsRobots.tsx":
/*!****************************************************************!*\
  !*** ./app/views/issueList/noGroupsHandler/congratsRobots.tsx ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_images_spot_congrats_robots_mp4__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry-images/spot/congrats-robots.mp4 */ "./images/spot/congrats-robots.mp4");
/* harmony import */ var sentry_components_autoplayVideo__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/autoplayVideo */ "./app/components/autoplayVideo.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }





/**
 * Note, video needs `muted` for `autoplay` to work on Chrome
 * See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video
 */



function CongratsRobots() {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(AnimatedScene, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(StyledAutoplayVideo, {
      "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Congratulations video'),
      src: sentry_images_spot_congrats_robots_mp4__WEBPACK_IMPORTED_MODULE_1__
    })
  });
}

CongratsRobots.displayName = "CongratsRobots";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (CongratsRobots);

const AnimatedScene = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1524o6y1"
} : 0)( true ? {
  name: "ddxhyk",
  styles: "max-width:800px"
} : 0);

const StyledAutoplayVideo = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_autoplayVideo__WEBPACK_IMPORTED_MODULE_2__.AutoplayVideo,  true ? {
  target: "e1524o6y0"
} : 0)("max-height:320px;max-width:100%;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./images/spot/congrats-robots.mp4":
/*!*****************************************!*\
  !*** ./images/spot/congrats-robots.mp4 ***!
  \*****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__.p + "assets/congrats-robots.04800129a22b89e6e073.mp4";

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_issueList_noGroupsHandler_congratsRobots_tsx.3656907bda7bec6f7cbba7ff166958d8.js.map