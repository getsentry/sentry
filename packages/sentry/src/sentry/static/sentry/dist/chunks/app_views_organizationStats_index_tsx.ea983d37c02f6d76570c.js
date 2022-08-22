"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_organizationStats_index_tsx"],{

/***/ "./app/components/charts/errorPanel.tsx":
/*!**********************************************!*\
  !*** ./app/components/charts/errorPanel.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");


const ErrorPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1six6h50"
} : 0)("display:flex;flex-direction:column;justify-content:center;align-items:center;flex:1;flex-shrink:0;overflow:hidden;height:", p => p.height || '200px', ";position:relative;border-color:transparent;margin-bottom:0;color:", p => p.theme.gray300, ";font-size:", p => p.theme.fontSizeExtraLarge, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ErrorPanel);

/***/ }),

/***/ "./app/components/charts/optionSelector.tsx":
/*!**************************************************!*\
  !*** ./app/components/charts/optionSelector.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/featureBadge */ "./app/components/featureBadge.tsx");
/* harmony import */ var sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/forms/compactSelect */ "./app/components/forms/compactSelect.tsx");
/* harmony import */ var sentry_components_truncate__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/truncate */ "./app/components/truncate.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









function OptionSelector(_ref) {
  let {
    options,
    onChange,
    selected,
    title,
    featureType,
    multiple,
    ...rest
  } = _ref;
  const mappedOptions = (0,react__WEBPACK_IMPORTED_MODULE_2__.useMemo)(() => {
    return options.map(opt => ({ ...opt,
      label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_truncate__WEBPACK_IMPORTED_MODULE_5__["default"], {
        value: String(opt.label),
        maxLength: 60,
        expandDirection: "left"
      })
    }));
  }, [options]);

  function onValueChange(option) {
    onChange(multiple ? option.map(o => o.value) : option.value);
  }

  function isOptionDisabled(option) {
    return (// Option is explicitly marked as disabled
      option.disabled || // The user has reached the maximum number of selections (3), and the option hasn't
      // yet been selected. These options should be disabled to visually indicate that the
      // user has reached the max.
      multiple && selected.length === 3 && !selected.includes(option.value)
    );
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_4__["default"], {
    size: "sm",
    options: mappedOptions,
    value: selected,
    onChange: onValueChange,
    isOptionDisabled: isOptionDisabled,
    multiple: multiple,
    triggerProps: {
      borderless: true,
      prefix: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
        children: [title, (0,sentry_utils__WEBPACK_IMPORTED_MODULE_6__.defined)(featureType) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(StyledFeatureBadge, {
          type: featureType
        }) : null]
      })
    },
    placement: "bottom right",
    ...rest
  });
}

OptionSelector.displayName = "OptionSelector";

const StyledFeatureBadge = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e1a4edto0"
} : 0)( true ? {
  name: "6og82r",
  styles: "margin-left:0px"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OptionSelector);

/***/ }),

/***/ "./app/components/gridEditable/sortLink.tsx":
/*!**************************************************!*\
  !*** ./app/components/gridEditable/sortLink.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }







function SortLink(_ref) {
  let {
    align,
    title,
    canSort,
    generateSortLink,
    onClick,
    direction
  } = _ref;
  const target = generateSortLink();

  if (!target || !canSort) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(StyledNonLink, {
      align: align,
      children: title
    });
  }

  const arrow = !direction ? null : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(StyledIconArrow, {
    size: "xs",
    direction: direction === 'desc' ? 'down' : 'up'
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(StyledLink, {
    align: align,
    to: target,
    onClick: onClick,
    children: [title, " ", arrow]
  });
}

SortLink.displayName = "SortLink";

const StyledLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(props => {
  const forwardProps = lodash_omit__WEBPACK_IMPORTED_MODULE_1___default()(props, ['align']);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_2__["default"], { ...forwardProps
  });
},  true ? {
  target: "e1xb2te62"
} : 0)("display:block;width:100%;white-space:nowrap;color:inherit;&:hover,&:active,&:focus,&:visited{color:inherit;}", p => p.align ? `text-align: ${p.align};` : '', ";" + ( true ? "" : 0));

const StyledNonLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1xb2te61"
} : 0)("display:block;width:100%;white-space:nowrap;", p => p.align ? `text-align: ${p.align};` : '', ";" + ( true ? "" : 0));

const StyledIconArrow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconArrow,  true ? {
  target: "e1xb2te60"
} : 0)( true ? {
  name: "40f4ru",
  styles: "vertical-align:top"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SortLink);

/***/ }),

/***/ "./app/components/notAvailable.tsx":
/*!*****************************************!*\
  !*** ./app/components/notAvailable.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function NotAvailable(_ref) {
  let {
    tooltip,
    className
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_1__["default"], {
    title: tooltip,
    skipWrapper: true,
    disabled: tooltip === undefined,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(Wrapper, {
      className: className,
      children: '\u2014'
    })
  });
}

NotAvailable.displayName = "NotAvailable";

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1ickyb10"
} : 0)("color:", p => p.theme.gray200, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (NotAvailable);

/***/ }),

/***/ "./app/components/scoreCard.tsx":
/*!**************************************!*\
  !*** ./app/components/scoreCard.tsx ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "HeaderTitle": () => (/* binding */ HeaderTitle),
/* harmony export */   "Score": () => (/* binding */ Score),
/* harmony export */   "ScorePanel": () => (/* binding */ ScorePanel),
/* harmony export */   "ScoreWrapper": () => (/* binding */ ScoreWrapper),
/* harmony export */   "Title": () => (/* binding */ Title),
/* harmony export */   "Trend": () => (/* binding */ Trend),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/textOverflow */ "./app/components/textOverflow.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









function ScoreCard(_ref) {
  let {
    title,
    score,
    help,
    trend,
    trendStatus,
    className
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(ScorePanel, {
    className: className,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(HeaderTitle, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Title, {
        children: title
      }), help && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_2__["default"], {
        title: help,
        size: "sm",
        position: "top"
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(ScoreWrapper, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Score, {
        children: score !== null && score !== void 0 ? score : '\u2014'
      }), (0,sentry_utils__WEBPACK_IMPORTED_MODULE_5__.defined)(trend) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Trend, {
        trendStatus: trendStatus,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_3__["default"], {
          children: trend
        })
      })]
    })]
  });
}

ScoreCard.displayName = "ScoreCard";

function getTrendColor(p) {
  switch (p.trendStatus) {
    case 'good':
      return p.theme.green300;

    case 'bad':
      return p.theme.red300;

    default:
      return p.theme.gray300;
  }
}

const ScorePanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__.Panel,  true ? {
  target: "e179ouq55"
} : 0)("display:flex;flex-direction:column;justify-content:space-between;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(3), ";min-height:96px;" + ( true ? "" : 0));
const HeaderTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e179ouq54"
} : 0)("display:inline-grid;grid-auto-flow:column;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1), ";align-items:center;width:fit-content;" + ( true ? "" : 0));
const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e179ouq53"
} : 0)("font-size:", p => p.theme.fontSizeLarge, ";color:", p => p.theme.headingColor, ";", p => p.theme.overflowEllipsis, ";font-weight:600;" + ( true ? "" : 0));
const ScoreWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e179ouq52"
} : 0)( true ? {
  name: "ph5vh8",
  styles: "display:flex;flex-direction:row;align-items:flex-end;max-width:100%"
} : 0);
const Score = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e179ouq51"
} : 0)("flex-shrink:1;font-size:32px;line-height:1;color:", p => p.theme.headingColor, ";white-space:nowrap;" + ( true ? "" : 0));
const Trend = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e179ouq50"
} : 0)("color:", getTrendColor, ";margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1), ";line-height:1;overflow:hidden;" + ( true ? "" : 0));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ScoreCard);

/***/ }),

/***/ "./app/views/organizationStats/index.tsx":
/*!***********************************************!*\
  !*** ./app/views/organizationStats/index.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "OrganizationStats": () => (/* binding */ OrganizationStats),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var sentry_actionCreators_navigation__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/actionCreators/navigation */ "./app/actionCreators/navigation.tsx");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/errorBoundary */ "./app/components/errorBoundary.tsx");
/* harmony import */ var sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/forms/compactSelect */ "./app/components/forms/compactSelect.tsx");
/* harmony import */ var sentry_components_hookOrDefault__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/hookOrDefault */ "./app/components/hookOrDefault.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_components_pageHeading__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/pageHeading */ "./app/components/pageHeading.tsx");
/* harmony import */ var sentry_components_pageTimeRangeSelector__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/pageTimeRangeSelector */ "./app/components/pageTimeRangeSelector.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_organization__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/styles/organization */ "./app/styles/organization.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_organizationStats_header__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/views/organizationStats/header */ "./app/views/organizationStats/header.tsx");
/* harmony import */ var _usageChart__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! ./usageChart */ "./app/views/organizationStats/usageChart/index.tsx");
/* harmony import */ var _usageStatsOrg__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! ./usageStatsOrg */ "./app/views/organizationStats/usageStatsOrg.tsx");
/* harmony import */ var _usageStatsProjects__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! ./usageStatsProjects */ "./app/views/organizationStats/usageStatsProjects.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");































const HookHeader = (0,sentry_components_hookOrDefault__WEBPACK_IMPORTED_MODULE_13__["default"])({
  hookName: 'component:org-stats-banner'
});
const PAGE_QUERY_PARAMS = ['pageStatsPeriod', 'pageStart', 'pageEnd', 'pageUtc', 'dataCategory', 'transform', 'sort', 'query', 'cursor'];
class OrganizationStats extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    var _this;

    super(...arguments);
    _this = this;

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getNextLocations", project => {
      const {
        location,
        organization
      } = this.props;
      const nextLocation = { ...location,
        query: { ...location.query,
          project: project.id
        }
      }; // Do not leak out page-specific keys

      nextLocation.query = lodash_omit__WEBPACK_IMPORTED_MODULE_5___default()(nextLocation.query, PAGE_QUERY_PARAMS);
      return {
        performance: { ...nextLocation,
          pathname: `/organizations/${organization.slug}/performance/`
        },
        projectDetail: { ...nextLocation,
          pathname: `/organizations/${organization.slug}/projects/${project.slug}/`
        },
        issueList: { ...nextLocation,
          pathname: `/organizations/${organization.slug}/issues/`
        },
        settings: {
          pathname: `/settings/${organization.slug}/projects/${project.slug}/`
        }
      };
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleUpdateDatetime", datetime => {
      const {
        start,
        end,
        relative,
        utc
      } = datetime;

      if (start && end) {
        const parser = utc ? (moment__WEBPACK_IMPORTED_MODULE_7___default().utc) : (moment__WEBPACK_IMPORTED_MODULE_7___default());
        return this.setStateOnUrl({
          pageStatsPeriod: undefined,
          pageStart: parser(start).format(),
          pageEnd: parser(end).format(),
          pageUtc: utc !== null && utc !== void 0 ? utc : undefined
        });
      }

      return this.setStateOnUrl({
        pageStatsPeriod: relative || undefined,
        pageStart: undefined,
        pageEnd: undefined,
        pageUtc: undefined
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "navigateToSamplingSettings", e => {
      var _e$preventDefault;

      (_e$preventDefault = e.preventDefault) === null || _e$preventDefault === void 0 ? void 0 : _e$preventDefault.call(e);
      const {
        organization,
        router
      } = this.props;
      (0,sentry_actionCreators_navigation__WEBPACK_IMPORTED_MODULE_8__.navigateTo)(`/settings/${organization.slug}/projects/:projectId/server-side-sampling/?referrer=org-stats.alert`, router);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "setStateOnUrl", function (nextState) {
      let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {
        willUpdateRouter: true
      };
      const {
        location,
        router
      } = _this.props;
      const nextQueryParams = lodash_pick__WEBPACK_IMPORTED_MODULE_6___default()(nextState, PAGE_QUERY_PARAMS);
      const nextLocation = { ...location,
        query: { ...(location === null || location === void 0 ? void 0 : location.query),
          ...nextQueryParams
        }
      };

      if (options.willUpdateRouter) {
        router.push(nextLocation);
      }

      return nextLocation;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderPageControl", () => {
      const {
        organization
      } = this.props;
      const {
        start,
        end,
        period,
        utc
      } = this.dataDatetime;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(DropdownDataCategory, {
          triggerProps: {
            prefix: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Category')
          },
          value: this.dataCategory,
          options: _usageChart__WEBPACK_IMPORTED_MODULE_26__.CHART_OPTIONS_DATACATEGORY,
          onChange: opt => this.setStateOnUrl({
            dataCategory: opt.value
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(StyledPageTimeRangeSelector, {
          organization: organization,
          relative: period !== null && period !== void 0 ? period : '',
          start: start !== null && start !== void 0 ? start : null,
          end: end !== null && end !== void 0 ? end : null,
          utc: utc !== null && utc !== void 0 ? utc : null,
          onUpdate: this.handleUpdateDatetime,
          relativeOptions: lodash_omit__WEBPACK_IMPORTED_MODULE_5___default()(sentry_constants__WEBPACK_IMPORTED_MODULE_19__.DEFAULT_RELATIVE_PERIODS, ['1h'])
        })]
      });
    });
  }

  get dataCategory() {
    var _this$props$location, _this$props$location$;

    const dataCategory = (_this$props$location = this.props.location) === null || _this$props$location === void 0 ? void 0 : (_this$props$location$ = _this$props$location.query) === null || _this$props$location$ === void 0 ? void 0 : _this$props$location$.dataCategory;

    switch (dataCategory) {
      case sentry_types__WEBPACK_IMPORTED_MODULE_23__.DataCategory.ERRORS:
      case sentry_types__WEBPACK_IMPORTED_MODULE_23__.DataCategory.TRANSACTIONS:
      case sentry_types__WEBPACK_IMPORTED_MODULE_23__.DataCategory.ATTACHMENTS:
        return dataCategory;

      default:
        return sentry_types__WEBPACK_IMPORTED_MODULE_23__.DataCategory.ERRORS;
    }
  }

  get dataCategoryName() {
    var _DATA_CATEGORY_NAMES$;

    const dataCategory = this.dataCategory;
    return (_DATA_CATEGORY_NAMES$ = sentry_constants__WEBPACK_IMPORTED_MODULE_19__.DATA_CATEGORY_NAMES[dataCategory]) !== null && _DATA_CATEGORY_NAMES$ !== void 0 ? _DATA_CATEGORY_NAMES$ : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Unknown Data Category');
  }

  get dataDatetime() {
    var _this$props$location$2, _this$props$location2;

    const query = (_this$props$location$2 = (_this$props$location2 = this.props.location) === null || _this$props$location2 === void 0 ? void 0 : _this$props$location2.query) !== null && _this$props$location$2 !== void 0 ? _this$props$location$2 : {};
    const {
      start,
      end,
      statsPeriod,
      utc: utcString
    } = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_15__.normalizeDateTimeParams)(query, {
      allowEmptyPeriod: true,
      allowAbsoluteDatetime: true,
      allowAbsolutePageDatetime: true
    });

    if (!statsPeriod && !start && !end) {
      return {
        period: sentry_constants__WEBPACK_IMPORTED_MODULE_19__.DEFAULT_STATS_PERIOD
      };
    } // Following getParams, statsPeriod will take priority over start/end


    if (statsPeriod) {
      return {
        period: statsPeriod
      };
    }

    const utc = utcString === 'true';

    if (start && end) {
      return utc ? {
        start: moment__WEBPACK_IMPORTED_MODULE_7___default().utc(start).format(),
        end: moment__WEBPACK_IMPORTED_MODULE_7___default().utc(end).format(),
        utc
      } : {
        start: moment__WEBPACK_IMPORTED_MODULE_7___default()(start).utc().format(),
        end: moment__WEBPACK_IMPORTED_MODULE_7___default()(end).utc().format(),
        utc
      };
    }

    return {
      period: sentry_constants__WEBPACK_IMPORTED_MODULE_19__.DEFAULT_STATS_PERIOD
    };
  } // Validation and type-casting should be handled by chart


  get chartTransform() {
    var _this$props$location3, _this$props$location4;

    return (_this$props$location3 = this.props.location) === null || _this$props$location3 === void 0 ? void 0 : (_this$props$location4 = _this$props$location3.query) === null || _this$props$location4 === void 0 ? void 0 : _this$props$location4.transform;
  } // Validation and type-casting should be handled by table


  get tableSort() {
    var _this$props$location5, _this$props$location6;

    return (_this$props$location5 = this.props.location) === null || _this$props$location5 === void 0 ? void 0 : (_this$props$location6 = _this$props$location5.query) === null || _this$props$location6 === void 0 ? void 0 : _this$props$location6.sort;
  }

  get tableQuery() {
    var _this$props$location7, _this$props$location8;

    return (_this$props$location7 = this.props.location) === null || _this$props$location7 === void 0 ? void 0 : (_this$props$location8 = _this$props$location7.query) === null || _this$props$location8 === void 0 ? void 0 : _this$props$location8.query;
  }

  get tableCursor() {
    var _this$props$location9, _this$props$location10;

    return (_this$props$location9 = this.props.location) === null || _this$props$location9 === void 0 ? void 0 : (_this$props$location10 = _this$props$location9.query) === null || _this$props$location10 === void 0 ? void 0 : _this$props$location10.cursor;
  }

  render() {
    const {
      organization
    } = this.props;
    const hasTeamInsights = organization.features.includes('team-insights');
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_18__["default"], {
      title: "Usage Stats",
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
        children: [hasTeamInsights && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_views_organizationStats_header__WEBPACK_IMPORTED_MODULE_25__["default"], {
          organization: organization,
          activeTab: "stats"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(Body, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_14__.Main, {
            fullWidth: true,
            children: [!hasTeamInsights && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_21__.PageHeader, {
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_pageHeading__WEBPACK_IMPORTED_MODULE_16__["default"], {
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Organization Usage Stats')
                })
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)("p", {
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('We collect usage metrics on three categories: errors, transactions, and attachments. The charts below reflect data that Sentry has received across your entire organization. You can also find them broken down by project in the table.')
              })]
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(HookHeader, {
              organization: organization
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(PageGrid, {
              children: [this.renderPageControl(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_11__["default"], {
                mini: true,
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(_usageStatsOrg__WEBPACK_IMPORTED_MODULE_27__["default"], {
                  organization: organization,
                  dataCategory: this.dataCategory,
                  dataCategoryName: this.dataCategoryName,
                  dataDatetime: this.dataDatetime,
                  chartTransform: this.chartTransform,
                  handleChangeState: this.setStateOnUrl
                })
              })]
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_9__["default"], {
              features: ['server-side-sampling', 'server-side-sampling-ui'],
              organization: organization,
              children: this.dataCategory === sentry_types__WEBPACK_IMPORTED_MODULE_23__.DataCategory.TRANSACTIONS && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_10__["default"], {
                type: "info",
                showIcon: true,
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.tct)('Manage your transaction usage in Server-Side Sampling. Go to [link: Server-Side Sampling Settings].', {
                  link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)("a", {
                    href: "#",
                    onClick: this.navigateToSamplingSettings
                  })
                })
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_11__["default"], {
              mini: true,
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(_usageStatsProjects__WEBPACK_IMPORTED_MODULE_28__["default"], {
                organization: organization,
                dataCategory: this.dataCategory,
                dataCategoryName: this.dataCategoryName,
                dataDatetime: this.dataDatetime,
                tableSort: this.tableSort,
                tableQuery: this.tableQuery,
                tableCursor: this.tableCursor,
                handleChangeState: this.setStateOnUrl,
                getNextLocations: this.getNextLocations
              })
            })]
          })
        })]
      })
    });
  }

}
OrganizationStats.displayName = "OrganizationStats";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_24__["default"])(OrganizationStats));

const PageGrid = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eonnbv93"
} : 0)("display:grid;grid-template-columns:1fr;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(2), ";@media (min-width: ", p => p.theme.breakpoints.small, "){grid-template-columns:repeat(2, 1fr);}@media (min-width: ", p => p.theme.breakpoints.large, "){grid-template-columns:repeat(4, 1fr);}" + ( true ? "" : 0));

const DropdownDataCategory = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_12__["default"],  true ? {
  target: "eonnbv92"
} : 0)("grid-column:auto/span 1;button[aria-haspopup='listbox']{width:100%;height:100%;}@media (min-width: ", p => p.theme.breakpoints.small, "){grid-column:auto/span 2;}@media (min-width: ", p => p.theme.breakpoints.large, "){grid-column:auto/span 1;}" + ( true ? "" : 0));

const StyledPageTimeRangeSelector = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_pageTimeRangeSelector__WEBPACK_IMPORTED_MODULE_17__["default"],  true ? {
  target: "eonnbv91"
} : 0)("grid-column:auto/span 1;@media (min-width: ", p => p.theme.breakpoints.small, "){grid-column:auto/span 2;}@media (min-width: ", p => p.theme.breakpoints.large, "){grid-column:auto/span 3;}" + ( true ? "" : 0));

const Body = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_14__.Body,  true ? {
  target: "eonnbv90"
} : 0)("@media (min-width: ", p => p.theme.breakpoints.medium, "){display:block;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/organizationStats/types.tsx":
/*!***********************************************!*\
  !*** ./app/views/organizationStats/types.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Outcome": () => (/* binding */ Outcome)
/* harmony export */ });
let Outcome;
/**
 * Raw response from API endpoint
 */

(function (Outcome) {
  Outcome["ACCEPTED"] = "accepted";
  Outcome["FILTERED"] = "filtered";
  Outcome["INVALID"] = "invalid";
  Outcome["DROPPED"] = "dropped";
  Outcome["RATE_LIMITED"] = "rate_limited";
  Outcome["CLIENT_DISCARD"] = "client_discard";
})(Outcome || (Outcome = {}));

/***/ }),

/***/ "./app/views/organizationStats/usageChart/index.tsx":
/*!**********************************************************!*\
  !*** ./app/views/organizationStats/usageChart/index.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CHART_OPTIONS_DATACATEGORY": () => (/* binding */ CHART_OPTIONS_DATACATEGORY),
/* harmony export */   "CHART_OPTIONS_DATA_TRANSFORM": () => (/* binding */ CHART_OPTIONS_DATA_TRANSFORM),
/* harmony export */   "ChartDataTransform": () => (/* binding */ ChartDataTransform),
/* harmony export */   "SeriesTypes": () => (/* binding */ SeriesTypes),
/* harmony export */   "UsageChart": () => (/* binding */ UsageChart),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var color__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! color */ "../node_modules/color/index.js");
/* harmony import */ var color__WEBPACK_IMPORTED_MODULE_23___default = /*#__PURE__*/__webpack_require__.n(color__WEBPACK_IMPORTED_MODULE_23__);
/* harmony import */ var sentry_components_charts_baseChart__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/baseChart */ "./app/components/charts/baseChart.tsx");
/* harmony import */ var sentry_components_charts_components_legend__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/components/legend */ "./app/components/charts/components/legend.tsx");
/* harmony import */ var sentry_components_charts_components_xAxis__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/charts/components/xAxis */ "./app/components/charts/components/xAxis.tsx");
/* harmony import */ var sentry_components_charts_series_barSeries__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/charts/series/barSeries */ "./app/components/charts/series/barSeries.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_panels_panel__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/panels/panel */ "./app/components/panels/panel.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ../utils */ "./app/views/organizationStats/utils.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ./utils */ "./app/views/organizationStats/usageChart/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



























const COLOR_ERRORS = color__WEBPACK_IMPORTED_MODULE_23___default()(sentry_utils_theme__WEBPACK_IMPORTED_MODULE_20__["default"].dataCategory.errors).lighten(0.25).string();
const COLOR_TRANSACTIONS = color__WEBPACK_IMPORTED_MODULE_23___default()(sentry_utils_theme__WEBPACK_IMPORTED_MODULE_20__["default"].dataCategory.transactions).lighten(0.35).string();
const COLOR_ATTACHMENTS = color__WEBPACK_IMPORTED_MODULE_23___default()(sentry_utils_theme__WEBPACK_IMPORTED_MODULE_20__["default"].dataCategory.attachments).lighten(0.65).string();
const COLOR_DROPPED = sentry_utils_theme__WEBPACK_IMPORTED_MODULE_20__["default"].red300;
const COLOR_FILTERED = sentry_utils_theme__WEBPACK_IMPORTED_MODULE_20__["default"].pink100;
const CHART_OPTIONS_DATACATEGORY = [{
  label: sentry_constants__WEBPACK_IMPORTED_MODULE_13__.DATA_CATEGORY_NAMES[sentry_types__WEBPACK_IMPORTED_MODULE_17__.DataCategory.ERRORS],
  value: sentry_types__WEBPACK_IMPORTED_MODULE_17__.DataCategory.ERRORS,
  disabled: false,
  yAxisMinInterval: 100
}, {
  label: sentry_constants__WEBPACK_IMPORTED_MODULE_13__.DATA_CATEGORY_NAMES[sentry_types__WEBPACK_IMPORTED_MODULE_17__.DataCategory.TRANSACTIONS],
  value: sentry_types__WEBPACK_IMPORTED_MODULE_17__.DataCategory.TRANSACTIONS,
  disabled: false,
  yAxisMinInterval: 100
}, {
  label: sentry_constants__WEBPACK_IMPORTED_MODULE_13__.DATA_CATEGORY_NAMES[sentry_types__WEBPACK_IMPORTED_MODULE_17__.DataCategory.ATTACHMENTS],
  value: sentry_types__WEBPACK_IMPORTED_MODULE_17__.DataCategory.ATTACHMENTS,
  disabled: false,
  yAxisMinInterval: 0.5 * _utils__WEBPACK_IMPORTED_MODULE_21__.GIGABYTE
}];
let ChartDataTransform;

(function (ChartDataTransform) {
  ChartDataTransform["CUMULATIVE"] = "cumulative";
  ChartDataTransform["PERIODIC"] = "periodic";
})(ChartDataTransform || (ChartDataTransform = {}));

const CHART_OPTIONS_DATA_TRANSFORM = [{
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Cumulative'),
  value: ChartDataTransform.CUMULATIVE,
  disabled: false
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Periodic'),
  value: ChartDataTransform.PERIODIC,
  disabled: false
}];
let SeriesTypes;

(function (SeriesTypes) {
  SeriesTypes["ACCEPTED"] = "Accepted";
  SeriesTypes["DROPPED"] = "Dropped";
  SeriesTypes["PROJECTED"] = "Projected";
  SeriesTypes["FILTERED"] = "Filtered";
})(SeriesTypes || (SeriesTypes = {}));

class UsageChart extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      xAxisDates: []
    });
  }

  /**
   * UsageChart needs to generate the X-Axis dates as props.usageStats may
   * not pass the complete range of X-Axis data points
   *
   * E.g. usageStats.accepted covers day 1-15 of a month, usageStats.projected
   * either covers day 16-30 or may not be available at all.
   */
  static getDerivedStateFromProps(nextProps, prevState) {
    const {
      usageDateStart,
      usageDateEnd,
      usageDateShowUtc,
      usageDateInterval
    } = nextProps;
    return { ...prevState,
      xAxisDates: (0,_utils__WEBPACK_IMPORTED_MODULE_22__.getXAxisDates)(usageDateStart, usageDateEnd, usageDateShowUtc, usageDateInterval)
    };
  }

  get chartColors() {
    const {
      dataCategory,
      theme
    } = this.props;
    const COLOR_PROJECTED = theme.chartOther;

    if (dataCategory === sentry_types__WEBPACK_IMPORTED_MODULE_17__.DataCategory.ERRORS) {
      return [COLOR_ERRORS, COLOR_FILTERED, COLOR_DROPPED, COLOR_PROJECTED];
    }

    if (dataCategory === sentry_types__WEBPACK_IMPORTED_MODULE_17__.DataCategory.ATTACHMENTS) {
      return [COLOR_ATTACHMENTS, COLOR_FILTERED, COLOR_DROPPED, COLOR_PROJECTED];
    }

    return [COLOR_TRANSACTIONS, COLOR_FILTERED, COLOR_DROPPED, COLOR_PROJECTED];
  }

  get chartMetadata() {
    const {
      categoryOptions,
      usageDateStart,
      usageDateEnd
    } = this.props;
    const {
      usageDateInterval,
      usageStats,
      dataCategory,
      dataTransform,
      handleDataTransformation
    } = this.props;
    const {
      xAxisDates
    } = this.state;
    const selectDataCategory = categoryOptions.find(o => o.value === dataCategory);

    if (!selectDataCategory) {
      throw new Error('Selected item is not supported');
    } // Do not assume that handleDataTransformation is a pure function


    const chartData = { ...handleDataTransformation(usageStats, dataTransform)
    };
    Object.keys(chartData).forEach(k => {
      const isProjected = k === SeriesTypes.PROJECTED; // Map the array and destructure elements to avoid side-effects

      chartData[k] = chartData[k].map(stat => {
        return { ...stat,
          tooltip: {
            show: false
          },
          itemStyle: {
            opacity: isProjected ? 0.6 : 1
          }
        };
      });
    }); // Use hours as common units

    const dataPeriod = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_18__.statsPeriodToDays)(undefined, usageDateStart, usageDateEnd) * 24;
    const barPeriod = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_18__.parsePeriodToHours)(usageDateInterval);

    if (dataPeriod < 0 || barPeriod < 0) {
      throw new Error('UsageChart: Unable to parse data time period');
    }

    const {
      xAxisTickInterval,
      xAxisLabelInterval
    } = (0,_utils__WEBPACK_IMPORTED_MODULE_22__.getXAxisLabelInterval)(dataPeriod, dataPeriod / barPeriod);
    const {
      label,
      yAxisMinInterval
    } = selectDataCategory;
    return {
      chartLabel: label,
      chartData,
      xAxisData: xAxisDates,
      xAxisTickInterval,
      xAxisLabelInterval,
      yAxisMinInterval,
      yAxisFormatter: val => (0,_utils__WEBPACK_IMPORTED_MODULE_21__.formatUsageWithUnits)(val, dataCategory, {
        isAbbreviated: true,
        useUnitScaling: true
      }),
      tooltipValueFormatter: (0,_utils__WEBPACK_IMPORTED_MODULE_22__.getTooltipFormatter)(dataCategory)
    };
  }

  get chartSeries() {
    const {
      chartSeries
    } = this.props;
    const {
      chartData
    } = this.chartMetadata;
    let series = [(0,sentry_components_charts_series_barSeries__WEBPACK_IMPORTED_MODULE_8__["default"])({
      name: SeriesTypes.ACCEPTED,
      data: chartData.accepted,
      // TODO(ts)
      barMinHeight: 1,
      stack: 'usage',
      legendHoverLink: false
    }), (0,sentry_components_charts_series_barSeries__WEBPACK_IMPORTED_MODULE_8__["default"])({
      name: SeriesTypes.FILTERED,
      data: chartData.filtered,
      // TODO(ts)
      barMinHeight: 1,
      stack: 'usage',
      legendHoverLink: false
    }), (0,sentry_components_charts_series_barSeries__WEBPACK_IMPORTED_MODULE_8__["default"])({
      name: SeriesTypes.DROPPED,
      data: chartData.dropped,
      // TODO(ts)
      stack: 'usage',
      legendHoverLink: false
    }), (0,sentry_components_charts_series_barSeries__WEBPACK_IMPORTED_MODULE_8__["default"])({
      name: SeriesTypes.PROJECTED,
      data: chartData.projected,
      // TODO(ts)
      barMinHeight: 1,
      stack: 'usage',
      legendHoverLink: false
    })]; // Additional series passed by parent component

    if (chartSeries) {
      series = series.concat(chartSeries);
    }

    return series;
  }

  get chartLegend() {
    const {
      chartData
    } = this.chartMetadata;
    const legend = [{
      name: SeriesTypes.ACCEPTED
    }];

    if (chartData.filtered && chartData.filtered.length > 0) {
      legend.push({
        name: SeriesTypes.FILTERED
      });
    }

    if (chartData.dropped.length > 0) {
      legend.push({
        name: SeriesTypes.DROPPED
      });
    }

    if (chartData.projected.length > 0) {
      legend.push({
        name: SeriesTypes.PROJECTED
      });
    }

    return legend;
  }

  get chartTooltip() {
    const {
      chartTooltip
    } = this.props;

    if (chartTooltip) {
      return chartTooltip;
    }

    const {
      tooltipValueFormatter
    } = this.chartMetadata;
    return {
      // Trigger to axis prevents tooltip from redrawing when hovering
      // over individual bars
      trigger: 'axis',
      valueFormatter: tooltipValueFormatter
    };
  }

  renderChart() {
    const {
      theme,
      title,
      isLoading,
      isError,
      errors
    } = this.props;

    if (isLoading) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_12__["default"], {
        height: "200px",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_10__["default"], {
          mini: true
        })
      });
    }

    if (isError) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_12__["default"], {
        height: "200px",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconWarning, {
          size: theme.fontSizeExtraLarge
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(ErrorMessages, {
          children: errors && Object.keys(errors).map(k => {
            var _errors$k;

            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)("span", {
              children: (_errors$k = errors[k]) === null || _errors$k === void 0 ? void 0 : _errors$k.message
            }, k);
          })
        })]
      });
    }

    const {
      xAxisData,
      xAxisTickInterval,
      xAxisLabelInterval,
      yAxisMinInterval,
      yAxisFormatter
    } = this.chartMetadata;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_9__.HeaderTitleLegend, {
        children: title || (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Current Usage Period')
      }), (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_19__["default"])({
        value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_charts_baseChart__WEBPACK_IMPORTED_MODULE_5__["default"], {
          colors: this.chartColors,
          grid: {
            bottom: '3px',
            left: '0px',
            right: '10px',
            top: '40px'
          },
          xAxis: (0,sentry_components_charts_components_xAxis__WEBPACK_IMPORTED_MODULE_7__["default"])({
            show: true,
            type: 'category',
            name: 'Date',
            data: xAxisData,
            axisTick: {
              interval: xAxisTickInterval,
              alignWithLabel: true
            },
            axisLabel: {
              interval: xAxisLabelInterval,
              formatter: label => label.slice(0, 6) // Limit label to 6 chars

            },
            theme
          }),
          yAxis: {
            min: 0,
            minInterval: yAxisMinInterval,
            axisLabel: {
              formatter: yAxisFormatter,
              color: theme.chartLabel
            }
          },
          series: this.chartSeries,
          tooltip: this.chartTooltip,
          onLegendSelectChanged: () => {},
          legend: (0,sentry_components_charts_components_legend__WEBPACK_IMPORTED_MODULE_6__["default"])({
            right: 10,
            top: 5,
            data: this.chartLegend,
            theme
          })
        }),
        fixed: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_12__["default"], {
          height: "200px"
        })
      })]
    });
  }

  render() {
    const {
      footer
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(sentry_components_panels_panel__WEBPACK_IMPORTED_MODULE_11__["default"], {
      id: "usage-chart",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_9__.ChartContainer, {
        children: this.renderChart()
      }), footer]
    });
  }

}
UsageChart.displayName = "UsageChart";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(UsageChart, "defaultProps", {
  categoryOptions: CHART_OPTIONS_DATACATEGORY,
  usageDateShowUtc: true,
  usageDateInterval: '1d',
  handleDataTransformation: (stats, transform) => {
    const chartData = {
      accepted: [],
      dropped: [],
      projected: [],
      filtered: []
    };
    const isCumulative = transform === ChartDataTransform.CUMULATIVE;
    Object.keys(stats).forEach(k => {
      let count = 0;
      chartData[k] = stats[k].map(stat => {
        const [x, y] = stat.value;
        count = isCumulative ? count + y : y;
        return { ...stat,
          value: [x, count]
        };
      });
    });
    return chartData;
  }
});

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,_emotion_react__WEBPACK_IMPORTED_MODULE_25__.d)(UsageChart));

const ErrorMessages = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "erx9nbs0"
} : 0)("display:flex;flex-direction:column;margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1), ";font-size:", p => p.theme.fontSizeSmall, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/organizationStats/usageChart/utils.tsx":
/*!**********************************************************!*\
  !*** ./app/views/organizationStats/usageChart/utils.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FORMAT_DATETIME_DAILY": () => (/* binding */ FORMAT_DATETIME_DAILY),
/* harmony export */   "FORMAT_DATETIME_HOURLY": () => (/* binding */ FORMAT_DATETIME_HOURLY),
/* harmony export */   "getDateFromMoment": () => (/* binding */ getDateFromMoment),
/* harmony export */   "getDateFromUnixTimestamp": () => (/* binding */ getDateFromUnixTimestamp),
/* harmony export */   "getTooltipFormatter": () => (/* binding */ getTooltipFormatter),
/* harmony export */   "getXAxisDates": () => (/* binding */ getXAxisDates),
/* harmony export */   "getXAxisLabelInterval": () => (/* binding */ getXAxisLabelInterval)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../utils */ "./app/views/organizationStats/utils.tsx");





/**
 * Avoid changing "MMM D" format as X-axis labels on UsageChart are naively
 * truncated by date.slice(0, 6). This avoids "..." when truncating by ECharts.
 */

const FORMAT_DATETIME_DAILY = 'MMM D';
const FORMAT_DATETIME_HOURLY = 'MMM D LT';
/**
 * Used to generate X-axis data points and labels for UsageChart
 * Ensure that this method is idempotent and doesn't change the moment object
 * that is passed in
 *
 * Use the `useUtc` parameter to get the UTC date for the provided
 * moment instance.
 */

function getDateFromMoment(m) {
  let interval = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '1d';
  let useUtc = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  const days = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_3__.parsePeriodToHours)(interval) / 24;

  if (days >= 1) {
    return useUtc ? moment__WEBPACK_IMPORTED_MODULE_1___default().utc(m).format(FORMAT_DATETIME_DAILY) : m.format(FORMAT_DATETIME_DAILY);
  }

  const parsedInterval = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_2__.parseStatsPeriod)(interval);
  const datetime = useUtc ? moment__WEBPACK_IMPORTED_MODULE_1___default()(m).utc() : moment__WEBPACK_IMPORTED_MODULE_1___default()(m).local();
  return parsedInterval ? `${datetime.format(FORMAT_DATETIME_HOURLY)} - ${datetime.add(parsedInterval.period, parsedInterval.periodLength).format('LT (Z)')}` : datetime.format(FORMAT_DATETIME_HOURLY);
}
function getDateFromUnixTimestamp(timestamp) {
  const date = moment__WEBPACK_IMPORTED_MODULE_1___default().unix(timestamp);
  return getDateFromMoment(date);
}
function getXAxisDates(dateStart, dateEnd) {
  var _parseStatsPeriod;

  let dateUtc = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  let interval = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : '1d';
  const range = [];
  const start = moment__WEBPACK_IMPORTED_MODULE_1___default()(dateStart).startOf('h');
  const end = moment__WEBPACK_IMPORTED_MODULE_1___default()(dateEnd).startOf('h');

  if (!start.isValid() || !end.isValid()) {
    return range;
  }

  const {
    period,
    periodLength
  } = (_parseStatsPeriod = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_2__.parseStatsPeriod)(interval)) !== null && _parseStatsPeriod !== void 0 ? _parseStatsPeriod : {
    period: 1,
    periodLength: 'd'
  };

  while (!start.isAfter(end)) {
    range.push(getDateFromMoment(start, interval, dateUtc));
    start.add(period, periodLength); // FIXME(ts): Something odd with momentjs types
  }

  return range;
}
function getTooltipFormatter(dataCategory) {
  return function () {
    let val = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
    return (0,_utils__WEBPACK_IMPORTED_MODULE_4__.formatUsageWithUnits)(val, dataCategory, {
      useUnitScaling: true
    });
  };
}
const MAX_NUMBER_OF_LABELS = 10;
/**
 *
 * @param dataPeriod - Quantity of hours covered by the data
 * @param numBars - Quantity of data points covered by the dataPeriod
 */

function getXAxisLabelInterval(dataPeriod, numBars) {
  return dataPeriod > 7 * 24 ? getLabelIntervalLongPeriod(dataPeriod, numBars) : getLabelIntervalShortPeriod(dataPeriod, numBars);
}
/**
 * @param dataPeriod - Quantity of hours covered by data, expected 7+ days
 */

function getLabelIntervalLongPeriod(dataPeriod, numBars) {
  const days = dataPeriod / 24;

  if (days <= 7) {
    throw new Error('This method should be used for periods > 7 days');
  } // Use 1 tick per day


  let numTicks = days;
  let numLabels = numTicks;
  const daysBetweenLabels = [2, 4, 7, 14];
  const daysBetweenTicks = [1, 2, 7, 7];

  for (let i = 0; i < daysBetweenLabels.length && numLabels > MAX_NUMBER_OF_LABELS; i++) {
    numLabels = numTicks / daysBetweenLabels[i];
    numTicks = days / daysBetweenTicks[i];
  }

  return {
    xAxisTickInterval: numBars / numTicks - 1,
    xAxisLabelInterval: numBars / numLabels - 1
  };
}
/**
 * @param dataPeriod - Quantity of hours covered by data, expected <7 days
 */


function getLabelIntervalShortPeriod(dataPeriod, numBars) {
  const days = dataPeriod / 24;

  if (days > 7) {
    throw new Error('This method should be used for periods <= 7 days');
  } // Use 1 tick/label per day, since it's guaranteed to be 7 or less


  const numTicks = days;
  const interval = numBars / numTicks;
  return {
    xAxisTickInterval: interval - 1,
    xAxisLabelInterval: interval - 1
  };
}

/***/ }),

/***/ "./app/views/organizationStats/usageStatsOrg.tsx":
/*!*******************************************************!*\
  !*** ./app/views/organizationStats/usageStatsOrg.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_charts_optionSelector__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/charts/optionSelector */ "./app/components/charts/optionSelector.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_components_notAvailable__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/notAvailable */ "./app/components/notAvailable.tsx");
/* harmony import */ var sentry_components_scoreCard__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/scoreCard */ "./app/components/scoreCard.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var _usageChart_utils__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ./usageChart/utils */ "./app/views/organizationStats/usageChart/utils.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ./types */ "./app/views/organizationStats/types.tsx");
/* harmony import */ var _usageChart__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ./usageChart */ "./app/views/organizationStats/usageChart/index.tsx");
/* harmony import */ var _usageStatsPerMin__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ./usageStatsPerMin */ "./app/views/organizationStats/usageStatsPerMin.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ./utils */ "./app/views/organizationStats/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






















class UsageStatsOrganization extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_7__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderChartFooter", () => {
      const {
        handleChangeState
      } = this.props;
      const {
        loading,
        error
      } = this.state;
      const {
        chartDateInterval,
        chartTransform,
        chartDateStartDisplay,
        chartDateEndDisplay,
        chartDateTimezoneDisplay
      } = this.chartData;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(Footer, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_9__.InlineContainer, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(FooterDate, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_9__.SectionHeading, {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Date Range:')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)("span", {
              children: loading || error ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_notAvailable__WEBPACK_IMPORTED_MODULE_11__["default"], {}) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.tct)('[start] — [end] ([timezone] UTC, [interval] interval)', {
                start: chartDateStartDisplay,
                end: chartDateEndDisplay,
                timezone: chartDateTimezoneDisplay,
                interval: chartDateInterval
              })
            })]
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_9__.InlineContainer, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_charts_optionSelector__WEBPACK_IMPORTED_MODULE_8__["default"], {
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Type'),
            selected: chartTransform,
            options: _usageChart__WEBPACK_IMPORTED_MODULE_19__.CHART_OPTIONS_DATA_TRANSFORM,
            onChange: val => handleChangeState({
              transform: val
            })
          })
        })]
      });
    });
  }

  componentDidUpdate(prevProps) {
    const {
      dataDatetime: prevDateTime
    } = prevProps;
    const {
      dataDatetime: currDateTime
    } = this.props;

    if (prevDateTime.start !== currDateTime.start || prevDateTime.end !== currDateTime.end || prevDateTime.period !== currDateTime.period || prevDateTime.utc !== currDateTime.utc) {
      this.reloadData();
    }
  }

  getEndpoints() {
    return [['orgStats', this.endpointPath, {
      query: this.endpointQuery
    }]];
  }

  get endpointPath() {
    const {
      organization
    } = this.props;
    return `/organizations/${organization.slug}/stats_v2/`;
  }

  get endpointQuery() {
    const {
      dataDatetime
    } = this.props;
    const queryDatetime = dataDatetime.start && dataDatetime.end ? {
      start: dataDatetime.start,
      end: dataDatetime.end,
      utc: dataDatetime.utc
    } : {
      statsPeriod: dataDatetime.period || sentry_constants__WEBPACK_IMPORTED_MODULE_13__.DEFAULT_STATS_PERIOD
    };
    return { ...queryDatetime,
      interval: (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_10__.getSeriesApiInterval)(dataDatetime),
      groupBy: ['category', 'outcome'],
      field: ['sum(quantity)']
    };
  }

  get chartData() {
    const {
      orgStats
    } = this.state;
    return { ...this.mapSeriesToChart(orgStats),
      ...this.chartDateRange,
      ...this.chartTransform
    };
  }

  get chartTransform() {
    const {
      chartTransform
    } = this.props;

    switch (chartTransform) {
      case _usageChart__WEBPACK_IMPORTED_MODULE_19__.ChartDataTransform.CUMULATIVE:
      case _usageChart__WEBPACK_IMPORTED_MODULE_19__.ChartDataTransform.PERIODIC:
        return {
          chartTransform
        };

      default:
        return {
          chartTransform: _usageChart__WEBPACK_IMPORTED_MODULE_19__.ChartDataTransform.PERIODIC
        };
    }
  }

  get chartDateRange() {
    const {
      orgStats
    } = this.state;
    const {
      dataDatetime
    } = this.props;
    const interval = (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_10__.getSeriesApiInterval)(dataDatetime); // Use fillers as loading/error states will not display datetime at all

    if (!orgStats || !orgStats.intervals) {
      return {
        chartDateInterval: interval,
        chartDateStart: '',
        chartDateEnd: '',
        chartDateUtc: true,
        chartDateStartDisplay: '',
        chartDateEndDisplay: '',
        chartDateTimezoneDisplay: ''
      };
    }

    const {
      intervals
    } = orgStats;
    const intervalHours = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_16__.parsePeriodToHours)(interval); // Keep datetime in UTC until we want to display it to users

    const startTime = moment__WEBPACK_IMPORTED_MODULE_6___default()(intervals[0]).utc();
    const endTime = intervals.length < 2 ? moment__WEBPACK_IMPORTED_MODULE_6___default()(startTime) // when statsPeriod and interval is the same value
    : moment__WEBPACK_IMPORTED_MODULE_6___default()(intervals[intervals.length - 1]).utc();
    const useUtc = (0,_utils__WEBPACK_IMPORTED_MODULE_21__.isDisplayUtc)(dataDatetime); // If interval is a day or more, use UTC to format date. Otherwise, the date
    // may shift ahead/behind when converting to the user's local time.

    const FORMAT_DATETIME = intervalHours >= 24 ? _usageChart_utils__WEBPACK_IMPORTED_MODULE_17__.FORMAT_DATETIME_DAILY : _usageChart_utils__WEBPACK_IMPORTED_MODULE_17__.FORMAT_DATETIME_HOURLY;
    const xAxisStart = moment__WEBPACK_IMPORTED_MODULE_6___default()(startTime);
    const xAxisEnd = moment__WEBPACK_IMPORTED_MODULE_6___default()(endTime);
    const displayStart = useUtc ? moment__WEBPACK_IMPORTED_MODULE_6___default()(startTime).utc() : moment__WEBPACK_IMPORTED_MODULE_6___default()(startTime).local();
    const displayEnd = useUtc ? moment__WEBPACK_IMPORTED_MODULE_6___default()(endTime).utc() : moment__WEBPACK_IMPORTED_MODULE_6___default()(endTime).local();

    if (intervalHours < 24) {
      displayEnd.add(intervalHours, 'h');
    }

    return {
      chartDateInterval: interval,
      chartDateStart: xAxisStart.format(),
      chartDateEnd: xAxisEnd.format(),
      chartDateUtc: useUtc,
      chartDateStartDisplay: displayStart.format(FORMAT_DATETIME),
      chartDateEndDisplay: displayEnd.format(FORMAT_DATETIME),
      chartDateTimezoneDisplay: displayStart.format('Z')
    };
  }

  mapSeriesToChart(orgStats) {
    const cardStats = {
      total: undefined,
      accepted: undefined,
      dropped: undefined,
      filtered: undefined
    };
    const chartStats = {
      accepted: [],
      dropped: [],
      projected: [],
      filtered: []
    };

    if (!orgStats) {
      return {
        cardStats,
        chartStats
      };
    }

    try {
      const {
        dataCategory
      } = this.props;
      const {
        chartDateInterval,
        chartDateUtc
      } = this.chartDateRange;
      const usageStats = orgStats.intervals.map(interval => {
        const dateTime = moment__WEBPACK_IMPORTED_MODULE_6___default()(interval);
        return {
          date: (0,_usageChart_utils__WEBPACK_IMPORTED_MODULE_17__.getDateFromMoment)(dateTime, chartDateInterval, chartDateUtc),
          total: 0,
          accepted: 0,
          filtered: 0,
          dropped: {
            total: 0
          }
        };
      }); // Tally totals for card data

      const count = {
        total: 0,
        [_types__WEBPACK_IMPORTED_MODULE_18__.Outcome.ACCEPTED]: 0,
        [_types__WEBPACK_IMPORTED_MODULE_18__.Outcome.FILTERED]: 0,
        [_types__WEBPACK_IMPORTED_MODULE_18__.Outcome.DROPPED]: 0,
        [_types__WEBPACK_IMPORTED_MODULE_18__.Outcome.INVALID]: 0,
        // Combined with dropped later
        [_types__WEBPACK_IMPORTED_MODULE_18__.Outcome.RATE_LIMITED]: 0,
        // Combined with dropped later
        [_types__WEBPACK_IMPORTED_MODULE_18__.Outcome.CLIENT_DISCARD]: 0 // Not exposed yet

      };
      orgStats.groups.forEach(group => {
        const {
          outcome,
          category
        } = group.by; // HACK: The backend enum are singular, but the frontend enums are plural

        if (!dataCategory.includes(`${category}`)) {
          return;
        }

        if (outcome !== _types__WEBPACK_IMPORTED_MODULE_18__.Outcome.CLIENT_DISCARD) {
          count.total += group.totals['sum(quantity)'];
        }

        count[outcome] += group.totals['sum(quantity)'];
        group.series['sum(quantity)'].forEach((stat, i) => {
          switch (outcome) {
            case _types__WEBPACK_IMPORTED_MODULE_18__.Outcome.ACCEPTED:
            case _types__WEBPACK_IMPORTED_MODULE_18__.Outcome.FILTERED:
              usageStats[i][outcome] += stat;
              return;

            case _types__WEBPACK_IMPORTED_MODULE_18__.Outcome.DROPPED:
            case _types__WEBPACK_IMPORTED_MODULE_18__.Outcome.RATE_LIMITED:
            case _types__WEBPACK_IMPORTED_MODULE_18__.Outcome.INVALID:
              usageStats[i].dropped.total += stat; // TODO: add client discards to dropped?

              return;

            default:
              return;
          }
        });
      }); // Invalid and rate_limited data is combined with dropped

      count[_types__WEBPACK_IMPORTED_MODULE_18__.Outcome.DROPPED] += count[_types__WEBPACK_IMPORTED_MODULE_18__.Outcome.INVALID];
      count[_types__WEBPACK_IMPORTED_MODULE_18__.Outcome.DROPPED] += count[_types__WEBPACK_IMPORTED_MODULE_18__.Outcome.RATE_LIMITED];
      usageStats.forEach(stat => {
        var _chartStats$filtered;

        stat.total = stat.accepted + stat.filtered + stat.dropped.total; // Chart Data

        chartStats.accepted.push({
          value: [stat.date, stat.accepted]
        });
        chartStats.dropped.push({
          value: [stat.date, stat.dropped.total]
        });
        (_chartStats$filtered = chartStats.filtered) === null || _chartStats$filtered === void 0 ? void 0 : _chartStats$filtered.push({
          value: [stat.date, stat.filtered]
        });
      });
      return {
        cardStats: {
          total: (0,_utils__WEBPACK_IMPORTED_MODULE_21__.formatUsageWithUnits)(count.total, dataCategory, (0,_utils__WEBPACK_IMPORTED_MODULE_21__.getFormatUsageOptions)(dataCategory)),
          accepted: (0,_utils__WEBPACK_IMPORTED_MODULE_21__.formatUsageWithUnits)(count[_types__WEBPACK_IMPORTED_MODULE_18__.Outcome.ACCEPTED], dataCategory, (0,_utils__WEBPACK_IMPORTED_MODULE_21__.getFormatUsageOptions)(dataCategory)),
          filtered: (0,_utils__WEBPACK_IMPORTED_MODULE_21__.formatUsageWithUnits)(count[_types__WEBPACK_IMPORTED_MODULE_18__.Outcome.FILTERED], dataCategory, (0,_utils__WEBPACK_IMPORTED_MODULE_21__.getFormatUsageOptions)(dataCategory)),
          dropped: (0,_utils__WEBPACK_IMPORTED_MODULE_21__.formatUsageWithUnits)(count[_types__WEBPACK_IMPORTED_MODULE_18__.Outcome.DROPPED], dataCategory, (0,_utils__WEBPACK_IMPORTED_MODULE_21__.getFormatUsageOptions)(dataCategory))
        },
        chartStats
      };
    } catch (err) {
      _sentry_react__WEBPACK_IMPORTED_MODULE_23__.withScope(scope => {
        scope.setContext('query', this.endpointQuery);
        scope.setContext('body', { ...orgStats
        });
        _sentry_react__WEBPACK_IMPORTED_MODULE_23__.captureException(err);
      });
      return {
        cardStats,
        chartStats,
        dataError: new Error('Failed to parse stats data')
      };
    }
  }

  renderCards() {
    const {
      dataCategory,
      dataCategoryName,
      organization
    } = this.props;
    const {
      loading
    } = this.state;
    const {
      total,
      accepted,
      dropped,
      filtered
    } = this.chartData.cardStats;
    const cardMetadata = [{
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.tct)('Total [dataCategory]', {
        dataCategory: dataCategoryName
      }),
      value: total
    }, {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Accepted'),
      help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.tct)('Accepted [dataCategory] were successfully processed by Sentry', {
        dataCategory
      }),
      value: accepted,
      secondaryValue: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(_usageStatsPerMin__WEBPACK_IMPORTED_MODULE_20__["default"], {
        organization: organization,
        dataCategory: dataCategory
      })
    }, {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Filtered'),
      help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.tct)('Filtered [dataCategory] were blocked due to your inbound data filter rules', {
        dataCategory
      }),
      value: filtered
    }, {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Dropped'),
      help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.tct)('Dropped [dataCategory] were discarded due to invalid data, rate-limits, quota limits, or spike protection', {
        dataCategory
      }),
      value: dropped
    }];
    return cardMetadata.map((card, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(StyledScoreCard, {
      title: card.title,
      score: loading ? undefined : card.value,
      help: card.help,
      trend: card.secondaryValue
    }, i));
  }

  renderChart() {
    const {
      dataCategory
    } = this.props;
    const {
      error,
      errors,
      loading
    } = this.state;
    const {
      chartStats,
      dataError,
      chartDateInterval,
      chartDateStart,
      chartDateEnd,
      chartDateUtc,
      chartTransform
    } = this.chartData;
    const hasError = error || !!dataError;
    const chartErrors = dataError ? { ...errors,
      data: dataError
    } : errors; // TODO(ts): AsyncComponent

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(_usageChart__WEBPACK_IMPORTED_MODULE_19__["default"], {
      isLoading: loading,
      isError: hasError,
      errors: chartErrors,
      title: " " // Force the title to be blank
      ,
      footer: this.renderChartFooter(),
      dataCategory: dataCategory,
      dataTransform: chartTransform,
      usageDateStart: chartDateStart,
      usageDateEnd: chartDateEnd,
      usageDateShowUtc: chartDateUtc,
      usageDateInterval: chartDateInterval,
      usageStats: chartStats
    });
  }

  renderComponent() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(react__WEBPACK_IMPORTED_MODULE_5__.Fragment, {
      children: [this.renderCards(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(ChartWrapper, {
        children: this.renderChart()
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (UsageStatsOrganization);

const StyledScoreCard = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_scoreCard__WEBPACK_IMPORTED_MODULE_12__["default"],  true ? {
  target: "e2z08b03"
} : 0)( true ? {
  name: "14rqsjo",
  styles: "grid-column:auto/span 1;margin:0"
} : 0);

const ChartWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e2z08b02"
} : 0)( true ? {
  name: "18iuzk9",
  styles: "grid-column:1/-1"
} : 0);

const Footer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e2z08b01"
} : 0)("display:flex;flex-direction:row;justify-content:space-between;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(3), ";border-top:1px solid ", p => p.theme.border, ";" + ( true ? "" : 0));

const FooterDate = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e2z08b00"
} : 0)("display:flex;flex-direction:row;align-items:center;>", sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_9__.SectionHeading, "{margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1.5), ";}>span:last-child{font-weight:400;font-size:", p => p.theme.fontSizeMedium, ";}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/organizationStats/usageStatsPerMin.tsx":
/*!**********************************************************!*\
  !*** ./app/views/organizationStats/usageStatsPerMin.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./types */ "./app/views/organizationStats/types.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./utils */ "./app/views/organizationStats/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








/**
 * Making 1 extra API call to display this number isn't very efficient.
 * The other approach would be to fetch the data in UsageStatsOrg with 1min
 * interval and roll it up on the frontend, but that (1) adds unnecessary
 * complexity as it's gnarly to fetch + rollup 90 days of 1min intervals,
 * (3) API resultset has a limit of 1000, so 90 days of 1min would not work.
 *
 * We're going with this approach for simplicity sake. By keeping the range
 * as small as possible, this call is quite fast.
 */
class UsageStatsPerMin extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_2__["default"] {
  getEndpoints() {
    return [['orgStats', this.endpointPath, {
      query: this.endpointQuery
    }]];
  }

  get endpointPath() {
    const {
      organization
    } = this.props;
    return `/organizations/${organization.slug}/stats_v2/`;
  }

  get endpointQuery() {
    return {
      statsPeriod: '5m',
      // Any value <1h will return current hour's data
      interval: '1m',
      groupBy: ['category', 'outcome'],
      field: ['sum(quantity)']
    };
  }

  get minuteData() {
    const {
      dataCategory
    } = this.props;
    const {
      loading,
      error,
      orgStats
    } = this.state;

    if (loading || error || !orgStats || orgStats.intervals.length === 0) {
      return undefined;
    } // The last minute in the series is still "in progress"
    // Read data from 2nd last element for the latest complete minute


    const {
      intervals,
      groups
    } = orgStats;
    const lastMin = Math.max(intervals.length - 2, 0);
    const eventsLastMin = groups.reduce((count, group) => {
      const {
        outcome,
        category
      } = group.by; // HACK: The backend enum are singular, but the frontend enums are plural

      if (!dataCategory.includes(`${category}`) || outcome !== _types__WEBPACK_IMPORTED_MODULE_4__.Outcome.ACCEPTED) {
        return count;
      }

      count += group.series['sum(quantity)'][lastMin];
      return count;
    }, 0);
    return (0,_utils__WEBPACK_IMPORTED_MODULE_5__.formatUsageWithUnits)(eventsLastMin, dataCategory, (0,_utils__WEBPACK_IMPORTED_MODULE_5__.getFormatUsageOptions)(dataCategory));
  }

  renderComponent() {
    if (!this.minuteData) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(Wrapper, {
      children: [this.minuteData, " ", (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('in last min')]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (UsageStatsPerMin);

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e2asf1f0"
} : 0)("display:inline-block;color:", p => p.theme.success, ";font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/organizationStats/usageStatsProjects.tsx":
/*!************************************************************!*\
  !*** ./app/views/organizationStats/usageStatsProjects.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SortBy": () => (/* binding */ SortBy),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_components_gridEditable_sortLink__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/gridEditable/sortLink */ "./app/components/gridEditable/sortLink.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/searchBar */ "./app/components/searchBar.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./types */ "./app/views/organizationStats/types.tsx");
/* harmony import */ var _usageTable__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ./usageTable */ "./app/views/organizationStats/usageTable/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




















let SortBy;

(function (SortBy) {
  SortBy["PROJECT"] = "project";
  SortBy["TOTAL"] = "total";
  SortBy["ACCEPTED"] = "accepted";
  SortBy["FILTERED"] = "filtered";
  SortBy["DROPPED"] = "dropped";
  SortBy["INVALID"] = "invalid";
  SortBy["RATE_LIMITED"] = "rate_limited";
})(SortBy || (SortBy = {}));

class UsageStatsProjects extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_5__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeSort", nextKey => {
      const {
        handleChangeState
      } = this.props;
      const {
        key,
        direction
      } = this.tableSort;
      let nextDirection = 1; // Default to descending

      if (key === nextKey) {
        nextDirection = direction * -1; // Toggle if clicking on the same column
      } else if (nextKey === SortBy.PROJECT) {
        nextDirection = -1; // Default PROJECT to ascending
      } // The header uses SortLink, which takes a LocationDescriptor and pushes
      // that to the router. As such, we do not need to update the router in
      // handleChangeState


      return handleChangeState({
        sort: `${nextDirection > 0 ? '-' : ''}${nextKey}`
      }, {
        willUpdateRouter: false
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSearch", query => {
      const {
        handleChangeState,
        tableQuery
      } = this.props;

      if (query === tableQuery) {
        return;
      }

      if (!query) {
        handleChangeState({
          query: undefined,
          cursor: undefined
        });
        return;
      }

      handleChangeState({
        query,
        cursor: undefined
      });
    });
  }

  componentDidUpdate(prevProps) {
    const {
      dataDatetime: prevDateTime,
      dataCategory: prevDataCategory
    } = prevProps;
    const {
      dataDatetime: currDateTime,
      dataCategory: currDataCategory
    } = this.props;

    if (prevDateTime.start !== currDateTime.start || prevDateTime.end !== currDateTime.end || prevDateTime.period !== currDateTime.period || prevDateTime.utc !== currDateTime.utc || currDataCategory !== prevDataCategory) {
      this.reloadData();
    }
  }

  getEndpoints() {
    return [['projectStats', this.endpointPath, {
      query: this.endpointQuery
    }]];
  }

  get endpointPath() {
    const {
      organization
    } = this.props;
    return `/organizations/${organization.slug}/stats_v2/`;
  }

  get endpointQuery() {
    const {
      dataDatetime,
      dataCategory
    } = this.props;
    const queryDatetime = dataDatetime.start && dataDatetime.end ? {
      start: dataDatetime.start,
      end: dataDatetime.end,
      utc: dataDatetime.utc
    } : {
      statsPeriod: dataDatetime.period || sentry_constants__WEBPACK_IMPORTED_MODULE_10__.DEFAULT_STATS_PERIOD
    }; // We do not need more granularity in the data so interval is '1d'

    return { ...queryDatetime,
      interval: (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_6__.getSeriesApiInterval)(dataDatetime),
      groupBy: ['outcome', 'project'],
      field: ['sum(quantity)'],
      project: '-1',
      // get all project user has access to
      category: dataCategory.slice(0, -1) // backend is singular

    };
  }

  get tableData() {
    const {
      projectStats
    } = this.state;
    return {
      headers: this.tableHeader,
      ...this.mapSeriesToTable(projectStats)
    };
  }

  get tableSort() {
    const {
      tableSort
    } = this.props;

    if (!tableSort) {
      return {
        key: SortBy.TOTAL,
        direction: 1
      };
    }

    let key = tableSort;
    let direction = -1;

    if (tableSort.charAt(0) === '-') {
      key = key.slice(1);
      direction = 1;
    }

    switch (key) {
      case SortBy.PROJECT:
      case SortBy.TOTAL:
      case SortBy.ACCEPTED:
      case SortBy.FILTERED:
      case SortBy.DROPPED:
        return {
          key,
          direction
        };

      default:
        return {
          key: SortBy.ACCEPTED,
          direction: -1
        };
    }
  }

  get tableCursor() {
    const {
      tableCursor
    } = this.props;
    const offset = Number(tableCursor === null || tableCursor === void 0 ? void 0 : tableCursor.split(':')[1]);
    return isNaN(offset) ? 0 : offset;
  }
  /**
   * OrganizationStatsEndpointV2 does not have any performance issues. We use
   * client-side pagination to limit the number of rows on the table so the
   * page doesn't scroll too deeply for organizations with a lot of projects
   */


  get pageLink() {
    const numRows = this.filteredProjects.length;
    const offset = this.tableCursor;
    const prevOffset = offset - UsageStatsProjects.MAX_ROWS_USAGE_TABLE;
    const nextOffset = offset + UsageStatsProjects.MAX_ROWS_USAGE_TABLE;
    return `<link>; rel="previous"; results="${prevOffset >= 0}"; cursor="0:${Math.max(0, prevOffset)}:1", <link>; rel="next"; results="${nextOffset < numRows}"; cursor="0:${nextOffset}:0"`;
  }
  /**
   * Filter projects if there's a query
   */


  get filteredProjects() {
    const {
      projects,
      tableQuery
    } = this.props;
    return tableQuery ? projects.filter(p => p.slug.includes(tableQuery) && p.hasAccess) : projects.filter(p => p.hasAccess);
  }

  get tableHeader() {
    const {
      key,
      direction
    } = this.tableSort;

    const getArrowDirection = linkKey => {
      if (linkKey !== key) {
        return undefined;
      }

      return direction > 0 ? 'desc' : 'asc';
    };

    return [{
      key: SortBy.PROJECT,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Project'),
      align: 'left',
      direction: getArrowDirection(SortBy.PROJECT),
      onClick: () => this.handleChangeSort(SortBy.PROJECT)
    }, {
      key: SortBy.TOTAL,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Total'),
      align: 'right',
      direction: getArrowDirection(SortBy.TOTAL),
      onClick: () => this.handleChangeSort(SortBy.TOTAL)
    }, {
      key: SortBy.ACCEPTED,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Accepted'),
      align: 'right',
      direction: getArrowDirection(SortBy.ACCEPTED),
      onClick: () => this.handleChangeSort(SortBy.ACCEPTED)
    }, {
      key: SortBy.FILTERED,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Filtered'),
      align: 'right',
      direction: getArrowDirection(SortBy.FILTERED),
      onClick: () => this.handleChangeSort(SortBy.FILTERED)
    }, {
      key: SortBy.DROPPED,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Dropped'),
      align: 'right',
      direction: getArrowDirection(SortBy.DROPPED),
      onClick: () => this.handleChangeSort(SortBy.DROPPED)
    }].map(h => {
      const Cell = h.key === SortBy.PROJECT ? _usageTable__WEBPACK_IMPORTED_MODULE_16__.CellProject : _usageTable__WEBPACK_IMPORTED_MODULE_16__.CellStat;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(Cell, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_gridEditable_sortLink__WEBPACK_IMPORTED_MODULE_7__["default"], {
          canSort: true,
          title: h.title,
          align: h.align,
          direction: h.direction,
          generateSortLink: h.onClick
        })
      }, h.key);
    });
  }

  getProjectLink(project) {
    const {
      dataCategory,
      getNextLocations,
      organization
    } = this.props;
    const {
      performance,
      projectDetail,
      settings
    } = getNextLocations(project);

    if (dataCategory === sentry_types__WEBPACK_IMPORTED_MODULE_13__.DataCategory.TRANSACTIONS && organization.features.includes('performance-view')) {
      return {
        projectLink: performance,
        projectSettingsLink: settings
      };
    }

    return {
      projectLink: projectDetail,
      projectSettingsLink: settings
    };
  }

  mapSeriesToTable(projectStats) {
    if (!projectStats) {
      return {
        tableStats: []
      };
    }

    const stats = {};

    try {
      const baseStat = {
        [SortBy.TOTAL]: 0,
        [SortBy.ACCEPTED]: 0,
        [SortBy.FILTERED]: 0,
        [SortBy.DROPPED]: 0
      };
      const projectList = this.filteredProjects;
      const projectSet = new Set(projectList.map(p => p.id));
      projectStats.groups.forEach(group => {
        const {
          outcome,
          project: projectId
        } = group.by; // Backend enum is singlar. Frontend enum is plural.

        if (!projectSet.has(projectId.toString())) {
          return;
        }

        if (!stats[projectId]) {
          stats[projectId] = { ...baseStat
          };
        }

        if (outcome !== _types__WEBPACK_IMPORTED_MODULE_15__.Outcome.CLIENT_DISCARD) {
          stats[projectId].total += group.totals['sum(quantity)'];
        }

        if (outcome === _types__WEBPACK_IMPORTED_MODULE_15__.Outcome.ACCEPTED || outcome === _types__WEBPACK_IMPORTED_MODULE_15__.Outcome.FILTERED) {
          stats[projectId][outcome] += group.totals['sum(quantity)'];
        } else if (outcome === _types__WEBPACK_IMPORTED_MODULE_15__.Outcome.RATE_LIMITED || outcome === _types__WEBPACK_IMPORTED_MODULE_15__.Outcome.INVALID || outcome === _types__WEBPACK_IMPORTED_MODULE_15__.Outcome.DROPPED) {
          stats[projectId][SortBy.DROPPED] += group.totals['sum(quantity)'];
        }
      }); // For projects without stats, fill in with zero

      const tableStats = projectList.map(proj => {
        var _stats$proj$id;

        const stat = (_stats$proj$id = stats[proj.id]) !== null && _stats$proj$id !== void 0 ? _stats$proj$id : { ...baseStat
        };
        return {
          project: { ...proj
          },
          ...this.getProjectLink(proj),
          ...stat
        };
      });
      const {
        key,
        direction
      } = this.tableSort;
      tableStats.sort((a, b) => {
        if (key === SortBy.PROJECT) {
          return b.project.slug.localeCompare(a.project.slug) * direction;
        }

        return a[key] !== b[key] ? (b[key] - a[key]) * direction : a.project.slug.localeCompare(b.project.slug);
      });
      const offset = this.tableCursor;
      return {
        tableStats: tableStats.slice(offset, offset + UsageStatsProjects.MAX_ROWS_USAGE_TABLE)
      };
    } catch (err) {
      _sentry_react__WEBPACK_IMPORTED_MODULE_18__.withScope(scope => {
        scope.setContext('query', this.endpointQuery);
        scope.setContext('body', { ...projectStats
        });
        _sentry_react__WEBPACK_IMPORTED_MODULE_18__.captureException(err);
      });
      return {
        tableStats: [],
        error: err
      };
    }
  }

  renderComponent() {
    const {
      error,
      errors,
      loading
    } = this.state;
    const {
      dataCategory,
      loadingProjects,
      tableQuery
    } = this.props;
    const {
      headers,
      tableStats
    } = this.tableData;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(Container, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_9__["default"], {
          defaultQuery: "",
          query: tableQuery,
          placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Filter your projects'),
          onSearch: this.handleSearch
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(Container, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(_usageTable__WEBPACK_IMPORTED_MODULE_16__["default"], {
          isLoading: loading || loadingProjects,
          isError: error,
          errors: errors // TODO(ts)
          ,
          isEmpty: tableStats.length === 0,
          headers: headers,
          dataCategory: dataCategory,
          usageStats: tableStats
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_8__["default"], {
          pageLinks: this.pageLink
        })]
      })]
    });
  }

}

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(UsageStatsProjects, "MAX_ROWS_USAGE_TABLE", 25);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_14__["default"])(UsageStatsProjects));

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1ii6wy90"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(2), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/organizationStats/usageTable/index.tsx":
/*!**********************************************************!*\
  !*** ./app/views/organizationStats/usageTable/index.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CellProject": () => (/* binding */ CellProject),
/* harmony export */   "CellStat": () => (/* binding */ CellStat),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/errorPanel */ "./app/components/charts/errorPanel.tsx");
/* harmony import */ var sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/idBadge */ "./app/components/idBadge/index.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_organizations_headerItem__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/organizations/headerItem */ "./app/components/organizations/headerItem.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_panels_panelTable__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/panels/panelTable */ "./app/components/panels/panelTable.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ../utils */ "./app/views/organizationStats/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

















const DOCS_URL = 'https://docs.sentry.io/product/accounts/membership/#restricting-access';

class UsageTable extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getErrorMessage", errorMessage => {
      if (errorMessage.projectStats.responseJSON.detail === 'No projects available') {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_15__["default"], {
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconWarning, {
            color: "gray300",
            size: "48"
          }),
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)("You don't have access to any projects, or your organization has no projects."),
          description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('Learn more about [link:Project Access]', {
            link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_6__["default"], {
              href: DOCS_URL
            })
          })
        });
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconWarning, {
        color: "gray300",
        size: "48"
      });
    });
  }

  get formatUsageOptions() {
    const {
      dataCategory
    } = this.props;
    return {
      isAbbreviated: dataCategory !== sentry_types__WEBPACK_IMPORTED_MODULE_13__.DataCategory.ATTACHMENTS,
      useUnitScaling: dataCategory === sentry_types__WEBPACK_IMPORTED_MODULE_13__.DataCategory.ATTACHMENTS
    };
  }

  renderTableRow(stat) {
    const {
      dataCategory
    } = this.props;
    const {
      project,
      total,
      accepted,
      filtered,
      dropped
    } = stat;
    return [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(CellProject, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__["default"], {
        to: stat.projectLink,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(StyledIdBadge, {
          avatarSize: 16,
          disableLink: true,
          hideOverflow: true,
          project: project,
          displayName: project.slug
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_organizations_headerItem__WEBPACK_IMPORTED_MODULE_8__.SettingsIconLink, {
        to: stat.projectSettingsLink,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconSettings, {
          size: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_14__["default"].iconSizes.sm
        })
      })]
    }, 0), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(CellStat, {
      children: (0,_utils__WEBPACK_IMPORTED_MODULE_16__.formatUsageWithUnits)(total, dataCategory, this.formatUsageOptions)
    }, 1), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(CellStat, {
      children: (0,_utils__WEBPACK_IMPORTED_MODULE_16__.formatUsageWithUnits)(accepted, dataCategory, this.formatUsageOptions)
    }, 2), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(CellStat, {
      children: (0,_utils__WEBPACK_IMPORTED_MODULE_16__.formatUsageWithUnits)(filtered, dataCategory, this.formatUsageOptions)
    }, 3), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(CellStat, {
      children: (0,_utils__WEBPACK_IMPORTED_MODULE_16__.formatUsageWithUnits)(dropped, dataCategory, this.formatUsageOptions)
    }, 4)];
  }

  render() {
    const {
      isEmpty,
      isLoading,
      isError,
      errors,
      headers,
      usageStats
    } = this.props;

    if (isError) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.Panel, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_4__["default"], {
          height: "256px",
          children: this.getErrorMessage(errors)
        })
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(StyledPanelTable, {
      isLoading: isLoading,
      isEmpty: isEmpty,
      headers: headers,
      children: usageStats.map(s => this.renderTableRow(s))
    });
  }

}

UsageTable.displayName = "UsageTable";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (UsageTable);

const StyledPanelTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels_panelTable__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "e5qzo7m3"
} : 0)("grid-template-columns:repeat(5, auto);@media (min-width: ", p => p.theme.breakpoints.small, "){grid-template-columns:1fr repeat(4, minmax(0, auto));}" + ( true ? "" : 0));

const CellStat = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e5qzo7m2"
} : 0)( true ? {
  name: "10jfpq4",
  styles: "flex-shrink:1;text-align:right;font-variant-numeric:tabular-nums"
} : 0);
const CellProject = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(CellStat,  true ? {
  target: "e5qzo7m1"
} : 0)( true ? {
  name: "1axuxrw",
  styles: "display:flex;align-items:center;text-align:left"
} : 0);

const StyledIdBadge = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e5qzo7m0"
} : 0)( true ? {
  name: "ri00hy",
  styles: "overflow:hidden;white-space:nowrap;flex-shrink:1"
} : 0);

/***/ }),

/***/ "./app/views/organizationStats/utils.tsx":
/*!***********************************************!*\
  !*** ./app/views/organizationStats/utils.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "BILLION": () => (/* binding */ BILLION),
/* harmony export */   "GIGABYTE": () => (/* binding */ GIGABYTE),
/* harmony export */   "MILLION": () => (/* binding */ MILLION),
/* harmony export */   "abbreviateUsageNumber": () => (/* binding */ abbreviateUsageNumber),
/* harmony export */   "formatUsageWithUnits": () => (/* binding */ formatUsageWithUnits),
/* harmony export */   "getFormatUsageOptions": () => (/* binding */ getFormatUsageOptions),
/* harmony export */   "isDisplayUtc": () => (/* binding */ isDisplayUtc)
/* harmony export */ });
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");




const MILLION = 10 ** 6;
const BILLION = 10 ** 9;
const GIGABYTE = 10 ** 9;

/**
 * This expects usage values/quantities for the data categories that we sell.
 *
 * Note: usageQuantity for Attachments should be in BYTES
 */
function formatUsageWithUnits() {
  let usageQuantity = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
  let dataCategory = arguments.length > 1 ? arguments[1] : undefined;
  let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {
    isAbbreviated: false,
    useUnitScaling: false
  };

  if (dataCategory !== sentry_types__WEBPACK_IMPORTED_MODULE_1__.DataCategory.ATTACHMENTS) {
    return options.isAbbreviated ? abbreviateUsageNumber(usageQuantity) : usageQuantity.toLocaleString();
  }

  if (options.useUnitScaling) {
    return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.formatBytesBase10)(usageQuantity);
  }

  const usageGb = usageQuantity / GIGABYTE;
  return options.isAbbreviated ? `${abbreviateUsageNumber(usageGb)} GB` : `${usageGb.toLocaleString(undefined, {
    maximumFractionDigits: 2
  })} GB`;
}
/**
 * Good default for "formatUsageWithUnits"
 */

function getFormatUsageOptions(dataCategory) {
  return {
    isAbbreviated: dataCategory !== sentry_types__WEBPACK_IMPORTED_MODULE_1__.DataCategory.ATTACHMENTS,
    useUnitScaling: dataCategory === sentry_types__WEBPACK_IMPORTED_MODULE_1__.DataCategory.ATTACHMENTS
  };
}
/**
 * Instead of using this function directly, use formatReservedWithUnits or
 * formatUsageWithUnits with options.isAbbreviated to true instead.
 *
 * This function display different precision for billion/million/thousand to
 * provide clarity on usage of errors/transactions/attachments to the user.
 *
 * If you are not displaying usage numbers, it might be better to use
 * `formatAbbreviatedNumber` in 'sentry/utils/formatters'
 */

function abbreviateUsageNumber(n) {
  if (n >= BILLION) {
    return (n / BILLION).toLocaleString(undefined, {
      maximumFractionDigits: 2
    }) + 'B';
  }

  if (n >= MILLION) {
    return (n / MILLION).toLocaleString(undefined, {
      maximumFractionDigits: 1
    }) + 'M';
  }

  if (n >= 1000) {
    return (n / 1000).toFixed().toLocaleString() + 'K';
  } // Do not show decimals


  return n.toFixed().toLocaleString();
}
/**
 * We want to display datetime in UTC in the following situations:
 *
 * 1) The user selected an absolute date range with UTC
 * 2) The user selected a wide date range with 1d interval
 *
 * When the interval is 1d, we need to use UTC because the 24 hour range might
 * shift forward/backward depending on the user's timezone, or it might be
 * displayed as a day earlier/later
 */

function isDisplayUtc(datetime) {
  if (datetime.utc) {
    return true;
  }

  const interval = (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_0__.getSeriesApiInterval)(datetime);
  const hours = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_3__.parsePeriodToHours)(interval);
  return hours >= 24;
}

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_organizationStats_index_tsx.7130a8111350a14927969fdae2fcf562.js.map