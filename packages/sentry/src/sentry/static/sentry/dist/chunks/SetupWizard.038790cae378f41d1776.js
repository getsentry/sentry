"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["SetupWizard"],{

/***/ "./app/views/setupWizard/index.tsx":
/*!*****************************************!*\
  !*** ./app/views/setupWizard/index.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_themeAndStyleProvider__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/themeAndStyleProvider */ "./app/components/themeAndStyleProvider.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










function SetupWizard(_ref) {
  let {
    hash = false
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_6__["default"])();
  const closeTimeoutRef = (0,react__WEBPACK_IMPORTED_MODULE_1__.useRef)(undefined);
  const [finished, setFinished] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  });
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    return () => {
      window.clearTimeout(closeTimeoutRef.current);
    };
  });
  const checkFinished = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async () => {
    try {
      await api.requestPromise(`/wizard/${hash}/`);
    } catch {
      setFinished(true);
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = window.setTimeout(() => window.close(), 10000);
    }
  }, [api, hash]);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    const pollingInterval = window.setInterval(checkFinished, 1000);
    return () => window.clearInterval(pollingInterval);
  }, [checkFinished]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_themeAndStyleProvider__WEBPACK_IMPORTED_MODULE_4__["default"], {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("div", {
      className: "container",
      children: !finished ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_3__["default"], {
        style: {
          margin: '2em auto'
        },
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("div", {
          className: "row",
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("h5", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Waiting for wizard to connect')
          })
        })
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)("div", {
        className: "row",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("h5", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Return to your terminal to complete your setup')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("h5", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('(This window will close in 10 seconds)')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
          onClick: () => window.close(),
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Close browser tab')
        })]
      })
    })
  });
}

SetupWizard.displayName = "SetupWizard";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SetupWizard);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/SetupWizard.a14dd34d77b61b358451905f7bd33a90.js.map