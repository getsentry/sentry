"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_splitDiff_tsx"],{

/***/ "./app/components/splitDiff.tsx":
/*!**************************************!*\
  !*** ./app/components/splitDiff.tsx ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var diff__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! diff */ "../node_modules/diff/lib/index.mjs");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }




const diffFnMap = {
  chars: diff__WEBPACK_IMPORTED_MODULE_2__.diffChars,
  words: diff__WEBPACK_IMPORTED_MODULE_2__.diffWords,
  lines: diff__WEBPACK_IMPORTED_MODULE_2__.diffLines
};

const SplitDiff = _ref => {
  let {
    className,
    type = 'lines',
    base,
    target
  } = _ref;
  const diffFn = diffFnMap[type];
  const baseLines = base.split('\n');
  const targetLines = target.split('\n');
  const [largerArray] = baseLines.length > targetLines.length ? [baseLines, targetLines] : [targetLines, baseLines];
  const results = largerArray.map((_line, index) => diffFn(baseLines[index] || '', targetLines[index] || '', {
    newlineIsToken: true
  }));
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(SplitTable, {
    className: className,
    "data-test-id": "split-diff",
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(SplitBody, {
      children: results.map((line, j) => {
        const highlightAdded = line.find(result => result.added);
        const highlightRemoved = line.find(result => result.removed);
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("tr", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Cell, {
            isRemoved: highlightRemoved,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Line, {
              children: line.filter(result => !result.added).map((result, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Word, {
                isRemoved: result.removed,
                children: result.value
              }, i))
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Gap, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Cell, {
            isAdded: highlightAdded,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Line, {
              children: line.filter(result => !result.removed).map((result, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Word, {
                isAdded: result.added,
                children: result.value
              }, i))
            })
          })]
        }, j);
      })
    })
  });
};

SplitDiff.displayName = "SplitDiff";

const SplitTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('table',  true ? {
  target: "e1fxrp6z5"
} : 0)( true ? {
  name: "15dv2py",
  styles: "table-layout:fixed;border-collapse:collapse;width:100%"
} : 0);

const SplitBody = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('tbody',  true ? {
  target: "e1fxrp6z4"
} : 0)("font-family:", p => p.theme.text.familyMono, ";font-size:", p => p.theme.fontSizeSmall, ";" + ( true ? "" : 0));

const Cell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('td',  true ? {
  target: "e1fxrp6z3"
} : 0)("vertical-align:top;", p => p.isRemoved && `background-color: ${p.theme.diff.removedRow}`, ";", p => p.isAdded && `background-color: ${p.theme.diff.addedRow}`, ";" + ( true ? "" : 0));

const Gap = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('td',  true ? {
  target: "e1fxrp6z2"
} : 0)( true ? {
  name: "1x3sxtc",
  styles: "width:20px"
} : 0);

const Line = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1fxrp6z1"
} : 0)( true ? {
  name: "5kov97",
  styles: "display:flex;flex-wrap:wrap"
} : 0);

const Word = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1fxrp6z0"
} : 0)("white-space:pre-wrap;word-break:break-all;", p => p.isRemoved && `background-color: ${p.theme.diff.removed}`, ";", p => p.isAdded && `background-color: ${p.theme.diff.added}`, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SplitDiff);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_splitDiff_tsx.c7c846a3402818769aeb2495d9b1aa68.js.map