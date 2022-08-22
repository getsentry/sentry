"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_acl_access_tsx-app_components_forms_textCopyInput_tsx-app_components_truncate_-b908d0"],{

/***/ "./app/components/acl/access.tsx":
/*!***************************************!*\
  !*** ./app/components/acl/access.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_isRenderFunc__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/isRenderFunc */ "./app/utils/isRenderFunc.tsx");
/* harmony import */ var sentry_utils_withConfig__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/withConfig */ "./app/utils/withConfig.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










const DEFAULT_NO_ACCESS_MESSAGE = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__["default"], {
  type: "error",
  showIcon: true,
  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('You do not have sufficient permissions to access this.')
}); // Props that function children will get.


const defaultProps = {
  renderNoAccessMessage: false,
  isSuperuser: false,
  requireAll: true,
  access: []
};

/**
 * Component to handle access restrictions.
 */
class Access extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  render() {
    const {
      organization,
      config,
      access,
      requireAll,
      isSuperuser,
      renderNoAccessMessage,
      children
    } = this.props;
    const {
      access: orgAccess
    } = organization || {
      access: []
    };
    const method = requireAll ? 'every' : 'some';
    const hasAccess = !access || access[method](acc => orgAccess.includes(acc));
    const hasSuperuser = !!(config.user && config.user.isSuperuser);
    const renderProps = {
      hasAccess,
      hasSuperuser
    };
    const render = hasAccess && (!isSuperuser || hasSuperuser);

    if (!render && typeof renderNoAccessMessage === 'function') {
      return renderNoAccessMessage(renderProps);
    }

    if (!render && renderNoAccessMessage) {
      return DEFAULT_NO_ACCESS_MESSAGE;
    }

    if ((0,sentry_utils_isRenderFunc__WEBPACK_IMPORTED_MODULE_5__.isRenderFunc)(children)) {
      return children(renderProps);
    }

    return render ? children : null;
  }

}

Access.displayName = "Access";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(Access, "defaultProps", defaultProps);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_7__["default"])((0,sentry_utils_withConfig__WEBPACK_IMPORTED_MODULE_6__["default"])(Access)));

/***/ }),

/***/ "./app/components/forms/textCopyInput.tsx":
/*!************************************************!*\
  !*** ./app/components/forms/textCopyInput.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "StyledCopyButton": () => (/* binding */ StyledCopyButton),
/* harmony export */   "StyledInput": () => (/* binding */ StyledInput),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_dom__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-dom */ "../node_modules/react-dom/profiling.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_clipboard__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/clipboard */ "./app/components/clipboard.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_styles_input__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/input */ "./app/styles/input.tsx");
/* harmony import */ var sentry_utils_selectText__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/selectText */ "./app/utils/selectText.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }











const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "etk0cn13"
} : 0)( true ? {
  name: "zjik7",
  styles: "display:flex"
} : 0);

const StyledInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('input',  true ? {
  target: "etk0cn12"
} : 0)(sentry_styles_input__WEBPACK_IMPORTED_MODULE_8__.inputStyles, ";background-color:", p => p.theme.backgroundSecondary, ";border-right-width:0;border-top-right-radius:0;border-bottom-right-radius:0;direction:", p => p.rtl ? 'rtl' : 'ltr', ";&:hover,&:focus{background-color:", p => p.theme.backgroundSecondary, ";border-right-width:0;}" + ( true ? "" : 0));

const OverflowContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "etk0cn11"
} : 0)( true ? {
  name: "1u4yjkc",
  styles: "flex-grow:1;border:none"
} : 0);

const StyledCopyButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "etk0cn10"
} : 0)( true ? {
  name: "1tz1tsa",
  styles: "flex-shrink:1;border-radius:0 0.25em 0.25em 0;box-shadow:none"
} : 0);

class TextCopyInput extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "textRef", /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_3__.createRef)());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleCopyClick", e => {
      if (!this.textRef.current) {
        return;
      }

      const {
        onCopy,
        children
      } = this.props;
      this.handleSelectText();
      onCopy === null || onCopy === void 0 ? void 0 : onCopy(children, e);
      e.stopPropagation();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSelectText", () => {
      const {
        rtl
      } = this.props;

      if (!this.textRef.current) {
        return;
      } // We use findDOMNode here because `this.textRef` is not a dom node,
      // it's a ref to AutoSelectText


      const node = (0,react_dom__WEBPACK_IMPORTED_MODULE_4__.findDOMNode)(this.textRef.current); // eslint-disable-line react/no-find-dom-node

      if (!node || !(node instanceof HTMLElement)) {
        return;
      }

      if (rtl && node instanceof HTMLInputElement) {
        // we don't want to select the first character - \u202A, nor the last - \u202C
        node.setSelectionRange(1, node.value.length - 1);
      } else {
        (0,sentry_utils_selectText__WEBPACK_IMPORTED_MODULE_9__.selectText)(node);
      }
    });
  }

  render() {
    const {
      className,
      disabled,
      style,
      children,
      rtl
    } = this.props;
    /**
     * We are using direction: rtl; to always show the ending of a long overflowing text in input.
     *
     * This however means that the trailing characters with BiDi class O.N. ('Other Neutrals') goes to the other side.
     * Hello! becomes !Hello and vice versa. This is a problem for us when we want to show path in this component, because
     * /user/local/bin becomes user/local/bin/. Wrapping in unicode characters for left-to-righ embedding solves this,
     * however we need to be aware of them when selecting the text - we are solving that by offsetting the selectionRange.
     */

    const inputValue = rtl ? '\u202A' + children + '\u202C' : children;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(Wrapper, {
      className: className,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(OverflowContainer, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(StyledInput, {
          readOnly: true,
          disabled: disabled,
          ref: this.textRef,
          style: style,
          value: inputValue,
          onClick: this.handleSelectText,
          rtl: rtl
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_clipboard__WEBPACK_IMPORTED_MODULE_6__["default"], {
        hideUnsupported: true,
        value: children,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(StyledCopyButton, {
          type: "button",
          disabled: disabled,
          onClick: this.handleCopyClick,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconCopy, {})
        })
      })]
    });
  }

}

TextCopyInput.displayName = "TextCopyInput";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TextCopyInput);

/***/ }),

/***/ "./app/components/truncate.tsx":
/*!*************************************!*\
  !*** ./app/components/truncate.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FullValue": () => (/* binding */ FullValue),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






class Truncate extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      isExpanded: false
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onFocus", () => {
      const {
        value,
        maxLength
      } = this.props;

      if (value.length <= maxLength) {
        return;
      }

      this.setState({
        isExpanded: true
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onBlur", () => {
      if (this.state.isExpanded) {
        this.setState({
          isExpanded: false
        });
      }
    });
  }

  render() {
    const {
      className,
      leftTrim,
      trimRegex,
      minLength,
      maxLength,
      value,
      expandable,
      expandDirection
    } = this.props;
    const isTruncated = value.length > maxLength;
    let shortValue = '';

    if (isTruncated) {
      const slicedValue = leftTrim ? value.slice(value.length - (maxLength - 4), value.length) : value.slice(0, maxLength - 4); // Try to trim to values from the regex

      if (trimRegex && leftTrim) {
        const valueIndex = slicedValue.search(trimRegex);
        shortValue = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("span", {
          children: ["\u2026", ' ', valueIndex > 0 && valueIndex <= maxLength - minLength ? slicedValue.slice(slicedValue.search(trimRegex), slicedValue.length) : slicedValue]
        });
      } else if (trimRegex && !leftTrim) {
        const matches = slicedValue.match(trimRegex);
        let lastIndex = matches ? slicedValue.lastIndexOf(matches[matches.length - 1]) + 1 : slicedValue.length;

        if (lastIndex <= minLength) {
          lastIndex = slicedValue.length;
        }

        shortValue = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("span", {
          children: [slicedValue.slice(0, lastIndex), " \u2026"]
        });
      } else if (leftTrim) {
        shortValue = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("span", {
          children: ["\u2026 ", slicedValue]
        });
      } else {
        shortValue = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("span", {
          children: [slicedValue, " \u2026"]
        });
      }
    } else {
      shortValue = value;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(Wrapper, {
      className: className,
      onMouseOver: expandable ? this.onFocus : undefined,
      onMouseOut: expandable ? this.onBlur : undefined,
      onFocus: expandable ? this.onFocus : undefined,
      onBlur: expandable ? this.onBlur : undefined,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("span", {
        children: shortValue
      }), isTruncated && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(FullValue, {
        expanded: this.state.isExpanded,
        expandDirection: expandDirection,
        children: value
      })]
    });
  }

}

Truncate.displayName = "Truncate";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(Truncate, "defaultProps", {
  className: '',
  minLength: 15,
  maxLength: 50,
  leftTrim: false,
  expandable: true,
  expandDirection: 'right'
});

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e1sfkn8v1"
} : 0)( true ? {
  name: "bjn8wh",
  styles: "position:relative"
} : 0);

const FullValue = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e1sfkn8v0"
} : 0)("display:none;position:absolute;background:", p => p.theme.background, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(0.5), ";border:1px solid ", p => p.theme.innerBorder, ";white-space:nowrap;border-radius:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(0.5), ";top:-5px;", p => p.expandDirection === 'left' && 'right: -5px;', " ", p => p.expandDirection === 'right' && 'left: -5px;', " ", p => p.expanded && `
    z-index: ${p.theme.zIndex.truncationFullValue};
    display: block;
    `, ";" + ( true ? "" : 0));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Truncate);

/***/ }),

/***/ "./app/utils/useOrganization.tsx":
/*!***************************************!*\
  !*** ./app/utils/useOrganization.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_views_organizationContext__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/views/organizationContext */ "./app/views/organizationContext.tsx");




function useOrganization() {
  const organization = (0,react__WEBPACK_IMPORTED_MODULE_1__.useContext)(sentry_views_organizationContext__WEBPACK_IMPORTED_MODULE_2__.OrganizationContext);

  if (!organization) {
    throw new Error('useOrganization called but organization is not set.');
  }

  return organization;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (useOrganization);

/***/ }),

/***/ "./app/utils/withConfig.tsx":
/*!**********************************!*\
  !*** ./app/utils/withConfig.tsx ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/stores/useLegacyStore */ "./app/stores/useLegacyStore.tsx");
/* harmony import */ var sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/getDisplayName */ "./app/utils/getDisplayName.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





/**
 * Higher order component that passes the config object to the wrapped
 * component
 */
function withConfig(WrappedComponent) {
  const Wrapper = props => {
    const config = (0,sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_1__.useLegacyStore)(sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_0__["default"]);
    const allProps = {
      config,
      ...props
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(WrappedComponent, { ...allProps
    });
  };

  Wrapper.displayName = `withConfig(${(0,sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_2__["default"])(WrappedComponent)})`;
  return Wrapper;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (withConfig);

/***/ }),

/***/ "./app/views/organizationContext.tsx":
/*!*******************************************!*\
  !*** ./app/views/organizationContext.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "OrganizationContext": () => (/* binding */ OrganizationContext)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");

const OrganizationContext = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_0__.createContext)(null);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_acl_access_tsx-app_components_forms_textCopyInput_tsx-app_components_truncate_-b908d0.a29ce8102c58984dfa2ed60e4d335b59.js.map