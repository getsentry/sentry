"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_actions_organizationsActions_tsx-app_components_clipboard_tsx-app_components_forms_compac-1ced7e"],{

/***/ "./app/actions/organizationsActions.tsx":
/*!**********************************************!*\
  !*** ./app/actions/organizationsActions.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);

const OrganizationsActions = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createActions)(['update', 'setActive', 'changeSlug', 'remove', 'removeSuccess', 'removeError']);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OrganizationsActions);

/***/ }),

/***/ "./app/actions/projectActions.tsx":
/*!****************************************!*\
  !*** ./app/actions/projectActions.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);

const ProjectActions = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createActions)(['addTeam', 'addTeamError', 'addTeamSuccess', 'changeSlug', 'createSuccess', 'loadProjects', 'loadStats', 'loadStatsError', 'loadStatsForProjectSuccess', 'loadStatsSuccess', 'removeProject', 'removeProjectError', 'removeProjectSuccess', 'removeTeam', 'removeTeamError', 'removeTeamSuccess', 'reset', 'setActive', 'update', 'updateError', 'updateSuccess']);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectActions);

/***/ }),

/***/ "./app/components/badge.tsx":
/*!**********************************!*\
  !*** ./app/components/badge.tsx ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




const Badge = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_ref => {
  let {
    children,
    text,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("span", { ...props,
    children: children !== null && children !== void 0 ? children : text
  });
},  true ? {
  target: "e1gotaso0"
} : 0)("display:inline-block;height:20px;min-width:20px;line-height:20px;border-radius:20px;padding:0 5px;margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(0.5), ";font-size:75%;font-weight:600;text-align:center;color:", p => {
  var _p$type;

  return p.theme.badge[(_p$type = p.type) !== null && _p$type !== void 0 ? _p$type : 'default'].color;
}, ";background:", p => {
  var _p$type2;

  return p.theme.badge[(_p$type2 = p.type) !== null && _p$type2 !== void 0 ? _p$type2 : 'default'].background;
}, ";transition:background 100ms linear;position:relative;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Badge);

/***/ }),

/***/ "./app/components/clipboard.tsx":
/*!**************************************!*\
  !*** ./app/components/clipboard.tsx ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_dom__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-dom */ "../node_modules/react-dom/profiling.js");
/* harmony import */ var copy_text_to_clipboard__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! copy-text-to-clipboard */ "../node_modules/copy-text-to-clipboard/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");







/**
 * copy-text-to-clipboard relies on `document.execCommand('copy')`
 */
function isSupported() {
  var _document$queryComman, _document;

  return !!((_document$queryComman = (_document = document).queryCommandSupported) !== null && _document$queryComman !== void 0 && _document$queryComman.call(_document, 'copy'));
}

function Clipboard(_ref) {
  let {
    hideMessages = false,
    successMessage = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Copied to clipboard'),
    errorMessage = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Error copying to clipboard'),
    value,
    onSuccess,
    onError,
    hideUnsupported,
    children
  } = _ref;
  const [element, setElement] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)();
  const handleClick = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
    const copyWasSuccessful = (0,copy_text_to_clipboard__WEBPACK_IMPORTED_MODULE_3__["default"])(value);

    if (!copyWasSuccessful) {
      if (!hideMessages) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)(errorMessage);
      }

      onError === null || onError === void 0 ? void 0 : onError();
      return;
    }

    if (!hideMessages) {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)(successMessage);
    }

    onSuccess === null || onSuccess === void 0 ? void 0 : onSuccess();
  }, [value, onError, onSuccess, errorMessage, successMessage, hideMessages]);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    element === null || element === void 0 ? void 0 : element.addEventListener('click', handleClick);
    return () => element === null || element === void 0 ? void 0 : element.removeEventListener('click', handleClick);
  }, [handleClick, element]); // XXX: Instead of assigning the `onClick` to the cloned child element, we
  // attach a event listener, otherwise we would wipeout whatever click handler
  // may be assigned on the child.

  const handleMount = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(ref => {
    // eslint-disable-next-line react/no-find-dom-node
    setElement((0,react_dom__WEBPACK_IMPORTED_MODULE_2__.findDOMNode)(ref));
  }, []); // Browser doesn't support `execCommand`

  if (hideUnsupported && !isSupported()) {
    return null;
  }

  if (! /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.isValidElement)(children)) {
    return null;
  }

  return /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.cloneElement)(children, {
    ref: handleMount
  });
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Clipboard);

/***/ }),

/***/ "./app/components/forms/compactSelect.tsx":
/*!************************************************!*\
  !*** ./app/components/forms/compactSelect.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CompactSelectControl": () => (/* binding */ CompactSelectControl),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_select__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! react-select */ "../node_modules/react-select/dist/index-4322c0ed.browser.esm.js");
/* harmony import */ var _react_aria_button__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @react-aria/button */ "../node_modules/@react-aria/button/dist/module.js");
/* harmony import */ var _react_aria_focus__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @react-aria/focus */ "../node_modules/@react-aria/focus/dist/module.js");
/* harmony import */ var _react_aria_menu__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @react-aria/menu */ "../node_modules/@react-aria/menu/dist/module.js");
/* harmony import */ var _react_aria_overlays__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @react-aria/overlays */ "../node_modules/@react-aria/overlays/dist/module.js");
/* harmony import */ var _react_aria_utils__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @react-aria/utils */ "../node_modules/@react-aria/utils/dist/module.js");
/* harmony import */ var _react_stately_menu__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @react-stately/menu */ "../node_modules/@react-stately/menu/dist/module.js");
/* harmony import */ var sentry_components_badge__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/badge */ "./app/components/badge.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_dropdownButton__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/dropdownButton */ "./app/components/dropdownButton.tsx");
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


















/**
 * Recursively finds the selected option(s) from an options array. Useful for
 * non-flat arrays that contain sections (groups of options).
 */
function getSelectedOptions(opts, value) {
  return opts.reduce((acc, cur) => {
    if (cur.options) {
      return acc.concat(getSelectedOptions(cur.options, value));
    }

    if (cur.value === value) {
      return acc.concat(cur);
    }

    return acc;
  }, []);
} // Exported so we can further customize this component with react-select's
// components prop elsewhere


const CompactSelectControl = _ref => {
  let {
    innerProps,
    ...props
  } = _ref;
  const {
    hasValue,
    selectProps
  } = props;
  const {
    isSearchable,
    menuTitle,
    isClearable,
    isLoading
  } = selectProps;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
    children: [(menuTitle || isClearable || isLoading) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(MenuHeader, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(MenuTitle, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("span", {
          children: menuTitle
        })
      }), isLoading && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(StyledLoadingIndicator, {
        size: 12,
        mini: true
      }), hasValue && isClearable && !isLoading && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(ClearButton, {
        type: "button",
        size: "zero",
        borderless: true,
        onClick: () => props.clearValue() // set tabIndex -1 to autofocus search on open
        ,
        tabIndex: isSearchable ? -1 : undefined,
        children: "Clear"
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(react_select__WEBPACK_IMPORTED_MODULE_10__.y.Control, { ...props,
      innerProps: { ...innerProps,
        ...(!isSearchable && {
          'aria-hidden': true
        })
      }
    })]
  });
};
CompactSelectControl.displayName = "CompactSelectControl";

// TODO(vl): Turn this into a reusable component
function Menu(_ref2) {
  var _positionProps$style, _positionProps$style2;

  let {
    // Trigger & trigger state
    targetRef,
    onClose,
    // Overlay props
    offset = 8,
    crossOffset = 0,
    containerPadding = 8,
    placement = 'bottom left',
    shouldCloseOnBlur = true,
    isDismissable = true,
    maxMenuHeight = 400,
    minMenuWidth,
    children
  } = _ref2;
  // Control the overlay's position
  const overlayRef = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(null);
  const {
    overlayProps
  } = (0,_react_aria_overlays__WEBPACK_IMPORTED_MODULE_11__.useOverlay)({
    isOpen: true,
    onClose,
    shouldCloseOnBlur,
    isDismissable,
    shouldCloseOnInteractOutside: target => {
      var _targetRef$current;

      return target && targetRef.current !== target && !((_targetRef$current = targetRef.current) !== null && _targetRef$current !== void 0 && _targetRef$current.contains(target));
    }
  }, overlayRef);
  const {
    overlayProps: positionProps
  } = (0,_react_aria_overlays__WEBPACK_IMPORTED_MODULE_11__.useOverlayPosition)({
    targetRef,
    overlayRef,
    offset,
    crossOffset,
    placement,
    containerPadding,
    isOpen: true
  });
  const menuHeight = (_positionProps$style = positionProps.style) !== null && _positionProps$style !== void 0 && _positionProps$style.maxHeight ? Math.min(+((_positionProps$style2 = positionProps.style) === null || _positionProps$style2 === void 0 ? void 0 : _positionProps$style2.maxHeight), maxMenuHeight) : 'none';
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(Overlay, {
    ref: overlayRef,
    minWidth: minMenuWidth,
    ...(0,_react_aria_utils__WEBPACK_IMPORTED_MODULE_12__.mergeProps)(overlayProps, positionProps),
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_react_aria_focus__WEBPACK_IMPORTED_MODULE_13__.FocusScope, {
      restoreFocus: true,
      autoFocus: true,
      children: children(menuHeight)
    })
  });
}

Menu.displayName = "Menu";

/**
 * A select component with a more compact trigger button. Accepts the same
 * props as SelectControl, plus some more for the trigger button & overlay.
 */
function CompactSelect(_ref3) {
  let {
    // Select props
    options,
    onChange,
    defaultValue,
    value: valueProp,
    isDisabled: disabledProp,
    isSearchable = false,
    multiple,
    placeholder = 'Search…',
    onChangeValueMap,
    // Trigger button & wrapper props
    trigger,
    triggerLabel,
    triggerProps,
    size = 'md',
    className,
    renderWrapAs,
    closeOnSelect = true,
    menuTitle,
    onClose,
    ...props
  } = _ref3;
  // Manage the dropdown menu's open state
  const isDisabled = disabledProp || (options === null || options === void 0 ? void 0 : options.length) === 0;
  const triggerRef = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(null);
  const state = (0,_react_stately_menu__WEBPACK_IMPORTED_MODULE_14__.useMenuTriggerState)(props);
  const {
    menuTriggerProps
  } = (0,_react_aria_menu__WEBPACK_IMPORTED_MODULE_15__.useMenuTrigger)({
    type: 'listbox',
    isDisabled
  }, state, triggerRef);
  const {
    buttonProps
  } = (0,_react_aria_button__WEBPACK_IMPORTED_MODULE_16__.useButton)({
    onPress: () => state.toggle(),
    isDisabled,
    ...menuTriggerProps
  }, triggerRef); // Keep an internal copy of the current select value and update the control
  // button's label when the value changes

  const [internalValue, setInternalValue] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(valueProp !== null && valueProp !== void 0 ? valueProp : defaultValue); // Update the button label when the value changes

  const getLabel = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(() => {
    var _selectedOptions$0$la, _selectedOptions$;

    const newValue = valueProp !== null && valueProp !== void 0 ? valueProp : internalValue;
    const valueSet = Array.isArray(newValue) ? newValue : [newValue];
    const selectedOptions = valueSet.map(val => getSelectedOptions(options, val)).flat();
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(ButtonLabel, {
        children: (_selectedOptions$0$la = (_selectedOptions$ = selectedOptions[0]) === null || _selectedOptions$ === void 0 ? void 0 : _selectedOptions$.label) !== null && _selectedOptions$0$la !== void 0 ? _selectedOptions$0$la : ''
      }), selectedOptions.length > 1 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(StyledBadge, {
        text: `+${selectedOptions.length - 1}`
      })]
    });
  }, [options, valueProp, internalValue]);
  const [label, setLabel] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(null);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    setLabel(getLabel());
  }, [getLabel]);

  function onValueChange(option) {
    const valueMap = onChangeValueMap !== null && onChangeValueMap !== void 0 ? onChangeValueMap : opts => opts.map(opt => opt.value);
    const newValue = Array.isArray(option) ? valueMap(option) : option === null || option === void 0 ? void 0 : option.value;
    setInternalValue(newValue);
    onChange === null || onChange === void 0 ? void 0 : onChange(option);

    if (closeOnSelect && !multiple) {
      state.close();
    }
  } // Calculate the current trigger element's width. This will be used as
  // the min width for the menu.


  const [triggerWidth, setTriggerWidth] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(); // Update triggerWidth when its size changes using useResizeObserver

  const updateTriggerWidth = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(async () => {
    var _triggerRef$current;

    // Wait until the trigger element finishes rendering, otherwise
    // ResizeObserver might throw an infinite loop error.
    await new Promise(resolve => window.setTimeout(resolve));
    const newTriggerWidth = (_triggerRef$current = triggerRef.current) === null || _triggerRef$current === void 0 ? void 0 : _triggerRef$current.offsetWidth;
    newTriggerWidth && setTriggerWidth(newTriggerWidth);
  }, [triggerRef]);
  (0,_react_aria_utils__WEBPACK_IMPORTED_MODULE_12__.useResizeObserver)({
    ref: triggerRef,
    onResize: updateTriggerWidth
  }); // If ResizeObserver is not available, manually update the width
  // when any of [trigger, triggerLabel, triggerProps] changes.

  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (typeof window.ResizeObserver !== 'undefined') {
      return;
    }

    updateTriggerWidth();
  }, [updateTriggerWidth]);

  function renderTrigger() {
    if (trigger) {
      return trigger({
        props: {
          size,
          isOpen: state.isOpen,
          ...triggerProps,
          ...buttonProps
        },
        ref: triggerRef
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_dropdownButton__WEBPACK_IMPORTED_MODULE_5__["default"], {
      ref: triggerRef,
      size: size,
      isOpen: state.isOpen,
      ...triggerProps,
      ...buttonProps,
      children: triggerLabel !== null && triggerLabel !== void 0 ? triggerLabel : label
    });
  }

  function onMenuClose() {
    onClose === null || onClose === void 0 ? void 0 : onClose();
    state.close();
  }

  function renderMenu() {
    if (!state.isOpen) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(Menu, {
      targetRef: triggerRef,
      onClose: onMenuClose,
      minMenuWidth: triggerWidth,
      ...props,
      children: menuHeight => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_6__["default"], {
        components: {
          Control: CompactSelectControl,
          ClearIndicator: null
        },
        ...props,
        options: options,
        value: valueProp !== null && valueProp !== void 0 ? valueProp : internalValue,
        multiple: multiple,
        onChange: onValueChange,
        size: size,
        menuTitle: menuTitle,
        placeholder: placeholder,
        isSearchable: isSearchable,
        menuHeight: menuHeight,
        menuPlacement: "bottom",
        menuIsOpen: true,
        isCompact: true,
        controlShouldRenderValue: false,
        hideSelectedOptions: false,
        menuShouldScrollIntoView: false,
        blurInputOnSelect: false,
        closeMenuOnSelect: false,
        closeMenuOnScroll: false,
        openMenuOnFocus: true
      })
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(MenuControlWrap, {
    className: className,
    as: renderWrapAs,
    role: "presentation",
    children: [renderTrigger(), renderMenu()]
  });
}

CompactSelect.displayName = "CompactSelect";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (CompactSelect);

const MenuControlWrap = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eqx4e0q7"
} : 0)( true ? "" : 0);

const ButtonLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "eqx4e0q6"
} : 0)(p => p.theme.overflowEllipsis, " text-align:left;" + ( true ? "" : 0));

const StyledBadge = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_badge__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "eqx4e0q5"
} : 0)( true ? {
  name: "enavay",
  styles: "flex-shrink:0;top:auto"
} : 0);

const Overlay = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eqx4e0q4"
} : 0)("max-width:calc(100% - ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(2), ");border-radius:", p => p.theme.borderRadius, ";background:", p => p.theme.backgroundElevated, ";box-shadow:0 0 0 1px ", p => p.theme.translucentBorder, ",", p => p.theme.dropShadowHeavy, ";font-size:", p => p.theme.fontSizeMedium, ";overflow:hidden;z-index:", p => p.theme.zIndex.dropdown, "!important;", p => p.minWidth && `min-width: ${p.minWidth}px;`, ";" + ( true ? "" : 0));

const MenuHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eqx4e0q3"
} : 0)("position:relative;display:flex;align-items:center;justify-content:space-between;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(0.75), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(0.75), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1.5), ";box-shadow:0 1px 0 ", p => p.theme.translucentInnerBorder, ";z-index:1;" + ( true ? "" : 0));

const MenuTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "eqx4e0q2"
} : 0)("font-weight:600;font-size:", p => p.theme.fontSizeSmall, ";color:", p => p.theme.headingColor, ";white-space:nowrap;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(2), ";" + ( true ? "" : 0));

const StyledLoadingIndicator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "eqx4e0q1"
} : 0)("&&{margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(0.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(0.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(0.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";height:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1.5), ";width:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1.5), ";}" + ( true ? "" : 0));

const ClearButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "eqx4e0q0"
} : 0)("font-size:", p => p.theme.fontSizeSmall, ";color:", p => p.theme.subText, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/globalSelectionLink.tsx":
/*!************************************************!*\
  !*** ./app/components/globalSelectionLink.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/utils */ "./app/components/organizations/pageFilters/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
// eslint-disable-next-line no-restricted-imports






/**
 * A modified link used for navigating between organization level pages that
 * will keep the global selection values (projects, environments, time) in the
 * querystring when navigating if it's present
 *
 * Falls back to <a> if there is no router present.
 */
function GlobalSelectionLink(props) {
  const {
    location,
    to
  } = props;
  const globalQuery = (0,sentry_components_organizations_pageFilters_utils__WEBPACK_IMPORTED_MODULE_3__.extractSelectionParameters)(location === null || location === void 0 ? void 0 : location.query);
  const hasGlobalQuery = Object.keys(globalQuery).length > 0;
  const query = typeof to === 'object' && to.query ? { ...globalQuery,
    ...to.query
  } : globalQuery;

  if (location) {
    const toWithGlobalQuery = !hasGlobalQuery ? {} : typeof to === 'string' ? {
      pathname: to,
      query
    } : { ...to,
      query
    };
    const routerProps = hasGlobalQuery ? { ...props,
      to: toWithGlobalQuery
    } : { ...props,
      to
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_2__["default"], { ...routerProps
    });
  }

  let queryStringObject = {};

  if (typeof to === 'object' && to.search) {
    queryStringObject = query_string__WEBPACK_IMPORTED_MODULE_1__.parse(to.search);
  }

  queryStringObject = { ...queryStringObject,
    ...globalQuery
  };

  if (typeof to === 'object' && to.query) {
    queryStringObject = { ...queryStringObject,
      ...to.query
    };
  }

  const queryString = query_string__WEBPACK_IMPORTED_MODULE_1__.stringify(queryStringObject);
  const url = (typeof to === 'string' ? to : to.pathname) + (queryString ? `?${queryString}` : '');
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("a", { ...props,
    href: url
  });
}

GlobalSelectionLink.displayName = "GlobalSelectionLink";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_0__.withRouter)(GlobalSelectionLink));

/***/ }),

/***/ "./app/components/hovercard.tsx":
/*!**************************************!*\
  !*** ./app/components/hovercard.tsx ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Body": () => (/* binding */ Body),
/* harmony export */   "Divider": () => (/* binding */ Divider),
/* harmony export */   "Header": () => (/* binding */ Header),
/* harmony export */   "Hovercard": () => (/* binding */ Hovercard)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_dom__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-dom */ "../node_modules/react-dom/profiling.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! framer-motion */ "../node_modules/framer-motion/dist/es/components/AnimatePresence/index.mjs");
/* harmony import */ var sentry_components_overlay__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/overlay */ "./app/components/overlay.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_useHoverOverlay__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/useHoverOverlay */ "./app/utils/useHoverOverlay.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











function Hovercard(_ref) {
  let {
    body,
    bodyClassName,
    children,
    className,
    containerClassName,
    header,
    offset = 12,
    displayTimeout = 100,
    tipBorderColor = 'translucentBorder',
    tipColor = 'backgroundElevated',
    ...hoverOverlayProps
  } = _ref;
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_6__.a)();
  const {
    wrapTrigger,
    isOpen,
    overlayProps,
    placement,
    arrowData,
    arrowProps
  } = (0,sentry_utils_useHoverOverlay__WEBPACK_IMPORTED_MODULE_5__.useHoverOverlay)('hovercard', {
    offset,
    displayTimeout,
    isHoverable: true,
    className: containerClassName,
    ...hoverOverlayProps
  }); // Nothing to render if no header or body. Be consistent with wrapping the
  // children with the trigger in the case that the body / header is set while
  // the trigger is hovered.

  if (!body && !header) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: wrapTrigger(children)
    });
  }

  const hovercardContent = isOpen && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_overlay__WEBPACK_IMPORTED_MODULE_3__.PositionWrapper, {
    zIndex: theme.zIndex.hovercard,
    ...overlayProps,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(StyledHovercard, {
      animated: true,
      arrowProps: { ...arrowProps,
        size: 20,
        background: tipColor,
        border: tipBorderColor
      },
      originPoint: arrowData,
      placement: placement,
      className: className,
      children: [header ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Header, {
        children: header
      }) : null, body ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Body, {
        className: bodyClassName,
        children: body
      }) : null]
    })
  });

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [wrapTrigger(children), /*#__PURE__*/(0,react_dom__WEBPACK_IMPORTED_MODULE_2__.createPortal)((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(framer_motion__WEBPACK_IMPORTED_MODULE_8__.AnimatePresence, {
      children: hovercardContent
    }), document.body)]
  });
}

Hovercard.displayName = "Hovercard";

const StyledHovercard = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_overlay__WEBPACK_IMPORTED_MODULE_3__.Overlay,  true ? {
  target: "e19qyv1k3"
} : 0)("width:295px;line-height:1.2;h6{color:", p => p.theme.subText, ";font-size:", p => p.theme.fontSizeExtraSmall, ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1), ";text-transform:uppercase;}" + ( true ? "" : 0));

const Header = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e19qyv1k2"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";background:", p => p.theme.backgroundSecondary, ";border-bottom:1px solid ", p => p.theme.border, ";border-radius:", p => p.theme.borderRadiusTop, ";font-weight:600;word-wrap:break-word;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1.5), ";" + ( true ? "" : 0));

const Body = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e19qyv1k1"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(2), ";min-height:30px;" + ( true ? "" : 0));

const Divider = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e19qyv1k0"
} : 0)("position:relative;margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1.5), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1), ";&:before{display:block;position:absolute;content:'';height:1px;top:50%;left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(2), ";right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(2), ";background:", p => p.theme.innerBorder, ";z-index:-1;}h6{display:inline;padding-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1), ";background:", p => p.theme.background, ";}" + ( true ? "" : 0));



/***/ }),

/***/ "./app/components/organizations/pageFilters/utils.tsx":
/*!************************************************************!*\
  !*** ./app/components/organizations/pageFilters/utils.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "extractDatetimeSelectionParameters": () => (/* binding */ extractDatetimeSelectionParameters),
/* harmony export */   "extractSelectionParameters": () => (/* binding */ extractSelectionParameters),
/* harmony export */   "getDefaultSelection": () => (/* binding */ getDefaultSelection),
/* harmony export */   "isSelectionEqual": () => (/* binding */ isSelectionEqual)
/* harmony export */ });
/* harmony import */ var lodash_identity__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash/identity */ "../node_modules/lodash/identity.js");
/* harmony import */ var lodash_identity__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash_identity__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var lodash_pickBy__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/pickBy */ "../node_modules/lodash/pickBy.js");
/* harmony import */ var lodash_pickBy__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_pickBy__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/constants/pageFilters */ "./app/constants/pageFilters.tsx");







/**
 * Make a default page filters object
 */
function getDefaultSelection() {
  const datetime = {
    start: null,
    end: null,
    period: sentry_constants__WEBPACK_IMPORTED_MODULE_4__.DEFAULT_STATS_PERIOD,
    utc: null
  };
  return {
    projects: [],
    environments: [],
    datetime
  };
}
/**
 * Extract the page filter parameters from an object
 * Useful for extracting page filter properties from the current URL
 * when building another URL.
 */

function extractSelectionParameters(query) {
  return lodash_pickBy__WEBPACK_IMPORTED_MODULE_3___default()(lodash_pick__WEBPACK_IMPORTED_MODULE_2___default()(query, Object.values(sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_5__.URL_PARAM)), (lodash_identity__WEBPACK_IMPORTED_MODULE_0___default()));
}
/**
 * Extract the page filter datetime parameters from an object.
 */

function extractDatetimeSelectionParameters(query) {
  return lodash_pickBy__WEBPACK_IMPORTED_MODULE_3___default()(lodash_pick__WEBPACK_IMPORTED_MODULE_2___default()(query, Object.values(sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_5__.DATE_TIME_KEYS)), (lodash_identity__WEBPACK_IMPORTED_MODULE_0___default()));
}
/**
 * Compare the non-utc values of two selections.
 * Useful when re-fetching data based on page filters changing.
 *
 * utc is not compared as there is a problem somewhere in the selection
 * data flow that results in it being undefined | null | boolean instead of null | boolean.
 * The additional undefined state makes this function just as unreliable as isEqual(selection, other)
 */

function isSelectionEqual(selection, other) {
  var _selection$datetime$s, _other$datetime$start, _selection$datetime$e, _other$datetime$end;

  if (!lodash_isEqual__WEBPACK_IMPORTED_MODULE_1___default()(selection.projects, other.projects) || !lodash_isEqual__WEBPACK_IMPORTED_MODULE_1___default()(selection.environments, other.environments)) {
    return false;
  } // Use string comparison as we aren't interested in the identity of the datetimes.


  if (selection.datetime.period !== other.datetime.period || ((_selection$datetime$s = selection.datetime.start) === null || _selection$datetime$s === void 0 ? void 0 : _selection$datetime$s.toString()) !== ((_other$datetime$start = other.datetime.start) === null || _other$datetime$start === void 0 ? void 0 : _other$datetime$start.toString()) || ((_selection$datetime$e = selection.datetime.end) === null || _selection$datetime$e === void 0 ? void 0 : _selection$datetime$e.toString()) !== ((_other$datetime$end = other.datetime.end) === null || _other$datetime$end === void 0 ? void 0 : _other$datetime$end.toString())) {
    return false;
  }

  return true;
}

/***/ }),

/***/ "./app/constants/pageFilters.tsx":
/*!***************************************!*\
  !*** ./app/constants/pageFilters.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ALL_ACCESS_PROJECTS": () => (/* binding */ ALL_ACCESS_PROJECTS),
/* harmony export */   "DATE_TIME": () => (/* binding */ DATE_TIME),
/* harmony export */   "DATE_TIME_KEYS": () => (/* binding */ DATE_TIME_KEYS),
/* harmony export */   "PAGE_URL_PARAM": () => (/* binding */ PAGE_URL_PARAM),
/* harmony export */   "URL_PARAM": () => (/* binding */ URL_PARAM)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);

const URL_PARAM = {
  START: 'start',
  END: 'end',
  UTC: 'utc',
  PERIOD: 'statsPeriod',
  PROJECT: 'project',
  ENVIRONMENT: 'environment'
};
const PAGE_URL_PARAM = {
  PAGE_START: 'pageStart',
  PAGE_END: 'pageEnd',
  PAGE_UTC: 'pageUtc',
  PAGE_PERIOD: 'pageStatsPeriod'
};
const DATE_TIME = {
  START: 'start',
  END: 'end',
  PERIOD: 'period',
  UTC: 'utc'
};
const DATE_TIME_KEYS = [...Object.values(DATE_TIME), 'statsPeriod'];
const ALL_ACCESS_PROJECTS = -1;

/***/ }),

/***/ "./app/stores/projectsStore.tsx":
/*!**************************************!*\
  !*** ./app/stores/projectsStore.tsx ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actions/projectActions */ "./app/actions/projectActions.tsx");
/* harmony import */ var sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actions/teamActions */ "./app/actions/teamActions.tsx");
/* harmony import */ var sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/makeSafeRefluxStore */ "./app/utils/makeSafeRefluxStore.ts");





const storeConfig = {
  itemsById: {},
  loading: true,
  unsubscribeListeners: [],

  init() {
    this.reset();
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_2__["default"].addTeamSuccess, this.onAddTeam));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_2__["default"].changeSlug, this.onChangeSlug));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_2__["default"].createSuccess, this.onCreateSuccess));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_2__["default"].loadProjects, this.loadInitialData));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_2__["default"].loadStatsSuccess, this.onStatsLoadSuccess));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_2__["default"].removeTeamSuccess, this.onRemoveTeam));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_2__["default"].reset, this.reset));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_2__["default"].updateSuccess, this.onUpdateSuccess));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_3__["default"].removeTeamSuccess, this.onDeleteTeam));
  },

  reset() {
    this.itemsById = {};
    this.loading = true;
  },

  loadInitialData(items) {
    const mapping = items.map(project => [project.id, project]);
    this.itemsById = Object.fromEntries(mapping);
    this.loading = false;
    this.trigger(new Set(Object.keys(this.itemsById)));
  },

  onChangeSlug(prevSlug, newSlug) {
    const prevProject = this.getBySlug(prevSlug);

    if (!prevProject) {
      return;
    }

    const newProject = { ...prevProject,
      slug: newSlug
    };
    this.itemsById = { ...this.itemsById,
      [newProject.id]: newProject
    };
    this.trigger(new Set([prevProject.id]));
  },

  onCreateSuccess(project) {
    this.itemsById = { ...this.itemsById,
      [project.id]: project
    };
    this.trigger(new Set([project.id]));
  },

  onUpdateSuccess(data) {
    const project = this.getById(data.id);

    if (!project) {
      return;
    }

    const newProject = { ...project,
      ...data
    };
    this.itemsById = { ...this.itemsById,
      [project.id]: newProject
    };
    this.trigger(new Set([data.id]));
  },

  onStatsLoadSuccess(data) {
    const entries = Object.entries(data || {}).filter(_ref => {
      let [projectId] = _ref;
      return projectId in this.itemsById;
    }); // Assign stats into projects

    entries.forEach(_ref2 => {
      let [projectId, stats] = _ref2;
      this.itemsById[projectId].stats = stats;
    });
    const touchedIds = entries.map(_ref3 => {
      let [projectId] = _ref3;
      return projectId;
    });
    this.trigger(new Set(touchedIds));
  },

  /**
   * Listener for when a team is completely removed
   *
   * @param teamSlug Team Slug
   */
  onDeleteTeam(teamSlug) {
    // Look for team in all projects
    const projects = this.getAll().filter(_ref4 => {
      let {
        teams
      } = _ref4;
      return teams.find(_ref5 => {
        let {
          slug
        } = _ref5;
        return slug === teamSlug;
      });
    });
    projects.forEach(project => this.removeTeamFromProject(teamSlug, project));
    const affectedProjectIds = projects.map(project => project.id);
    this.trigger(new Set(affectedProjectIds));
  },

  onRemoveTeam(teamSlug, projectSlug) {
    const project = this.getBySlug(projectSlug);

    if (!project) {
      return;
    }

    this.removeTeamFromProject(teamSlug, project);
    this.trigger(new Set([project.id]));
  },

  onAddTeam(team, projectSlug) {
    const project = this.getBySlug(projectSlug); // Don't do anything if we can't find a project

    if (!project) {
      return;
    }

    const newProject = { ...project,
      teams: [...project.teams, team]
    };
    this.itemsById = { ...this.itemsById,
      [project.id]: newProject
    };
    this.trigger(new Set([project.id]));
  },

  // Internal method, does not trigger
  removeTeamFromProject(teamSlug, project) {
    const newTeams = project.teams.filter(_ref6 => {
      let {
        slug
      } = _ref6;
      return slug !== teamSlug;
    });
    const newProject = { ...project,
      teams: newTeams
    };
    this.itemsById = { ...this.itemsById,
      [project.id]: newProject
    };
  },

  isLoading() {
    return this.loading;
  },

  getAll() {
    return Object.values(this.itemsById).sort((a, b) => a.slug.localeCompare(b.slug));
  },

  getById(id) {
    return this.getAll().find(project => project.id === id);
  },

  getBySlug(slug) {
    return this.getAll().find(project => project.slug === slug);
  },

  getState() {
    return {
      projects: this.getAll(),
      loading: this.loading
    };
  }

};
const ProjectsStore = (0,reflux__WEBPACK_IMPORTED_MODULE_1__.createStore)((0,sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_4__.makeSafeRefluxStore)(storeConfig));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectsStore);

/***/ }),

/***/ "./app/utils/events.tsx":
/*!******************************!*\
  !*** ./app/utils/events.tsx ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getLocation": () => (/* binding */ getLocation),
/* harmony export */   "getMessage": () => (/* binding */ getMessage),
/* harmony export */   "getShortEventId": () => (/* binding */ getShortEventId),
/* harmony export */   "getTitle": () => (/* binding */ getTitle),
/* harmony export */   "getTreeLabelPartDetails": () => (/* binding */ getTreeLabelPartDetails)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils_platform__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/platform */ "./app/utils/platform.tsx");





function isTombstone(maybe) {
  return !maybe.hasOwnProperty('type');
}
/**
 * Extract the display message from an event.
 */


function getMessage(event) {
  if (isTombstone(event)) {
    return event.culprit || '';
  }

  const {
    metadata,
    type,
    culprit
  } = event;

  switch (type) {
    case sentry_types__WEBPACK_IMPORTED_MODULE_2__.EventOrGroupType.ERROR:
      return metadata.value;

    case sentry_types__WEBPACK_IMPORTED_MODULE_2__.EventOrGroupType.CSP:
      return metadata.message;

    case sentry_types__WEBPACK_IMPORTED_MODULE_2__.EventOrGroupType.EXPECTCT:
    case sentry_types__WEBPACK_IMPORTED_MODULE_2__.EventOrGroupType.EXPECTSTAPLE:
    case sentry_types__WEBPACK_IMPORTED_MODULE_2__.EventOrGroupType.HPKP:
      return '';

    default:
      return culprit || '';
  }
}
/**
 * Get the location from an event.
 */

function getLocation(event) {
  if (isTombstone(event)) {
    return undefined;
  }

  if (event.type === sentry_types__WEBPACK_IMPORTED_MODULE_2__.EventOrGroupType.ERROR && (0,sentry_utils_platform__WEBPACK_IMPORTED_MODULE_3__.isNativePlatform)(event.platform)) {
    return event.metadata.filename || undefined;
  }

  return undefined;
}
function getTreeLabelPartDetails(part) {
  // Note: This function also exists in Python in eventtypes/base.py, to make
  // porting efforts simpler it's recommended to keep both variants
  // structurally similar.
  if (typeof part === 'string') {
    return part;
  }

  const label = (part === null || part === void 0 ? void 0 : part.function) || (part === null || part === void 0 ? void 0 : part.package) || (part === null || part === void 0 ? void 0 : part.filebase) || (part === null || part === void 0 ? void 0 : part.type);
  const classbase = part === null || part === void 0 ? void 0 : part.classbase;

  if (classbase) {
    return label ? `${classbase}.${label}` : classbase;
  }

  return label || '<unknown>';
}

function computeTitleWithTreeLabel(metadata) {
  const {
    type,
    current_tree_label,
    finest_tree_label
  } = metadata;
  const treeLabel = current_tree_label || finest_tree_label;
  const formattedTreeLabel = treeLabel ? treeLabel.map(labelPart => getTreeLabelPartDetails(labelPart)).join(' | ') : undefined;

  if (!type) {
    return {
      title: formattedTreeLabel || metadata.function || '<unknown>',
      treeLabel
    };
  }

  if (!formattedTreeLabel) {
    return {
      title: type,
      treeLabel: undefined
    };
  }

  return {
    title: `${type} | ${formattedTreeLabel}`,
    treeLabel: [{
      type
    }, ...(treeLabel !== null && treeLabel !== void 0 ? treeLabel : [])]
  };
}

function getTitle(event) {
  var _ref, _metadata$uri, _metadata$origin, _ref2;

  let features = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
  let grouping = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  const {
    metadata,
    type,
    culprit
  } = event;
  const customTitle = features.includes('custom-event-title') && metadata !== null && metadata !== void 0 && metadata.title ? metadata.title : undefined;

  switch (type) {
    case sentry_types__WEBPACK_IMPORTED_MODULE_2__.EventOrGroupType.ERROR:
      {
        if (customTitle) {
          return {
            title: customTitle,
            subtitle: culprit,
            treeLabel: undefined
          };
        }

        const displayTitleWithTreeLabel = features.includes('grouping-title-ui') && (grouping || (0,sentry_utils_platform__WEBPACK_IMPORTED_MODULE_3__.isNativePlatform)(event.platform) || (0,sentry_utils_platform__WEBPACK_IMPORTED_MODULE_3__.isMobilePlatform)(event.platform));

        if (displayTitleWithTreeLabel) {
          return {
            subtitle: culprit,
            ...computeTitleWithTreeLabel(metadata)
          };
        }

        return {
          subtitle: culprit,
          title: metadata.type || metadata.function || '<unknown>',
          treeLabel: undefined
        };
      }

    case sentry_types__WEBPACK_IMPORTED_MODULE_2__.EventOrGroupType.CSP:
      return {
        title: (_ref = customTitle !== null && customTitle !== void 0 ? customTitle : metadata.directive) !== null && _ref !== void 0 ? _ref : '',
        subtitle: (_metadata$uri = metadata.uri) !== null && _metadata$uri !== void 0 ? _metadata$uri : '',
        treeLabel: undefined
      };

    case sentry_types__WEBPACK_IMPORTED_MODULE_2__.EventOrGroupType.EXPECTCT:
    case sentry_types__WEBPACK_IMPORTED_MODULE_2__.EventOrGroupType.EXPECTSTAPLE:
    case sentry_types__WEBPACK_IMPORTED_MODULE_2__.EventOrGroupType.HPKP:
      // Due to a regression some reports did not have message persisted
      // (https://github.com/getsentry/sentry/pull/19794) so we need to fall
      // back to the computed title for these.
      return {
        title: customTitle !== null && customTitle !== void 0 ? customTitle : metadata.message || event.title,
        subtitle: (_metadata$origin = metadata.origin) !== null && _metadata$origin !== void 0 ? _metadata$origin : '',
        treeLabel: undefined
      };

    case sentry_types__WEBPACK_IMPORTED_MODULE_2__.EventOrGroupType.DEFAULT:
      return {
        title: (_ref2 = customTitle !== null && customTitle !== void 0 ? customTitle : metadata.title) !== null && _ref2 !== void 0 ? _ref2 : '',
        subtitle: '',
        treeLabel: undefined
      };

    default:
      return {
        title: customTitle !== null && customTitle !== void 0 ? customTitle : event.title,
        subtitle: '',
        treeLabel: undefined
      };
  }
}
/**
 * Returns a short eventId with only 8 characters
 */

function getShortEventId(eventId) {
  return eventId.substring(0, 8);
}

/***/ }),

/***/ "./app/utils/parseLinkHeader.tsx":
/*!***************************************!*\
  !*** ./app/utils/parseLinkHeader.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ parseLinkHeader)
/* harmony export */ });
function parseLinkHeader(header) {
  if (header === null || header === '') {
    return {};
  }

  const headerValues = header.split(',');
  const links = {};
  headerValues.forEach(val => {
    const match = /<([^>]+)>; rel="([^"]+)"(?:; results="([^"]+)")?(?:; cursor="([^"]+)")?/g.exec(val);
    const hasResults = match[3] === 'true' ? true : match[3] === 'false' ? false : null;
    links[match[2]] = {
      href: match[1],
      results: hasResults,
      cursor: match[4]
    };
  });
  return links;
}

/***/ }),

/***/ "./app/utils/platform.tsx":
/*!********************************!*\
  !*** ./app/utils/platform.tsx ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "isMobilePlatform": () => (/* binding */ isMobilePlatform),
/* harmony export */   "isNativePlatform": () => (/* binding */ isNativePlatform)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/data/platformCategories */ "./app/data/platformCategories.tsx");



function isNativePlatform(platform) {
  switch (platform) {
    case 'cocoa':
    case 'objc':
    case 'native':
    case 'swift':
    case 'c':
      return true;

    default:
      return false;
  }
}
function isMobilePlatform(platform) {
  if (!platform) {
    return false;
  }

  return [...sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_2__.mobile].includes(platform);
}

/***/ }),

/***/ "./app/utils/projects.tsx":
/*!********************************!*\
  !*** ./app/utils/projects.tsx ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_memoize__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/memoize */ "../node_modules/lodash/memoize.js");
/* harmony import */ var lodash_memoize__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_memoize__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var lodash_partition__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/partition */ "../node_modules/lodash/partition.js");
/* harmony import */ var lodash_partition__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_partition__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var lodash_uniqBy__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/uniqBy */ "../node_modules/lodash/uniqBy.js");
/* harmony import */ var lodash_uniqBy__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_uniqBy__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actions/projectActions */ "./app/actions/projectActions.tsx");
/* harmony import */ var sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/stores/projectsStore */ "./app/stores/projectsStore.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_parseLinkHeader__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/parseLinkHeader */ "./app/utils/parseLinkHeader.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");













class BaseProjects extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    var _this;

    super(...arguments);
    _this = this;

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      fetchedProjects: [],
      projectsFromStore: [],
      initiallyLoaded: false,
      fetching: false,
      isIncomplete: null,
      hasMore: null,
      prevSearch: null,
      nextCursor: null,
      fetchError: null
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchQueue", new Set());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getProjectsMap", lodash_memoize__WEBPACK_IMPORTED_MODULE_3___default()(projects => new Map(projects.map(project => [project.slug, project]))));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getProjectsIdMap", lodash_memoize__WEBPACK_IMPORTED_MODULE_3___default()(projects => new Map(projects.map(project => [parseInt(project.id, 10), project]))));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "loadSpecificProjects", () => {
      const {
        slugs,
        projects
      } = this.props;
      const projectsMap = this.getProjectsMap(projects); // Split slugs into projects that are in store and not in store
      // (so we can request projects not in store)

      const [inStore, notInStore] = lodash_partition__WEBPACK_IMPORTED_MODULE_4___default()(slugs, slug => projectsMap.has(slug)); // Get the actual summaries of projects that are in store

      const projectsFromStore = inStore.map(slug => projectsMap.get(slug)).filter(sentry_utils__WEBPACK_IMPORTED_MODULE_8__.defined); // Add to queue

      notInStore.forEach(slug => this.fetchQueue.add(slug));
      this.setState({
        // placeholders for projects we need to fetch
        fetchedProjects: notInStore.map(slug => ({
          slug
        })),
        // set initiallyLoaded if any projects were fetched from store
        initiallyLoaded: !!inStore.length,
        projectsFromStore
      });

      if (!notInStore.length) {
        return;
      }

      this.fetchSpecificProjects();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "loadSpecificProjectsFromIds", () => {
      const {
        projectIds,
        projects
      } = this.props;
      const projectsMap = this.getProjectsIdMap(projects); // Split projectIds into projects that are in store and not in store
      // (so we can request projects not in store)

      const [inStore, notInStore] = lodash_partition__WEBPACK_IMPORTED_MODULE_4___default()(projectIds, id => projectsMap.has(id));

      if (notInStore.length) {
        this.loadAllProjects();
        return;
      } // Get the actual summaries of projects that are in store


      const projectsFromStore = inStore.map(id => projectsMap.get(id)).filter(sentry_utils__WEBPACK_IMPORTED_MODULE_8__.defined);
      this.setState({
        // set initiallyLoaded if any projects were fetched from store
        initiallyLoaded: !!inStore.length,
        projectsFromStore
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchSpecificProjects", async () => {
      const {
        api,
        orgId,
        passthroughPlaceholderProject
      } = this.props;

      if (!this.fetchQueue.size) {
        return;
      }

      this.setState({
        fetching: true
      });
      let projects = [];
      let fetchError = null;

      try {
        const {
          results
        } = await fetchProjects(api, orgId, {
          slugs: Array.from(this.fetchQueue)
        });
        projects = results;
      } catch (err) {
        console.error(err); // eslint-disable-line no-console

        fetchError = err;
      }

      const projectsMap = this.getProjectsMap(projects); // For each item in the fetch queue, lookup the project object and in the case
      // where something wrong has happened and we were unable to get project summary from
      // the server, just fill in with an object with only the slug

      const projectsOrPlaceholder = Array.from(this.fetchQueue).map(slug => projectsMap.has(slug) ? projectsMap.get(slug) : !!passthroughPlaceholderProject ? {
        slug
      } : null).filter(sentry_utils__WEBPACK_IMPORTED_MODULE_8__.defined);
      this.setState({
        fetchedProjects: projectsOrPlaceholder,
        isIncomplete: this.fetchQueue.size !== projects.length,
        initiallyLoaded: true,
        fetching: false,
        fetchError
      });
      this.fetchQueue.clear();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "loadAllProjects", async () => {
      const {
        api,
        orgId,
        limit,
        allProjects
      } = this.props;
      this.setState({
        fetching: true
      });

      try {
        const {
          results,
          hasMore,
          nextCursor
        } = await fetchProjects(api, orgId, {
          limit,
          allProjects
        });
        this.setState({
          fetching: false,
          fetchedProjects: results,
          initiallyLoaded: true,
          hasMore,
          nextCursor
        });
      } catch (err) {
        console.error(err); // eslint-disable-line no-console

        this.setState({
          fetching: false,
          fetchedProjects: [],
          initiallyLoaded: true,
          fetchError: err
        });
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSearch", async function (search) {
      let {
        append
      } = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      const {
        api,
        orgId,
        limit
      } = _this.props;
      const {
        prevSearch
      } = _this.state;
      const cursor = _this.state.nextCursor;

      _this.setState({
        fetching: true
      });

      try {
        const {
          results,
          hasMore,
          nextCursor
        } = await fetchProjects(api, orgId, {
          search,
          limit,
          prevSearch,
          cursor
        });

        _this.setState(state => {
          let fetchedProjects;

          if (append) {
            // Remove duplicates
            fetchedProjects = lodash_uniqBy__WEBPACK_IMPORTED_MODULE_5___default()([...state.fetchedProjects, ...results], _ref => {
              let {
                slug
              } = _ref;
              return slug;
            });
          } else {
            fetchedProjects = results;
          }

          return {
            fetchedProjects,
            hasMore,
            fetching: false,
            prevSearch: search,
            nextCursor
          };
        });
      } catch (err) {
        console.error(err); // eslint-disable-line no-console

        _this.setState({
          fetching: false,
          fetchError: err
        });
      }
    });
  }

  componentDidMount() {
    const {
      slugs,
      projectIds
    } = this.props;

    if (!!(slugs !== null && slugs !== void 0 && slugs.length)) {
      this.loadSpecificProjects();
    } else if (!!(projectIds !== null && projectIds !== void 0 && projectIds.length)) {
      this.loadSpecificProjectsFromIds();
    } else {
      this.loadAllProjects();
    }
  }

  componentDidUpdate(prevProps) {
    const {
      projects
    } = this.props;

    if (projects !== prevProps.projects) {
      this.updateProjectsFromStore();
    }
  }
  /**
   * Function to update projects when the store emits updates
   */


  updateProjectsFromStore() {
    const {
      allProjects,
      projects,
      slugs
    } = this.props;

    if (allProjects) {
      this.setState({
        fetchedProjects: projects
      });
      return;
    }

    if (!!(slugs !== null && slugs !== void 0 && slugs.length)) {
      // Extract the requested projects from the store based on props.slugs
      const projectsMap = this.getProjectsMap(projects);
      const projectsFromStore = slugs.map(slug => projectsMap.get(slug)).filter(sentry_utils__WEBPACK_IMPORTED_MODULE_8__.defined);
      this.setState({
        projectsFromStore
      });
    }
  }
  /**
   * List of projects that need to be fetched via API
   */


  render() {
    const {
      slugs,
      children
    } = this.props;
    const renderProps = {
      // We want to make sure that at the minimum, we return a list of objects with only `slug`
      // while we load actual project data
      projects: this.state.initiallyLoaded ? [...this.state.fetchedProjects, ...this.state.projectsFromStore] : slugs && slugs.map(slug => ({
        slug
      })) || [],
      // This is set when we fail to find some slugs from both store and API
      isIncomplete: this.state.isIncomplete,
      // This is state for when fetching data from API
      fetching: this.state.fetching,
      // Project results (from API) are paginated and there are more projects
      // that are not in the initial queryset
      hasMore: this.state.hasMore,
      // Calls API and searches for project, accepts a callback function with signature:
      //
      // fn(searchTerm, {append: bool})
      onSearch: this.handleSearch,
      // Reflects whether or not the initial fetch for the requested projects
      // was fulfilled
      initiallyLoaded: this.state.initiallyLoaded,
      // The error that occurred if fetching failed
      fetchError: this.state.fetchError
    };
    return children(renderProps);
  }

}

BaseProjects.displayName = "BaseProjects";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(BaseProjects, "defaultProps", {
  passthroughPlaceholderProject: true
});

/**
 * @deprecated consider using useProjects if possible.
 *
 * This is a utility component that should be used to fetch an organization's projects (summary).
 * It can either fetch explicit projects (e.g. via slug) or a paginated list of projects.
 * These will be passed down to the render prop (`children`).
 *
 * The legacy way of handling this is that `ProjectSummary[]` is expected to be included in an
 * `Organization` as well as being saved to `ProjectsStore`.
 */
const Projects = (0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_11__["default"])((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_10__["default"])(BaseProjects));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Projects);

async function fetchProjects(api, orgId) {
  let {
    slugs,
    search,
    limit,
    prevSearch,
    cursor,
    allProjects
  } = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  const query = {
    // Never return latestDeploys project property from api
    collapse: ['latestDeploys']
  };

  if (slugs && slugs.length) {
    query.query = slugs.map(slug => `slug:${slug}`).join(' ');
  }

  if (search) {
    query.query = `${query.query ? `${query.query} ` : ''}${search}`;
  }

  if ((!prevSearch && !search || prevSearch === search) && cursor) {
    query.cursor = cursor;
  } // "0" shouldn't be a valid value, so this check is fine


  if (limit) {
    query.per_page = limit;
  }

  if (allProjects) {
    const projects = sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_7__["default"].getAll();
    const loading = sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_7__["default"].isLoading(); // If the projects store is loaded then return all projects from the store

    if (!loading) {
      return {
        results: projects,
        hasMore: false
      };
    } // Otherwise mark the query to fetch all projects from the API


    query.all_projects = 1;
  }

  let hasMore = false;
  let nextCursor = null;
  const [data,, resp] = await api.requestPromise(`/organizations/${orgId}/projects/`, {
    includeAllArgs: true,
    query
  });
  const pageLinks = resp === null || resp === void 0 ? void 0 : resp.getResponseHeader('Link');

  if (pageLinks) {
    const paginationObject = (0,sentry_utils_parseLinkHeader__WEBPACK_IMPORTED_MODULE_9__["default"])(pageLinks);
    hasMore = paginationObject && (paginationObject.next.results || paginationObject.previous.results);
    nextCursor = paginationObject.next.cursor;
  } // populate the projects store if all projects were fetched


  if (allProjects) {
    sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_6__["default"].loadProjects(data);
  }

  return {
    results: data,
    hasMore,
    nextCursor
  };
}

/***/ }),

/***/ "./app/utils/selectText.tsx":
/*!**********************************!*\
  !*** ./app/utils/selectText.tsx ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "selectText": () => (/* binding */ selectText)
/* harmony export */ });
function selectText(node) {
  if (node instanceof HTMLInputElement && node.type === 'text') {
    node.select();
  } else if (node instanceof Node && window.getSelection) {
    const range = document.createRange();
    range.selectNode(node);
    const selection = window.getSelection();

    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
}

/***/ }),

/***/ "./app/utils/useProjects.tsx":
/*!***********************************!*\
  !*** ./app/utils/useProjects.tsx ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_uniqBy__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/uniqBy */ "../node_modules/lodash/uniqBy.js");
/* harmony import */ var lodash_uniqBy__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_uniqBy__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actions/projectActions */ "./app/actions/projectActions.tsx");
/* harmony import */ var sentry_stores_organizationStore__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/stores/organizationStore */ "./app/stores/organizationStore.tsx");
/* harmony import */ var sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/stores/projectsStore */ "./app/stores/projectsStore.tsx");
/* harmony import */ var sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/stores/useLegacyStore */ "./app/stores/useLegacyStore.tsx");
/* harmony import */ var sentry_utils_parseLinkHeader__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/parseLinkHeader */ "./app/utils/parseLinkHeader.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");











/**
 * Helper function to actually load projects
 */
async function fetchProjects(api, orgId) {
  let {
    slugs,
    search,
    limit,
    lastSearch,
    cursor
  } = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  const query = {
    // Never return latestDeploys project property from api
    collapse: ['latestDeploys']
  };

  if (slugs !== undefined && slugs.length > 0) {
    query.query = slugs.map(slug => `slug:${slug}`).join(' ');
  }

  if (search) {
    var _query$query;

    query.query = `${(_query$query = query.query) !== null && _query$query !== void 0 ? _query$query : ''}${search}`.trim();
  }

  const prevSearchMatches = !lastSearch && !search || lastSearch === search;

  if (prevSearchMatches && cursor) {
    query.cursor = cursor;
  }

  if (limit !== undefined) {
    query.per_page = limit;
  }

  let hasMore = false;
  let nextCursor = null;
  const [data,, resp] = await api.requestPromise(`/organizations/${orgId}/projects/`, {
    includeAllArgs: true,
    query
  });
  const pageLinks = resp === null || resp === void 0 ? void 0 : resp.getResponseHeader('Link');

  if (pageLinks) {
    var _paginationObject$nex, _paginationObject$pre, _paginationObject$nex2;

    const paginationObject = (0,sentry_utils_parseLinkHeader__WEBPACK_IMPORTED_MODULE_8__["default"])(pageLinks);
    hasMore = (paginationObject === null || paginationObject === void 0 ? void 0 : (_paginationObject$nex = paginationObject.next) === null || _paginationObject$nex === void 0 ? void 0 : _paginationObject$nex.results) || (paginationObject === null || paginationObject === void 0 ? void 0 : (_paginationObject$pre = paginationObject.previous) === null || _paginationObject$pre === void 0 ? void 0 : _paginationObject$pre.results);
    nextCursor = paginationObject === null || paginationObject === void 0 ? void 0 : (_paginationObject$nex2 = paginationObject.next) === null || _paginationObject$nex2 === void 0 ? void 0 : _paginationObject$nex2.cursor;
  }

  return {
    results: data,
    hasMore,
    nextCursor
  };
}
/**
 * Provides projects from the ProjectStore
 *
 * This hook also provides a way to select specific project slugs, and search
 * (type-ahead) for more projects that may not be in the project store.
 *
 * NOTE: Currently ALL projects are always loaded, but this hook is designed
 * for future-compat in a world where we do _not_ load all projects.
 */


function useProjects() {
  var _slugs$filter;

  let {
    limit,
    slugs,
    orgId: propOrgId
  } = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_9__["default"])();
  const {
    organization
  } = (0,sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_7__.useLegacyStore)(sentry_stores_organizationStore__WEBPACK_IMPORTED_MODULE_5__["default"]);
  const store = (0,sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_7__.useLegacyStore)(sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_6__["default"]);
  const orgId = propOrgId !== null && propOrgId !== void 0 ? propOrgId : organization === null || organization === void 0 ? void 0 : organization.slug;
  const storeSlugs = new Set(store.projects.map(t => t.slug));
  const slugsToLoad = (_slugs$filter = slugs === null || slugs === void 0 ? void 0 : slugs.filter(slug => !storeSlugs.has(slug))) !== null && _slugs$filter !== void 0 ? _slugs$filter : [];
  const shouldLoadSlugs = slugsToLoad.length > 0;
  const [state, setState] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)({
    initiallyLoaded: !store.loading && !shouldLoadSlugs,
    fetching: shouldLoadSlugs,
    hasMore: null,
    lastSearch: null,
    nextCursor: null,
    fetchError: null
  });
  const slugsRef = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(null); // Only initialize slugsRef.current once and modify it when we receive new
  // slugs determined through set equality

  if (slugs !== undefined) {
    if (slugsRef.current === null) {
      slugsRef.current = new Set(slugs);
    }

    if (slugs.length !== slugsRef.current.size || slugs.some(slug => {
      var _slugsRef$current;

      return !((_slugsRef$current = slugsRef.current) !== null && _slugsRef$current !== void 0 && _slugsRef$current.has(slug));
    })) {
      slugsRef.current = new Set(slugs);
    }
  }

  async function loadProjectsBySlug() {
    if (orgId === undefined) {
      // eslint-disable-next-line no-console
      console.error('Cannot use useProjects({slugs}) without an organization in context');
      return;
    }

    setState({ ...state,
      fetching: true
    });

    try {
      const {
        results,
        hasMore,
        nextCursor
      } = await fetchProjects(api, orgId, {
        slugs: slugsToLoad,
        limit
      });
      const fetchedProjects = lodash_uniqBy__WEBPACK_IMPORTED_MODULE_3___default()([...store.projects, ...results], _ref => {
        let {
          slug
        } = _ref;
        return slug;
      });
      sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_4__["default"].loadProjects(fetchedProjects);
      setState({ ...state,
        hasMore,
        fetching: false,
        initiallyLoaded: true,
        nextCursor
      });
    } catch (err) {
      console.error(err); // eslint-disable-line no-console

      setState({ ...state,
        fetching: false,
        initiallyLoaded: !store.loading,
        fetchError: err
      });
    }
  }

  async function handleSearch(search) {
    const {
      lastSearch
    } = state;
    const cursor = state.nextCursor;

    if (search === '') {
      return;
    }

    if (orgId === undefined) {
      // eslint-disable-next-line no-console
      console.error('Cannot use useProjects.onSearch without an organization in context');
      return;
    }

    setState({ ...state,
      fetching: true
    });

    try {
      api.clear();
      const {
        results,
        hasMore,
        nextCursor
      } = await fetchProjects(api, orgId, {
        search,
        limit,
        lastSearch,
        cursor
      });
      const fetchedProjects = lodash_uniqBy__WEBPACK_IMPORTED_MODULE_3___default()([...store.projects, ...results], _ref2 => {
        let {
          slug
        } = _ref2;
        return slug;
      }); // Only update the store if we have more items

      if (fetchedProjects.length > store.projects.length) {
        sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_4__["default"].loadProjects(fetchedProjects);
      }

      setState({ ...state,
        hasMore,
        fetching: false,
        lastSearch: search,
        nextCursor
      });
    } catch (err) {
      console.error(err); // eslint-disable-line no-console

      setState({ ...state,
        fetching: false,
        fetchError: err
      });
    }
  }

  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    // Load specified team slugs
    if (shouldLoadSlugs) {
      loadProjectsBySlug();
      return;
    }
  }, [slugsRef.current]); // Update initiallyLoaded when we finish loading within the projectStore

  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    const storeLoaded = !store.loading;

    if (state.initiallyLoaded === storeLoaded) {
      return;
    }

    if (shouldLoadSlugs) {
      return;
    }

    setState({ ...state,
      initiallyLoaded: storeLoaded
    });
  }, [store.loading]);
  const {
    initiallyLoaded,
    fetching,
    fetchError,
    hasMore
  } = state;
  const filteredProjects = slugs ? store.projects.filter(t => slugs.includes(t.slug)) : store.projects;
  const placeholders = slugsToLoad.map(slug => ({
    slug
  }));
  const result = {
    projects: filteredProjects,
    placeholders,
    fetching: fetching || store.loading,
    initiallyLoaded,
    fetchError,
    hasMore,
    onSearch: handleSearch
  };
  return result;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (useProjects);

/***/ }),

/***/ "./app/utils/withProjects.tsx":
/*!************************************!*\
  !*** ./app/utils/withProjects.tsx ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/getDisplayName */ "./app/utils/getDisplayName.tsx");
/* harmony import */ var sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/useProjects */ "./app/utils/useProjects.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




/**
 * Higher order component that uses ProjectsStore and provides a list of projects
 */
function withProjects(WrappedComponent) {
  const Wrapper = props => {
    const {
      projects,
      initiallyLoaded
    } = (0,sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_1__["default"])();
    const loadingProjects = !initiallyLoaded;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(WrappedComponent, { ...props,
      projects,
      loadingProjects
    });
  };

  Wrapper.displayName = `withProjects(${(0,sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_0__["default"])(WrappedComponent)})`;
  return Wrapper;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (withProjects);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_actions_organizationsActions_tsx-app_components_clipboard_tsx-app_components_forms_compac-1ced7e.29b643a235ad5793335e4f3deea62d94.js.map