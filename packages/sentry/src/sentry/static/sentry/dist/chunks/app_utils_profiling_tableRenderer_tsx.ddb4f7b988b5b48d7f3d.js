"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_utils_profiling_tableRenderer_tsx"],{

/***/ "./app/components/gridEditable/sortLink.tsx":
/*!**************************************************!*\
  !*** ./app/components/gridEditable/sortLink.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }







function SortLink(_ref) {
  let {
    align,
    title,
    canSort,
    generateSortLink,
    onClick,
    direction
  } = _ref;
  const target = generateSortLink();

  if (!target || !canSort) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(StyledNonLink, {
      align: align,
      children: title
    });
  }

  const arrow = !direction ? null : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(StyledIconArrow, {
    size: "xs",
    direction: direction === 'desc' ? 'down' : 'up'
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(StyledLink, {
    align: align,
    to: target,
    onClick: onClick,
    children: [title, " ", arrow]
  });
}

SortLink.displayName = "SortLink";

const StyledLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(props => {
  const forwardProps = lodash_omit__WEBPACK_IMPORTED_MODULE_1___default()(props, ['align']);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_2__["default"], { ...forwardProps
  });
},  true ? {
  target: "e1xb2te62"
} : 0)("display:block;width:100%;white-space:nowrap;color:inherit;&:hover,&:active,&:focus,&:visited{color:inherit;}", p => p.align ? `text-align: ${p.align};` : '', ";" + ( true ? "" : 0));

const StyledNonLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1xb2te61"
} : 0)("display:block;width:100%;white-space:nowrap;", p => p.align ? `text-align: ${p.align};` : '', ";" + ( true ? "" : 0));

const StyledIconArrow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconArrow,  true ? {
  target: "e1xb2te60"
} : 0)( true ? {
  name: "40f4ru",
  styles: "vertical-align:top"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SortLink);

/***/ }),

/***/ "./app/utils/profiling/tableRenderer.tsx":
/*!***********************************************!*\
  !*** ./app/utils/profiling/tableRenderer.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "renderTableHead": () => (/* binding */ renderTableHead)
/* harmony export */ });
/* harmony import */ var sentry_components_gridEditable_sortLink__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/gridEditable/sortLink */ "./app/components/gridEditable/sortLink.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function renderTableHead(_ref) {
  let {
    currentSort,
    generateSortLink,
    rightAlignedColumns,
    sortableColumns
  } = _ref;
  return (column, _columnIndex) => {
    var _generateSortLink;

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)(sentry_components_gridEditable_sortLink__WEBPACK_IMPORTED_MODULE_0__["default"], {
      align: rightAlignedColumns !== null && rightAlignedColumns !== void 0 && rightAlignedColumns.has(column.key) ? 'right' : 'left',
      title: column.name,
      direction: (currentSort === null || currentSort === void 0 ? void 0 : currentSort.column) === column.key ? currentSort === null || currentSort === void 0 ? void 0 : currentSort.direction : undefined,
      canSort: (sortableColumns === null || sortableColumns === void 0 ? void 0 : sortableColumns.has(column.key)) || false,
      generateSortLink: (_generateSortLink = generateSortLink === null || generateSortLink === void 0 ? void 0 : generateSortLink(column.key)) !== null && _generateSortLink !== void 0 ? _generateSortLink : () => undefined
    });
  };
}

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_utils_profiling_tableRenderer_tsx.ee43cbd3ac447298d92c81b93dd8f9c2.js.map