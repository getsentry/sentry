"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_modals_widgetBuilder_overwriteWidgetModal_tsx-app_views_dashboardsV2_types_tsx"],{

/***/ "./app/components/modals/widgetBuilder/overwriteWidgetModal.tsx":
/*!**********************************************************************!*\
  !*** ./app/components/modals/widgetBuilder/overwriteWidgetModal.tsx ***!
  \**********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "modalCss": () => (/* binding */ modalCss)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetBuilder_widgetLibrary_card__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetBuilder/widgetLibrary/card */ "./app/views/dashboardsV2/widgetBuilder/widgetLibrary/card.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }










const MODAL_DESCRIPTION = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)("You've already started building this widget and will lose unsaved changes. Are you sure you want to overwrite this widget with the template values?");

function OverwriteWidgetModal(_ref) {
  let {
    Header,
    Body,
    Footer,
    closeModal,
    onConfirm,
    widget,
    iconColor
  } = _ref;

  function handleConfirm() {
    onConfirm();
    closeModal();
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Header, {
      closeButton: true,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("h4", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Overwrite Widget')
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(Body, {
      children: [MODAL_DESCRIPTION, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(CardWrapper, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_views_dashboardsV2_widgetBuilder_widgetLibrary_card__WEBPACK_IMPORTED_MODULE_6__.Card, {
          widget: widget,
          iconColor: iconColor
        })
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Footer, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_3__["default"], {
        gap: 1.5,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
          onClick: closeModal,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Cancel')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
          priority: "primary",
          onClick: handleConfirm,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Confirm')
        })]
      })
    })]
  });
}

OverwriteWidgetModal.displayName = "OverwriteWidgetModal";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OverwriteWidgetModal);
const modalCss =  true ? {
  name: "l07bt5",
  styles: "width:100%;max-width:700px;margin:70px auto"
} : 0;

const CardWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eeau8ya0"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(3), " 0;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/dashboardsV2/types.tsx":
/*!******************************************!*\
  !*** ./app/views/dashboardsV2/types.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DEFAULT_TABLE_LIMIT": () => (/* binding */ DEFAULT_TABLE_LIMIT),
/* harmony export */   "DashboardFilterKeys": () => (/* binding */ DashboardFilterKeys),
/* harmony export */   "DashboardState": () => (/* binding */ DashboardState),
/* harmony export */   "DashboardWidgetSource": () => (/* binding */ DashboardWidgetSource),
/* harmony export */   "DisplayType": () => (/* binding */ DisplayType),
/* harmony export */   "MAX_WIDGETS": () => (/* binding */ MAX_WIDGETS),
/* harmony export */   "WidgetType": () => (/* binding */ WidgetType)
/* harmony export */ });
// Max widgets per dashboard we are currently willing
// to allow to limit the load on snuba from the
// parallel requests. Somewhat arbitrary
// limit that can be changed if necessary.
const MAX_WIDGETS = 30;
const DEFAULT_TABLE_LIMIT = 5;
let DisplayType;

(function (DisplayType) {
  DisplayType["AREA"] = "area";
  DisplayType["BAR"] = "bar";
  DisplayType["LINE"] = "line";
  DisplayType["TABLE"] = "table";
  DisplayType["WORLD_MAP"] = "world_map";
  DisplayType["BIG_NUMBER"] = "big_number";
  DisplayType["TOP_N"] = "top_n";
})(DisplayType || (DisplayType = {}));

let WidgetType;

(function (WidgetType) {
  WidgetType["DISCOVER"] = "discover";
  WidgetType["ISSUE"] = "issue";
  WidgetType["RELEASE"] = "metrics";
})(WidgetType || (WidgetType = {}));

let DashboardFilterKeys;

(function (DashboardFilterKeys) {
  DashboardFilterKeys["RELEASE"] = "release";
})(DashboardFilterKeys || (DashboardFilterKeys = {}));

let DashboardState; // where we launch the dashboard widget from

(function (DashboardState) {
  DashboardState["VIEW"] = "view";
  DashboardState["EDIT"] = "edit";
  DashboardState["CREATE"] = "create";
  DashboardState["PENDING_DELETE"] = "pending_delete";
  DashboardState["PREVIEW"] = "preview";
})(DashboardState || (DashboardState = {}));

let DashboardWidgetSource;

(function (DashboardWidgetSource) {
  DashboardWidgetSource["DISCOVERV2"] = "discoverv2";
  DashboardWidgetSource["DASHBOARDS"] = "dashboards";
  DashboardWidgetSource["LIBRARY"] = "library";
  DashboardWidgetSource["ISSUE_DETAILS"] = "issueDetail";
})(DashboardWidgetSource || (DashboardWidgetSource = {}));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_modals_widgetBuilder_overwriteWidgetModal_tsx-app_views_dashboardsV2_types_tsx.909de58fed4a0d4bd60de1a141df645f.js.map