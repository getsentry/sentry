"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_performance_landing_widgets_components_selectableList_tsx"],{

/***/ "./app/views/performance/landing/widgets/components/selectableList.tsx":
/*!*****************************************************************************!*\
  !*** ./app/views/performance/landing/widgets/components/selectableList.tsx ***!
  \*****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "GrowLink": () => (/* binding */ GrowLink),
/* harmony export */   "ListClose": () => (/* binding */ ListClose),
/* harmony export */   "RightAlignedCell": () => (/* binding */ RightAlignedCell),
/* harmony export */   "Subtitle": () => (/* binding */ Subtitle),
/* harmony export */   "WidgetEmptyStateWarning": () => (/* binding */ WidgetEmptyStateWarning),
/* harmony export */   "default": () => (/* binding */ SelectableList)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/emptyStateWarning */ "./app/components/emptyStateWarning.tsx");
/* harmony import */ var sentry_components_forms_controls_radioGroup__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/forms/controls/radioGroup */ "./app/components/forms/controls/radioGroup.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_radio__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/radio */ "./app/components/radio.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }












function SelectableList(props) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("div", {
    children: props.items.map((item, index) => (0,_emotion_react__WEBPACK_IMPORTED_MODULE_10__.createElement)(SelectableItem, { ...props,
      isSelected: index === props.selectedIndex,
      currentIndex: index,
      key: index
    }, item()))
  });
}
SelectableList.displayName = "SelectableList";

function SelectableItem(_ref) {
  let {
    isSelected,
    currentIndex: index,
    children,
    setSelectedIndex,
    radioColor
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(ListItemContainer, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(ItemRadioContainer, {
      color: radioColor !== null && radioColor !== void 0 ? radioColor : '',
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_forms_controls_radioGroup__WEBPACK_IMPORTED_MODULE_2__.RadioLineItem, {
        index: index,
        role: "radio",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_radio__WEBPACK_IMPORTED_MODULE_4__["default"], {
          checked: isSelected,
          onChange: () => setSelectedIndex(index)
        })
      })
    }), children]
  });
}

SelectableItem.displayName = "SelectableItem";
const RightAlignedCell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1fgyx4u7"
} : 0)("text-align:right;display:flex;align-items:center;justify-content:center;padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";" + ( true ? "" : 0));
const Subtitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1fgyx4u6"
} : 0)("color:", p => p.theme.gray300, ";font-size:", p => p.theme.fontSizeMedium, ";display:inline-block;" + ( true ? "" : 0));
const GrowLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e1fgyx4u5"
} : 0)( true ? {
  name: "pu304d",
  styles: "flex-grow:1;display:inherit"
} : 0);
const WidgetEmptyStateWarning = () => {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(StyledEmptyStateWarning, {
    small: true,
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('No results')
  });
};
WidgetEmptyStateWarning.displayName = "WidgetEmptyStateWarning";
function ListClose(props) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(StyledTooltip, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Exclude this transaction from the search filter.'),
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(StyledIconClose, {
      onClick: () => {
        props.onClick();
        props.setSelectListIndex(0);
      }
    })
  });
}
ListClose.displayName = "ListClose";

const StyledTooltip = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e1fgyx4u4"
} : 0)( true ? {
  name: "1wnowod",
  styles: "display:flex;align-items:center;justify-content:center"
} : 0);

const StyledIconClose = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_6__.IconClose,  true ? {
  target: "e1fgyx4u3"
} : 0)("cursor:pointer;color:", p => p.theme.gray200, ";" + ( true ? "" : 0));

const StyledEmptyStateWarning = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "e1fgyx4u2"
} : 0)( true ? {
  name: "1t1oqhu",
  styles: "min-height:300px;justify-content:center"
} : 0);

const ListItemContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1fgyx4u1"
} : 0)("display:flex;border-top:1px solid ", p => p.theme.border, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(2), ";font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

const ItemRadioContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1fgyx4u0"
} : 0)("grid-row:1/3;input{cursor:pointer;}input:checked::after{background-color:", p => p.color, ";}" + ( true ? "" : 0));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_performance_landing_widgets_components_selectableList_tsx.d7d9bdf85f6ead1ae2da6a635a759d71.js.map