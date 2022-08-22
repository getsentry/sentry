"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_searchBar_tsx"],{

/***/ "./app/components/searchBar.tsx":
/*!**************************************!*\
  !*** ./app/components/searchBar.tsx ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_is_prop_valid__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/is-prop-valid */ "../node_modules/@emotion/is-prop-valid/dist/is-prop-valid.browser.esm.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_input__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/input */ "./app/components/input.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_icons_iconClose__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/icons/iconClose */ "./app/icons/iconClose.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }











function SearchBar(_ref) {
  let {
    query: queryProp,
    defaultQuery = '',
    onChange,
    onSearch,
    width,
    size,
    className,
    ...inputProps
  } = _ref;
  const inputRef = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(null);
  const [query, setQuery] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(queryProp !== null && queryProp !== void 0 ? queryProp : defaultQuery);
  const onQueryChange = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(e => {
    const {
      value
    } = e.target;
    setQuery(value);
    onChange === null || onChange === void 0 ? void 0 : onChange(value);
  }, [onChange]);
  const onSubmit = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(e => {
    var _inputRef$current;

    e.preventDefault();
    (_inputRef$current = inputRef.current) === null || _inputRef$current === void 0 ? void 0 : _inputRef$current.blur();
    onSearch === null || onSearch === void 0 ? void 0 : onSearch(query);
  }, [onSearch, query]);
  const clearSearch = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(() => {
    setQuery('');
    onChange === null || onChange === void 0 ? void 0 : onChange('');
    onSearch === null || onSearch === void 0 ? void 0 : onSearch('');
  }, [onChange, onSearch]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(FormWrap, {
    onSubmit: onSubmit,
    className: className,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(StyledInput, { ...inputProps,
      ref: inputRef,
      type: "text",
      name: "query",
      autoComplete: "off",
      value: query,
      onChange: onQueryChange,
      width: width,
      size: size,
      showClearButton: !!query
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(StyledIconSearch, {
      color: "subText",
      size: size === 'xs' ? 'xs' : 'sm',
      inputSize: size
    }), !!query && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(SearchClearButton, {
      type: "button",
      priority: "link",
      onClick: clearSearch,
      size: "xs",
      icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_icons_iconClose__WEBPACK_IMPORTED_MODULE_7__.IconClose, {
        size: "xs"
      }),
      "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Clear'),
      inputSize: size
    })]
  });
}

SearchBar.displayName = "SearchBar";

const FormWrap = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('form',  true ? {
  target: "e4xnwji3"
} : 0)( true ? {
  name: "4bgdod",
  styles: "display:block;position:relative"
} : 0);

const StyledInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_input__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e4xnwji2"
} : 0)("width:", p => p.width ? p.width : undefined, ";padding-left:", p => {
  var _p$size;

  return `calc(
    ${p.theme.formPadding[(_p$size = p.size) !== null && _p$size !== void 0 ? _p$size : 'md'].paddingLeft}px * 1.5 +
    ${p.theme.iconSizes.sm}
  )`;
}, ";", p => {
  var _p$size2;

  return p.showClearButton && `
      padding-right: calc(
        ${p.theme.formPadding[(_p$size2 = p.size) !== null && _p$size2 !== void 0 ? _p$size2 : 'md'].paddingRight}px * 1.5 +
        ${p.theme.iconSizes.xs}
      );
    `;
}, ";" + ( true ? "" : 0));

const StyledIconSearch = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_6__.IconSearch,  true ? {
  shouldForwardProp: prop => typeof prop === 'string' && (0,_emotion_is_prop_valid__WEBPACK_IMPORTED_MODULE_3__["default"])(prop),
  target: "e4xnwji1"
} : 0)("position:absolute;top:50%;left:", p => {
  var _p$inputSize;

  return p.theme.formPadding[(_p$inputSize = p.inputSize) !== null && _p$inputSize !== void 0 ? _p$inputSize : 'md'].paddingLeft;
}, "px;transform:translateY(-50%);pointer-events:none;" + ( true ? "" : 0));

const SearchClearButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "e4xnwji0"
} : 0)("position:absolute;top:50%;transform:translateY(-50%);right:", p => {
  var _p$inputSize2;

  return p.theme.formPadding[(_p$inputSize2 = p.inputSize) !== null && _p$inputSize2 !== void 0 ? _p$inputSize2 : 'md'].paddingRight;
}, "px;font-size:", p => p.theme.fontSizeLarge, ";color:", p => p.theme.subText, ";&:hover{color:", p => p.theme.textColor, ";}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SearchBar);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_searchBar_tsx.f7a02b4e36f34aca40d840d384c89807.js.map