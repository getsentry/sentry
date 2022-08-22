"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_forms_controls_multipleCheckbox_tsx"],{

/***/ "./app/components/forms/controls/multipleCheckbox.tsx":
/*!************************************************************!*\
  !*** ./app/components/forms/controls/multipleCheckbox.tsx ***!
  \************************************************************/
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
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






const MultipleCheckboxWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eib0h5u3"
} : 0)( true ? {
  name: "5kov97",
  styles: "display:flex;flex-wrap:wrap"
} : 0);

const Label = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('label',  true ? {
  target: "eib0h5u2"
} : 0)( true ? {
  name: "1ryhb28",
  styles: "font-weight:normal;white-space:nowrap;margin-right:10px;margin-bottom:10px;width:20%"
} : 0);

const CheckboxLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "eib0h5u1"
} : 0)( true ? {
  name: "1i7v2bx",
  styles: "margin-left:3px"
} : 0);

class MultipleCheckbox extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onChange", (selectedValue, e) => {
      const {
        value,
        onChange
      } = this.props;
      let newValue = [];

      if (typeof onChange !== 'function') {
        return;
      }

      if (e.target.checked) {
        newValue = value ? [...value, selectedValue] : [value];
      } else {
        newValue = value.filter(v => v !== selectedValue);
      }

      onChange(newValue, e);
    });
  }

  render() {
    const {
      disabled,
      choices,
      value
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(MultipleCheckboxWrapper, {
      children: choices.map(_ref => {
        let [choiceValue, choiceLabel] = _ref;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(LabelContainer, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(Label, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("input", {
              type: "checkbox",
              value: choiceValue,
              onChange: this.onChange.bind(this, choiceValue),
              disabled: disabled,
              checked: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_4__.defined)(value) && value.indexOf(choiceValue) !== -1
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(CheckboxLabel, {
              children: choiceLabel
            })]
          })
        }, choiceValue);
      })
    });
  }

}

MultipleCheckbox.displayName = "MultipleCheckbox";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MultipleCheckbox);

const LabelContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eib0h5u0"
} : 0)("width:100%;@media (min-width: ", p => p.theme.breakpoints.small, "){width:50%;}@media (min-width: ", p => p.theme.breakpoints.medium, "){width:33.333%;}@media (min-width: ", p => p.theme.breakpoints.large, "){width:25%;}" + ( true ? "" : 0));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_forms_controls_multipleCheckbox_tsx.cee6c463b580c7bdaddded6317022ab0.js.map