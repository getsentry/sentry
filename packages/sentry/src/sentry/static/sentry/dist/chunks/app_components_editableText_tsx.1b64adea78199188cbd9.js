"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_editableText_tsx"],{

/***/ "./app/components/editableText.tsx":
/*!*****************************************!*\
  !*** ./app/components/editableText.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_input__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/input */ "./app/components/input.tsx");
/* harmony import */ var sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/textOverflow */ "./app/components/textOverflow.tsx");
/* harmony import */ var sentry_icons_iconEdit__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/icons/iconEdit */ "./app/icons/iconEdit.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_useKeyPress__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/useKeyPress */ "./app/utils/useKeyPress.tsx");
/* harmony import */ var sentry_utils_useOnClickOutside__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/useOnClickOutside */ "./app/utils/useOnClickOutside.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }













function EditableText(_ref) {
  let {
    value,
    onChange,
    name,
    errorMessage,
    successMessage,
    maxLength,
    isDisabled = false,
    autoSelect = false,
    'aria-label': ariaLabel
  } = _ref;
  const [isEditing, setIsEditing] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(false);
  const [inputValue, setInputValue] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(value);
  const isEmpty = !inputValue.trim();
  const innerWrapperRef = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(null);
  const labelRef = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(null);
  const inputRef = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(null);
  const enter = (0,sentry_utils_useKeyPress__WEBPACK_IMPORTED_MODULE_9__["default"])('Enter');
  const esc = (0,sentry_utils_useKeyPress__WEBPACK_IMPORTED_MODULE_9__["default"])('Escape');

  function revertValueAndCloseEditor() {
    if (value !== inputValue) {
      setInputValue(value);
    }

    if (isEditing) {
      setIsEditing(false);
    }
  } // check to see if the user clicked outside of this component


  (0,sentry_utils_useOnClickOutside__WEBPACK_IMPORTED_MODULE_10__["default"])(innerWrapperRef, () => {
    if (!isEditing) {
      return;
    }

    if (isEmpty) {
      displayStatusMessage('error');
      return;
    }

    if (inputValue !== value) {
      onChange(inputValue);
      displayStatusMessage('success');
    }

    setIsEditing(false);
  });
  const onEnter = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(() => {
    if (enter) {
      if (isEmpty) {
        displayStatusMessage('error');
        return;
      }

      if (inputValue !== value) {
        onChange(inputValue);
        displayStatusMessage('success');
      }

      setIsEditing(false);
    }
  }, [enter, inputValue, onChange]);
  const onEsc = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(() => {
    if (esc) {
      revertValueAndCloseEditor();
    }
  }, [esc]);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    revertValueAndCloseEditor();
  }, [isDisabled, value]); // focus the cursor in the input field on edit start

  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (isEditing) {
      const inputElement = inputRef.current;

      if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_8__.defined)(inputElement)) {
        inputElement.focus();
      }
    }
  }, [isEditing]);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (isEditing) {
      // if Enter is pressed, save the value and close the editor
      onEnter(); // if Escape is pressed, revert the value and close the editor

      onEsc();
    }
  }, [onEnter, onEsc, isEditing]); // watch the Enter and Escape key presses

  function displayStatusMessage(status) {
    if (status === 'error') {
      if (errorMessage) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)(errorMessage);
      }

      return;
    }

    if (successMessage) {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addSuccessMessage)(successMessage);
    }
  }

  function handleInputChange(event) {
    setInputValue(event.target.value);
  }

  function handleEditClick() {
    setIsEditing(true);
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Wrapper, {
    isDisabled: isDisabled,
    isEditing: isEditing,
    children: isEditing ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(InputWrapper, {
      ref: innerWrapperRef,
      isEmpty: isEmpty,
      "data-test-id": "editable-text-input",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(StyledInput, {
        "aria-label": ariaLabel,
        name: name,
        ref: inputRef,
        value: inputValue,
        onChange: handleInputChange,
        onFocus: event => autoSelect && event.target.select(),
        maxLength: maxLength
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(InputLabel, {
        children: inputValue
      })]
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(Label, {
      onClick: isDisabled ? undefined : handleEditClick,
      ref: labelRef,
      isDisabled: isDisabled,
      "data-test-id": "editable-text-label",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(InnerLabel, {
        children: inputValue
      }), !isDisabled && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons_iconEdit__WEBPACK_IMPORTED_MODULE_6__.IconEdit, {})]
    })
  });
}

EditableText.displayName = "EditableText";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EditableText);

const Label = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1nzw5k75"
} : 0)("display:grid;grid-auto-flow:column;align-items:center;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";cursor:", p => p.isDisabled ? 'default' : 'pointer', ";" + ( true ? "" : 0));

const InnerLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e1nzw5k74"
} : 0)("border-top:1px solid transparent;border-bottom:1px dotted ", p => p.theme.gray200, ";" + ( true ? "" : 0));

const InputWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1nzw5k73"
} : 0)("display:inline-block;background:", p => p.theme.gray100, ";border-radius:", p => p.theme.borderRadius, ";margin:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(0.5), " -", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(0.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";max-width:calc(100% + ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(2), ");" + ( true ? "" : 0));

const StyledInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_input__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "e1nzw5k72"
} : 0)( true ? {
  name: "11a2h5e",
  styles: "border:none!important;background:transparent;height:auto;min-height:34px;padding:0;&,&:focus,&:active,&:hover{box-shadow:none;}"
} : 0);

const InputLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1nzw5k71"
} : 0)("height:0;opacity:0;white-space:pre;padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";" + ( true ? "" : 0));

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1nzw5k70"
} : 0)("display:flex;", p => p.isDisabled && `
      ${InnerLabel} {
        border-bottom-color: transparent;
      }
    `, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/utils/useKeyPress.tsx":
/*!***********************************!*\
  !*** ./app/utils/useKeyPress.tsx ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");


/**
 * Hook to detect when a specific key is being pressed
 */

function useKeyPress(targetKey) {
  const [keyPressed, setKeyPressed] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    function downHandler(_ref) {
      let {
        key
      } = _ref;

      if (key === targetKey) {
        setKeyPressed(true);
      }
    }

    function upHandler(_ref2) {
      let {
        key
      } = _ref2;

      if (key === targetKey) {
        setKeyPressed(false);
      }
    }

    window.addEventListener('keydown', downHandler);
    window.addEventListener('keyup', upHandler);
    return () => {
      window.removeEventListener('keydown', downHandler);
      window.removeEventListener('keyup', upHandler);
    };
  }, [targetKey]);
  return keyPressed;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (useKeyPress);

/***/ }),

/***/ "./app/utils/useOnClickOutside.tsx":
/*!*****************************************!*\
  !*** ./app/utils/useOnClickOutside.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
 // hook from https://usehooks.com/useOnClickOutside/

function useOnClickOutside(ref, handler) {
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    const listener = event => {
      const el = ref === null || ref === void 0 ? void 0 : ref.current; // Do nothing if clicking ref's element or descendent elements

      if (!el || el.contains(event.target)) {
        return;
      }

      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, // Reload only if ref or handler changes
  [ref, handler]);
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (useOnClickOutside);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_editableText_tsx.4357f313f12da68784681f81c0becb0c.js.map