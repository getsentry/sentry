"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_collapsePanel_tsx-app_views_organizationStats_teamInsights_controls_tsx-app_vi-0496da"],{

/***/ "./app/components/collapsePanel.tsx":
/*!******************************************!*\
  !*** ./app/components/collapsePanel.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "COLLAPSE_COUNT": () => (/* binding */ COLLAPSE_COUNT),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }








const COLLAPSE_COUNT = 5;

/**
 * Used to expand results.
 *
 * Our collapsible component was not used because we want our
 * expand button to be outside the list of children
 *
 */
function CollapsePanel(_ref) {
  let {
    items,
    children,
    buttonTitle,
    collapseCount = COLLAPSE_COUNT,
    disableBorder = true
  } = _ref;
  const [isExpanded, setIsExpanded] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(false);

  function expandResults() {
    setIsExpanded(true);
  }

  return children({
    isExpanded,
    showMoreButton: isExpanded || items <= collapseCount ? null : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(ShowMoreButton, {
      items: items,
      buttonTitle: buttonTitle,
      collapseCount: collapseCount,
      disableBorder: disableBorder,
      onClick: expandResults
    })
  });
}

function ShowMoreButton(_ref2) {
  let {
    items,
    buttonTitle = 'More',
    collapseCount = COLLAPSE_COUNT,
    disableBorder = true,
    onClick
  } = _ref2;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(ShowMore, {
    onClick: onClick,
    role: "button",
    "data-test-id": "collapse-show-more",
    disableBorder: disableBorder,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(ShowMoreText, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(StyledIconList, {
        color: "gray300"
      }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)('Show [count] [buttonTitle]', {
        count: items - collapseCount,
        buttonTitle
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconChevron, {
      color: "gray300",
      direction: "down"
    })]
  });
}

ShowMoreButton.displayName = "ShowMoreButton";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (CollapsePanel);

const ShowMore = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1dsvobb2"
} : 0)("display:flex;align-items:center;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(2), ";font-size:", p => p.theme.fontSizeMedium, ";color:", p => p.theme.subText, ";cursor:pointer;border-top:1px solid ", p => p.theme.border, ";", p => !p.disableBorder && /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_7__.css)("border-left:1px solid ", p.theme.border, ";border-right:1px solid ", p.theme.border, ";border-bottom:1px solid ", p.theme.border, ";border-bottom-left-radius:", p.theme.borderRadius, ";border-bottom-right-radius:", p.theme.borderRadius, ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(2), ";" + ( true ? "" : 0),  true ? "" : 0), ";" + ( true ? "" : 0));

const StyledIconList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconList,  true ? {
  target: "e1dsvobb1"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), ";" + ( true ? "" : 0));

const ShowMoreText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1dsvobb0"
} : 0)( true ? {
  name: "18keaja",
  styles: "display:flex;align-items:center;flex-grow:1"
} : 0);

/***/ }),

/***/ "./app/views/organizationStats/teamInsights/controls.tsx":
/*!***************************************************************!*\
  !*** ./app/views/organizationStats/teamInsights/controls.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var lodash_uniq__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/uniq */ "../node_modules/lodash/uniq.js");
/* harmony import */ var lodash_uniq__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_uniq__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_components_forms_teamSelector__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/teamSelector */ "./app/components/forms/teamSelector.tsx");
/* harmony import */ var sentry_components_pageTimeRangeSelector__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/pageTimeRangeSelector */ "./app/components/pageTimeRangeSelector.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_isActiveSuperuser__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/isActiveSuperuser */ "./app/utils/isActiveSuperuser.tsx");
/* harmony import */ var sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/localStorage */ "./app/utils/localStorage.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/useProjects */ "./app/utils/useProjects.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./utils */ "./app/views/organizationStats/teamInsights/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

















const INSIGHTS_DEFAULT_STATS_PERIOD = '8w';
const PAGE_QUERY_PARAMS = ['pageStatsPeriod', 'pageStart', 'pageEnd', 'pageUtc', 'dataCategory', 'transform', 'sort', 'query', 'cursor', 'team', 'environment'];

function TeamStatsControls(_ref) {
  var _currentTeam$projects, _location$query;

  let {
    location,
    router,
    currentTeam,
    currentEnvironment,
    showEnvironment
  } = _ref;
  const {
    projects
  } = (0,sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_13__["default"])({
    slugs: (_currentTeam$projects = currentTeam === null || currentTeam === void 0 ? void 0 : currentTeam.projects.map(project => project.slug)) !== null && _currentTeam$projects !== void 0 ? _currentTeam$projects : []
  });
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_12__["default"])();
  const isSuperuser = (0,sentry_utils_isActiveSuperuser__WEBPACK_IMPORTED_MODULE_10__.isActiveSuperuser)();
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_15__.a)();
  const query = (_location$query = location === null || location === void 0 ? void 0 : location.query) !== null && _location$query !== void 0 ? _location$query : {};
  const localStorageKey = `teamInsightsSelectedTeamId:${organization.slug}`;

  function handleChangeTeam(teamId) {
    sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_11__["default"].setItem(localStorageKey, teamId); // TODO(workflow): Preserve environment if it exists for the new team

    setStateOnUrl({
      team: teamId,
      environment: undefined
    });
  }

  function handleEnvironmentChange(_ref2) {
    let {
      value
    } = _ref2;

    if (value === '') {
      setStateOnUrl({
        environment: undefined
      });
    } else {
      setStateOnUrl({
        environment: value
      });
    }
  }

  function handleUpdateDatetime(datetime) {
    const {
      start,
      end,
      relative,
      utc
    } = datetime;

    if (start && end) {
      const parser = utc ? (moment__WEBPACK_IMPORTED_MODULE_4___default().utc) : (moment__WEBPACK_IMPORTED_MODULE_4___default());
      return setStateOnUrl({
        pageStatsPeriod: undefined,
        pageStart: parser(start).format(),
        pageEnd: parser(end).format(),
        pageUtc: utc !== null && utc !== void 0 ? utc : undefined
      });
    }

    return setStateOnUrl({
      pageStatsPeriod: relative || undefined,
      pageStart: undefined,
      pageEnd: undefined,
      pageUtc: undefined
    });
  }

  function setStateOnUrl(nextState) {
    const nextQueryParams = lodash_pick__WEBPACK_IMPORTED_MODULE_2___default()(nextState, PAGE_QUERY_PARAMS);
    const nextLocation = { ...location,
      query: { ...query,
        ...nextQueryParams
      }
    };
    router.push(nextLocation);
    return nextLocation;
  }

  const {
    period,
    start,
    end,
    utc
  } = (0,_utils__WEBPACK_IMPORTED_MODULE_14__.dataDatetime)(query);
  const environmentOptions = lodash_uniq__WEBPACK_IMPORTED_MODULE_3___default()(projects.map(project => project.environments).flat()).map(env => ({
    label: env,
    value: env
  }));
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(ControlsWrapper, {
    showEnvironment: showEnvironment,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledTeamSelector, {
      name: "select-team",
      inFieldLabel: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Team: '),
      value: currentTeam === null || currentTeam === void 0 ? void 0 : currentTeam.slug,
      onChange: choice => handleChangeTeam(choice.actor.id),
      teamFilter: isSuperuser ? undefined : filterTeam => filterTeam.isMember,
      styles: {
        singleValue(provided) {
          const custom = {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: theme.fontSizeMedium,
            ':before': { ...provided[':before'],
              color: theme.textColor,
              marginRight: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1.5),
              marginLeft: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(0.5)
            }
          };
          return { ...provided,
            ...custom
          };
        },

        input: (provided, state) => ({ ...provided,
          display: 'grid',
          gridTemplateColumns: 'max-content 1fr',
          alignItems: 'center',
          gridGap: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1),
          ':before': {
            backgroundColor: state.theme.backgroundSecondary,
            height: 24,
            width: 38,
            borderRadius: 3,
            content: '""',
            display: 'block'
          }
        })
      }
    }), showEnvironment && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_5__["default"], {
      options: [{
        value: '',
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('All')
      }, ...environmentOptions],
      value: currentEnvironment !== null && currentEnvironment !== void 0 ? currentEnvironment : '',
      onChange: handleEnvironmentChange,
      styles: {
        input: provided => ({ ...provided,
          display: 'grid',
          gridTemplateColumns: 'max-content 1fr',
          alignItems: 'center',
          gridGap: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1),
          ':before': {
            height: 24,
            width: 90,
            borderRadius: 3,
            content: '""',
            display: 'block'
          }
        }),
        control: base => ({ ...base,
          boxShadow: 'none'
        }),
        singleValue: base => ({ ...base,
          fontSize: theme.fontSizeMedium,
          display: 'flex',
          ':before': { ...base[':before'],
            color: theme.textColor,
            marginRight: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1.5)
          }
        })
      },
      inFieldLabel: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Environment:')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledPageTimeRangeSelector, {
      organization: organization,
      relative: period !== null && period !== void 0 ? period : '',
      start: start !== null && start !== void 0 ? start : null,
      end: end !== null && end !== void 0 ? end : null,
      utc: utc !== null && utc !== void 0 ? utc : null,
      onUpdate: handleUpdateDatetime,
      showAbsolute: false,
      relativeOptions: {
        '14d': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Last 2 weeks'),
        '4w': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Last 4 weeks'),
        [INSIGHTS_DEFAULT_STATS_PERIOD]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Last 8 weeks'),
        '12w': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Last 12 weeks')
      }
    })]
  });
}

TeamStatsControls.displayName = "TeamStatsControls";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TeamStatsControls);

const ControlsWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "epxns6w2"
} : 0)("display:grid;align-items:center;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(2), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(2), ";@media (min-width: ", p => p.theme.breakpoints.small, "){grid-template-columns:246px ", p => p.showEnvironment ? '246px' : '', " 1fr;}" + ( true ? "" : 0));

const StyledTeamSelector = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_forms_teamSelector__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "epxns6w1"
} : 0)("&>div{box-shadow:", p => p.theme.dropShadowLight, ";}" + ( true ? "" : 0));

const StyledPageTimeRangeSelector = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_pageTimeRangeSelector__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "epxns6w0"
} : 0)( true ? {
  name: "j6w5js",
  styles: "height:40px;div{min-height:unset;}"
} : 0);

/***/ }),

/***/ "./app/views/organizationStats/teamInsights/descriptionCard.tsx":
/*!**********************************************************************!*\
  !*** ./app/views/organizationStats/teamInsights/descriptionCard.tsx ***!
  \**********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }





function DescriptionCard(_ref) {
  let {
    title,
    description,
    children
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)(Wrapper, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)(LeftPanel, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(Title, {
        children: title
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(Description, {
        children: description
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(RightPanel, {
      children: children
    })]
  });
}

DescriptionCard.displayName = "DescriptionCard";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DescriptionCard);

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eyf29hd4"
} : 0)("border:1px solid ", p => p.theme.border, ";border-radius:", p => p.theme.borderRadius, ";display:flex;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(3), ";flex-direction:column;@media (min-width: ", p => p.theme.breakpoints.medium, "){flex-direction:row;}" + ( true ? "" : 0));

const LeftPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eyf29hd3"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(2), ";border-bottom:1px solid ", p => p.theme.border, ";@media (min-width: ", p => p.theme.breakpoints.medium, "){max-width:250px;border-right:1px solid ", p => p.theme.border, ";border-bottom:0;}" + ( true ? "" : 0));

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eyf29hd2"
} : 0)("font-size:", p => p.theme.fontSizeLarge, ";margin:0 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(0.5), ";" + ( true ? "" : 0));

const Description = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eyf29hd1"
} : 0)("color:", p => p.theme.subText, ";font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

const RightPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eyf29hd0"
} : 0)( true ? {
  name: "1ff36h2",
  styles: "flex-grow:1"
} : 0);

/***/ }),

/***/ "./app/views/organizationStats/teamInsights/styles.tsx":
/*!*************************************************************!*\
  !*** ./app/views/organizationStats/teamInsights/styles.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ProjectBadge": () => (/* binding */ ProjectBadge),
/* harmony export */   "ProjectBadgeContainer": () => (/* binding */ ProjectBadgeContainer)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/idBadge */ "./app/components/idBadge/index.tsx");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


const ProjectBadgeContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1l696dj1"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);
const ProjectBadge = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "e1l696dj0"
} : 0)( true ? {
  name: "ozd7xs",
  styles: "flex-shrink:0"
} : 0);

/***/ }),

/***/ "./app/views/organizationStats/teamInsights/utils.tsx":
/*!************************************************************!*\
  !*** ./app/views/organizationStats/teamInsights/utils.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "barAxisLabel": () => (/* binding */ barAxisLabel),
/* harmony export */   "convertDayValueObjectToSeries": () => (/* binding */ convertDayValueObjectToSeries),
/* harmony export */   "dataDatetime": () => (/* binding */ dataDatetime),
/* harmony export */   "groupByTrend": () => (/* binding */ groupByTrend),
/* harmony export */   "sortSeriesByDay": () => (/* binding */ sortSeriesByDay)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");




/**
 * Buckets a week of sequential days into one data unit
 */
function sortSeriesByDay(data) {
  return data.sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
}
/**
 * Convert an object with date as the key to a series
 */

function convertDayValueObjectToSeries(data) {
  return Object.entries(data).map(_ref => {
    let [bucket, count] = _ref;
    return {
      value: count,
      name: new Date(bucket).getTime()
    };
  });
}
/**
 * Takes a sorted array of trend items and groups them by worst/better/no chagne
 */

function groupByTrend(data) {
  const worseItems = data.filter(x => Math.round(x.trend) < 0);
  const betterItems = data.filter(x => Math.round(x.trend) > 0);
  const zeroItems = data.filter(x => Math.round(x.trend) === 0);
  return [...worseItems, ...betterItems, ...zeroItems];
}
const barAxisLabel = dataEntries => {
  return {
    splitNumber: Math.max(Math.round(dataEntries / 7), 4),
    type: 'category',
    axisTick: {
      alignWithLabel: true
    },
    axisLabel: {
      formatter: date => {
        return moment__WEBPACK_IMPORTED_MODULE_1___default()(new Date(Number(date))).format('MMM D');
      }
    }
  };
};
const INSIGHTS_DEFAULT_STATS_PERIOD = '8w';
function dataDatetime(query) {
  const {
    start,
    end,
    statsPeriod,
    utc: utcString
  } = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_2__.normalizeDateTimeParams)(query, {
    allowEmptyPeriod: true,
    allowAbsoluteDatetime: true,
    allowAbsolutePageDatetime: true
  });

  if (!statsPeriod && !start && !end) {
    return {
      period: INSIGHTS_DEFAULT_STATS_PERIOD
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
      start: moment__WEBPACK_IMPORTED_MODULE_1___default().utc(start).format(),
      end: moment__WEBPACK_IMPORTED_MODULE_1___default().utc(end).format(),
      utc
    } : {
      start: moment__WEBPACK_IMPORTED_MODULE_1___default()(start).utc().format(),
      end: moment__WEBPACK_IMPORTED_MODULE_1___default()(end).utc().format(),
      utc
    };
  }

  return {
    period: INSIGHTS_DEFAULT_STATS_PERIOD
  };
}

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_collapsePanel_tsx-app_views_organizationStats_teamInsights_controls_tsx-app_vi-0496da.5ee9fbf0326db9bc82c65fb0823c085a.js.map