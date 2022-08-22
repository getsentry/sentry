(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_modals_dashboardWidgetLibraryModal_index_tsx-app_utils_discover_charts_tsx-app-ff394d"],{

/***/ "./app/components/modals/dashboardWidgetLibraryModal/index.tsx":
/*!*********************************************************************!*\
  !*** ./app/components/modals/dashboardWidgetLibraryModal/index.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "modalCss": () => (/* binding */ modalCss)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_views_dashboardsV2_layoutUtils__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/views/dashboardsV2/layoutUtils */ "./app/views/dashboardsV2/layoutUtils.tsx");
/* harmony import */ var sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/views/dashboardsV2/types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var _button__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../../button */ "./app/components/button.tsx");
/* harmony import */ var _buttonBar__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../../buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var _libraryTab__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./libraryTab */ "./app/components/modals/dashboardWidgetLibraryModal/libraryTab.tsx");
/* harmony import */ var _tabsButtonBar__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./tabsButtonBar */ "./app/components/modals/dashboardWidgetLibraryModal/tabsButtonBar.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }















function DashboardWidgetLibraryModal(_ref) {
  let {
    Header,
    Body,
    Footer,
    dashboard,
    organization,
    customWidget,
    initialSelectedWidgets,
    closeModal,
    onAddWidget
  } = _ref;
  const [selectedWidgets, setSelectedWidgets] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(initialSelectedWidgets ? initialSelectedWidgets : []);
  const [errored, setErrored] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(false);

  function handleSubmit() {
    onAddWidget([...dashboard.widgets, ...selectedWidgets.map(sentry_views_dashboardsV2_layoutUtils__WEBPACK_IMPORTED_MODULE_6__.assignTempId)]);
    closeModal();
  }

  const overLimit = dashboard.widgets.length + selectedWidgets.length > sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_7__.MAX_WIDGETS;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(Header, {
      closeButton: true,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("h4", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Add Widget(s)')
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(Body, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(_tabsButtonBar__WEBPACK_IMPORTED_MODULE_11__.TabsButtonBar, {
        activeTab: _tabsButtonBar__WEBPACK_IMPORTED_MODULE_11__.TAB.Library,
        organization: organization,
        dashboard: dashboard,
        selectedWidgets: selectedWidgets,
        customWidget: customWidget,
        onAddWidget: onAddWidget
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(_libraryTab__WEBPACK_IMPORTED_MODULE_10__["default"], {
        selectedWidgets: selectedWidgets,
        errored: errored,
        setSelectedWidgets: setSelectedWidgets,
        setErrored: setErrored,
        organization: organization
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(Footer, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(_buttonBar__WEBPACK_IMPORTED_MODULE_9__["default"], {
        gap: 1,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(_button__WEBPACK_IMPORTED_MODULE_8__["default"], {
          external: true,
          href: "https://docs.sentry.io/product/dashboards/widget-library/",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Read the docs')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_3__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)('Exceeds max widgets ([maxWidgets]) per dashboard. Plese unselect [unselectWidgets] widget(s).', {
            maxWidgets: sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_7__.MAX_WIDGETS,
            unselectWidgets: dashboard.widgets.length + selectedWidgets.length - sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_7__.MAX_WIDGETS
          }),
          disabled: !!!overLimit,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(StyledButton, {
            "data-test-id": "confirm-widgets",
            priority: "primary",
            disabled: overLimit,
            type: "button",
            onClick: () => {
              if (!!!selectedWidgets.length) {
                setErrored(true);
                return;
              }

              (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_5__["default"])('dashboards_views.widget_library.add', {
                organization,
                num_widgets: selectedWidgets.length
              });
              selectedWidgets.forEach(selectedWidget => {
                (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_5__["default"])('dashboards_views.widget_library.add_widget', {
                  organization,
                  title: selectedWidget.title
                });
              });
              handleSubmit();
            },
            children: selectedWidgets.length ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)('Add ([numWidgets])', {
              numWidgets: selectedWidgets.length
            }) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Add')
          })
        })]
      })
    })]
  });
}

DashboardWidgetLibraryModal.displayName = "DashboardWidgetLibraryModal";
const modalCss =  true ? {
  name: "l07bt5",
  styles: "width:100%;max-width:700px;margin:70px auto"
} : 0;

const StyledButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_button__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "e1g50rat0"
} : 0)( true ? {
  name: "g740v2",
  styles: "min-width:90px"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DashboardWidgetLibraryModal);

/***/ }),

/***/ "./app/components/modals/dashboardWidgetLibraryModal/libraryTab.tsx":
/*!**************************************************************************!*\
  !*** ./app/components/modals/dashboardWidgetLibraryModal/libraryTab.tsx ***!
  \**************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/views/dashboardsV2/types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetLibrary_data__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetLibrary/data */ "./app/views/dashboardsV2/widgetLibrary/data.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetLibrary_widgetCard__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetLibrary/widgetCard */ "./app/views/dashboardsV2/widgetLibrary/widgetCard.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












function DashboardWidgetLibraryTab(_ref) {
  let {
    selectedWidgets,
    errored,
    organization,
    setSelectedWidgets,
    setErrored
  } = _ref;
  let defaultWidgets = sentry_views_dashboardsV2_widgetLibrary_data__WEBPACK_IMPORTED_MODULE_7__.DEFAULT_WIDGETS;

  if (!!!organization.features.includes('dashboards-releases')) {
    defaultWidgets = defaultWidgets.filter(widget => !!!(widget.widgetType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_6__.WidgetType.RELEASE));
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
    children: [errored && !!!selectedWidgets.length ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__["default"], {
      type: "error",
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Please select at least one Widget from our Library. Alternatively, you can build a custom widget from scratch.')
    }) : null, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(WidgetLibraryGrid, {
      children: defaultWidgets.map((widgetCard, index) => {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_views_dashboardsV2_widgetLibrary_widgetCard__WEBPACK_IMPORTED_MODULE_8__["default"], {
          "data-test-id": `widget-library-card-${index}`,
          widget: widgetCard,
          selectedWidgets: selectedWidgets,
          setSelectedWidgets: setSelectedWidgets,
          setErrored: setErrored
        }, widgetCard.title);
      })
    })]
  });
}

DashboardWidgetLibraryTab.displayName = "DashboardWidgetLibraryTab";

const WidgetLibraryGrid = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e15svj9l0"
} : 0)("display:grid;grid-template-columns:repeat(2, minmax(100px, 1fr));grid-template-rows:repeat(2, max-content);row-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1.5), ";column-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(2), ";@media (max-width: 700px){grid-template-columns:auto;}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DashboardWidgetLibraryTab);

/***/ }),

/***/ "./app/components/modals/dashboardWidgetLibraryModal/tabsButtonBar.tsx":
/*!*****************************************************************************!*\
  !*** ./app/components/modals/dashboardWidgetLibraryModal/tabsButtonBar.tsx ***!
  \*****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TAB": () => (/* binding */ TAB),
/* harmony export */   "TabsButtonBar": () => (/* binding */ TabsButtonBar)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/featureBadge */ "./app/components/featureBadge.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/views/dashboardsV2/types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var _button__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../../button */ "./app/components/button.tsx");
/* harmony import */ var _buttonBar__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../../buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./utils */ "./app/components/modals/dashboardWidgetLibraryModal/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }













let TAB;

(function (TAB) {
  TAB["Library"] = "library";
  TAB["Custom"] = "custom";
})(TAB || (TAB = {}));

function TabsButtonBar(_ref) {
  let {
    activeTab,
    organization,
    dashboard,
    selectedWidgets,
    customWidget,
    onAddWidget
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(StyledButtonBar, {
    active: activeTab,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(CustomButton, {
      barId: TAB.Custom,
      onClick: () => {
        if (activeTab === TAB.Custom) {
          return;
        }

        (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_6__["default"])('dashboards_views.widget_library.switch_tab', {
          organization,
          to: TAB.Custom
        });
        (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_1__.openAddDashboardWidgetModal)({
          organization,
          dashboard,
          selectedWidgets,
          widget: customWidget,
          source: sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_7__.DashboardWidgetSource.LIBRARY,
          onAddLibraryWidget: onAddWidget
        });
      },
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Custom Widget')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(LibraryButton, {
      barId: TAB.Library,
      "data-test-id": "library-tab",
      onClick: () => {
        if (activeTab === TAB.Library) {
          return;
        }

        (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_6__["default"])('dashboards_views.widget_library.switch_tab', {
          organization,
          to: TAB.Library
        });
        (0,_utils__WEBPACK_IMPORTED_MODULE_10__.setWidgetLibraryVisit)();

        if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_5__.defined)(onAddWidget)) {
          (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_1__.openDashboardWidgetLibraryModal)({
            organization,
            dashboard,
            customWidget,
            initialSelectedWidgets: selectedWidgets,
            onAddWidget
          });
        }
      },
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Widget Library'), (0,_utils__WEBPACK_IMPORTED_MODULE_10__.shouldShowNewBadge)() && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_2__["default"], {
        type: "new"
      })]
    })]
  });
}
TabsButtonBar.displayName = "TabsButtonBar";

const StyledButtonBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_buttonBar__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "ea8om9w2"
} : 0)("display:inline-flex;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(2), ";" + ( true ? "" : 0));

const LibraryButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_button__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "ea8om9w1"
} : 0)( true ? {
  name: "ygoyvl",
  styles: "border-top-left-radius:0;border-bottom-left-radius:0"
} : 0);

const CustomButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_button__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "ea8om9w0"
} : 0)( true ? {
  name: "1ga8o78",
  styles: "border-top-right-radius:0;border-bottom-right-radius:0;line-height:17px"
} : 0);

/***/ }),

/***/ "./app/components/modals/dashboardWidgetLibraryModal/utils.tsx":
/*!*********************************************************************!*\
  !*** ./app/components/modals/dashboardWidgetLibraryModal/utils.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "setWidgetLibraryVisit": () => (/* binding */ setWidgetLibraryVisit),
/* harmony export */   "shouldShowNewBadge": () => (/* binding */ shouldShowNewBadge)
/* harmony export */ });
const WIDGET_LIBRARY_VISITS = 'dashboard-widget-library-visits';
function shouldShowNewBadge() {
  const visits = localStorage.getItem(WIDGET_LIBRARY_VISITS);
  return visits === null || (parseInt(visits, 10) || 0) < 5;
}
function setWidgetLibraryVisit() {
  const visits = localStorage.getItem(WIDGET_LIBRARY_VISITS);
  localStorage.setItem(WIDGET_LIBRARY_VISITS, visits === null ? '1' : `${(parseInt(visits, 10) || 0) + 1}`);
}

/***/ }),

/***/ "./app/utils/discover/charts.tsx":
/*!***************************************!*\
  !*** ./app/utils/discover/charts.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "axisDuration": () => (/* binding */ axisDuration),
/* harmony export */   "axisLabelFormatter": () => (/* binding */ axisLabelFormatter),
/* harmony export */   "axisLabelFormatterUsingAggregateOutputType": () => (/* binding */ axisLabelFormatterUsingAggregateOutputType),
/* harmony export */   "categorizeDuration": () => (/* binding */ categorizeDuration),
/* harmony export */   "findRangeOfMultiSeries": () => (/* binding */ findRangeOfMultiSeries),
/* harmony export */   "getDurationUnit": () => (/* binding */ getDurationUnit),
/* harmony export */   "tooltipFormatter": () => (/* binding */ tooltipFormatter),
/* harmony export */   "tooltipFormatterUsingAggregateOutputType": () => (/* binding */ tooltipFormatterUsingAggregateOutputType)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");




/**
 * Formatter for chart tooltips that handle a variety of discover and metrics result values.
 * If the result is metric values, the value can be of type number or null
 */

function tooltipFormatter(value) {
  let outputType = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'number';

  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.defined)(value)) {
    return '\u2014';
  }

  return tooltipFormatterUsingAggregateOutputType(value, outputType);
}
/**
 * Formatter for chart tooltips that takes the aggregate output type directly
 */

function tooltipFormatterUsingAggregateOutputType(value, type) {
  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.defined)(value)) {
    return '\u2014';
  }

  switch (type) {
    case 'integer':
    case 'number':
      return value.toLocaleString();

    case 'percentage':
      return (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.formatPercentage)(value, 2);

    case 'duration':
      return (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.getDuration)(value / 1000, 2, true);

    case 'size':
      return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.formatBytesBase2)(value);

    default:
      return value.toString();
  }
}
/**
 * Formatter for chart axis labels that handle a variety of discover result values
 * This function is *very similar* to tooltipFormatter but outputs data with less precision.
 */

function axisLabelFormatter(value, outputType) {
  let abbreviation = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  let durationUnit = arguments.length > 3 ? arguments[3] : undefined;
  return axisLabelFormatterUsingAggregateOutputType(value, outputType, abbreviation, durationUnit);
}
/**
 * Formatter for chart axis labels that takes the aggregate output type directly
 */

function axisLabelFormatterUsingAggregateOutputType(value, type) {
  let abbreviation = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  let durationUnit = arguments.length > 3 ? arguments[3] : undefined;

  switch (type) {
    case 'integer':
    case 'number':
      return abbreviation ? (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.formatAbbreviatedNumber)(value) : value.toLocaleString();

    case 'percentage':
      return (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.formatPercentage)(value, 0);

    case 'duration':
      return axisDuration(value, durationUnit);

    case 'size':
      return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.formatBytesBase2)(value, 0);

    default:
      return value.toString();
  }
}
/**
 * Specialized duration formatting for axis labels.
 * In that context we are ok sacrificing accuracy for more
 * consistent sizing.
 *
 * @param value Number of milliseconds to format.
 */

function axisDuration(value, durationUnit) {
  var _durationUnit;

  (_durationUnit = durationUnit) !== null && _durationUnit !== void 0 ? _durationUnit : durationUnit = categorizeDuration(value);

  if (value === 0) {
    return '0';
  }

  switch (durationUnit) {
    case sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.WEEK:
      {
        const label = (value / sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.WEEK).toFixed(0);
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('%swk', label);
      }

    case sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.DAY:
      {
        const label = (value / sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.DAY).toFixed(0);
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('%sd', label);
      }

    case sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.HOUR:
      {
        const label = (value / sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.HOUR).toFixed(0);
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('%shr', label);
      }

    case sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.MINUTE:
      {
        const label = (value / sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.MINUTE).toFixed(0);
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('%smin', label);
      }

    case sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.SECOND:
      {
        const label = (value / sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.SECOND).toFixed(0);
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('%ss', label);
      }

    default:
      const label = value.toFixed(0);
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('%sms', label);
  }
}
/**
 * Given an array of series and an eCharts legend object,
 * finds the range of y values (min and max) based on which series is selected in the legend
 * Assumes series[0] > series[1] > ...
 * @param series Array of eCharts series
 * @param legend eCharts legend object
 * @returns
 */

function findRangeOfMultiSeries(series, legend) {
  var _series$;

  let range;

  if ((_series$ = series[0]) !== null && _series$ !== void 0 && _series$.data) {
    var _maxSeries2;

    let minSeries = series[0];
    let maxSeries;
    series.forEach((_ref, idx) => {
      var _legend$selected;

      let {
        seriesName,
        data
      } = _ref;

      if ((legend === null || legend === void 0 ? void 0 : (_legend$selected = legend.selected) === null || _legend$selected === void 0 ? void 0 : _legend$selected[seriesName]) !== false && data.length) {
        var _maxSeries;

        minSeries = series[idx];
        (_maxSeries = maxSeries) !== null && _maxSeries !== void 0 ? _maxSeries : maxSeries = series[idx];
      }
    });

    if ((_maxSeries2 = maxSeries) !== null && _maxSeries2 !== void 0 && _maxSeries2.data) {
      const max = Math.max(...maxSeries.data.map(_ref2 => {
        let {
          value
        } = _ref2;
        return value;
      }).filter(value => !!value));
      const min = Math.min(...minSeries.data.map(_ref3 => {
        let {
          value
        } = _ref3;
        return value;
      }).filter(value => !!value));
      range = {
        max,
        min
      };
    }
  }

  return range;
}
/**
 * Given a eCharts series and legend, returns the unit to be used on the yAxis for a duration chart
 * @param series eCharts series array
 * @param legend eCharts legend object
 * @returns
 */

function getDurationUnit(series, legend) {
  let durationUnit = 0;
  const range = findRangeOfMultiSeries(series, legend);

  if (range) {
    const avg = (range.max + range.min) / 2;
    durationUnit = categorizeDuration((range.max - range.min) / 5); // avg of 5 yAxis ticks per chart

    const numOfDigits = (avg / durationUnit).toFixed(0).length;

    if (numOfDigits > 6) {
      durationUnit = categorizeDuration(avg);
    }
  }

  return durationUnit;
}
/**
 * Categorizes the duration by Second, Minute, Hour, etc
 * Ex) categorizeDuration(1200) = MINUTE
 * @param value Duration in ms
 */

function categorizeDuration(value) {
  if (value >= sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.WEEK) {
    return sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.WEEK;
  }

  if (value >= sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.DAY) {
    return sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.DAY;
  }

  if (value >= sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.HOUR) {
    return sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.HOUR;
  }

  if (value >= sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.MINUTE) {
    return sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.MINUTE;
  }

  if (value >= sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.SECOND) {
    return sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.SECOND;
  }

  return 1;
}

/***/ }),

/***/ "./app/utils/withProject.tsx":
/*!***********************************!*\
  !*** ./app/utils/withProject.tsx ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_sentryTypes__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/sentryTypes */ "./app/sentryTypes.tsx");
/* harmony import */ var sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/getDisplayName */ "./app/utils/getDisplayName.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






/**
 * Currently wraps component with project from context
 */
const withProject = WrappedComponent => {
  var _class;

  return _class = class extends react__WEBPACK_IMPORTED_MODULE_1__.Component {
    render() {
      const {
        project,
        ...props
      } = this.props;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(WrappedComponent, {
        project: project !== null && project !== void 0 ? project : this.context.project,
        ...props
      });
    }

  }, (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(_class, "displayName", `withProject(${(0,sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_3__["default"])(WrappedComponent)})`), (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(_class, "contextTypes", {
    project: sentry_sentryTypes__WEBPACK_IMPORTED_MODULE_2__["default"].Project
  }), _class;
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (withProject);

/***/ }),

/***/ "./app/views/dashboardsV2/widgetLibrary/data.tsx":
/*!*******************************************************!*\
  !*** ./app/views/dashboardsV2/widgetLibrary/data.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DEFAULT_WIDGETS": () => (/* binding */ DEFAULT_WIDGETS),
/* harmony export */   "getTopNConvertedDefaultWidgets": () => (/* binding */ getTopNConvertedDefaultWidgets)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/discover/types */ "./app/utils/discover/types.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../types */ "./app/views/dashboardsV2/types.tsx");



const DEFAULT_WIDGETS = [{
  id: 'duration-distribution',
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Duration Distribution'),
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Compare transaction durations across different percentiles.'),
  displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.LINE,
  widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
  interval: '5m',
  queries: [{
    name: '',
    conditions: 'event.type:transaction',
    fields: ['p50(transaction.duration)', 'p75(transaction.duration)', 'p95(transaction.duration)'],
    aggregates: ['p50(transaction.duration)', 'p75(transaction.duration)', 'p95(transaction.duration)'],
    columns: [],
    orderby: ''
  }]
}, {
  id: 'high-throughput-transactions',
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('High Throughput Transactions'),
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Top 5 transactions with the largest volume.'),
  displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TOP_N,
  widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
  interval: '5m',
  queries: [{
    name: '',
    conditions: 'event.type:transaction',
    fields: ['transaction', 'count()'],
    aggregates: ['count()'],
    columns: ['transaction'],
    orderby: '-count()'
  }]
}, {
  id: 'crash-rates-recent-releases',
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Crash Rates for Recent Releases'),
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Percentage of crashed sessions for latest releases.'),
  displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.LINE,
  widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.RELEASE,
  interval: '5m',
  limit: 8,
  queries: [{
    name: '',
    conditions: '',
    fields: ['crash_rate(session)', 'release'],
    aggregates: ['crash_rate(session)'],
    columns: ['release'],
    orderby: '-release'
  }]
}, {
  id: 'session-health',
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Session Health'),
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Number of abnormal, crashed, errored and healthy sessions.'),
  displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
  widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.RELEASE,
  interval: '5m',
  queries: [{
    name: '',
    conditions: '',
    fields: ['session.status', 'sum(session)'],
    aggregates: ['sum(session)'],
    columns: ['session.status'],
    orderby: ''
  }]
}, {
  id: 'lcp-country',
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('LCP by Country'),
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Density map showing page load times by country.'),
  displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.WORLD_MAP,
  widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
  interval: '5m',
  queries: [{
    name: '',
    conditions: 'has:geo.country_code',
    fields: ['p75(measurements.lcp)'],
    aggregates: ['p75(measurements.lcp)'],
    columns: [],
    orderby: ''
  }]
}, {
  id: 'miserable-users',
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Miserable Users'),
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Unique users who have experienced slow load times.'),
  displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
  widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
  interval: '5m',
  queries: [{
    name: '',
    conditions: '',
    fields: ['count_miserable(user,300)'],
    aggregates: ['count_miserable(user,300)'],
    columns: [],
    orderby: ''
  }]
}, {
  id: 'slow-vs-fast',
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Slow vs. Fast Transactions'),
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Percentage breakdown of transaction durations over and under 300ms.'),
  displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BAR,
  widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
  interval: '5m',
  queries: [{
    name: '',
    conditions: 'event.type:transaction',
    fields: ['equation|(count_if(transaction.duration,greater,300) / count()) * 100', 'equation|(count_if(transaction.duration,lessOrEquals,300) / count()) * 100'],
    aggregates: ['equation|(count_if(transaction.duration,greater,300) / count()) * 100', 'equation|(count_if(transaction.duration,lessOrEquals,300) / count()) * 100'],
    columns: [],
    orderby: ''
  }]
}, {
  id: 'issue-for-review',
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Issues For Review'),
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Most recently seen unresolved issues for review.'),
  displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
  widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.ISSUE,
  interval: '5m',
  queries: [{
    name: '',
    conditions: 'is:unresolved is:for_review',
    fields: ['issue', 'assignee', 'events', 'title'],
    aggregates: [],
    columns: ['issue', 'assignee', 'events', 'title'],
    orderby: 'date'
  }]
}, {
  id: 'top-unhandled',
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Top Unhandled Error Types'),
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Most frequently encountered unhandled errors.'),
  displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TOP_N,
  widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
  interval: '5m',
  queries: [{
    name: '',
    conditions: 'error.unhandled:true',
    fields: ['error.type', 'count()'],
    aggregates: ['count()'],
    columns: ['error.type'],
    orderby: '-count()'
  }]
}, {
  id: 'users-affected',
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Users Affected by Errors'),
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Footprint of unique users affected by errors.'),
  displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.LINE,
  widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
  interval: '5m',
  queries: [{
    name: '',
    conditions: 'event.type:error',
    fields: ['count_unique(user)', 'count()'],
    aggregates: ['count_unique(user)', 'count()'],
    columns: [],
    orderby: ''
  }]
}];
function getTopNConvertedDefaultWidgets() {
  return DEFAULT_WIDGETS.map(widget => {
    if (widget.displayType === _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TOP_N) {
      return { ...widget,
        displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.AREA,
        limit: sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_1__.TOP_N
      };
    }

    return widget;
  });
}

/***/ }),

/***/ "./app/views/dashboardsV2/widgetLibrary/widgetCard.tsx":
/*!*************************************************************!*\
  !*** ./app/views/dashboardsV2/widgetLibrary/widgetCard.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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

/***/ }),

/***/ "../node_modules/lodash/_baseExtremum.js":
/*!***********************************************!*\
  !*** ../node_modules/lodash/_baseExtremum.js ***!
  \***********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var isSymbol = __webpack_require__(/*! ./isSymbol */ "../node_modules/lodash/isSymbol.js");

/**
 * The base implementation of methods like `_.max` and `_.min` which accepts a
 * `comparator` to determine the extremum value.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} iteratee The iteratee invoked per iteration.
 * @param {Function} comparator The comparator used to compare values.
 * @returns {*} Returns the extremum value.
 */
function baseExtremum(array, iteratee, comparator) {
  var index = -1,
      length = array.length;

  while (++index < length) {
    var value = array[index],
        current = iteratee(value);

    if (current != null && (computed === undefined
          ? (current === current && !isSymbol(current))
          : comparator(current, computed)
        )) {
      var computed = current,
          result = value;
    }
  }
  return result;
}

module.exports = baseExtremum;


/***/ }),

/***/ "../node_modules/lodash/_baseGt.js":
/*!*****************************************!*\
  !*** ../node_modules/lodash/_baseGt.js ***!
  \*****************************************/
/***/ ((module) => {

/**
 * The base implementation of `_.gt` which doesn't coerce arguments.
 *
 * @private
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if `value` is greater than `other`,
 *  else `false`.
 */
function baseGt(value, other) {
  return value > other;
}

module.exports = baseGt;


/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_modals_dashboardWidgetLibraryModal_index_tsx-app_utils_discover_charts_tsx-app-ff394d.e9b95809fb56afe29ee6fbb45e6e925e.js.map