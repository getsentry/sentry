"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_dashboardsV2_widgetBuilder_widgetLibrary_card_tsx"],{

/***/ "./app/views/dashboardsV2/widgetBuilder/widgetLibrary/card.tsx":
/*!*********************************************************************!*\
  !*** ./app/views/dashboardsV2/widgetBuilder/widgetLibrary/card.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Card": () => (/* binding */ Card)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetLibrary_widgetCard__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetLibrary/widgetCard */ "./app/views/dashboardsV2/widgetLibrary/widgetCard.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }





function Card(_ref) {
  let {
    widget,
    iconColor
  } = _ref;
  const {
    title,
    description,
    displayType
  } = widget;
  const Icon = (0,sentry_views_dashboardsV2_widgetLibrary_widgetCard__WEBPACK_IMPORTED_MODULE_2__.getWidgetIcon)(displayType);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(Container, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(IconWrapper, {
      backgroundColor: iconColor,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Icon, {
        color: "white"
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(Information, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Heading, {
        children: title
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(SubHeading, {
        children: description
      })]
    })]
  });
}
Card.displayName = "Card";

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1kr3ej04"
} : 0)("display:flex;flex-direction:row;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1), ";" + ( true ? "" : 0));

const Information = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1kr3ej03"
} : 0)( true ? {
  name: "1fttcpj",
  styles: "display:flex;flex-direction:column"
} : 0);

const Heading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1kr3ej02"
} : 0)("font-size:", p => p.theme.fontSizeLarge, ";font-weight:500;margin-bottom:0;color:", p => p.theme.gray500, ";" + ( true ? "" : 0));

const SubHeading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('small',  true ? {
  target: "e1kr3ej01"
} : 0)("color:", p => p.theme.gray300, ";" + ( true ? "" : 0));

const IconWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1kr3ej00"
} : 0)("display:flex;justify-content:center;align-items:center;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1), ";min-width:40px;height:40px;border-radius:", p => p.theme.borderRadius, ";background:", p => p.backgroundColor, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/dashboardsV2/widgetLibrary/widgetCard.tsx":
/*!*************************************************************!*\
  !*** ./app/views/dashboardsV2/widgetLibrary/widgetCard.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "getWidgetIcon": () => (/* binding */ getWidgetIcon)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_icons_iconGraphArea__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/icons/iconGraphArea */ "./app/icons/iconGraphArea.tsx");
/* harmony import */ var sentry_icons_iconGraphBar__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/icons/iconGraphBar */ "./app/icons/iconGraphBar.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












function getWidgetIcon(displayType) {
  switch (displayType) {
    case _types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.TABLE:
      return sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconMenu;

    case _types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.WORLD_MAP:
      return sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconGlobe;

    case _types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.BIG_NUMBER:
      return sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconNumber;

    case _types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.BAR:
      return sentry_icons_iconGraphBar__WEBPACK_IMPORTED_MODULE_7__.IconGraphBar;

    case _types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.TOP_N:
      return sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconArrow;

    case _types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.AREA:
      return sentry_icons_iconGraphArea__WEBPACK_IMPORTED_MODULE_6__.IconGraphArea;

    case _types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.LINE:
    default:
      return sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconGraph;
  }
}

function WidgetLibraryCard(_ref) {
  let {
    selectedWidgets,
    widget,
    setSelectedWidgets,
    ['data-test-id']: dataTestId
  } = _ref;
  const [selected, setSelected] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(selectedWidgets.includes(widget));
  const Icon = getWidgetIcon(widget.displayType);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(StyledPanel, {
    "data-test-id": dataTestId,
    selected: selected,
    onClick: () => {
      if (selected) {
        const updatedWidgets = selectedWidgets.filter(selectedWidget => widget !== selectedWidget);
        setSelectedWidgets(updatedWidgets);
      } else {
        const updatedWidgets = selectedWidgets.slice().concat(widget);
        setSelectedWidgets(updatedWidgets);
      }

      setSelected(!!!selected);
    },
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__.PanelBody, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(TitleContainer, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(Icon, {
          size: "xs"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(Title, {
          children: widget.title
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(Description, {
        children: widget.description
      })]
    })
  });
}

WidgetLibraryCard.displayName = "WidgetLibraryCard";

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e11j9f793"
} : 0)("padding-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";font-size:16px;line-height:140%;color:", p => p.theme.gray500, ";" + ( true ? "" : 0));

const TitleContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e11j9f792"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(2), ";padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(0.5), ";display:flex;align-items:center;" + ( true ? "" : 0));

const Description = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e11j9f791"
} : 0)("padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1.5), " 36px;font-size:14px;line-height:21px;color:", p => p.theme.gray300, ";" + ( true ? "" : 0));

const StyledPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__.Panel,  true ? {
  target: "e11j9f790"
} : 0)("border:", p => p.selected ? `2px solid ${p.theme.active}` : `1px solid ${p.theme.border}`, ";margin:", p => p.selected ? '-1px' : 0, ";box-sizing:border-box;box-shadow:0px 2px 1px rgba(0, 0, 0, 0.08);cursor:pointer;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (WidgetLibraryCard);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_dashboardsV2_widgetBuilder_widgetLibrary_card_tsx.634a7049c043f3a1fc54fea219f80dcd.js.map