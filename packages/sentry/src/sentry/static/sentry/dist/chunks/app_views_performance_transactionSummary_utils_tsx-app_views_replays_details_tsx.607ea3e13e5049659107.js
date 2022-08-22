"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_performance_transactionSummary_utils_tsx-app_views_replays_details_tsx"],{

/***/ "./app/components/charts/areaChart.tsx":
/*!*********************************************!*\
  !*** ./app/components/charts/areaChart.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AreaChart": () => (/* binding */ AreaChart)
/* harmony export */ });
/* harmony import */ var _series_areaSeries__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./series/areaSeries */ "./app/components/charts/series/areaSeries.tsx");
/* harmony import */ var _baseChart__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./baseChart */ "./app/components/charts/baseChart.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function AreaChart(_ref) {
  let {
    series,
    stacked,
    colors,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(_baseChart__WEBPACK_IMPORTED_MODULE_1__["default"], { ...props,
    "data-test-id": "area-chart",
    colors: colors,
    series: series.map((_ref2, i) => {
      let {
        seriesName,
        data,
        ...otherSeriesProps
      } = _ref2;
      return (0,_series_areaSeries__WEBPACK_IMPORTED_MODULE_0__["default"])({
        stack: stacked ? 'area' : undefined,
        name: seriesName,
        data: data.map(_ref3 => {
          let {
            name,
            value
          } = _ref3;
          return [name, value];
        }),
        lineStyle: {
          color: colors === null || colors === void 0 ? void 0 : colors[i],
          opacity: 1,
          width: 0.4
        },
        areaStyle: {
          color: colors === null || colors === void 0 ? void 0 : colors[i],
          opacity: 1.0
        },
        animation: false,
        animationThreshold: 1,
        animationDuration: 0,
        ...otherSeriesProps
      });
    })
  });
}
AreaChart.displayName = "AreaChart";

/***/ }),

/***/ "./app/components/charts/series/areaSeries.tsx":
/*!*****************************************************!*\
  !*** ./app/components/charts/series/areaSeries.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AreaSeries)
/* harmony export */ });
/* harmony import */ var sentry_components_charts_series_lineSeries__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/charts/series/lineSeries */ "./app/components/charts/series/lineSeries.tsx");

function AreaSeries() {
  let props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  return (0,sentry_components_charts_series_lineSeries__WEBPACK_IMPORTED_MODULE_0__["default"])({ ...props
  });
}

/***/ }),

/***/ "./app/components/events/meta/metaProxy.tsx":
/*!**************************************************!*\
  !*** ./app/components/events/meta/metaProxy.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "MetaProxy": () => (/* binding */ MetaProxy),
/* harmony export */   "getMeta": () => (/* binding */ getMeta),
/* harmony export */   "withMeta": () => (/* binding */ withMeta)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_es_reflect_to_string_tag_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.reflect.to-string-tag.js */ "../node_modules/core-js/modules/es.reflect.to-string-tag.js");
/* harmony import */ var core_js_modules_es_reflect_to_string_tag_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_reflect_to_string_tag_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var lodash_isEmpty__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/isEmpty */ "../node_modules/lodash/isEmpty.js");
/* harmony import */ var lodash_isEmpty__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_isEmpty__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var lodash_isNull__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/isNull */ "../node_modules/lodash/isNull.js");
/* harmony import */ var lodash_isNull__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_isNull__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var lodash_memoize__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/memoize */ "../node_modules/lodash/memoize.js");
/* harmony import */ var lodash_memoize__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_memoize__WEBPACK_IMPORTED_MODULE_4__);





const GET_META = Symbol('GET_META');
const IS_PROXY = Symbol('IS_PROXY');

function isAnnotated(meta) {
  if (lodash_isEmpty__WEBPACK_IMPORTED_MODULE_2___default()(meta)) {
    return false;
  }

  return !lodash_isEmpty__WEBPACK_IMPORTED_MODULE_2___default()(meta.rem) || !lodash_isEmpty__WEBPACK_IMPORTED_MODULE_2___default()(meta.err);
}

class MetaProxy {
  constructor(local) {
    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "local", void 0);

    this.local = local;
  }

  get(obj, prop, receiver) {
    // trap calls to `getMeta` to return meta object
    if (prop === GET_META) {
      return key => {
        if (this.local && this.local[key] && this.local[key]['']) {
          // TODO: Error checks
          const meta = this.local[key][''];
          return isAnnotated(meta) ? meta : undefined;
        }

        return undefined;
      };
    } // this is how  we can determine if current `obj` is a proxy


    if (prop === IS_PROXY) {
      return true;
    }

    const value = Reflect.get(obj, prop, receiver);

    if (!Reflect.has(obj, prop) || typeof value !== 'object' || lodash_isNull__WEBPACK_IMPORTED_MODULE_3___default()(value)) {
      return value;
    } // This is so we don't create a new Proxy from an object that is
    // already a proxy. Otherwise we can get into very deep recursive calls


    if (Reflect.get(obj, IS_PROXY, receiver)) {
      return value;
    } // Make sure we apply proxy to all children (objects and arrays)
    // Do we need to check for annotated inside of objects?


    return new Proxy(value, new MetaProxy(this.local && this.local[prop]));
  }

}
const withMeta = lodash_memoize__WEBPACK_IMPORTED_MODULE_4___default()(function withMeta(event) {
  if (!event) {
    return event;
  } // Return unproxied `event` if browser does not support `Proxy`


  if (typeof window.Proxy === 'undefined' || typeof window.Reflect === 'undefined') {
    return event;
  } // withMeta returns a type that is supposed to be 100% compatible with its
  // input type. Proxy typing on typescript is not really functional enough to
  // make this work without casting.
  //
  // https://github.com/microsoft/TypeScript/issues/20846


  return new Proxy(event, new MetaProxy(event._meta));
});
function getMeta(obj, prop) {
  if (!obj || typeof obj[GET_META] !== 'function') {
    return undefined;
  }

  return obj[GET_META](prop);
}

/***/ }),

/***/ "./app/components/featureFeedback/index.tsx":
/*!**************************************************!*\
  !*** ./app/components/featureFeedback/index.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FeatureFeedback": () => (/* binding */ FeatureFeedback)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






// Provides a button that, when clicked, opens a modal with a form that,
// when filled and submitted, will send feedback to Sentry (feedbacks project).
function FeatureFeedback(_ref) {
  let {
    feedbackTypes,
    featureName,
    buttonProps = {}
  } = _ref;

  async function handleClick() {
    const mod = await __webpack_require__.e(/*! import() */ "app_components_featureFeedback_feedbackModal_tsx").then(__webpack_require__.bind(__webpack_require__, /*! sentry/components/featureFeedback/feedbackModal */ "./app/components/featureFeedback/feedbackModal.tsx"));
    const {
      FeedbackModal,
      modalCss
    } = mod;
    (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_1__.openModal)(deps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(FeedbackModal, { ...deps,
      featureName: featureName,
      feedbackTypes: feedbackTypes
    }), {
      modalCss
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
    icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconMegaphone, {}),
    onClick: handleClick,
    ...buttonProps,
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Give Feedback')
  });
}
FeatureFeedback.displayName = "FeatureFeedback";

/***/ }),

/***/ "./app/components/htmlCode.tsx":
/*!*************************************!*\
  !*** ./app/components/htmlCode.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var prism_sentry_index_css__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! prism-sentry/index.css */ "../node_modules/prism-sentry/index.css");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var js_beautify__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! js-beautify */ "../node_modules/js-beautify/js/index.js");
/* harmony import */ var js_beautify__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(js_beautify__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var prismjs__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! prismjs */ "../node_modules/prismjs/prism.js");
/* harmony import */ var prismjs__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(prismjs__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }







function HTMLCode(_ref) {
  let {
    code
  } = _ref;
  const codeRef = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(null);
  const formattedCode = js_beautify__WEBPACK_IMPORTED_MODULE_3___default().html(code, {
    indent_size: 2
  });
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    prismjs__WEBPACK_IMPORTED_MODULE_4___default().highlightElement(codeRef.current, false);
  }, []);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(CodeWrapper, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("pre", {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("code", {
        ref: codeRef,
        className: "language-html",
        children: formattedCode
      })
    })
  });
}

HTMLCode.displayName = "HTMLCode";

const CodeWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ekoyb3a0"
} : 0)( true ? {
  name: "17gjkqx",
  styles: "line-height:1.5;pre{word-break:break-all;white-space:pre-wrap;}"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (HTMLCode);

/***/ }),

/***/ "./app/components/keyValueTable.tsx":
/*!******************************************!*\
  !*** ./app/components/keyValueTable.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "KeyValueTable": () => (/* binding */ KeyValueTable),
/* harmony export */   "KeyValueTableRow": () => (/* binding */ KeyValueTableRow)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }





const KeyValueTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('dl',  true ? {
  target: "e13z4zle2"
} : 0)( true ? {
  name: "u4s7v9",
  styles: "display:grid;grid-template-columns:50% 50%"
} : 0);
const KeyValueTableRow = _ref => {
  let {
    keyName,
    value
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Key, {
      children: keyName
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Value, {
      children: value
    })]
  });
};
KeyValueTableRow.displayName = "KeyValueTableRow";

const commonStyles = _ref2 => {
  let {
    theme
  } = _ref2;
  return `
font-size: ${theme.fontSizeMedium};
padding: ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(0.5)} ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1)};
font-weight: normal;
line-height: inherit;
${p => p.theme.overflowEllipsis};
&:nth-of-type(2n-1) {
  background-color: ${theme.backgroundSecondary};
}
`;
};

const Key = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('dt',  true ? {
  target: "e13z4zle1"
} : 0)(commonStyles, ";color:", p => p.theme.textColor, ";" + ( true ? "" : 0));

const Value = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('dd',  true ? {
  target: "e13z4zle0"
} : 0)(commonStyles, ";color:", p => p.theme.subText, ";text-align:right;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/replays/breadcrumbs/gridlines.tsx":
/*!**********************************************************!*\
  !*** ./app/components/replays/breadcrumbs/gridlines.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "MajorGridlines": () => (/* binding */ MajorGridlines),
/* harmony export */   "MinorGridlines": () => (/* binding */ MinorGridlines)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_replays_breadcrumbs_timeline__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/replays/breadcrumbs/timeline */ "./app/components/replays/breadcrumbs/timeline.tsx");
/* harmony import */ var sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/replays/utils */ "./app/components/replays/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







const Line = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_replays_breadcrumbs_timeline__WEBPACK_IMPORTED_MODULE_3__.Col,  true ? {
  target: "e145a7q31"
} : 0)("border-right:1px ", p => p.lineStyle, " ", p => p.theme.gray100, ";text-align:right;line-height:14px;" + ( true ? "" : 0));

function Gridlines(_ref) {
  let {
    children,
    cols,
    lineStyle,
    remaining
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_replays_breadcrumbs_timeline__WEBPACK_IMPORTED_MODULE_3__.Columns, {
    totalColumns: cols,
    remainder: remaining,
    children: [...Array(cols)].map((_, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Line, {
      lineStyle: lineStyle,
      children: children ? children(i) : null
    }, i))
  });
}

Gridlines.displayName = "Gridlines";
function MajorGridlines(_ref2) {
  let {
    durationMs,
    minWidth = 50,
    width
  } = _ref2;
  const {
    timespan,
    cols,
    remaining
  } = (0,sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_4__.countColumns)(durationMs, width, minWidth);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Gridlines, {
    cols: cols,
    lineStyle: "solid",
    remaining: remaining,
    children: i => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Label, {
      children: (0,sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_4__.formatTime)((i + 1) * timespan)
    })
  });
}
MajorGridlines.displayName = "MajorGridlines";
function MinorGridlines(_ref3) {
  let {
    durationMs,
    minWidth = 20,
    width
  } = _ref3;
  const {
    cols,
    remaining
  } = (0,sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_4__.countColumns)(durationMs, width, minWidth);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Gridlines, {
    cols: cols,
    lineStyle: "dotted",
    remaining: remaining
  });
}
MinorGridlines.displayName = "MinorGridlines";

const Label = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('small',  true ? {
  target: "e145a7q30"
} : 0)("font-variant-numeric:tabular-nums;font-size:", p => p.theme.fontSizeSmall, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/replays/breadcrumbs/replayTimeline.tsx":
/*!***************************************************************!*\
  !*** ./app/components/replays/breadcrumbs/replayTimeline.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_components_replays_breadcrumbs_gridlines__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/replays/breadcrumbs/gridlines */ "./app/components/replays/breadcrumbs/gridlines.tsx");
/* harmony import */ var sentry_components_replays_breadcrumbs_replayTimelineEvents__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/replays/breadcrumbs/replayTimelineEvents */ "./app/components/replays/breadcrumbs/replayTimelineEvents.tsx");
/* harmony import */ var sentry_components_replays_breadcrumbs_replayTimelineSpans__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/replays/breadcrumbs/replayTimelineSpans */ "./app/components/replays/breadcrumbs/replayTimelineSpans.tsx");
/* harmony import */ var sentry_components_replays_breadcrumbs_stacked__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/replays/breadcrumbs/stacked */ "./app/components/replays/breadcrumbs/stacked.tsx");
/* harmony import */ var sentry_components_replays_player_scrubber__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/replays/player/scrubber */ "./app/components/replays/player/scrubber.tsx");
/* harmony import */ var sentry_components_replays_player_scrubberMouseTracking__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/replays/player/scrubberMouseTracking */ "./app/components/replays/player/scrubberMouseTracking.tsx");
/* harmony import */ var sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/replays/replayContext */ "./app/components/replays/replayContext.tsx");
/* harmony import */ var sentry_components_replays_resizeable__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/replays/resizeable */ "./app/components/replays/resizeable.tsx");
/* harmony import */ var sentry_types_breadcrumbs__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/types/breadcrumbs */ "./app/types/breadcrumbs.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");















const USER_ACTIONS = [sentry_types_breadcrumbs__WEBPACK_IMPORTED_MODULE_12__.BreadcrumbType.ERROR, sentry_types_breadcrumbs__WEBPACK_IMPORTED_MODULE_12__.BreadcrumbType.NAVIGATION, sentry_types_breadcrumbs__WEBPACK_IMPORTED_MODULE_12__.BreadcrumbType.UI, sentry_types_breadcrumbs__WEBPACK_IMPORTED_MODULE_12__.BreadcrumbType.USER];

function ReplayTimeline(_ref) {
  let {} = _ref;
  const {
    replay
  } = (0,sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_10__.useReplayContext)();

  if (!replay) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_3__["default"], {
      height: "48px",
      bottomGutter: 2
    });
  }

  const durationMs = replay.getDurationMs();
  const startTimestampMs = replay.getReplay().startedAt.getTime();
  const crumbs = replay.getRawCrumbs() || [];
  const spans = replay.getRawSpans() || [];
  const userCrumbs = crumbs.filter(crumb => USER_ACTIONS.includes(crumb.type));
  const networkSpans = spans.filter(replay.isNetworkSpan);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.Panel, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_replays_player_scrubberMouseTracking__WEBPACK_IMPORTED_MODULE_9__["default"], {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_replays_resizeable__WEBPACK_IMPORTED_MODULE_11__.Resizeable, {
        children: _ref2 => {
          let {
            width
          } = _ref2;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(sentry_components_replays_breadcrumbs_stacked__WEBPACK_IMPORTED_MODULE_7__["default"], {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_replays_breadcrumbs_gridlines__WEBPACK_IMPORTED_MODULE_4__.MinorGridlines, {
              durationMs: durationMs,
              width: width
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_replays_breadcrumbs_gridlines__WEBPACK_IMPORTED_MODULE_4__.MajorGridlines, {
              durationMs: durationMs,
              width: width
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_replays_player_scrubber__WEBPACK_IMPORTED_MODULE_8__.TimelineScrubber, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(UnderTimestamp, {
              paddingTop: "36px",
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_replays_breadcrumbs_replayTimelineSpans__WEBPACK_IMPORTED_MODULE_6__["default"], {
                durationMs: durationMs,
                spans: networkSpans,
                startTimestampMs: startTimestampMs
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(UnderTimestamp, {
              paddingTop: "0",
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_replays_breadcrumbs_replayTimelineEvents__WEBPACK_IMPORTED_MODULE_5__["default"], {
                crumbs: userCrumbs,
                durationMs: durationMs,
                startTimestampMs: startTimestampMs,
                width: width
              })
            })]
          });
        }
      })
    })
  });
}

ReplayTimeline.displayName = "ReplayTimeline";

const UnderTimestamp = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e156rrl40"
} : 0)("padding-top:", p => p.paddingTop, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReplayTimeline);

/***/ }),

/***/ "./app/components/replays/breadcrumbs/replayTimelineEvents.tsx":
/*!*********************************************************************!*\
  !*** ./app/components/replays/breadcrumbs/replayTimelineEvents.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_components_replays_breadcrumbs_timeline__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/replays/breadcrumbs/timeline */ "./app/components/replays/breadcrumbs/timeline.tsx");
/* harmony import */ var sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/replays/replayContext */ "./app/components/replays/replayContext.tsx");
/* harmony import */ var sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/replays/utils */ "./app/components/replays/utils.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var sentry_views_replays_detail_breadcrumbs_breadcrumbItem__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/views/replays/detail/breadcrumbs/breadcrumbItem */ "./app/views/replays/detail/breadcrumbs/breadcrumbItem.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }











const EVENT_STICK_MARKER_WIDTH = 4;

function ReplayTimelineEvents(_ref) {
  let {
    className,
    crumbs,
    durationMs,
    startTimestampMs,
    width
  } = _ref;
  const totalColumns = Math.floor(width / EVENT_STICK_MARKER_WIDTH);
  const eventsByCol = (0,sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_5__.getCrumbsByColumn)(startTimestampMs, durationMs, crumbs, totalColumns);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_replays_breadcrumbs_timeline__WEBPACK_IMPORTED_MODULE_3__.Columns, {
    className: className,
    totalColumns: totalColumns,
    remainder: 0,
    children: Array.from(eventsByCol.entries()).map(_ref2 => {
      let [column, breadcrumbs] = _ref2;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(EventColumn, {
        column: column,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(Event, {
          crumbs: breadcrumbs,
          startTimestampMs: startTimestampMs
        })
      }, column);
    })
  });
}

ReplayTimelineEvents.displayName = "ReplayTimelineEvents";

const EventColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_replays_breadcrumbs_timeline__WEBPACK_IMPORTED_MODULE_3__.Col,  true ? {
  target: "e1lcghnx3"
} : 0)("grid-column:", p => Math.floor(p.column), ";place-items:stretch;display:grid;&:hover{z-index:", p => p.theme.zIndex.initial, ";}" + ( true ? "" : 0));

function Event(_ref3) {
  let {
    crumbs,
    startTimestampMs
  } = _ref3;
  const {
    setCurrentTime
  } = (0,sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_4__.useReplayContext)();
  const handleClick = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(crumb => {
    crumb.timestamp !== undefined ? setCurrentTime((0,sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_5__.relativeTimeInMs)(crumb.timestamp, startTimestampMs)) : null;
  }, [setCurrentTime, startTimestampMs]);
  const title = crumbs.map(crumb => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_views_replays_detail_breadcrumbs_breadcrumbItem__WEBPACK_IMPORTED_MODULE_9__["default"], {
    crumb: crumb,
    startTimestampMs: startTimestampMs,
    isHovered: false,
    isSelected: false,
    onClick: handleClick
  }, crumb.id));
  const overlayStyle = /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_11__.css)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(0.5), "!important;max-width:291px!important;width:291px;@media screen and (max-width: ", sentry_utils_theme__WEBPACK_IMPORTED_MODULE_8__["default"].breakpoints.small, "){max-width:220px!important;}" + ( true ? "" : 0),  true ? "" : 0); // If we have more than 3 events we want to make sure of showing all the different colors that we have

  const colors = [...new Set(crumbs.map(crumb => crumb.color))]; // We just need to stack up to 3 times

  const totalStackNumber = Math.min(crumbs.length, 3);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(IconPosition, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(IconNodeTooltip, {
      title: title,
      overlayStyle: overlayStyle,
      isHoverable: true,
      children: crumbs.slice(0, totalStackNumber).map((crumb, index) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(IconNode, {
        color: colors[index] || crumb.color,
        stack: {
          totalStackNumber,
          index
        }
      }, crumb.id))
    })
  });
}

Event.displayName = "Event";

const getNodeDimensions = _ref4 => {
  let {
    stack
  } = _ref4;
  const {
    totalStackNumber,
    index
  } = stack;
  const multiplier = totalStackNumber - index;
  const size = (multiplier + 1) * 4;
  return `
    width: ${size}px;
    height: ${size}px;
  `;
};

const IconNodeTooltip = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e1lcghnx2"
} : 0)( true ? {
  name: "p3b18d",
  styles: "display:grid;justify-items:center;align-items:center"
} : 0);

const IconPosition = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1lcghnx1"
} : 0)("position:absolute;transform:translate(-50%);margin-left:", EVENT_STICK_MARKER_WIDTH / 2, "px;align-self:center;display:grid;" + ( true ? "" : 0));

const IconNode = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1lcghnx0"
} : 0)("grid-column:1;grid-row:1;", getNodeDimensions, " border-radius:50%;color:", p => p.theme.white, ";background:", p => {
  var _p$theme$p$color;

  return (_p$theme$p$color = p.theme[p.color]) !== null && _p$theme$p$color !== void 0 ? _p$theme$p$color : p.color;
}, ";box-shadow:", p => p.theme.dropShadowLightest, ";user-select:none;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReplayTimelineEvents);

/***/ }),

/***/ "./app/components/replays/breadcrumbs/replayTimelineSpans.tsx":
/*!********************************************************************!*\
  !*** ./app/components/replays/breadcrumbs/replayTimelineSpans.tsx ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/replays/utils */ "./app/components/replays/utils.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_replays_hooks_useActiveReplayTab__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/replays/hooks/useActiveReplayTab */ "./app/utils/replays/hooks/useActiveReplayTab.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










function ReplayTimelineEvents(_ref) {
  let {
    className,
    durationMs,
    spans,
    startTimestampMs
  } = _ref;
  const flattenedSpans = (0,sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_2__.flattenSpans)(spans);
  const {
    setActiveTab
  } = (0,sentry_utils_replays_hooks_useActiveReplayTab__WEBPACK_IMPORTED_MODULE_6__["default"])();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Spans, {
    className: className,
    children: flattenedSpans.map((span, i) => {
      const sinceStart = span.startTimestamp - startTimestampMs;
      const startPct = (0,sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_2__.divide)(sinceStart, durationMs);
      const widthPct = (0,sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_2__.divide)(span.duration, durationMs);
      const requestsCount = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tn)('%s network request', '%s network requests', span.spanCount);
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_3__["default"], {
        title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
          children: [requestsCount, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("br", {}), span.duration.toFixed(2), "ms"]
        }),
        skipWrapper: true,
        disableForVisualTest: true,
        position: "bottom",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Span, {
          startPct: startPct,
          widthPct: widthPct,
          onClick: () => setActiveTab('network')
        })
      }, i);
    })
  });
}

ReplayTimelineEvents.displayName = "ReplayTimelineEvents";

const Spans = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('ul',  true ? {
  target: "e1qmy7wx1"
} : 0)("list-style:none;margin:0;padding:0;height:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1.5), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(0.5), ";position:relative;pointer-events:none;" + ( true ? "" : 0));

const Span = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('li',  true ? {
  target: "e1qmy7wx0"
} : 0)("cursor:pointer;display:block;position:absolute;left:", p => p.startPct * 100, "%;min-width:1px;width:", p => p.widthPct * 100, "%;height:100%;background:", p => p.theme.charts.colors[0], ";border-radius:2px;pointer-events:auto;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (/*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_1__.memo(ReplayTimelineEvents));

/***/ }),

/***/ "./app/components/replays/breadcrumbs/stacked.tsx":
/*!********************************************************!*\
  !*** ./app/components/replays/breadcrumbs/stacked.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

/**
 * Render all child elements directly on top of each other.
 *
 * This implementation does not remove the stack of elements from the document
 * flow, so width/height is reserved.
 *
 * An alternative would be to use `position:absolute;` in which case the size
 * would not be part of document flow and other elements could render behind.
 */
const Stacked = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ew7f4bw0"
} : 0)( true ? {
  name: "ndjpn0",
  styles: "display:grid;grid-template:1fr/1fr;>*{grid-area:1/1;}"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Stacked);

/***/ }),

/***/ "./app/components/replays/breadcrumbs/timeline.tsx":
/*!*********************************************************!*\
  !*** ./app/components/replays/breadcrumbs/timeline.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Col": () => (/* binding */ Col),
/* harmony export */   "Columns": () => (/* binding */ Columns)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");


/**
 * Use grid to create columns that we can place child nodes into.
 * Leveraging grid for alignment means we don't need to calculate percent offset
 * nor use position:absolute to lay out items.
 *
 * <Columns>
 *   <Col>...</Col>
 *   <Col>...</Col>
 * </Columns>
 */
const Columns = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('ul',  true ? {
  target: "eos1bss1"
} : 0)("list-style:none;margin:0;padding:0;height:100%;width:100%;display:grid;grid-template-columns:repeat(", p => p.totalColumns, ", 1fr) ", p => p.remainder, "fr;place-items:stretch;" + ( true ? "" : 0)); // Export an empty component which so that callsites can correctly nest nodes:

const Col = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('li',  true ? {
  target: "eos1bss0"
} : 0)( true ? "" : 0);

/***/ }),

/***/ "./app/components/replays/header/detailsPageBreadcrumbs.tsx":
/*!******************************************************************!*\
  !*** ./app/components/replays/header/detailsPageBreadcrumbs.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_breadcrumbs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/breadcrumbs */ "./app/components/breadcrumbs.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_components_replays_replaysFeatureBadge__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/replays/replaysFeatureBadge */ "./app/components/replays/replaysFeatureBadge.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









function DetailsPageBreadcrumbs(_ref) {
  let {
    orgSlug,
    replayRecord
  } = _ref;
  const labelTitle = (replayRecord === null || replayRecord === void 0 ? void 0 : replayRecord.user.name) || (replayRecord === null || replayRecord === void 0 ? void 0 : replayRecord.user.email) || (replayRecord === null || replayRecord === void 0 ? void 0 : replayRecord.user.ip_address) || (replayRecord === null || replayRecord === void 0 ? void 0 : replayRecord.user.id);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_breadcrumbs__WEBPACK_IMPORTED_MODULE_2__["default"], {
    crumbs: [{
      to: `/organizations/${orgSlug}/replays/`,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Replays')
    }, {
      label: labelTitle ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
        children: [labelTitle, " ", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_replays_replaysFeatureBadge__WEBPACK_IMPORTED_MODULE_4__["default"], {})]
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(HeaderPlaceholder, {
        width: "500px",
        height: "24px"
      })
    }]
  });
}

DetailsPageBreadcrumbs.displayName = "DetailsPageBreadcrumbs";

const HeaderPlaceholder = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(props => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_3__["default"], {
  width: "100%",
  height: "19px",
  ...props
}),  true ? {
  target: "ezbltw40"
} : 0)("background-color:", p => p.theme.background, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DetailsPageBreadcrumbs);

/***/ }),

/***/ "./app/components/replays/replaysFeatureBadge.tsx":
/*!********************************************************!*\
  !*** ./app/components/replays/replaysFeatureBadge.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/featureBadge */ "./app/components/featureBadge.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function ReplaysFeatureBadge(props) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)(sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_0__["default"], { ...props,
    type: "alpha"
  });
}

ReplaysFeatureBadge.displayName = "ReplaysFeatureBadge";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReplaysFeatureBadge);

/***/ }),

/***/ "./app/components/replays/resizeable.tsx":
/*!***********************************************!*\
  !*** ./app/components/replays/resizeable.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Resizeable": () => (/* binding */ Resizeable)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _react_aria_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @react-aria/utils */ "../node_modules/@react-aria/utils/dist/module.js");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





/**
 * Watch and pass element dimensions into child render function.
 *
 * WARNING: be careful not to update the dimensions of child elements based on
 * this parent size as that could cause infinite render loops
 */
function Resizeable(_ref) {
  let {
    children,
    className
  } = _ref;
  const el = (0,react__WEBPACK_IMPORTED_MODULE_1__.useRef)(null);
  const [dimensions, setDimensions] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)({
    height: 0,
    width: 0
  });
  const onResize = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
    var _el$current, _el$current2;

    setDimensions({
      height: ((_el$current = el.current) === null || _el$current === void 0 ? void 0 : _el$current.clientHeight) || 0,
      width: ((_el$current2 = el.current) === null || _el$current2 === void 0 ? void 0 : _el$current2.clientWidth) || 0
    });
  }, [setDimensions]);
  (0,_react_aria_utils__WEBPACK_IMPORTED_MODULE_2__.useResizeObserver)({
    ref: el,
    onResize
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("div", {
    className: className,
    ref: el,
    children: children(dimensions)
  });
}
Resizeable.displayName = "Resizeable";

/***/ }),

/***/ "./app/components/tagsTableRow.tsx":
/*!*****************************************!*\
  !*** ./app/components/tagsTableRow.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_keyValueTable__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/keyValueTable */ "./app/components/keyValueTable.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_components_version__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/version */ "./app/components/version.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _events_meta_annotatedText__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./events/meta/annotatedText */ "./app/components/events/meta/annotatedText/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









function TagsTableRow(_ref) {
  var _meta$key, _meta$value, _keyMetaData$err;

  let {
    tag,
    query,
    generateUrl,
    meta
  } = _ref;
  const tagInQuery = query.includes(`${tag.key}:`);
  const target = tagInQuery ? undefined : generateUrl(tag);
  const keyMetaData = meta === null || meta === void 0 ? void 0 : (_meta$key = meta.key) === null || _meta$key === void 0 ? void 0 : _meta$key[''];
  const valueMetaData = meta === null || meta === void 0 ? void 0 : (_meta$value = meta.value) === null || _meta$value === void 0 ? void 0 : _meta$value[''];

  const renderTagValue = () => {
    switch (tag.key) {
      case 'release':
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_version__WEBPACK_IMPORTED_MODULE_5__["default"], {
          version: tag.value,
          anchor: false,
          withPackage: true
        });

      default:
        return tag.value;
    }
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_keyValueTable__WEBPACK_IMPORTED_MODULE_2__.KeyValueTableRow, {
    keyName: !!keyMetaData && !tag.key ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_events_meta_annotatedText__WEBPACK_IMPORTED_MODULE_7__["default"], {
      value: tag.key,
      meta: keyMetaData
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(StyledTooltip, {
      title: tag.key,
      children: tag.key
    }),
    value: !!valueMetaData && !tag.value ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_events_meta_annotatedText__WEBPACK_IMPORTED_MODULE_7__["default"], {
      value: tag.value,
      meta: valueMetaData
    }) : keyMetaData !== null && keyMetaData !== void 0 && (_keyMetaData$err = keyMetaData.err) !== null && _keyMetaData$err !== void 0 && _keyMetaData$err.length ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(ValueContainer, {
      children: renderTagValue()
    }) : tagInQuery ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(StyledTooltip, {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('This tag is in the current filter conditions'),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(ValueContainer, {
        children: renderTagValue()
      })
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(StyledTooltip, {
      title: renderTagValue(),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_3__["default"], {
        to: target || '',
        children: renderTagValue()
      })
    })
  });
}

TagsTableRow.displayName = "TagsTableRow";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TagsTableRow);

const StyledTooltip = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "eefv4rs1"
} : 0)(p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

const ValueContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "eefv4rs0"
} : 0)( true ? {
  name: "1jltqks",
  styles: "display:block;overflow:hidden;text-overflow:ellipsis;line-height:normal"
} : 0);

/***/ }),

/***/ "./app/utils/performance/urls.ts":
/*!***************************************!*\
  !*** ./app/utils/performance/urls.ts ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getTransactionDetailsUrl": () => (/* binding */ getTransactionDetailsUrl)
/* harmony export */ });
/* harmony import */ var sentry_components_events_interfaces_spans_utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/events/interfaces/spans/utils */ "./app/components/events/interfaces/spans/utils.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");


function getTransactionDetailsUrl(orgSlug, eventSlug, transaction, query, spanId) {
  const locationQuery = { ...(query || {}),
    transaction
  };

  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(locationQuery.transaction)) {
    delete locationQuery.transaction;
  }

  const target = {
    pathname: `/organizations/${orgSlug}/performance/${eventSlug}/`,
    query: locationQuery,
    hash: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(spanId) ? (0,sentry_components_events_interfaces_spans_utils__WEBPACK_IMPORTED_MODULE_0__.spanTargetHash)(spanId) : undefined
  };

  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(target.hash)) {
    delete target.hash;
  }

  return target;
}

/***/ }),

/***/ "./app/utils/replays/hooks/useActiveReplayTab.tsx":
/*!********************************************************!*\
  !*** ./app/utils/replays/hooks/useActiveReplayTab.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TabKey": () => (/* binding */ TabKey),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_utils_replays_hooks_useUrlParams__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/replays/hooks/useUrlParams */ "./app/utils/replays/hooks/useUrlParams.tsx");


let TabKey;

(function (TabKey) {
  TabKey["console"] = "console";
  TabKey["dom"] = "dom";
  TabKey["network"] = "network";
  TabKey["trace"] = "trace";
  TabKey["issues"] = "issues";
  TabKey["memory"] = "memory";
})(TabKey || (TabKey = {}));

function isReplayTab(tab) {
  return tab in TabKey;
}

const DEFAULT_TAB = TabKey.console;

function useActiveReplayTab() {
  const {
    getParamValue,
    setParamValue
  } = (0,sentry_utils_replays_hooks_useUrlParams__WEBPACK_IMPORTED_MODULE_1__["default"])('t_main', DEFAULT_TAB);
  const paramValue = getParamValue();
  return {
    getActiveTab: (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(() => isReplayTab(paramValue || '') ? paramValue : DEFAULT_TAB, [paramValue]),
    setActiveTab: (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(value => isReplayTab(value) ? setParamValue(value) : setParamValue(DEFAULT_TAB), [setParamValue])
  };
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (useActiveReplayTab);

/***/ }),

/***/ "./app/utils/replays/hooks/useCrumbHandlers.tsx":
/*!******************************************************!*\
  !*** ./app/utils/replays/hooks/useCrumbHandlers.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/replays/replayContext */ "./app/components/replays/replayContext.tsx");
/* harmony import */ var sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/replays/utils */ "./app/components/replays/utils.tsx");




function useCrumbHandlers() {
  let startTimestampMs = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
  const {
    clearAllHighlights,
    highlight,
    removeHighlight,
    setCurrentHoverTime,
    setCurrentTime
  } = (0,sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_1__.useReplayContext)();
  const handleMouseEnter = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(item => {
    if (startTimestampMs) {
      var _item$timestamp;

      setCurrentHoverTime((0,sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_2__.relativeTimeInMs)((_item$timestamp = item.timestamp) !== null && _item$timestamp !== void 0 ? _item$timestamp : '', startTimestampMs));
    }

    if (item.data && 'nodeId' in item.data) {
      // XXX: Kind of hacky, but mouseLeave does not fire if you move from a
      // crumb to a tooltip
      clearAllHighlights();
      highlight({
        nodeId: item.data.nodeId,
        annotation: item.data.label
      });
    }
  }, [setCurrentHoverTime, startTimestampMs, highlight, clearAllHighlights]);
  const handleMouseLeave = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(item => {
    setCurrentHoverTime(undefined);

    if (item.data && 'nodeId' in item.data) {
      removeHighlight({
        nodeId: item.data.nodeId
      });
    }
  }, [setCurrentHoverTime, removeHighlight]);
  const handleClick = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(crumb => {
    crumb.timestamp !== undefined && startTimestampMs !== undefined ? setCurrentTime((0,sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_2__.relativeTimeInMs)(crumb.timestamp, startTimestampMs)) : null;
  }, [setCurrentTime, startTimestampMs]);
  return {
    handleMouseEnter,
    handleMouseLeave,
    handleClick
  };
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (useCrumbHandlers);

/***/ }),

/***/ "./app/utils/replays/hooks/useCurrentItemScroller.tsx":
/*!************************************************************!*\
  !*** ./app/utils/replays/hooks/useCurrentItemScroller.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useCurrentItemScroller": () => (/* binding */ useCurrentItemScroller)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");



const defer = fn => setTimeout(fn, 0);

function useCurrentItemScroller(containerRef) {
  const [isAutoScrollDisabled, setIsAutoScrollDisabled] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    const containerEl = containerRef.current;
    let observer;

    if (containerEl) {
      const isContainerScrollable = () => containerEl.scrollHeight > containerEl.offsetHeight;

      observer = new MutationObserver(mutationList => {
        for (const mutation of mutationList) {
          if (mutation.type === 'attributes' && mutation.attributeName === 'aria-current' && mutation.target.nodeType === 1 // Element nodeType
          ) {
            const element = mutation.target;
            const isCurrent = (element === null || element === void 0 ? void 0 : element.ariaCurrent) === 'true';

            if (isCurrent && isContainerScrollable() && !isAutoScrollDisabled) {
              // Deferring the scroll helps prevent it from not being executed
              // in certain situations. (jumping to a time with the scrubber)
              defer(() => {
                element === null || element === void 0 ? void 0 : element.scrollIntoView({
                  behavior: 'smooth',
                  block: 'center',
                  inline: 'start'
                });
              });
            }
          }
        }
      });
      observer.observe(containerRef.current, {
        attributes: true,
        childList: false,
        subtree: true
      });
    }

    const handleMouseEnter = () => {
      setIsAutoScrollDisabled(true);
    };

    const handleMouseLeave = () => {
      setIsAutoScrollDisabled(false);
    };

    containerEl === null || containerEl === void 0 ? void 0 : containerEl.addEventListener('mouseenter', handleMouseEnter);
    containerEl === null || containerEl === void 0 ? void 0 : containerEl.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      var _observer;

      (_observer = observer) === null || _observer === void 0 ? void 0 : _observer.disconnect();
      containerEl === null || containerEl === void 0 ? void 0 : containerEl.removeEventListener('mouseenter', handleMouseEnter);
      containerEl === null || containerEl === void 0 ? void 0 : containerEl.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [containerRef, isAutoScrollDisabled]);
}

/***/ }),

/***/ "./app/utils/replays/hooks/useExtractedCrumbHtml.tsx":
/*!***********************************************************!*\
  !*** ./app/utils/replays/hooks/useExtractedCrumbHtml.tsx ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var lodash_first__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/first */ "../node_modules/lodash/first.js");
/* harmony import */ var lodash_first__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_first__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var rrweb__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! rrweb */ "../node_modules/rrweb/es/rrweb/packages/rrweb/src/replay/index.js");






// Copied from `node_modules/rrweb/typings/types.d.ts`
var EventType;

(function (EventType) {
  EventType[EventType["DomContentLoaded"] = 0] = "DomContentLoaded";
  EventType[EventType["Load"] = 1] = "Load";
  EventType[EventType["FullSnapshot"] = 2] = "FullSnapshot";
  EventType[EventType["IncrementalSnapshot"] = 3] = "IncrementalSnapshot";
  EventType[EventType["Meta"] = 4] = "Meta";
  EventType[EventType["Custom"] = 5] = "Custom";
  EventType[EventType["Plugin"] = 6] = "Plugin";
})(EventType || (EventType = {}));

function useExtractedCrumbHtml(_ref) {
  let {
    replay
  } = _ref;
  const [breadcrumbRefs, setBreadcrumbReferences] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)([]);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    let isMounted = true;
    const domRoot = document.createElement('div');
    domRoot.className = 'sr-block';
    const {
      style
    } = domRoot;
    style.position = 'fixed';
    style.inset = '0';
    style.width = '0';
    style.height = '0';
    style.overflow = 'hidden';
    document.body.appendChild(domRoot); // Get a list of the breadcrumbs that relate directly to the DOM, for each
    // crumb we will extract the referenced HTML.

    const crumbs = replay.getRawCrumbs().filter(crumb => crumb.data && 'nodeId' in crumb.data);
    const rrwebEvents = replay.getRRWebEvents(); // Grab the last event, but skip the synthetic `replay-end` event that the
    // ReplayerReader added. RRWeb will skip that event when it comes time to render

    const lastEvent = rrwebEvents[rrwebEvents.length - 2];

    const isLastRRWebEvent = event => lastEvent === event;

    const replayerRef = new rrweb__WEBPACK_IMPORTED_MODULE_4__.Replayer(rrwebEvents, {
      root: domRoot,
      loadTimeout: 1,
      showWarning: false,
      blockClass: 'sr-block',
      speed: 99999,
      skipInactive: true,
      triggerFocus: false,
      plugins: [new BreadcrumbReferencesPlugin({
        crumbs,
        isFinished: isLastRRWebEvent,
        onFinish: rows => {
          if (isMounted) {
            setBreadcrumbReferences(rows);
          }

          setTimeout(() => {
            if (document.body.contains(domRoot)) {
              document.body.removeChild(domRoot);
            }
          }, 0);
        }
      })],
      mouseTail: false
    });

    try {
      // Run the replay to the end, we will capture data as it streams into the plugin
      replayerRef.pause(replay.getReplay().finishedAt.getTime());
    } catch (error) {
      _sentry_react__WEBPACK_IMPORTED_MODULE_5__.captureException(error);
    }

    return () => {
      isMounted = false;
    };
  }, [replay]);
  return {
    isLoading: false,
    actions: breadcrumbRefs
  };
}

class BreadcrumbReferencesPlugin {
  constructor(_ref2) {
    let {
      crumbs,
      isFinished,
      onFinish
    } = _ref2;

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "crumbs", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "isFinished", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onFinish", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "activities", []);

    this.crumbs = crumbs;
    this.isFinished = isFinished;
    this.onFinish = onFinish;
  }

  handler(event, _isSync, _ref3) {
    let {
      replayer
    } = _ref3;

    if (event.type === EventType.IncrementalSnapshot) {
      const crumb = lodash_first__WEBPACK_IMPORTED_MODULE_3___default()(this.crumbs);
      const nextTimestamp = +new Date((crumb === null || crumb === void 0 ? void 0 : crumb.timestamp) || '');

      if (crumb && nextTimestamp && nextTimestamp <= event.timestamp) {
        var _crumb$data;

        // we passed the next one, grab the dom, and pop the timestamp off
        const mirror = replayer.getMirror(); // @ts-expect-error

        const node = mirror.getNode(((_crumb$data = crumb.data) === null || _crumb$data === void 0 ? void 0 : _crumb$data.nodeId) || ''); // @ts-expect-error

        const html = (node === null || node === void 0 ? void 0 : node.outerHTML) || (node === null || node === void 0 ? void 0 : node.textContent) || ''; // Limit document node depth to 2

        let truncated = removeNodesAtLevel(html, 2); // If still very long and/or removeNodesAtLevel failed, truncate

        if (truncated.length > 1500) {
          truncated = truncated.substring(0, 1500);
        }

        if (truncated) {
          this.activities.push({
            crumb,
            html: truncated,
            timestamp: nextTimestamp
          });
        }

        this.crumbs.shift();
      }
    }

    if (this.isFinished(event)) {
      this.onFinish(this.activities);
    }
  }

}

function removeNodesAtLevel(html, level) {
  const parser = new DOMParser();

  try {
    const doc = parser.parseFromString(html, 'text/html');

    const removeChildLevel = function (max, collection) {
      let current = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;

      for (let i = 0; i < collection.length; i++) {
        const child = collection[i];

        if (child.nodeName === 'STYLE') {
          child.textContent = '/* Inline CSS */';
        }

        if (child.nodeName === 'svg') {
          child.innerHTML = '<!-- SVG -->';
        }

        if (max <= current) {
          if (child.childElementCount > 0) {
            child.innerHTML = `<!-- ${child.childElementCount} descendents -->`;
          }
        } else {
          removeChildLevel(max, child.children, current + 1);
        }
      }
    };

    removeChildLevel(level, doc.body.children);
    return doc.body.innerHTML;
  } catch (err) {
    // If we can't parse the HTML, just return the original
    return html;
  }
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (useExtractedCrumbHtml);

/***/ }),

/***/ "./app/utils/replays/hooks/useReplayLayout.tsx":
/*!*****************************************************!*\
  !*** ./app/utils/replays/hooks/useReplayLayout.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "LayoutKey": () => (/* binding */ LayoutKey),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_stores_preferencesStore__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/stores/preferencesStore */ "./app/stores/preferencesStore.tsx");
/* harmony import */ var sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/stores/useLegacyStore */ "./app/stores/useLegacyStore.tsx");
/* harmony import */ var sentry_utils_replays_hooks_useUrlParams__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/replays/hooks/useUrlParams */ "./app/utils/replays/hooks/useUrlParams.tsx");
/* harmony import */ var sentry_views_replays_detail_layout_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/views/replays/detail/layout/utils */ "./app/views/replays/detail/layout/utils.tsx");





let LayoutKey;

(function (LayoutKey) {
  LayoutKey["topbar"] = "topbar";
  LayoutKey["sidebar_left"] = "sidebar_left";
  LayoutKey["sidebar_right"] = "sidebar_right";
})(LayoutKey || (LayoutKey = {}));

function isLayout(val) {
  return val in LayoutKey;
}

function useActiveReplayTab() {
  const collapsed = !!(0,sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_2__.useLegacyStore)(sentry_stores_preferencesStore__WEBPACK_IMPORTED_MODULE_1__["default"]).collapsed;
  const defaultLayout = (0,sentry_views_replays_detail_layout_utils__WEBPACK_IMPORTED_MODULE_4__.getDefaultLayout)(collapsed);
  const {
    getParamValue,
    setParamValue
  } = (0,sentry_utils_replays_hooks_useUrlParams__WEBPACK_IMPORTED_MODULE_3__["default"])('l_page', defaultLayout);
  const paramValue = getParamValue();
  return {
    getLayout: (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(() => isLayout(paramValue || '') ? paramValue : defaultLayout, [defaultLayout, paramValue]),
    setLayout: (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(value => isLayout(value) ? setParamValue(value) : setParamValue(defaultLayout), [defaultLayout, setParamValue])
  };
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (useActiveReplayTab);

/***/ }),

/***/ "./app/utils/replays/hooks/useUrlParams.tsx":
/*!**************************************************!*\
  !*** ./app/utils/replays/hooks/useUrlParams.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_utils_useRouteContext__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/useRouteContext */ "./app/utils/useRouteContext.tsx");




function useUrlParams(defaultKey, defaultValue) {
  const {
    location
  } = (0,sentry_utils_useRouteContext__WEBPACK_IMPORTED_MODULE_2__.useRouteContext)();
  const getParamValue = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(key => {
    return location.query[key] || defaultValue;
  }, [location, defaultValue]);
  const setParamValue = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)((key, value) => {
    react_router__WEBPACK_IMPORTED_MODULE_1__.browserHistory.push({ ...location,
      query: { ...location.query,
        [key]: value
      }
    });
  }, [location]);
  const getWithDefault = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(() => getParamValue(defaultKey || ''), [getParamValue, defaultKey]);
  const setWithDefault = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(value => setParamValue(defaultKey || '', value), [setParamValue, defaultKey]);

  if (defaultKey !== undefined) {
    return {
      getParamValue: getWithDefault,
      setParamValue: setWithDefault
    };
  }

  return {
    getParamValue,
    setParamValue
  };
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (useUrlParams);

/***/ }),

/***/ "./app/views/performance/transactionSummary/utils.tsx":
/*!************************************************************!*\
  !*** ./app/views/performance/transactionSummary/utils.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SidebarSpacer": () => (/* binding */ SidebarSpacer),
/* harmony export */   "TransactionFilterOptions": () => (/* binding */ TransactionFilterOptions),
/* harmony export */   "generateTraceLink": () => (/* binding */ generateTraceLink),
/* harmony export */   "generateTransactionLink": () => (/* binding */ generateTransactionLink),
/* harmony export */   "generateTransactionSummaryRoute": () => (/* binding */ generateTransactionSummaryRoute),
/* harmony export */   "normalizeSearchConditions": () => (/* binding */ normalizeSearchConditions),
/* harmony export */   "normalizeSearchConditionsWithTransactionName": () => (/* binding */ normalizeSearchConditionsWithTransactionName),
/* harmony export */   "transactionSummaryRouteWithQuery": () => (/* binding */ transactionSummaryRouteWithQuery)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_discover_urls__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/discover/urls */ "./app/utils/discover/urls.tsx");
/* harmony import */ var sentry_utils_performance_urls__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/performance/urls */ "./app/utils/performance/urls.ts");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_views_performance_traceDetails_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/performance/traceDetails/utils */ "./app/views/performance/traceDetails/utils.tsx");






let TransactionFilterOptions;

(function (TransactionFilterOptions) {
  TransactionFilterOptions["FASTEST"] = "fastest";
  TransactionFilterOptions["SLOW"] = "slow";
  TransactionFilterOptions["OUTLIER"] = "outlier";
  TransactionFilterOptions["RECENT"] = "recent";
})(TransactionFilterOptions || (TransactionFilterOptions = {}));

function generateTransactionSummaryRoute(_ref) {
  let {
    orgSlug
  } = _ref;
  return `/organizations/${orgSlug}/performance/summary/`;
} // normalizes search conditions by removing any redundant search conditions before presenting them in:
// - query strings
// - search UI

function normalizeSearchConditions(query) {
  const filterParams = normalizeSearchConditionsWithTransactionName(query); // no need to include transaction as its already in the query params

  filterParams.removeFilter('transaction');
  return filterParams;
} // normalizes search conditions by removing any redundant search conditions, but retains any transaction name

function normalizeSearchConditionsWithTransactionName(query) {
  const filterParams = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_4__.MutableSearch(query); // remove any event.type queries since it is implied to apply to only transactions

  filterParams.removeFilter('event.type');
  return filterParams;
}
function transactionSummaryRouteWithQuery(_ref2) {
  let {
    orgSlug,
    transaction,
    projectID,
    query,
    unselectedSeries = 'p100()',
    display,
    trendFunction,
    trendColumn,
    showTransactions,
    additionalQuery
  } = _ref2;
  const pathname = generateTransactionSummaryRoute({
    orgSlug
  });
  let searchFilter;

  if (typeof query.query === 'string') {
    searchFilter = normalizeSearchConditions(query.query).formatString();
  } else {
    searchFilter = query.query;
  }

  return {
    pathname,
    query: {
      transaction,
      project: projectID,
      environment: query.environment,
      statsPeriod: query.statsPeriod,
      start: query.start,
      end: query.end,
      query: searchFilter,
      unselectedSeries,
      showTransactions,
      display,
      trendFunction,
      trendColumn,
      ...additionalQuery
    }
  };
}
function generateTraceLink(dateSelection) {
  return (organization, tableRow, _query) => {
    const traceId = `${tableRow.trace}`;

    if (!traceId) {
      return {};
    }

    return (0,sentry_views_performance_traceDetails_utils__WEBPACK_IMPORTED_MODULE_5__.getTraceDetailsUrl)(organization, traceId, dateSelection, {});
  };
}
function generateTransactionLink(transactionName) {
  return (organization, tableRow, query, spanId) => {
    const eventSlug = (0,sentry_utils_discover_urls__WEBPACK_IMPORTED_MODULE_2__.generateEventSlug)(tableRow);
    return (0,sentry_utils_performance_urls__WEBPACK_IMPORTED_MODULE_3__.getTransactionDetailsUrl)(organization.slug, eventSlug, transactionName, query, spanId);
  };
}
const SidebarSpacer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1radvp0"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(3), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/replays/detail/breadcrumbs/index.tsx":
/*!********************************************************!*\
  !*** ./app/views/replays/detail/breadcrumbs/index.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/replays/replayContext */ "./app/components/replays/replayContext.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_replays_getBreadcrumb__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/replays/getBreadcrumb */ "./app/utils/replays/getBreadcrumb.tsx");
/* harmony import */ var sentry_utils_replays_hooks_useCrumbHandlers__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/replays/hooks/useCrumbHandlers */ "./app/utils/replays/hooks/useCrumbHandlers.tsx");
/* harmony import */ var sentry_utils_replays_hooks_useCurrentItemScroller__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/replays/hooks/useCurrentItemScroller */ "./app/utils/replays/hooks/useCurrentItemScroller.tsx");
/* harmony import */ var sentry_views_replays_detail_breadcrumbs_breadcrumbItem__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/replays/detail/breadcrumbs/breadcrumbItem */ "./app/views/replays/detail/breadcrumbs/breadcrumbItem.tsx");
/* harmony import */ var sentry_views_replays_detail_layout_fluidPanel__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/replays/detail/layout/fluidPanel */ "./app/views/replays/detail/layout/fluidPanel.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }














function CrumbPlaceholder(_ref) {
  let {
    number
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(BreadcrumbContainer, {
    children: [...Array(number)].map((_, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(PlaceholderMargin, {
      height: "53px"
    }, i))
  });
}

CrumbPlaceholder.displayName = "CrumbPlaceholder";

function Breadcrumbs(_ref2) {
  let {} = _ref2;
  const {
    currentHoverTime,
    currentTime,
    replay
  } = (0,sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_6__.useReplayContext)();
  const replayRecord = replay === null || replay === void 0 ? void 0 : replay.getReplay();
  const allCrumbs = replay === null || replay === void 0 ? void 0 : replay.getRawCrumbs();
  const crumbListContainerRef = (0,react__WEBPACK_IMPORTED_MODULE_3__.useRef)(null);
  (0,sentry_utils_replays_hooks_useCurrentItemScroller__WEBPACK_IMPORTED_MODULE_11__.useCurrentItemScroller)(crumbListContainerRef);
  const startTimestampMs = (replayRecord === null || replayRecord === void 0 ? void 0 : replayRecord.startedAt.getTime()) || 0;
  const {
    handleMouseEnter,
    handleMouseLeave,
    handleClick
  } = (0,sentry_utils_replays_hooks_useCrumbHandlers__WEBPACK_IMPORTED_MODULE_10__["default"])(startTimestampMs);
  const isLoaded = Boolean(replayRecord);
  const crumbs = (allCrumbs === null || allCrumbs === void 0 ? void 0 : allCrumbs.filter(crumb => !['console'].includes(crumb.category || ''))) || [];
  const currentUserAction = (0,sentry_utils_replays_getBreadcrumb__WEBPACK_IMPORTED_MODULE_9__.getPrevBreadcrumb)({
    crumbs,
    targetTimestampMs: startTimestampMs + currentTime,
    allowExact: true
  });
  const closestUserAction = currentHoverTime !== undefined ? (0,sentry_utils_replays_getBreadcrumb__WEBPACK_IMPORTED_MODULE_9__.getPrevBreadcrumb)({
    crumbs,
    targetTimestampMs: startTimestampMs + (currentHoverTime !== null && currentHoverTime !== void 0 ? currentHoverTime : 0),
    allowExact: true
  }) : undefined;
  const content = isLoaded ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(BreadcrumbContainer, {
    children: crumbs.map(crumb => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_views_replays_detail_breadcrumbs_breadcrumbItem__WEBPACK_IMPORTED_MODULE_12__["default"], {
      crumb: crumb,
      startTimestampMs: startTimestampMs,
      isHovered: (closestUserAction === null || closestUserAction === void 0 ? void 0 : closestUserAction.id) === crumb.id,
      isSelected: (currentUserAction === null || currentUserAction === void 0 ? void 0 : currentUserAction.id) === crumb.id,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      onClick: handleClick
    }, crumb.id))
  }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(CrumbPlaceholder, {
    number: 4
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(Panel, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_views_replays_detail_layout_fluidPanel__WEBPACK_IMPORTED_MODULE_13__["default"], {
      bodyRef: crumbListContainerRef,
      title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(PanelHeader, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Breadcrumbs')
      }),
      children: content
    })
  });
}

Breadcrumbs.displayName = "Breadcrumbs";

const BreadcrumbContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eim69pk3"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(0.5), ";" + ( true ? "" : 0));

const Panel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__.Panel,  true ? {
  target: "eim69pk2"
} : 0)( true ? {
  name: "eu54nu",
  styles: "width:100%;height:100%;overflow:hidden;margin-bottom:0"
} : 0);

const PanelHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__.PanelHeader,  true ? {
  target: "eim69pk1"
} : 0)("background-color:", p => p.theme.background, ";border-bottom:1px solid ", p => p.theme.innerBorder, ";font-size:", p => p.theme.fontSizeSmall, ";color:", p => p.theme.gray500, ";text-transform:capitalize;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";font-weight:600;" + ( true ? "" : 0));

const PlaceholderMargin = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "eim69pk0"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";width:auto;border-radius:", p => p.theme.borderRadius, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Breadcrumbs);

/***/ }),

/***/ "./app/views/replays/detail/console/consoleMessage.tsx":
/*!*************************************************************!*\
  !*** ./app/views/replays/detail/console/consoleMessage.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "MessageFormatter": () => (/* binding */ MessageFormatter),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_string_replace_all_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.string.replace-all.js */ "../node_modules/core-js/modules/es.string.replace-all.js");
/* harmony import */ var core_js_modules_es_string_replace_all_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_all_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_isObject__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/isObject */ "../node_modules/lodash/isObject.js");
/* harmony import */ var lodash_isObject__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_isObject__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var sprintf_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sprintf-js */ "../node_modules/sprintf-js/src/sprintf.js");
/* harmony import */ var sprintf_js__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(sprintf_js__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/errorBoundary */ "./app/components/errorBoundary.tsx");
/* harmony import */ var sentry_components_events_meta_annotatedText__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/events/meta/annotatedText */ "./app/components/events/meta/annotatedText/index.tsx");
/* harmony import */ var sentry_components_events_meta_metaProxy__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/events/meta/metaProxy */ "./app/components/events/meta/metaProxy.tsx");
/* harmony import */ var sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/replays/replayContext */ "./app/components/replays/replayContext.tsx");
/* harmony import */ var sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/replays/utils */ "./app/components/replays/utils.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

















/**
 * Attempt to stringify
 */
function renderString(arg) {
  if (typeof arg !== 'object') {
    return arg;
  }

  try {
    return JSON.stringify(arg);
  } catch {
    return arg.toString();
  }
}
/**
 * Attempt to emulate the browser console as much as possible
 */


function MessageFormatter(_ref) {
  var _breadcrumb$data, _breadcrumb$data2, _breadcrumb$data3;

  let {
    breadcrumb
  } = _ref;
  let logMessage = '';

  if (!((_breadcrumb$data = breadcrumb.data) !== null && _breadcrumb$data !== void 0 && _breadcrumb$data.arguments)) {
    var _breadcrumb$message;

    // There is a possibility that we don't have arguments as we could be receiving an exception type breadcrumb.
    // In these cases we just need the message prop.
    // There are cases in which our prop message is an array, we want to force it to become a string
    logMessage = ((_breadcrumb$message = breadcrumb.message) === null || _breadcrumb$message === void 0 ? void 0 : _breadcrumb$message.toString()) || '';
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_events_meta_annotatedText__WEBPACK_IMPORTED_MODULE_10__["default"], {
      meta: (0,sentry_components_events_meta_metaProxy__WEBPACK_IMPORTED_MODULE_11__.getMeta)(breadcrumb, 'message'),
      value: logMessage
    });
  } // Browser's console formatter only works on the first arg


  const [message, ...args] = (_breadcrumb$data2 = breadcrumb.data) === null || _breadcrumb$data2 === void 0 ? void 0 : _breadcrumb$data2.arguments;
  const isMessageString = typeof message === 'string';
  const placeholders = isMessageString ? sprintf_js__WEBPACK_IMPORTED_MODULE_7__.sprintf.parse(message).filter(parsed => Array.isArray(parsed)) : []; // Placeholders can only occur in the first argument and only if it is a string.
  // We can skip the below code and avoid using `sprintf` if there are no placeholders.

  if (placeholders.length) {
    // TODO `%c` is console specific, it applies colors to messages
    // for now we are stripping it as this is potentially risky to implement due to xss
    const consoleColorPlaceholderIndexes = placeholders.filter(_ref2 => {
      let [placeholder] = _ref2;
      return placeholder === '%c';
    }).map((_, i) => i); // Retrieve message formatting args

    const messageArgs = args.slice(0, placeholders.length); // Filter out args that were for %c

    for (const colorIndex of consoleColorPlaceholderIndexes) {
      messageArgs.splice(colorIndex, 1);
    } // Attempt to stringify the rest of the args


    const restArgs = args.slice(placeholders.length).map(renderString);
    const formattedMessage = isMessageString ? (0,sprintf_js__WEBPACK_IMPORTED_MODULE_7__.vsprintf)(message.replaceAll('%c', ''), messageArgs) : renderString(message);
    logMessage = [formattedMessage, ...restArgs].join(' ').trim();
  } else if (((_breadcrumb$data3 = breadcrumb.data) === null || _breadcrumb$data3 === void 0 ? void 0 : _breadcrumb$data3.arguments.length) === 1 && lodash_isObject__WEBPACK_IMPORTED_MODULE_6___default()(message) && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_17__.objectIsEmpty)(message)) {
    // There is a special case where `console.error()` is called with an Error object.
    // The SDK uses the Error's `message` property as the breadcrumb message, but we lose the Error type,
    // resulting in an empty object in the breadcrumb arguments. In this case, we
    // only want to use `breadcrumb.message`.
    logMessage = breadcrumb.message || JSON.stringify(message);
  } else {
    var _breadcrumb$data4;

    // If the string `[object Object]` is found in message, it means the SDK attempted to stringify an object,
    // but the actual object should be captured in the arguments.
    //
    // Likewise if arrays are found e.g. [test,test] the SDK will serialize it to 'test, test'.
    //
    // In those cases, we'll want to use our pretty print in every argument that was passed to the logger instead of using
    // the SDK's serialization.
    const argValues = (_breadcrumb$data4 = breadcrumb.data) === null || _breadcrumb$data4 === void 0 ? void 0 : _breadcrumb$data4.arguments.map(renderString);
    logMessage = argValues.join(' ').trim();
  } // TODO(replays): Add better support for AnnotatedText (e.g. we use message
  // args from breadcrumb.data.arguments and not breadcrumb.message directly)


  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_events_meta_annotatedText__WEBPACK_IMPORTED_MODULE_10__["default"], {
    meta: (0,sentry_components_events_meta_metaProxy__WEBPACK_IMPORTED_MODULE_11__.getMeta)(breadcrumb, 'message'),
    value: logMessage
  });
}
MessageFormatter.displayName = "MessageFormatter";

function ConsoleMessage(_ref3) {
  let {
    breadcrumb,
    isActive = false,
    hasOccurred,
    isLast,
    startTimestampMs = 0
  } = _ref3;
  const ICONS = {
    error: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_15__.IconClose, {
      isCircled: true,
      size: "xs"
    }),
    warning: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_15__.IconWarning, {
      size: "xs"
    })
  };
  const {
    setCurrentTime,
    setCurrentHoverTime
  } = (0,sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_12__.useReplayContext)();
  const diff = (0,sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_13__.relativeTimeInMs)(breadcrumb.timestamp || '', startTimestampMs);

  const handleOnClick = () => setCurrentTime(diff);

  const handleOnMouseOver = () => setCurrentHoverTime(diff);

  const handleOnMouseOut = () => setCurrentHoverTime(undefined);

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(react__WEBPACK_IMPORTED_MODULE_5__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(Icon, {
      isLast: isLast,
      level: breadcrumb.level,
      isActive: isActive,
      hasOccurred: hasOccurred,
      onMouseOver: handleOnMouseOver,
      onMouseOut: handleOnMouseOut,
      children: ICONS[breadcrumb.level]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(Message, {
      isLast: isLast,
      level: breadcrumb.level,
      hasOccurred: hasOccurred,
      onMouseOver: handleOnMouseOver,
      onMouseOut: handleOnMouseOut,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_9__["default"], {
        mini: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(MessageFormatter, {
          breadcrumb: breadcrumb
        })
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(ConsoleTimestamp, {
      isLast: isLast,
      level: breadcrumb.level,
      hasOccurred: hasOccurred,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_14__["default"], {
        title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_8__["default"], {
          date: breadcrumb.timestamp,
          seconds: true
        }),
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(ConsoleTimestampButton, {
          onClick: handleOnClick,
          onMouseOver: handleOnMouseOver,
          onMouseOut: handleOnMouseOut,
          children: (0,sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_13__.showPlayerTime)(breadcrumb.timestamp || '', startTimestampMs)
        })
      })
    })]
  });
}

ConsoleMessage.displayName = "ConsoleMessage";

const Common = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "efmgn2a4"
} : 0)("background-color:", p => ['warning', 'error'].includes(p.level) ? p.theme.alert[p.level].backgroundLight : 'inherit', ";color:", _ref4 => {
  let {
    hasOccurred = true,
    ...p
  } = _ref4;

  if (!hasOccurred) {
    return p.theme.gray300;
  }

  if (['warning', 'error'].includes(p.level)) {
    return p.theme.alert[p.level].iconHoverColor;
  }

  return 'inherit';
}, ";", p => !p.isLast ? `border-bottom: 1px solid ${p.theme.innerBorder}` : '', ";transition:color 0.5s ease;&:nth-child(1){border-top-left-radius:3px;}&:nth-child(3){border-top-right-radius:3px;}&:nth-last-child(1){border-bottom-right-radius:3px;}&:nth-last-child(3){border-bottom-left-radius:3px;}" + ( true ? "" : 0));

const ConsoleTimestamp = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Common,  true ? {
  target: "efmgn2a3"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(0.25), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1), ";" + ( true ? "" : 0));

const ConsoleTimestampButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('button',  true ? {
  target: "efmgn2a2"
} : 0)( true ? {
  name: "1kpy5mm",
  styles: "background:none;border:none"
} : 0);

const Icon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Common,  true ? {
  target: "efmgn2a1"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(0.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1), ";position:relative;&:after{content:'';position:absolute;top:0;left:0;z-index:1;height:100%;width:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(0.5), ";background-color:", p => p.isActive ? p.theme.focus : 'transparent', ";}&:nth-child(1):after{border-top-left-radius:3px;}&:nth-last-child(3):after{border-bottom-left-radius:3px;}" + ( true ? "" : 0));

const Message = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Common,  true ? {
  target: "efmgn2a0"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(0.25), " 0;white-space:pre-wrap;word-break:break-word;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ConsoleMessage);

/***/ }),

/***/ "./app/views/replays/detail/console/index.tsx":
/*!****************************************************!*\
  !*** ./app/views/replays/detail/console/index.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/forms/compactSelect */ "./app/components/forms/compactSelect.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/replays/replayContext */ "./app/components/replays/replayContext.tsx");
/* harmony import */ var sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/replays/utils */ "./app/components/replays/utils.tsx");
/* harmony import */ var sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/searchBar */ "./app/components/searchBar.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_replays_getBreadcrumb__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/replays/getBreadcrumb */ "./app/utils/replays/getBreadcrumb.tsx");
/* harmony import */ var sentry_views_replays_detail_console_consoleMessage__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/replays/detail/console/consoleMessage */ "./app/views/replays/detail/console/consoleMessage.tsx");
/* harmony import */ var sentry_views_replays_detail_console_utils__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/replays/detail/console/utils */ "./app/views/replays/detail/console/utils.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

















const getDistinctLogLevels = breadcrumbs => Array.from(new Set(breadcrumbs.map(breadcrumb => breadcrumb.level)));

function Console(_ref) {
  let {
    breadcrumbs,
    startTimestampMs = 0
  } = _ref;
  const {
    currentHoverTime,
    currentTime
  } = (0,sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_6__.useReplayContext)();
  const [searchTerm, setSearchTerm] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)('');
  const [logLevel, setLogLevel] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)([]);
  const handleSearch = lodash_debounce__WEBPACK_IMPORTED_MODULE_3___default()(query => setSearchTerm(query), 150);
  const filteredBreadcrumbs = (0,react__WEBPACK_IMPORTED_MODULE_2__.useMemo)(() => (0,sentry_views_replays_detail_console_utils__WEBPACK_IMPORTED_MODULE_13__.filterBreadcrumbs)(breadcrumbs, searchTerm, logLevel), [logLevel, searchTerm, breadcrumbs]);
  const closestUserAction = currentHoverTime !== undefined ? (0,sentry_utils_replays_getBreadcrumb__WEBPACK_IMPORTED_MODULE_11__.getPrevBreadcrumb)({
    crumbs: breadcrumbs,
    targetTimestampMs: startTimestampMs + (currentHoverTime !== null && currentHoverTime !== void 0 ? currentHoverTime : 0),
    allowExact: true
  }) : undefined;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(ConsoleFilters, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_4__["default"], {
        triggerProps: {
          prefix: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Log Level')
        },
        multiple: true,
        options: getDistinctLogLevels(breadcrumbs).map(breadcrumbLogLevel => ({
          value: breadcrumbLogLevel,
          label: breadcrumbLogLevel
        })),
        onChange: selections => setLogLevel(selections.map(selection => selection.value))
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_8__["default"], {
        onChange: handleSearch,
        placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Search console logs...')
      })]
    }), filteredBreadcrumbs.length > 0 ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(ConsoleTable, {
      children: filteredBreadcrumbs.map((breadcrumb, i) => {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_views_replays_detail_console_consoleMessage__WEBPACK_IMPORTED_MODULE_12__["default"], {
          isActive: (closestUserAction === null || closestUserAction === void 0 ? void 0 : closestUserAction.id) === breadcrumb.id,
          startTimestampMs: startTimestampMs,
          isLast: i === breadcrumbs.length - 1,
          breadcrumb: breadcrumb,
          hasOccurred: currentTime >= (0,sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_7__.relativeTimeInMs)((breadcrumb === null || breadcrumb === void 0 ? void 0 : breadcrumb.timestamp) || '', startTimestampMs)
        }, breadcrumb.id);
      })
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(StyledEmptyMessage, {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('No results found.')
    })]
  });
}

Console.displayName = "Console";

const ConsoleFilters = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1difbsh2"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";grid-template-columns:max-content 1fr;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";@media (max-width: ", p => p.theme.breakpoints.small, "){margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";}" + ( true ? "" : 0));

const StyledEmptyMessage = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_14__["default"],  true ? {
  target: "e1difbsh1"
} : 0)( true ? {
  name: "1h3rtzg",
  styles: "align-items:center"
} : 0);

const ConsoleTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__.Panel,  true ? {
  target: "e1difbsh0"
} : 0)("display:grid;grid-template-columns:max-content auto max-content;width:100%;font-family:", p => p.theme.text.familyMono, ";font-size:0.8em;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Console);

/***/ }),

/***/ "./app/views/replays/detail/console/utils.tsx":
/*!****************************************************!*\
  !*** ./app/views/replays/detail/console/utils.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "filterBreadcrumbs": () => (/* binding */ filterBreadcrumbs)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);

const filterBreadcrumbs = (breadcrumbs, searchTerm, logLevel) => {
  if (!searchTerm && logLevel.length === 0) {
    return breadcrumbs;
  }

  return breadcrumbs.filter(breadcrumb => {
    const normalizedSearchTerm = searchTerm.toLowerCase();
    const doesMatch = JSON.stringify(breadcrumb.data).toLowerCase().includes(normalizedSearchTerm);

    if (logLevel.length > 0) {
      return doesMatch && logLevel.includes(breadcrumb.level);
    }

    return doesMatch;
  });
};

/***/ }),

/***/ "./app/views/replays/detail/domMutations/index.tsx":
/*!*********************************************************!*\
  !*** ./app/views/replays/detail/domMutations/index.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_events_interfaces_breadcrumbs_breadcrumb_type_icon__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/events/interfaces/breadcrumbs/breadcrumb/type/icon */ "./app/components/events/interfaces/breadcrumbs/breadcrumb/type/icon.tsx");
/* harmony import */ var sentry_components_htmlCode__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/htmlCode */ "./app/components/htmlCode.tsx");
/* harmony import */ var sentry_components_replays_breadcrumbs_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/replays/breadcrumbs/utils */ "./app/components/replays/breadcrumbs/utils.tsx");
/* harmony import */ var sentry_components_replays_playerRelativeTime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/replays/playerRelativeTime */ "./app/components/replays/playerRelativeTime.tsx");
/* harmony import */ var sentry_components_truncate__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/truncate */ "./app/components/truncate.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_replays_hooks_useCrumbHandlers__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/replays/hooks/useCrumbHandlers */ "./app/utils/replays/hooks/useCrumbHandlers.tsx");
/* harmony import */ var sentry_utils_replays_hooks_useExtractedCrumbHtml__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/replays/hooks/useExtractedCrumbHtml */ "./app/utils/replays/hooks/useExtractedCrumbHtml.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }












function DomMutations(_ref) {
  let {
    replay
  } = _ref;
  const {
    isLoading,
    actions
  } = (0,sentry_utils_replays_hooks_useExtractedCrumbHtml__WEBPACK_IMPORTED_MODULE_9__["default"])({
    replay
  });
  const startTimestampMs = replay.getReplay().startedAt.getTime();
  const {
    handleMouseEnter,
    handleMouseLeave,
    handleClick
  } = (0,sentry_utils_replays_hooks_useCrumbHandlers__WEBPACK_IMPORTED_MODULE_8__["default"])(startTimestampMs);

  if (isLoading) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(MutationList, {
    children: actions.map((mutation, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(MutationListItem, {
      onMouseEnter: () => handleMouseEnter(mutation.crumb),
      onMouseLeave: () => handleMouseLeave(mutation.crumb),
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(StepConnector, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(MutationItemContainer, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)("div", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(MutationMetadata, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(IconWrapper, {
              color: mutation.crumb.color,
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_events_interfaces_breadcrumbs_breadcrumb_type_icon__WEBPACK_IMPORTED_MODULE_2__["default"], {
                type: mutation.crumb.type
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(UnstyledButton, {
              onClick: () => handleClick(mutation.crumb),
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_replays_playerRelativeTime__WEBPACK_IMPORTED_MODULE_5__["default"], {
                relativeTimeMs: startTimestampMs,
                timestamp: mutation.crumb.timestamp
              })
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(MutationDetails, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(TitleContainer, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(Title, {
                children: (0,sentry_components_replays_breadcrumbs_utils__WEBPACK_IMPORTED_MODULE_4__.getDetails)(mutation.crumb).title
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_truncate__WEBPACK_IMPORTED_MODULE_6__["default"], {
              maxLength: 30,
              leftTrim: (mutation.crumb.message || '').includes('>'),
              value: mutation.crumb.message || ''
            })]
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(CodeContainer, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_htmlCode__WEBPACK_IMPORTED_MODULE_3__["default"], {
            code: mutation.html
          })
        })]
      })]
    }, i))
  });
}

DomMutations.displayName = "DomMutations";

const MutationList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('ul',  true ? {
  target: "e14cz4cy10"
} : 0)("list-style:none;position:relative;height:100%;overflow-y:auto;border:1px solid ", p => p.theme.border, ";border-radius:", p => p.theme.borderRadius, ";padding-left:0;margin-bottom:0;" + ( true ? "" : 0));

const MutationListItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('li',  true ? {
  target: "e14cz4cy9"
} : 0)("display:flex;align-items:start;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(2), ";&:hover{background-color:", p => p.theme.backgroundSecondary, ";}" + ( true ? "" : 0));

const MutationItemContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e14cz4cy8"
} : 0)( true ? {
  name: "18j1er7",
  styles: "display:grid;grid-template-columns:280px 1fr"
} : 0);

const MutationMetadata = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e14cz4cy7"
} : 0)("display:flex;align-items:start;column-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";" + ( true ? "" : 0));
/**
 * Taken `from events/interfaces/.../breadcrumbs/types`
 */


const IconWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e14cz4cy6"
} : 0)("display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;color:", p => p.theme.white, ";background:", p => {
  var _p$theme$p$color;

  return (_p$theme$p$color = p.theme[p.color]) !== null && _p$theme$p$color !== void 0 ? _p$theme$p$color : p.color;
}, ";box-shadow:", p => p.theme.dropShadowLightest, ";z-index:1;" + ( true ? "" : 0));

const UnstyledButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('button',  true ? {
  target: "e14cz4cy5"
} : 0)( true ? {
  name: "leu7je",
  styles: "background:none;border:none;padding:0"
} : 0);

const MutationDetails = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e14cz4cy4"
} : 0)("margin-left:30px;margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(0.5), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(3), ";" + ( true ? "" : 0));

const TitleContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e14cz4cy3"
} : 0)("display:flex;justify-content:space-between;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";" + ( true ? "" : 0));

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e14cz4cy2"
} : 0)(p => p.theme.overflowEllipsis, ";text-transform:capitalize;color:", p => p.theme.gray400, ";font-weight:bold;line-height:", p => p.theme.text.lineHeightBody, ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(0.5), ";" + ( true ? "" : 0));

const CodeContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e14cz4cy1"
} : 0)( true ? {
  name: "1o88dcq",
  styles: "overflow:auto;max-height:400px;max-width:100%"
} : 0);

const StepConnector = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e14cz4cy0"
} : 0)("position:absolute;height:100%;top:28px;left:31px;border-right:1px ", p => p.theme.border, " dashed;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DomMutations);

/***/ }),

/***/ "./app/views/replays/detail/focusArea.tsx":
/*!************************************************!*\
  !*** ./app/views/replays/detail/focusArea.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/acl/featureDisabled */ "./app/components/acl/featureDisabled.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/replays/replayContext */ "./app/components/replays/replayContext.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_types_breadcrumbs__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/types/breadcrumbs */ "./app/types/breadcrumbs.tsx");
/* harmony import */ var sentry_utils_replays_hooks_useActiveReplayTab__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/replays/hooks/useActiveReplayTab */ "./app/utils/replays/hooks/useActiveReplayTab.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var sentry_views_replays_detail_console__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/replays/detail/console */ "./app/views/replays/detail/console/index.tsx");
/* harmony import */ var sentry_views_replays_detail_domMutations__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/replays/detail/domMutations */ "./app/views/replays/detail/domMutations/index.tsx");
/* harmony import */ var sentry_views_replays_detail_issueList__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/replays/detail/issueList */ "./app/views/replays/detail/issueList.tsx");
/* harmony import */ var sentry_views_replays_detail_memoryChart__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/replays/detail/memoryChart */ "./app/views/replays/detail/memoryChart.tsx");
/* harmony import */ var sentry_views_replays_detail_network__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/replays/detail/network */ "./app/views/replays/detail/network/index.tsx");
/* harmony import */ var sentry_views_replays_detail_trace__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/replays/detail/trace */ "./app/views/replays/detail/trace.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


















function getBreadcrumbsByCategory(breadcrumbs, categories) {
  return breadcrumbs.filter(sentry_types_breadcrumbs__WEBPACK_IMPORTED_MODULE_7__.isBreadcrumbTypeDefault).filter(breadcrumb => categories.includes(breadcrumb.category || ''));
}

function FocusArea(_ref) {
  let {} = _ref;
  const {
    getActiveTab
  } = (0,sentry_utils_replays_hooks_useActiveReplayTab__WEBPACK_IMPORTED_MODULE_8__["default"])();
  const {
    currentTime,
    currentHoverTime,
    replay,
    setCurrentTime,
    setCurrentHoverTime
  } = (0,sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_5__.useReplayContext)();
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_9__["default"])(); // Memoize this because re-renders will interfere with the mouse state of the
  // chart (e.g. on mouse over and out)

  const memorySpans = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    return replay === null || replay === void 0 ? void 0 : replay.getRawSpans().filter(replay.isMemorySpan);
  }, [replay]);

  if (!replay || !memorySpans) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_4__["default"], {
      height: "150px"
    });
  }

  const replayRecord = replay.getReplay();
  const startTimestampMs = replayRecord.startedAt.getTime();

  const getNetworkSpans = () => {
    return replay.getRawSpans().filter(replay.isNetworkSpan);
  };

  switch (getActiveTab()) {
    case 'console':
      const consoleMessages = getBreadcrumbsByCategory(replay === null || replay === void 0 ? void 0 : replay.getRawCrumbs(), ['console', 'exception']);
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_views_replays_detail_console__WEBPACK_IMPORTED_MODULE_10__["default"], {
        breadcrumbs: consoleMessages !== null && consoleMessages !== void 0 ? consoleMessages : [],
        startTimestampMs: replayRecord.startedAt.getTime()
      });

    case 'network':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_views_replays_detail_network__WEBPACK_IMPORTED_MODULE_14__["default"], {
        replayRecord: replayRecord,
        networkSpans: getNetworkSpans()
      });

    case 'trace':
      const features = ['organizations:performance-view'];

      const renderDisabled = () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_3__["default"], {
        featureName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Performance Monitoring'),
        features: features,
        message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Requires performance monitoring.'),
        hideHelpToggle: true
      });

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_2__["default"], {
        organization: organization,
        hookName: "feature-disabled:configure-distributed-tracing",
        features: features,
        renderDisabled: renderDisabled,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_views_replays_detail_trace__WEBPACK_IMPORTED_MODULE_15__["default"], {
          organization: organization,
          replayRecord: replayRecord
        })
      });

    case 'issues':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_views_replays_detail_issueList__WEBPACK_IMPORTED_MODULE_12__["default"], {
        replayId: replayRecord.id,
        projectId: replayRecord.projectId
      });

    case 'dom':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_views_replays_detail_domMutations__WEBPACK_IMPORTED_MODULE_11__["default"], {
        replay: replay
      });

    case 'memory':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_views_replays_detail_memoryChart__WEBPACK_IMPORTED_MODULE_13__["default"], {
        currentTime: currentTime,
        currentHoverTime: currentHoverTime,
        memorySpans: memorySpans,
        setCurrentTime: setCurrentTime,
        setCurrentHoverTime: setCurrentHoverTime,
        startTimestampMs: startTimestampMs
      });

    default:
      return null;
  }
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (FocusArea);

/***/ }),

/***/ "./app/views/replays/detail/focusTabs.tsx":
/*!************************************************!*\
  !*** ./app/views/replays/detail/focusTabs.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/navTabs */ "./app/components/navTabs.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_replays_hooks_useActiveReplayTab__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/replays/hooks/useActiveReplayTab */ "./app/utils/replays/hooks/useActiveReplayTab.tsx");
/* harmony import */ var sentry_utils_useLocation__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/useLocation */ "./app/utils/useLocation.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







const ReplayTabs = {
  console: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Console'),
  dom: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('DOM Events'),
  network: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Network'),
  trace: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Trace'),
  issues: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Issues'),
  memory: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Memory')
};

function FocusTabs(_ref) {
  let {} = _ref;
  const {
    pathname,
    query
  } = (0,sentry_utils_useLocation__WEBPACK_IMPORTED_MODULE_5__.useLocation)();
  const {
    getActiveTab,
    setActiveTab
  } = (0,sentry_utils_replays_hooks_useActiveReplayTab__WEBPACK_IMPORTED_MODULE_4__["default"])();
  const activeTab = getActiveTab();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_2__["default"], {
    underlined: true,
    children: Object.entries(ReplayTabs).map(_ref2 => {
      let [tab, label] = _ref2;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("li", {
        className: activeTab === tab ? 'active' : '',
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("a", {
          href: `${pathname}?${query_string__WEBPACK_IMPORTED_MODULE_1__.stringify({ ...query,
            t_main: tab
          })}`,
          onClick: e => {
            setActiveTab(tab);
            e.preventDefault();
          },
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("span", {
            children: label
          })
        })
      }, tab);
    })
  });
}

FocusTabs.displayName = "FocusTabs";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (FocusTabs);

/***/ }),

/***/ "./app/views/replays/detail/issueList.tsx":
/*!************************************************!*\
  !*** ./app/views/replays/detail/issueList.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_keyBy__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/keyBy */ "../node_modules/lodash/keyBy.js");
/* harmony import */ var lodash_keyBy__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_keyBy__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_components_eventOrGroupExtraDetails__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/eventOrGroupExtraDetails */ "./app/components/eventOrGroupExtraDetails.tsx");
/* harmony import */ var sentry_components_eventOrGroupHeader__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/eventOrGroupHeader */ "./app/components/eventOrGroupHeader.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_components_stream_group__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/stream/group */ "./app/components/stream/group.tsx");
/* harmony import */ var sentry_components_stream_groupChart__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/stream/groupChart */ "./app/components/stream/groupChart.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_discover_discoverQuery__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/discover/discoverQuery */ "./app/utils/discover/discoverQuery.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_useLocation__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/useLocation */ "./app/utils/useLocation.tsx");
/* harmony import */ var sentry_utils_useMedia__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/useMedia */ "./app/utils/useMedia.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var sentry_utils_usePageFilters__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/usePageFilters */ "./app/utils/usePageFilters.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }





















const columns = [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Issue'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Graph'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Events'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Users')];

function IssueList(props) {
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_18__["default"])();
  const location = (0,sentry_utils_useLocation__WEBPACK_IMPORTED_MODULE_16__.useLocation)();
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_15__["default"])();
  const {
    selection
  } = (0,sentry_utils_usePageFilters__WEBPACK_IMPORTED_MODULE_19__["default"])();
  const isScreenLarge = (0,sentry_utils_useMedia__WEBPACK_IMPORTED_MODULE_17__["default"])(`(min-width: ${sentry_utils_theme__WEBPACK_IMPORTED_MODULE_14__["default"].breakpoints.large})`);
  const [loadingIssueData, setLoadingIssueData] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(false);
  const [issuesById, setIssuesById] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)({});
  const [issueStatsById, setIssuesStatsById] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)({});

  const getEventView = () => {
    const eventQueryParams = {
      id: '',
      name: '',
      version: 2,
      fields: ['count(issue)', 'issue'],
      environment: selection.environments,
      projects: selection.projects,
      query: `replayId:${props.replayId} AND event.type:error`
    };
    const result = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_13__["default"].fromNewQueryWithLocation(eventQueryParams, location);
    return result;
  };

  const fetchIssueData = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(async () => {
    let issues;
    setLoadingIssueData(true);

    try {
      issues = await api.requestPromise(`/organizations/${organization.slug}/issues/`, {
        includeAllArgs: true,
        query: {
          project: props.projectId,
          query: `replayId:${props.replayId}`
        }
      });
      setIssuesById(lodash_keyBy__WEBPACK_IMPORTED_MODULE_3___default()(issues[0], 'id'));
    } catch (error) {
      setIssuesById({});
      setLoadingIssueData(false);
      return;
    }

    try {
      var _issues$;

      const issuesResults = await api.requestPromise(`/organizations/${organization.slug}/issues-stats/`, {
        includeAllArgs: true,
        query: {
          project: props.projectId,
          groups: (_issues$ = issues[0]) === null || _issues$ === void 0 ? void 0 : _issues$.map(issue => issue.id),
          query: `replayId:${props.replayId}`
        }
      });
      setIssuesStatsById(lodash_keyBy__WEBPACK_IMPORTED_MODULE_3___default()(issuesResults[0], 'id'));
    } catch (error) {
      setIssuesStatsById({});
    } finally {
      setLoadingIssueData(false);
    }
  }, [api, organization.slug, props.replayId, props.projectId]);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    fetchIssueData();
  }, [fetchIssueData]);

  const renderTableRow = error => {
    const matchedIssue = issuesById[error['issue.id']];
    const matchedIssueStats = issueStatsById[error['issue.id']];

    if (!matchedIssue) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(IssueDetailsWrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_eventOrGroupHeader__WEBPACK_IMPORTED_MODULE_5__["default"], {
          includeLink: true,
          data: matchedIssue,
          organization: organization,
          size: "normal"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_eventOrGroupExtraDetails__WEBPACK_IMPORTED_MODULE_4__["default"], {
          data: { ...matchedIssue,
            firstSeen: (matchedIssueStats === null || matchedIssueStats === void 0 ? void 0 : matchedIssueStats.firstSeen) || '',
            lastSeen: (matchedIssueStats === null || matchedIssueStats === void 0 ? void 0 : matchedIssueStats.lastSeen) || ''
          }
        })]
      }), isScreenLarge && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(ChartWrapper, {
        children: matchedIssueStats !== null && matchedIssueStats !== void 0 && matchedIssueStats.stats ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_stream_groupChart__WEBPACK_IMPORTED_MODULE_9__["default"], {
          statsPeriod: sentry_components_stream_group__WEBPACK_IMPORTED_MODULE_8__.DEFAULT_STREAM_GROUP_STATS_PERIOD,
          data: matchedIssueStats,
          showSecondaryPoints: true,
          showMarkLine: true
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_7__["default"], {
          height: "44px"
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(Item, {
        children: matchedIssueStats !== null && matchedIssueStats !== void 0 && matchedIssueStats.count ? matchedIssueStats === null || matchedIssueStats === void 0 ? void 0 : matchedIssueStats.count : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_7__["default"], {
          height: "24px"
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(Item, {
        children: matchedIssueStats !== null && matchedIssueStats !== void 0 && matchedIssueStats.userCount ? matchedIssueStats === null || matchedIssueStats === void 0 ? void 0 : matchedIssueStats.userCount : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_7__["default"], {
          height: "24px"
        })
      })]
    }, matchedIssue.id);
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_utils_discover_discoverQuery__WEBPACK_IMPORTED_MODULE_12__["default"], {
    eventView: getEventView(),
    location: location,
    orgSlug: organization.slug,
    limit: 15,
    children: data => {
      var _data$tableData, _data$tableData2;

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(StyledPanelTable, {
        isEmpty: ((_data$tableData = data.tableData) === null || _data$tableData === void 0 ? void 0 : _data$tableData.data.length) === 0,
        emptyMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('No related Issues found.'),
        isLoading: data.isLoading || loadingIssueData,
        headers: isScreenLarge ? columns : columns.filter(column => column !== (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Graph')),
        children: ((_data$tableData2 = data.tableData) === null || _data$tableData2 === void 0 ? void 0 : _data$tableData2.data.map(renderTableRow)) || null
      });
    }
  });
}

IssueList.displayName = "IssueList";

const ChartWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "epxicfm3"
} : 0)("width:200px;margin-left:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(2), ";padding-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(0), ";" + ( true ? "" : 0));

const Item = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "epxicfm2"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const IssueDetailsWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "epxicfm1"
} : 0)( true ? {
  name: "p03qob",
  styles: "overflow:hidden;line-height:normal"
} : 0);

const StyledPanelTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelTable,  true ? {
  target: "epxicfm0"
} : 0)("overflow:visible;grid-template-columns:minmax(1fr, max-content) repeat(3, max-content);@media (max-width: ", p => p.theme.breakpoints.large, "){grid-template-columns:minmax(0, 1fr) repeat(2, max-content);}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (IssueList);

/***/ }),

/***/ "./app/views/replays/detail/layout/chooseLayout.tsx":
/*!**********************************************************!*\
  !*** ./app/views/replays/detail/layout/chooseLayout.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/forms/compactSelect */ "./app/components/forms/compactSelect.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_replays_hooks_useReplayLayout__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/replays/hooks/useReplayLayout */ "./app/utils/replays/hooks/useReplayLayout.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






const layoutToLabel = {
  topbar: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Player Top'),
  sidebar_left: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Player Left'),
  sidebar_right: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Player Right')
};
const layoutToDir = {
  topbar: 'up',
  sidebar_left: 'left',
  sidebar_right: 'right'
};

function getLayoutIcon(layout) {
  const dir = layout in layoutToDir ? layoutToDir[layout] : 'up';
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_2__.IconPanel, {
    size: "sm",
    direction: dir
  });
}

getLayoutIcon.displayName = "getLayoutIcon";

function ChooseLayout(_ref) {
  let {} = _ref;
  const {
    getLayout,
    setLayout
  } = (0,sentry_utils_replays_hooks_useReplayLayout__WEBPACK_IMPORTED_MODULE_4__["default"])();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_1__["default"], {
    triggerProps: {
      size: 'xs',
      icon: getLayoutIcon(getLayout())
    },
    triggerLabel: "",
    value: getLayout(),
    placement: "bottom right",
    onChange: opt => setLayout(opt === null || opt === void 0 ? void 0 : opt.value),
    options: Object.entries(layoutToLabel).map(_ref2 => {
      let [value, label] = _ref2;
      return {
        value,
        label,
        leadingItems: getLayoutIcon(value)
      };
    })
  });
}

ChooseLayout.displayName = "ChooseLayout";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ChooseLayout);

/***/ }),

/***/ "./app/views/replays/detail/layout/fluidPanel.tsx":
/*!********************************************************!*\
  !*** ./app/views/replays/detail/layout/fluidPanel.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }




function FluidPanel(_ref) {
  let {
    className,
    children,
    bottom,
    title,
    bodyRef
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxs)(FluidContainer, {
    className: className,
    children: [title, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)(OverflowBody, {
      ref: bodyRef,
      children: children
    }), bottom]
  });
}

FluidPanel.displayName = "FluidPanel";

const FluidContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('section',  true ? {
  target: "e1p38l3b1"
} : 0)( true ? {
  name: "xoc9ou",
  styles: "display:grid;grid-template-rows:auto 1fr auto;height:100%"
} : 0);

const OverflowBody = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1p38l3b0"
} : 0)( true ? {
  name: "1vsyufa",
  styles: "height:100%;overflow:auto"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (FluidPanel);

/***/ }),

/***/ "./app/views/replays/detail/layout/index.tsx":
/*!***************************************************!*\
  !*** ./app/views/replays/detail/layout/index.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/errorBoundary */ "./app/components/errorBoundary.tsx");
/* harmony import */ var sentry_components_replays_breadcrumbs_replayTimeline__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/replays/breadcrumbs/replayTimeline */ "./app/components/replays/breadcrumbs/replayTimeline.tsx");
/* harmony import */ var sentry_components_replays_replayView__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/replays/replayView */ "./app/components/replays/replayView.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_replays_hooks_useFullscreen__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/replays/hooks/useFullscreen */ "./app/utils/replays/hooks/useFullscreen.tsx");
/* harmony import */ var sentry_utils_replays_hooks_useReplayLayout__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/replays/hooks/useReplayLayout */ "./app/utils/replays/hooks/useReplayLayout.tsx");
/* harmony import */ var sentry_utils_replays_hooks_useUrlParams__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/replays/hooks/useUrlParams */ "./app/utils/replays/hooks/useUrlParams.tsx");
/* harmony import */ var sentry_views_replays_detail_breadcrumbs__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/views/replays/detail/breadcrumbs */ "./app/views/replays/detail/breadcrumbs/index.tsx");
/* harmony import */ var sentry_views_replays_detail_focusArea__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/replays/detail/focusArea */ "./app/views/replays/detail/focusArea.tsx");
/* harmony import */ var sentry_views_replays_detail_focusTabs__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/replays/detail/focusTabs */ "./app/views/replays/detail/focusTabs.tsx");
/* harmony import */ var sentry_views_replays_detail_layout_fluidHeight__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/replays/detail/layout/fluidHeight */ "./app/views/replays/detail/layout/fluidHeight.tsx");
/* harmony import */ var sentry_views_replays_detail_layout_fluidPanel__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/replays/detail/layout/fluidPanel */ "./app/views/replays/detail/layout/fluidPanel.tsx");
/* harmony import */ var sentry_views_replays_detail_layout_splitPanel__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/replays/detail/layout/splitPanel */ "./app/views/replays/detail/layout/splitPanel.tsx");
/* harmony import */ var sentry_views_replays_detail_sideTabs__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/replays/detail/sideTabs */ "./app/views/replays/detail/sideTabs.tsx");
/* harmony import */ var sentry_views_replays_detail_tagPanel__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/views/replays/detail/tagPanel */ "./app/views/replays/detail/tagPanel.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



















const MIN_VIDEO_WIDTH = {
  px: 325
};
const MIN_CONTENT_WIDTH = {
  px: 325
};
const MIN_VIDEO_HEIGHT = {
  px: 200
};
const MIN_CONTENT_HEIGHT = {
  px: 200
};
const MIN_CRUMBS_HEIGHT = {
  px: 200
};

function ReplayLayout(_ref) {
  let {
    layout = sentry_utils_replays_hooks_useReplayLayout__WEBPACK_IMPORTED_MODULE_7__.LayoutKey.topbar,
    showCrumbs = true,
    showTimeline = true,
    showVideo = true
  } = _ref;
  const {
    ref: fullscreenRef,
    toggle: toggleFullscreen
  } = (0,sentry_utils_replays_hooks_useFullscreen__WEBPACK_IMPORTED_MODULE_6__["default"])();
  const timeline = showTimeline ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_2__["default"], {
    mini: true,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_replays_breadcrumbs_replayTimeline__WEBPACK_IMPORTED_MODULE_3__["default"], {})
  }) : null;
  const video = showVideo ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(VideoSection, {
    ref: fullscreenRef,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_2__["default"], {
      mini: true,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_replays_replayView__WEBPACK_IMPORTED_MODULE_4__["default"], {
        toggleFullscreen: toggleFullscreen
      })
    })
  }) : null;
  const crumbs = showCrumbs ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_2__["default"], {
    mini: true,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_replays_detail_breadcrumbs__WEBPACK_IMPORTED_MODULE_9__["default"], {})
  }) : null;

  const content = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_2__["default"], {
    mini: true,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_replays_detail_layout_fluidPanel__WEBPACK_IMPORTED_MODULE_13__["default"], {
      title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_replays_detail_focusTabs__WEBPACK_IMPORTED_MODULE_11__["default"], {}),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_replays_detail_focusArea__WEBPACK_IMPORTED_MODULE_10__["default"], {})
    })
  });

  if (layout === 'sidebar_right') {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(BodyContent, {
      children: [timeline, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_replays_detail_layout_splitPanel__WEBPACK_IMPORTED_MODULE_14__["default"], {
        left: {
          content,
          default: '60%',
          min: MIN_CONTENT_WIDTH
        },
        right: {
          content: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(SidebarContent, {
            video: video,
            crumbs: crumbs
          }),
          min: MIN_VIDEO_WIDTH
        }
      }, layout)]
    });
  }

  if (layout === 'sidebar_left') {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(BodyContent, {
      children: [timeline, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_replays_detail_layout_splitPanel__WEBPACK_IMPORTED_MODULE_14__["default"], {
        left: {
          content: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(SidebarContent, {
            video: video,
            crumbs: crumbs
          }),
          min: MIN_VIDEO_WIDTH
        },
        right: {
          content,
          default: '60%',
          min: MIN_CONTENT_WIDTH
        }
      }, layout)]
    });
  } // layout === 'topbar' or default


  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(BodyContent, {
    children: [timeline, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_replays_detail_layout_splitPanel__WEBPACK_IMPORTED_MODULE_14__["default"], {
      top: {
        content: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_replays_detail_layout_splitPanel__WEBPACK_IMPORTED_MODULE_14__["default"], {
          left: {
            content: video,
            default: '70%',
            min: MIN_VIDEO_WIDTH
          },
          right: {
            content: crumbs
          }
        }),
        min: MIN_VIDEO_HEIGHT
      },
      bottom: {
        content,
        default: '60%',
        min: MIN_CONTENT_HEIGHT
      }
    }, layout)]
  });
}

ReplayLayout.displayName = "ReplayLayout";

function SidebarContent(_ref2) {
  let {
    video,
    crumbs
  } = _ref2;
  const {
    getParamValue
  } = (0,sentry_utils_replays_hooks_useUrlParams__WEBPACK_IMPORTED_MODULE_8__["default"])('t_side', 'video');

  if (getParamValue() === 'tags') {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_replays_detail_layout_fluidPanel__WEBPACK_IMPORTED_MODULE_13__["default"], {
      title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_replays_detail_sideTabs__WEBPACK_IMPORTED_MODULE_15__["default"], {}),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_replays_detail_tagPanel__WEBPACK_IMPORTED_MODULE_16__["default"], {})
    });
  }

  if (video && crumbs) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_replays_detail_layout_fluidPanel__WEBPACK_IMPORTED_MODULE_13__["default"], {
      title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_replays_detail_sideTabs__WEBPACK_IMPORTED_MODULE_15__["default"], {}),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_replays_detail_layout_splitPanel__WEBPACK_IMPORTED_MODULE_14__["default"], {
        top: {
          content: video,
          default: '55%',
          min: MIN_VIDEO_HEIGHT
        },
        bottom: {
          content: crumbs,
          min: MIN_CRUMBS_HEIGHT
        }
      })
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [video, crumbs]
  });
}

SidebarContent.displayName = "SidebarContent";

const BodyContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('main',  true ? {
  target: "ejsf57e1"
} : 0)("background:", p => p.theme.background, ";width:100%;height:100%;display:grid;grid-template-rows:auto 1fr;overflow:hidden;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(2), ";" + ( true ? "" : 0));

const VideoSection = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_views_replays_detail_layout_fluidHeight__WEBPACK_IMPORTED_MODULE_12__["default"],  true ? {
  target: "ejsf57e0"
} : 0)("height:100%;background:", p => p.theme.background, ";gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReplayLayout);

/***/ }),

/***/ "./app/views/replays/detail/layout/splitPanel.tsx":
/*!********************************************************!*\
  !*** ./app/views/replays/detail/layout/splitPanel.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_replays_hooks_useMouseTracking__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/replays/hooks/useMouseTracking */ "./app/utils/replays/hooks/useMouseTracking.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }







const BAR_THICKNESS = 16;
const HALF_BAR = BAR_THICKNESS / 2;
const MOUSE_RELEASE_TIMEOUT_MS = 200;

const getValFromSide = (side, field) => side && typeof side === 'object' && field in side ? side[field] : undefined;

function getSplitDefault(props) {
  if ('left' in props) {
    const a = getValFromSide(props.left, 'default');

    if (a) {
      return {
        a
      };
    }

    const b = getValFromSide(props.right, 'default');

    if (b) {
      return {
        b
      };
    }

    return {
      a: '50%'
    };
  }

  const a = getValFromSide(props.top, 'default');

  if (a) {
    return {
      a
    };
  }

  const b = getValFromSide(props.bottom, 'default');

  if (b) {
    return {
      b
    };
  }

  return {
    a: '50%'
  };
}

function getMinMax(side) {
  const ONE = {
    px: Number.MAX_SAFE_INTEGER,
    pct: 1.0
  };
  const ZERO = {
    px: 0,
    pct: 0
  };

  if (!side || typeof side !== 'object') {
    return {
      max: ONE,
      min: ZERO
    };
  }

  return {
    max: 'max' in side ? { ...ONE,
      ...side.max
    } : ONE,
    min: 'min' in side ? { ...ZERO,
      ...side.min
    } : ZERO
  };
}

function useTimeout(_ref) {
  let {
    timeMs,
    callback
  } = _ref;
  const timeoutRef = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(null);
  const saveTimeout = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(timeout => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    } // See: https://reactjs.org/docs/hooks-faq.html#is-there-something-like-instance-variables
    // @ts-expect-error


    timeoutRef.current = timeout;
  }, []);
  return {
    start: () => saveTimeout(setTimeout(callback, timeMs)),
    stop: () => saveTimeout(null)
  };
}

function SplitPanel(props) {
  const [mousedown, setMousedown] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(false);
  const [sizeCSS, setSizeCSS] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(getSplitDefault(props));
  const {
    start: startMouseIdleTimer,
    stop: stopMouseIdleTimer
  } = useTimeout({
    timeMs: MOUSE_RELEASE_TIMEOUT_MS,
    callback: () => setMousedown(false)
  });
  const handleMouseDown = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(() => {
    setMousedown(true);
    document.addEventListener('mouseup', () => {
      setMousedown(false);
      stopMouseIdleTimer();
    }, {
      once: true
    });
    startMouseIdleTimer();
  }, [startMouseIdleTimer, stopMouseIdleTimer]);
  const handlePositionChange = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(params => {
    if (mousedown && params) {
      startMouseIdleTimer();
      const {
        left,
        top,
        width,
        height
      } = params;

      if ('left' in props) {
        const priPx = left - HALF_BAR;
        const priPct = priPx / width;
        const secPx = width - priPx;
        const secPct = 1 - priPct;
        const priLim = getMinMax(props.left);
        const secLim = getMinMax(props.right);

        if (priPx < priLim.min.px || priPx > priLim.max.px || priPct < priLim.min.pct || priPct > priLim.max.pct || secPx < secLim.min.px || secPx > secLim.max.px || secPct < secLim.min.pct || secPct > secLim.max.pct) {
          return;
        }

        setSizeCSS({
          a: `${priPct * 100}%`
        });
      } else {
        const priPx = top - HALF_BAR;
        const priPct = priPx / height;
        const secPx = height - priPx;
        const secPct = 1 - priPct;
        const priLim = getMinMax(props.top);
        const secLim = getMinMax(props.bottom);

        if (priPx < priLim.min.px || priPx > priLim.max.px || priPct < priLim.min.pct || priPct > priLim.max.pct || secPx < secLim.min.px || secPx > secLim.max.px || secPct < secLim.min.pct || secPct > secLim.max.pct) {
          return;
        }

        setSizeCSS({
          a: `${priPct * 100}%`
        });
      }
    }
  }, [mousedown, props, startMouseIdleTimer]);
  const mouseTrackingProps = (0,sentry_utils_replays_hooks_useMouseTracking__WEBPACK_IMPORTED_MODULE_5__["default"])({
    onPositionChange: handlePositionChange
  });
  const activeTrackingProps = mousedown ? mouseTrackingProps : {};

  if ('left' in props) {
    const {
      left: a,
      right: b
    } = props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(SplitPanelContainer, {
      orientation: "columns",
      size: sizeCSS,
      ...activeTrackingProps,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Panel, {
        children: getValFromSide(a, 'content') || a
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Divider, {
        slideDirection: "leftright",
        mousedown: mousedown,
        onMouseDown: handleMouseDown
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Panel, {
        children: getValFromSide(b, 'content') || b
      })]
    });
  }

  const {
    top: a,
    bottom: b
  } = props;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(SplitPanelContainer, {
    orientation: "rows",
    size: sizeCSS,
    ...activeTrackingProps,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Panel, {
      children: getValFromSide(a, 'content') || a
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Divider, {
      slideDirection: "updown",
      onMouseDown: () => setMousedown(true),
      onMouseUp: () => setMousedown(false),
      mousedown: mousedown
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Panel, {
      children: getValFromSide(b, 'content') || b
    })]
  });
}

SplitPanel.displayName = "SplitPanel";

const SplitPanelContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "erzgmep2"
} : 0)("width:100%;height:100%;display:grid;overflow:auto;grid-template-", p => p.orientation, ":", p => 'a' in p.size ? p.size.a : '1fr', " auto ", p => 'a' in p.size ? '1fr' : p.size.b, ";" + ( true ? "" : 0));

const Panel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "erzgmep1"
} : 0)( true ? {
  name: "d3v9zr",
  styles: "overflow:hidden"
} : 0);

const Divider = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_ref2 => {
  let {
    mousedown: _a,
    slideDirection: _b,
    ...props
  } = _ref2;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("div", { ...props,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconGrabbable, {
      size: "sm"
    })
  });
},  true ? {
  target: "erzgmep0"
} : 0)("display:grid;place-items:center;height:100%;width:100%;", p => p.mousedown ? 'user-select: none;' : '', " :hover{background:", p => p.theme.hover, ";}", p => p.slideDirection === 'leftright' ? `
        cursor: ew-resize;
        height: 100%;
        width: ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(2)};
      ` : `
        cursor: ns-resize;
        width: 100%;
        height: ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(2)};

        & > svg {
          transform: rotate(90deg);
        }
      `, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SplitPanel);

/***/ }),

/***/ "./app/views/replays/detail/layout/utils.tsx":
/*!***************************************************!*\
  !*** ./app/views/replays/detail/layout/utils.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getDefaultLayout": () => (/* binding */ getDefaultLayout)
/* harmony export */ });
/* harmony import */ var sentry_utils_replays_hooks_useReplayLayout__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/replays/hooks/useReplayLayout */ "./app/utils/replays/hooks/useReplayLayout.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");


const getDefaultLayout = collapsed => {
  const {
    innerWidth,
    innerHeight
  } = window;
  const sidebarWidth = parseInt(collapsed ? sentry_utils_theme__WEBPACK_IMPORTED_MODULE_1__["default"].sidebar.collapsedWidth : sentry_utils_theme__WEBPACK_IMPORTED_MODULE_1__["default"].sidebar.expandedWidth, 10);
  const mediumScreenWidth = parseInt(sentry_utils_theme__WEBPACK_IMPORTED_MODULE_1__["default"].breakpoints.medium, 10);
  const windowsWidth = innerWidth <= mediumScreenWidth ? innerWidth : innerWidth - sidebarWidth;

  if (windowsWidth < innerHeight) {
    return sentry_utils_replays_hooks_useReplayLayout__WEBPACK_IMPORTED_MODULE_0__.LayoutKey.topbar;
  }

  return sentry_utils_replays_hooks_useReplayLayout__WEBPACK_IMPORTED_MODULE_0__.LayoutKey.sidebar_left;
};

/***/ }),

/***/ "./app/views/replays/detail/memoryChart.tsx":
/*!**************************************************!*\
  !*** ./app/views/replays/detail/memoryChart.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_components_charts_areaChart__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/areaChart */ "./app/components/charts/areaChart.tsx");
/* harmony import */ var sentry_components_charts_components_grid__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/components/grid */ "./app/components/charts/components/grid.tsx");
/* harmony import */ var sentry_components_charts_components_tooltip__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/components/tooltip */ "./app/components/charts/components/tooltip.tsx");
/* harmony import */ var sentry_components_charts_components_xAxis__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/charts/components/xAxis */ "./app/components/charts/components/xAxis.tsx");
/* harmony import */ var sentry_components_charts_components_yAxis__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/charts/components/yAxis */ "./app/components/charts/components/yAxis.tsx");
/* harmony import */ var sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/emptyStateWarning */ "./app/components/emptyStateWarning.tsx");
/* harmony import */ var sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/replays/utils */ "./app/components/replays/utils.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


















const formatTimestamp = timestamp => (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_14__.getFormattedDate)(timestamp * 1000, 'MMM D, YYYY hh:mm:ss A z', {
  local: false
});

function MemoryChart(_ref) {
  let {
    forwardedRef,
    memorySpans,
    startTimestampMs = 0,
    setCurrentTime,
    setCurrentHoverTime
  } = _ref;
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_15__.a)();

  if (memorySpans.length <= 0) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_9__["default"], {
      withIcon: false,
      small: true,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('No memory metrics found')
    });
  }

  const chartOptions = {
    grid: (0,sentry_components_charts_components_grid__WEBPACK_IMPORTED_MODULE_5__["default"])({
      // makes space for the title
      top: '40px',
      left: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1),
      right: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1)
    }),
    tooltip: (0,sentry_components_charts_components_tooltip__WEBPACK_IMPORTED_MODULE_6__["default"])({
      trigger: 'axis',
      formatter: values => {
        const seriesTooltips = values.map(value => `
            <div>
              <span className="tooltip-label">${value.marker}<strong>${value.seriesName}</strong></span>
          ${(0,sentry_utils__WEBPACK_IMPORTED_MODULE_13__.formatBytesBase2)(value.data[1])}
            </div>
          `); // showPlayerTime expects a timestamp so we take the captured time in seconds and convert it to a UTC timestamp

        const template = ['<div class="tooltip-series">', ...seriesTooltips, '</div>', `<div class="tooltip-date" style="display: inline-block; width: max-content;">${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Span Time')}:
            ${formatTimestamp(values[0].axisValue)}
          </div>`, `<div class="tooltip-date" style="border: none;">${'Relative Time'}:
            ${(0,sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_10__.showPlayerTime)(moment__WEBPACK_IMPORTED_MODULE_3___default()(values[0].axisValue * 1000).toDate().toUTCString(), startTimestampMs)}
          </div>`, '<div class="tooltip-arrow"></div>'].join('');
        return template;
      }
    }),
    xAxis: (0,sentry_components_charts_components_xAxis__WEBPACK_IMPORTED_MODULE_7__["default"])({
      type: 'time',
      axisLabel: {
        formatter: formatTimestamp
      },
      theme
    }),
    yAxis: (0,sentry_components_charts_components_yAxis__WEBPACK_IMPORTED_MODULE_8__["default"])({
      type: 'value',
      name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Heap Size'),
      theme,
      nameTextStyle: {
        padding: 8,
        fontSize: theme.fontSizeLarge,
        fontWeight: 600,
        lineHeight: 1.2,
        color: theme.gray300
      },
      // input is in bytes, minInterval is a megabyte
      minInterval: 1024 * 1024,
      // maxInterval is a terabyte
      maxInterval: Math.pow(1024, 4),
      // format the axis labels to be whole number values
      axisLabel: {
        formatter: value => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_13__.formatBytesBase2)(value, 0)
      }
    }),
    // XXX: For area charts, mouse events *only* occurs when interacting with
    // the "line" of the area chart. Mouse events do not fire when interacting
    // with the "area" under the line.
    onMouseOver: _ref2 => {
      let {
        data
      } = _ref2;

      if (data[0]) {
        setCurrentHoverTime(data[0] * 1000 - startTimestampMs);
      }
    },
    onMouseOut: () => {
      setCurrentHoverTime(undefined);
    },
    onClick: _ref3 => {
      let {
        data
      } = _ref3;

      if (data.value) {
        setCurrentTime(data.value * 1000 - startTimestampMs);
      }
    }
  };
  const series = [{
    seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Used Heap Memory'),
    data: memorySpans.map(span => ({
      value: span.data.memory.usedJSHeapSize,
      name: span.endTimestamp
    })),
    stack: 'heap-memory',
    lineStyle: {
      opacity: 0.75,
      width: 1
    }
  }, {
    seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Free Heap Memory'),
    data: memorySpans.map(span => ({
      value: span.data.memory.totalJSHeapSize - span.data.memory.usedJSHeapSize,
      name: span.endTimestamp
    })),
    stack: 'heap-memory',
    lineStyle: {
      opacity: 0.75,
      width: 1
    }
  }, // Inserting this here so we can update in Container
  {
    id: 'currentTime',
    seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Current player time'),
    data: [],
    markLine: {
      symbol: ['', ''],
      data: [],
      label: {
        show: false
      },
      lineStyle: {
        type: 'solid',
        color: theme.purple300,
        width: 2
      }
    }
  }, {
    id: 'hoverTime',
    seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Hover player time'),
    data: [],
    markLine: {
      symbol: ['', ''],
      data: [],
      label: {
        show: false
      },
      lineStyle: {
        type: 'solid',
        color: theme.purple200,
        width: 2
      }
    }
  }];
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(MemoryChartWrapper, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_charts_areaChart__WEBPACK_IMPORTED_MODULE_4__.AreaChart, {
      forwardedRef: forwardedRef,
      series: series,
      ...chartOptions
    })
  });
}

MemoryChart.displayName = "MemoryChart";

const MemoryChartWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1gg6p480"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(2), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(3), ";border-radius:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(0.5), ";border:1px solid ", p => p.theme.border, ";" + ( true ? "" : 0));

const MemoizedMemoryChart = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_2__.memo)( /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_2__.forwardRef)((props, ref) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(MemoryChart, {
  forwardedRef: ref,
  ...props
})));

/**
 * This container is used to update echarts outside of React. `currentTime` is
 * the current time of the player -- if replay is currently playing, this will be
 * updated quite frequently causing the chart to constantly re-render. The
 * re-renders will conflict with mouse interactions (e.g. hovers and
 * tooltips).
 *
 * We need `MemoryChart` (which wraps an `<AreaChart>`) to re-render as
 * infrequently as possible, so we use React.memo and only pass in props that
 * are not frequently updated.
 * */
function MemoryChartContainer(_ref4) {
  let {
    currentTime,
    currentHoverTime,
    startTimestampMs = 0,
    ...props
  } = _ref4;
  const chart = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(null);
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_15__.a)();
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (!chart.current) {
      return;
    }

    const echarts = chart.current.getEchartsInstance();
    echarts.setOption({
      series: [{
        id: 'currentTime',
        markLine: {
          data: [{
            xAxis: currentTime + startTimestampMs
          }]
        }
      }]
    });
  }, [currentTime, startTimestampMs, theme]);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (!chart.current) {
      return;
    }

    const echarts = chart.current.getEchartsInstance();
    echarts.setOption({
      series: [{
        id: 'hoverTime',
        markLine: {
          data: [...(currentHoverTime ? [{
            xAxis: currentHoverTime + startTimestampMs
          }] : [])]
        }
      }]
    });
  }, [currentHoverTime, startTimestampMs, theme]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(MemoizedMemoryChart, {
    ref: chart,
    startTimestampMs: startTimestampMs,
    ...props
  });
}

MemoryChartContainer.displayName = "MemoryChartContainer";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MemoryChartContainer);

/***/ }),

/***/ "./app/views/replays/detail/network/index.tsx":
/*!****************************************************!*\
  !*** ./app/views/replays/detail/network/index.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_fileSize__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/fileSize */ "./app/components/fileSize.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/replays/replayContext */ "./app/components/replays/replayContext.tsx");
/* harmony import */ var sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/replays/utils */ "./app/components/replays/utils.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_views_replays_detail_network_utils__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/replays/detail/network/utils */ "./app/views/replays/detail/network/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }















function NetworkList(_ref) {
  let {
    replayRecord,
    networkSpans
  } = _ref;
  const startTimestampMs = replayRecord.startedAt.getTime();
  const {
    setCurrentHoverTime,
    setCurrentTime
  } = (0,sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_6__.useReplayContext)();
  const [sortConfig, setSortConfig] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)({
    by: 'startTimestamp',
    asc: true,
    getValue: row => row[sortConfig.by]
  });
  const handleMouseEnter = (0,react__WEBPACK_IMPORTED_MODULE_3__.useCallback)(timestamp => {
    if (startTimestampMs) {
      setCurrentHoverTime((0,sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_7__.relativeTimeInMs)(timestamp, startTimestampMs));
    }
  }, [setCurrentHoverTime, startTimestampMs]);
  const handleMouseLeave = (0,react__WEBPACK_IMPORTED_MODULE_3__.useCallback)(() => {
    setCurrentHoverTime(undefined);
  }, [setCurrentHoverTime]);
  const handleClick = (0,react__WEBPACK_IMPORTED_MODULE_3__.useCallback)(timestamp => {
    setCurrentTime((0,sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_7__.relativeTimeInMs)(timestamp, startTimestampMs));
  }, [setCurrentTime, startTimestampMs]);
  const getColumnHandlers = (0,react__WEBPACK_IMPORTED_MODULE_3__.useCallback)(startTime => ({
    onMouseEnter: () => handleMouseEnter(startTime),
    onMouseLeave: handleMouseLeave
  }), [handleMouseEnter, handleMouseLeave]);

  function handleSort(fieldName, getValue) {
    const getValueFunction = getValue ? getValue : row => row[fieldName];
    setSortConfig(prevSort => {
      if (prevSort.by === fieldName) {
        return {
          by: fieldName,
          asc: !prevSort.asc,
          getValue: getValueFunction
        };
      }

      return {
        by: fieldName,
        asc: true,
        getValue: getValueFunction
      };
    });
  }

  const networkData = (0,react__WEBPACK_IMPORTED_MODULE_3__.useMemo)(() => (0,sentry_views_replays_detail_network_utils__WEBPACK_IMPORTED_MODULE_13__.sortNetwork)(networkSpans, sortConfig), [networkSpans, sortConfig]);

  const sortArrow = sortedBy => {
    return sortConfig.by === sortedBy ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconArrow, {
      color: "gray300",
      size: "xs",
      direction: sortConfig.by === sortedBy && !sortConfig.asc ? 'up' : 'down'
    }) : null;
  };

  const columns = [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(SortItem, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(UnstyledHeaderButton, {
      onClick: () => handleSort('status', row => row.data.statusCode),
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Status'), " ", sortArrow('status')]
    })
  }, "status"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(SortItem, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(UnstyledHeaderButton, {
      onClick: () => handleSort('description'),
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Path'), " ", sortArrow('description')]
    })
  }, "path"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(SortItem, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(UnstyledHeaderButton, {
      onClick: () => handleSort('op'),
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Type'), " ", sortArrow('op')]
    })
  }, "type"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(SortItem, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(UnstyledHeaderButton, {
      onClick: () => handleSort('size', row => row.data.size),
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Size'), " ", sortArrow('size')]
    })
  }, "size"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(SortItem, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(UnstyledHeaderButton, {
      onClick: () => handleSort('duration', row => {
        return row.endTimestamp - row.startTimestamp;
      }),
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Duration'), " ", sortArrow('duration')]
    })
  }, "duration"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(SortItem, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(UnstyledHeaderButton, {
      onClick: () => handleSort('startTimestamp'),
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Timestamp'), " ", sortArrow('startTimestamp')]
    })
  }, "timestamp")];

  const renderTableRow = (network, index) => {
    const networkStartTimestamp = network.startTimestamp * 1000;
    const networkEndTimestamp = network.endTimestamp * 1000;
    const columnHandlers = getColumnHandlers(networkStartTimestamp);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(Item, { ...columnHandlers,
        children: network.data.statusCode ? network.data.statusCode : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(EmptyText, {
          children: "---"
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(Item, { ...columnHandlers,
        children: network.description ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_8__["default"], {
          title: network.description,
          isHoverable: true,
          overlayStyle: {
            maxWidth: '500px !important'
          },
          showOnlyOnOverflow: true,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(Text, {
            children: network.description
          })
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(EmptyText, {
          children: ["(", (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Missing path'), ")"]
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(Item, { ...columnHandlers,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(Text, {
          children: network.op.replace('resource.', '')
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(Item, { ...columnHandlers,
        numeric: true,
        children: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_12__.defined)(network.data.size) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_fileSize__WEBPACK_IMPORTED_MODULE_4__["default"], {
          bytes: network.data.size
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(EmptyText, {
          children: ["(", (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Missing size'), ")"]
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(Item, { ...columnHandlers,
        numeric: true,
        children: `${(networkEndTimestamp - networkStartTimestamp).toFixed(2)}ms`
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(Item, { ...columnHandlers,
        numeric: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(UnstyledButton, {
          onClick: () => handleClick(networkStartTimestamp),
          children: (0,sentry_components_replays_utils__WEBPACK_IMPORTED_MODULE_7__.showPlayerTime)(networkStartTimestamp, startTimestampMs, true)
        })
      })]
    }, index);
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StyledPanelTable, {
    columns: columns.length,
    isEmpty: networkData.length === 0,
    emptyMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('No related network requests found.'),
    headers: columns,
    disablePadding: true,
    stickyHeaders: true,
    children: networkData.map(renderTableRow) || null
  });
}

NetworkList.displayName = "NetworkList";

const Item = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1klhpdm6"
} : 0)("display:flex;align-items:center;", p => p.center && 'justify-content: center;', " max-height:28px;color:", p => p.theme[p.color || 'subText'], ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(0.75), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(1.5), ";background-color:", p => p.theme.background, ";", p => p.numeric && 'font-variant-numeric: tabular-nums;', ";" + ( true ? "" : 0));

const UnstyledButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('button',  true ? {
  target: "e1klhpdm5"
} : 0)( true ? {
  name: "efc641",
  styles: "border:0;background:none;padding:0;text-transform:inherit;width:100%;text-align:unset"
} : 0);

const UnstyledHeaderButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(UnstyledButton,  true ? {
  target: "e1klhpdm4"
} : 0)( true ? {
  name: "1066lcq",
  styles: "display:flex;justify-content:space-between;align-items:center"
} : 0);

const StyledPanelTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__.PanelTable,  true ? {
  target: "e1klhpdm3"
} : 0)("grid-template-columns:max-content minmax(200px, 1fr) repeat(\n      4,\n      minmax(max-content, 160px)\n    );grid-template-rows:24px repeat(auto-fit, 28px);font-size:", p => p.theme.fontSizeSmall, ";margin-bottom:0;height:100%;overflow:auto;>*{border-right:1px solid ", p => p.theme.innerBorder, ";border-bottom:1px solid ", p => p.theme.innerBorder, ";&:nth-child(", p => p.columns, "n){border-right:0;text-align:right;justify-content:end;}&:nth-child(", p => p.columns, "n - 1),&:nth-child(", p => p.columns, "n - 2){text-align:right;justify-content:end;}}",
/* sc-selector */
sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__.PanelTableHeader, "{min-height:24px;border-radius:0;color:", p => p.theme.subText, ";line-height:16px;text-transform:none;&:nth-child(", p => p.columns, "n),&:nth-child(", p => p.columns, "n - 1),&:nth-child(", p => p.columns, "n - 2){justify-content:center;align-items:flex-start;text-align:start;}}" + ( true ? "" : 0));

const Text = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('p',  true ? {
  target: "e1klhpdm2"
} : 0)( true ? {
  name: "18saqg8",
  styles: "padding:0;margin:0;text-overflow:ellipsis;white-space:nowrap;overflow:hidden"
} : 0);

const EmptyText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Text,  true ? {
  target: "e1klhpdm1"
} : 0)("font-style:italic;color:", p => p.theme.subText, ";" + ( true ? "" : 0));

const SortItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1klhpdm0"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(0.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(1.5), ";width:100%;svg{margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(0.25), ";}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (NetworkList);

/***/ }),

/***/ "./app/views/replays/detail/network/utils.tsx":
/*!****************************************************!*\
  !*** ./app/views/replays/detail/network/utils.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "sortNetwork": () => (/* binding */ sortNetwork)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);

function sortNetwork(network, sortConfig) {
  return [...network].sort((a, b) => {
    let valueA = sortConfig.getValue(a);
    let valueB = sortConfig.getValue(b);
    valueA = typeof valueA === 'string' ? valueA.toUpperCase() : valueA;
    valueB = typeof valueB === 'string' ? valueB.toUpperCase() : valueB;

    if (valueA === valueB) {
      return 0;
    }

    if (sortConfig.asc) {
      return valueA > valueB ? 1 : -1;
    }

    return valueB > valueA ? 1 : -1;
  });
}

/***/ }),

/***/ "./app/views/replays/detail/page.tsx":
/*!*******************************************!*\
  !*** ./app/views/replays/detail/page.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_featureFeedback__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/featureFeedback */ "./app/components/featureFeedback/index.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_replays_header_detailsPageBreadcrumbs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/replays/header/detailsPageBreadcrumbs */ "./app/components/replays/header/detailsPageBreadcrumbs.tsx");
/* harmony import */ var sentry_components_replays_walker_urlWalker__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/replays/walker/urlWalker */ "./app/components/replays/walker/urlWalker.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_replays_detail_layout_chooseLayout__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/views/replays/detail/layout/chooseLayout */ "./app/views/replays/detail/layout/chooseLayout.tsx");
/* harmony import */ var sentry_views_replays_detail_replayMetaData__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/views/replays/detail/replayMetaData */ "./app/views/replays/detail/replayMetaData.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }












function Page(_ref) {
  let {
    children,
    crumbs,
    orgSlug,
    replayRecord
  } = _ref;
  const title = replayRecord ? `${replayRecord.id} - Replays - ${orgSlug}` : `Replays - ${orgSlug}`;

  const header = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(Header, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(HeaderContent, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_replays_header_detailsPageBreadcrumbs__WEBPACK_IMPORTED_MODULE_3__["default"], {
        orgSlug: orgSlug,
        replayRecord: replayRecord
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(ButtonActionsWrapper, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_featureFeedback__WEBPACK_IMPORTED_MODULE_1__.FeatureFeedback, {
        featureName: "replay",
        buttonProps: {
          size: 'xs'
        }
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_views_replays_detail_layout_chooseLayout__WEBPACK_IMPORTED_MODULE_7__["default"], {})]
    }), replayRecord && crumbs ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_replays_walker_urlWalker__WEBPACK_IMPORTED_MODULE_4__.CrumbWalker, {
      replayRecord: replayRecord,
      crumbs: crumbs
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_views_replays_detail_replayMetaData__WEBPACK_IMPORTED_MODULE_8__.HeaderPlaceholder, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(MetaDataColumn, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_views_replays_detail_replayMetaData__WEBPACK_IMPORTED_MODULE_8__["default"], {
        replayRecord: replayRecord
      })
    })]
  });

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_5__["default"], {
    title: title,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(FullViewport, {
      children: [header, children]
    })
  });
}

Page.displayName = "Page";

const Header = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_2__.Header,  true ? {
  target: "ej4dyy04"
} : 0)("@media (min-width: ", p => p.theme.breakpoints.medium, "){padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(2), ";}" + ( true ? "" : 0));

const HeaderContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_2__.HeaderContent,  true ? {
  target: "ej4dyy03"
} : 0)( true ? {
  name: "1ykowef",
  styles: "margin-bottom:0"
} : 0); // TODO(replay); This could make a lot of sense to put inside HeaderActions by default


const ButtonActionsWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_2__.HeaderActions,  true ? {
  target: "ej4dyy02"
} : 0)("display:grid;grid-template-columns:repeat(2, max-content);justify-content:flex-end;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1), ";" + ( true ? "" : 0));

const MetaDataColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_2__.HeaderActions,  true ? {
  target: "ej4dyy01"
} : 0)("padding-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(3), ";align-self:end;" + ( true ? "" : 0));

const FullViewport = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ej4dyy00"
} : 0)( true ? {
  name: "tp5jy2",
  styles: "height:100vh;width:100%;display:grid;grid-template-rows:auto 1fr;overflow:hidden;~footer{display:none;}"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Page);

/***/ }),

/***/ "./app/views/replays/detail/replayMetaData.tsx":
/*!*****************************************************!*\
  !*** ./app/views/replays/detail/replayMetaData.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "HeaderPlaceholder": () => (/* binding */ HeaderPlaceholder),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_duration__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/duration */ "./app/components/duration.tsx");
/* harmony import */ var sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/idBadge/projectBadge */ "./app/components/idBadge/projectBadge.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/useProjects */ "./app/utils/useProjects.tsx");
/* harmony import */ var sentry_utils_useRouteContext__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/useRouteContext */ "./app/utils/useRouteContext.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");














function ReplayMetaData(_ref) {
  let {
    replayRecord
  } = _ref;
  const {
    params: {
      replaySlug
    }
  } = (0,sentry_utils_useRouteContext__WEBPACK_IMPORTED_MODULE_10__.useRouteContext)();
  const {
    projects
  } = (0,sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_9__["default"])();
  const [slug] = replaySlug.split(':');
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(KeyMetrics, {
    children: [replayRecord ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_4__["default"], {
      project: projects.find(p => p.id === replayRecord.projectId) || {
        slug
      },
      avatarSize: 16
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(HeaderPlaceholder, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(KeyMetricData, {
      children: replayRecord ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconCalendar, {
          color: "gray300"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_6__["default"], {
          date: replayRecord.startedAt,
          shorten: true
        })]
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(HeaderPlaceholder, {})
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(KeyMetricData, {
      children: replayRecord ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconClock, {
          color: "gray300"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_duration__WEBPACK_IMPORTED_MODULE_3__["default"], {
          seconds: Math.floor(msToSec((replayRecord === null || replayRecord === void 0 ? void 0 : replayRecord.duration) || 0)) || 1,
          abbreviation: true,
          exact: true
        })]
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(HeaderPlaceholder, {})
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(KeyMetricData, {
      children: replayRecord ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconFire, {
          color: "red300"
        }), replayRecord === null || replayRecord === void 0 ? void 0 : replayRecord.countErrors]
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(HeaderPlaceholder, {})
    })]
  });
}

ReplayMetaData.displayName = "ReplayMetaData";

function msToSec(ms) {
  return ms / 1000;
}

const HeaderPlaceholder = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(function HeaderPlaceholder(props) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_5__["default"], {
    width: "80px",
    height: "19px",
    ...props
  });
},  true ? {
  target: "egu94qd2"
} : 0)("background-color:", p => p.theme.background, ";" + ( true ? "" : 0));

const KeyMetrics = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "egu94qd1"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(3), ";grid-template-columns:repeat(4, max-content);align-items:center;justify-content:end;font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

const KeyMetricData = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "egu94qd0"
} : 0)("color:", p => p.theme.textColor, ";font-weight:normal;display:grid;grid-template-columns:repeat(2, max-content);align-items:center;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";line-height:", p => p.theme.text.lineHeightBody, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReplayMetaData);

/***/ }),

/***/ "./app/views/replays/detail/sideTabs.tsx":
/*!***********************************************!*\
  !*** ./app/views/replays/detail/sideTabs.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/navTabs */ "./app/components/navTabs.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_replays_hooks_useUrlParams__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/replays/hooks/useUrlParams */ "./app/utils/replays/hooks/useUrlParams.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





const TABS = {
  video: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Replay'),
  tags: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Tags')
};

function SideTabs(_ref) {
  let {} = _ref;
  const {
    getParamValue,
    setParamValue
  } = (0,sentry_utils_replays_hooks_useUrlParams__WEBPACK_IMPORTED_MODULE_3__["default"])('t_side', 'video');
  const active = getParamValue();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_1__["default"], {
    underlined: true,
    children: Object.entries(TABS).map(_ref2 => {
      let [tab, label] = _ref2;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("li", {
        className: active === tab ? 'active' : '',
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("a", {
          onClick: () => setParamValue(tab),
          children: label
        })
      }, tab);
    })
  });
}

SideTabs.displayName = "SideTabs";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SideTabs);

/***/ }),

/***/ "./app/views/replays/detail/tagPanel.tsx":
/*!***********************************************!*\
  !*** ./app/views/replays/detail/tagPanel.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_keyValueTable__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/keyValueTable */ "./app/components/keyValueTable.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/replays/replayContext */ "./app/components/replays/replayContext.tsx");
/* harmony import */ var sentry_components_tagsTableRow__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/tagsTableRow */ "./app/components/tagsTableRow.tsx");
/* harmony import */ var sentry_views_replays_detail_layout_fluidPanel__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/views/replays/detail/layout/fluidPanel */ "./app/views/replays/detail/layout/fluidPanel.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }










function TagPanel() {
  const {
    replay
  } = (0,sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_6__.useReplayContext)();
  const replayRecord = replay === null || replay === void 0 ? void 0 : replay.getReplay();

  if (!replayRecord) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_5__["default"], {
      height: "100%"
    });
  }

  const query = '';

  const generateUrl = () => '';

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(Panel, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_views_replays_detail_layout_fluidPanel__WEBPACK_IMPORTED_MODULE_8__["default"], {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_keyValueTable__WEBPACK_IMPORTED_MODULE_3__.KeyValueTable, {
        children: Object.entries(replayRecord.tags).map(_ref => {
          let [key, value] = _ref;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_tagsTableRow__WEBPACK_IMPORTED_MODULE_7__["default"], {
            tag: {
              key,
              value
            },
            query: query,
            generateUrl: generateUrl
          }, key);
        })
      })
    })
  });
}

TagPanel.displayName = "TagPanel";

const Panel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__.Panel,  true ? {
  target: "e19pdh1d0"
} : 0)( true ? {
  name: "eu54nu",
  styles: "width:100%;height:100%;overflow:hidden;margin-bottom:0"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TagPanel);

/***/ }),

/***/ "./app/views/replays/detail/trace.tsx":
/*!********************************************!*\
  !*** ./app/views/replays/detail/trace.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Trace)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/emptyStateWarning */ "./app/components/emptyStateWarning.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/constants/pageFilters */ "./app/constants/pageFilters.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/discover/genericDiscoverQuery */ "./app/utils/discover/genericDiscoverQuery.tsx");
/* harmony import */ var sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/performance/quickTrace/utils */ "./app/utils/performance/quickTrace/utils.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_useRouteContext__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/useRouteContext */ "./app/utils/useRouteContext.tsx");
/* harmony import */ var sentry_views_performance_traceDetails_traceView__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/performance/traceDetails/traceView */ "./app/views/performance/traceDetails/traceView.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");















const INITIAL_STATE = Object.freeze({
  error: null,
  isLoading: true,
  pageLinks: null,
  traceEventView: null,
  traces: null
});
function Trace(_ref) {
  var _state$traces;

  let {
    replayRecord,
    organization
  } = _ref;
  const [state, setState] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(INITIAL_STATE);
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_11__["default"])();
  const {
    location,
    params: {
      replaySlug,
      orgSlug
    }
  } = (0,sentry_utils_useRouteContext__WEBPACK_IMPORTED_MODULE_12__.useRouteContext)();
  const [, eventId] = replaySlug.split(':');
  const start = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_7__.getUtcDateString)(replayRecord.startedAt.getTime());
  const end = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_7__.getUtcDateString)(replayRecord.finishedAt.getTime());
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    async function loadTraces() {
      const eventView = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_8__["default"].fromSavedQuery({
        id: undefined,
        name: `Traces in replay ${eventId}`,
        fields: ['trace', 'count(trace)', 'min(timestamp)'],
        orderby: 'min_timestamp',
        query: `replayId:${eventId} !title:"sentry-replay-event*"`,
        projects: [sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_5__.ALL_ACCESS_PROJECTS],
        version: 2,
        start,
        end
      });

      try {
        const [data,, resp] = await (0,sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_9__.doDiscoverQuery)(api, `/organizations/${orgSlug}/events/`, eventView.getEventsAPIPayload(location));
        const traceIds = data.data.map(_ref2 => {
          let {
            trace
          } = _ref2;
          return trace;
        }).filter(trace => trace); // TODO(replays): Potential performance concerns here if number of traceIds is large

        const traceDetails = await Promise.all(traceIds.map(traceId => (0,sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_9__.doDiscoverQuery)(api, `/organizations/${orgSlug}/events-trace/${traceId}/`, (0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_10__.getTraceRequestPayload)({
          eventView: (0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_10__.makeEventView)({
            start,
            end
          }),
          location
        }))));
        setState(prevState => {
          var _resp$getResponseHead;

          return {
            isLoading: false,
            error: null,
            traceEventView: eventView,
            pageLinks: (_resp$getResponseHead = resp === null || resp === void 0 ? void 0 : resp.getResponseHeader('Link')) !== null && _resp$getResponseHead !== void 0 ? _resp$getResponseHead : prevState.pageLinks,
            traces: traceDetails.flatMap(_ref3 => {
              let [trace] = _ref3;
              return trace;
            }) || []
          };
        });
      } catch (err) {
        setState({
          isLoading: false,
          error: err,
          pageLinks: null,
          traceEventView: null,
          traces: null
        });
      }
    }

    loadTraces();
    return () => {};
  }, [api, eventId, orgSlug, location, start, end]);

  if (state.isLoading) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_4__["default"], {});
  }

  if (state.error || !state.traceEventView) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_3__["default"], {});
  }

  if (!((_state$traces = state.traces) !== null && _state$traces !== void 0 && _state$traces.length)) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_2__["default"], {
      withIcon: false,
      small: true,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('No traces found')
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_views_performance_traceDetails_traceView__WEBPACK_IMPORTED_MODULE_13__["default"], {
    meta: null,
    traces: state.traces,
    location: location,
    organization: organization,
    traceEventView: state.traceEventView,
    traceSlug: "Replay"
  }); // TODO(replays): pagination
}
Trace.displayName = "Trace";

/***/ }),

/***/ "./app/views/replays/details.tsx":
/*!***************************************!*\
  !*** ./app/views/replays/details.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_errors_detailedError__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/errors/detailedError */ "./app/components/errors/detailedError.tsx");
/* harmony import */ var sentry_components_errors_notFound__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/errors/notFound */ "./app/components/errors/notFound.tsx");
/* harmony import */ var sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/replays/replayContext */ "./app/components/replays/replayContext.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_organization__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/organization */ "./app/styles/organization.tsx");
/* harmony import */ var sentry_utils_replays_hooks_useReplayData__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/replays/hooks/useReplayData */ "./app/utils/replays/hooks/useReplayData.tsx");
/* harmony import */ var sentry_utils_replays_hooks_useReplayLayout__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/replays/hooks/useReplayLayout */ "./app/utils/replays/hooks/useReplayLayout.tsx");
/* harmony import */ var sentry_views_replays_detail_layout__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/views/replays/detail/layout */ "./app/views/replays/detail/layout/index.tsx");
/* harmony import */ var sentry_views_replays_detail_page__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/views/replays/detail/page */ "./app/views/replays/detail/page.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













function ReplayDetails(_ref) {
  let {
    location: {
      query: {
        t: initialTimeOffset // Time, in seconds, where the video should start

      }
    },
    params: {
      orgSlug,
      replaySlug
    }
  } = _ref;
  const {
    fetching,
    onRetry,
    replay
  } = (0,sentry_utils_replays_hooks_useReplayData__WEBPACK_IMPORTED_MODULE_6__["default"])({
    replaySlug,
    orgSlug
  });

  if (!fetching && !replay) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_views_replays_detail_page__WEBPACK_IMPORTED_MODULE_9__["default"], {
      orgSlug: orgSlug,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_5__.PageContent, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_errors_notFound__WEBPACK_IMPORTED_MODULE_2__["default"], {})
      })
    });
  }

  if (!fetching && replay && replay.getRRWebEvents().length < 2) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_views_replays_detail_page__WEBPACK_IMPORTED_MODULE_9__["default"], {
      orgSlug: orgSlug,
      replayRecord: replay.getReplay(),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_errors_detailedError__WEBPACK_IMPORTED_MODULE_1__["default"], {
        onRetry: onRetry,
        hideSupportLinks: true,
        heading: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Expected two or more replay events'),
        message: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("p", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('This Replay may not have captured any user actions.')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("p", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Or there may be an issue loading the actions from the server, click to try loading the Replay again.')
          })]
        })
      })
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_3__.Provider, {
    replay: replay,
    initialTimeOffset: initialTimeOffset,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(LoadedDetails, {
      orgSlug: orgSlug
    })
  });
}

ReplayDetails.displayName = "ReplayDetails";

function LoadedDetails(_ref2) {
  let {
    orgSlug
  } = _ref2;
  const {
    getLayout
  } = (0,sentry_utils_replays_hooks_useReplayLayout__WEBPACK_IMPORTED_MODULE_7__["default"])();
  const {
    replay
  } = (0,sentry_components_replays_replayContext__WEBPACK_IMPORTED_MODULE_3__.useReplayContext)();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_views_replays_detail_page__WEBPACK_IMPORTED_MODULE_9__["default"], {
    orgSlug: orgSlug,
    crumbs: replay === null || replay === void 0 ? void 0 : replay.getRawCrumbs(),
    replayRecord: replay === null || replay === void 0 ? void 0 : replay.getReplay(),
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_views_replays_detail_layout__WEBPACK_IMPORTED_MODULE_8__["default"], {
      layout: getLayout()
    })
  });
}

LoadedDetails.displayName = "LoadedDetails";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReplayDetails);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_performance_transactionSummary_utils_tsx-app_views_replays_details_tsx.cd1f71d760e0362b7c79b17eec50077c.js.map