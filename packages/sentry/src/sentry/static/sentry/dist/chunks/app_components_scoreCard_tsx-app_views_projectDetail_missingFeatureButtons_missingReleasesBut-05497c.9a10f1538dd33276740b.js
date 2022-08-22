"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_scoreCard_tsx-app_views_projectDetail_missingFeatureButtons_missingReleasesBut-05497c"],{

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

/***/ "./app/views/projectDetail/missingFeatureButtons/missingReleasesButtons.tsx":
/*!**********************************************************************************!*\
  !*** ./app/views/projectDetail/missingFeatureButtons/missingReleasesButtons.tsx ***!
  \**********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/modals/featureTourModal */ "./app/components/modals/featureTourModal.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_views_releases_list_releasesPromo__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/releases/list/releasesPromo */ "./app/views/releases/list/releasesPromo.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








const DOCS_URL = 'https://docs.sentry.io/product/releases/';
const DOCS_HEALTH_URL = 'https://docs.sentry.io/product/releases/health/';

function MissingReleasesButtons(_ref) {
  let {
    organization,
    health,
    projectId
  } = _ref;

  function handleTourAdvance(step, duration) {
    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_4__.trackAnalyticsEvent)({
      eventKey: 'project_detail.releases_tour.advance',
      eventName: 'Project Detail: Releases Tour Advance',
      organization_id: parseInt(organization.id, 10),
      project_id: projectId && parseInt(projectId, 10),
      step,
      duration
    });
  }

  function handleClose(step, duration) {
    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_4__.trackAnalyticsEvent)({
      eventKey: 'project_detail.releases_tour.close',
      eventName: 'Project Detail: Releases Tour Close',
      organization_id: parseInt(organization.id, 10),
      project_id: projectId && parseInt(projectId, 10),
      step,
      duration
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_1__["default"], {
    gap: 1,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_0__["default"], {
      size: "sm",
      priority: "primary",
      external: true,
      href: health ? DOCS_HEALTH_URL : DOCS_URL,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Start Setup')
    }), !health && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_2__["default"], {
      steps: sentry_views_releases_list_releasesPromo__WEBPACK_IMPORTED_MODULE_5__.RELEASES_TOUR_STEPS,
      onAdvance: handleTourAdvance,
      onCloseModal: handleClose,
      doneText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Start Setup'),
      doneUrl: health ? DOCS_HEALTH_URL : DOCS_URL,
      children: _ref2 => {
        let {
          showModal
        } = _ref2;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_0__["default"], {
          size: "sm",
          onClick: showModal,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Get Tour')
        });
      }
    })]
  });
}

MissingReleasesButtons.displayName = "MissingReleasesButtons";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MissingReleasesButtons);

/***/ }),

/***/ "./app/views/releases/utils/index.tsx":
/*!********************************************!*\
  !*** ./app/views/releases/utils/index.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ADOPTION_STAGE_LABELS": () => (/* binding */ ADOPTION_STAGE_LABELS),
/* harmony export */   "CRASH_FREE_DECIMAL_THRESHOLD": () => (/* binding */ CRASH_FREE_DECIMAL_THRESHOLD),
/* harmony export */   "displayCrashFreePercent": () => (/* binding */ displayCrashFreePercent),
/* harmony export */   "displaySessionStatusPercent": () => (/* binding */ displaySessionStatusPercent),
/* harmony export */   "getCrashFreePercent": () => (/* binding */ getCrashFreePercent),
/* harmony export */   "getReleaseBounds": () => (/* binding */ getReleaseBounds),
/* harmony export */   "getReleaseHandledIssuesUrl": () => (/* binding */ getReleaseHandledIssuesUrl),
/* harmony export */   "getReleaseNewIssuesUrl": () => (/* binding */ getReleaseNewIssuesUrl),
/* harmony export */   "getReleaseParams": () => (/* binding */ getReleaseParams),
/* harmony export */   "getReleaseUnhandledIssuesUrl": () => (/* binding */ getReleaseUnhandledIssuesUrl),
/* harmony export */   "getSessionStatusPercent": () => (/* binding */ getSessionStatusPercent),
/* harmony export */   "isMobileRelease": () => (/* binding */ isMobileRelease),
/* harmony export */   "isReleaseArchived": () => (/* binding */ isReleaseArchived),
/* harmony export */   "roundDuration": () => (/* binding */ roundDuration)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var lodash_round__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/round */ "../node_modules/lodash/round.js");
/* harmony import */ var lodash_round__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_round__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/constants/pageFilters */ "./app/constants/pageFilters.tsx");
/* harmony import */ var sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/data/platformCategories */ "./app/data/platformCategories.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_views_issueList_utils__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/issueList/utils */ "./app/views/issueList/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");















const CRASH_FREE_DECIMAL_THRESHOLD = 95;
const roundDuration = seconds => {
  return lodash_round__WEBPACK_IMPORTED_MODULE_3___default()(seconds, seconds > 60 ? 0 : 3);
};
const getCrashFreePercent = function (percent) {
  let decimalThreshold = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : CRASH_FREE_DECIMAL_THRESHOLD;
  let decimalPlaces = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 3;
  const roundedValue = lodash_round__WEBPACK_IMPORTED_MODULE_3___default()(percent, percent > decimalThreshold ? decimalPlaces : 0);

  if (roundedValue === 100 && percent < 100) {
    return Math.floor(percent * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces);
  }

  return roundedValue;
};
const displayCrashFreePercent = function (percent) {
  let decimalThreshold = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : CRASH_FREE_DECIMAL_THRESHOLD;
  let decimalPlaces = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 3;

  if (isNaN(percent)) {
    return '\u2015';
  }

  if (percent < 1 && percent > 0) {
    return `<1\u0025`;
  }

  const rounded = getCrashFreePercent(percent, decimalThreshold, decimalPlaces).toLocaleString();
  return `${rounded}\u0025`;
};
const getSessionStatusPercent = function (percent) {
  let absolute = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
  return lodash_round__WEBPACK_IMPORTED_MODULE_3___default()(absolute ? Math.abs(percent) : percent, 3);
};
const displaySessionStatusPercent = function (percent) {
  let absolute = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
  return `${getSessionStatusPercent(percent, absolute).toLocaleString()}\u0025`;
};
const getReleaseNewIssuesUrl = (orgSlug, projectId, version) => {
  return {
    pathname: `/organizations/${orgSlug}/issues/`,
    query: {
      project: projectId,
      // we are resetting time selector because releases' new issues count doesn't take time selector into account
      statsPeriod: undefined,
      start: undefined,
      end: undefined,
      query: new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_12__.MutableSearch([`firstRelease:${version}`]).formatString(),
      sort: sentry_views_issueList_utils__WEBPACK_IMPORTED_MODULE_13__.IssueSortOptions.FREQ
    }
  };
};
const getReleaseUnhandledIssuesUrl = function (orgSlug, projectId, version) {
  let dateTime = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
  return {
    pathname: `/organizations/${orgSlug}/issues/`,
    query: { ...dateTime,
      project: projectId,
      query: new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_12__.MutableSearch([`release:${version}`, 'error.unhandled:true']).formatString(),
      sort: sentry_views_issueList_utils__WEBPACK_IMPORTED_MODULE_13__.IssueSortOptions.FREQ
    }
  };
};
const getReleaseHandledIssuesUrl = function (orgSlug, projectId, version) {
  let dateTime = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
  return {
    pathname: `/organizations/${orgSlug}/issues/`,
    query: { ...dateTime,
      project: projectId,
      query: new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_12__.MutableSearch([`release:${version}`, 'error.handled:true']).formatString(),
      sort: sentry_views_issueList_utils__WEBPACK_IMPORTED_MODULE_13__.IssueSortOptions.FREQ
    }
  };
};
const isReleaseArchived = release => release.status === sentry_types__WEBPACK_IMPORTED_MODULE_10__.ReleaseStatus.Archived;
function getReleaseBounds(release) {
  var _ref;

  const retentionBound = moment__WEBPACK_IMPORTED_MODULE_4___default()().subtract(90, 'days');
  const {
    lastEvent,
    currentProjectMeta,
    dateCreated
  } = release || {};
  const {
    sessionsUpperBound
  } = currentProjectMeta || {};
  let type = 'normal';
  let releaseStart = moment__WEBPACK_IMPORTED_MODULE_4___default()(dateCreated).startOf('minute');
  let releaseEnd = moment__WEBPACK_IMPORTED_MODULE_4___default()((_ref = moment__WEBPACK_IMPORTED_MODULE_4___default()(sessionsUpperBound).isAfter(lastEvent) ? sessionsUpperBound : lastEvent) !== null && _ref !== void 0 ? _ref : undefined).endOf('minute');

  if (moment__WEBPACK_IMPORTED_MODULE_4___default()(releaseStart).isSame(releaseEnd, 'minute')) {
    releaseEnd = moment__WEBPACK_IMPORTED_MODULE_4___default()(releaseEnd).add(1, 'minutes');
  }

  if (releaseStart.isBefore(retentionBound)) {
    releaseStart = retentionBound;
    type = 'clamped';

    if (releaseEnd.isBefore(releaseStart) || !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_11__.defined)(sessionsUpperBound) && !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_11__.defined)(lastEvent)) {
      releaseEnd = moment__WEBPACK_IMPORTED_MODULE_4___default()();
      type = 'ancient';
    }
  }

  return {
    type,
    releaseStart: releaseStart.utc().format(),
    releaseEnd: releaseEnd.utc().format()
  };
}
function getReleaseParams(_ref2) {
  let {
    location,
    releaseBounds
  } = _ref2;
  const params = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_6__.normalizeDateTimeParams)(lodash_pick__WEBPACK_IMPORTED_MODULE_2___default()(location.query, [...Object.values(sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_7__.URL_PARAM), ...Object.values(sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_7__.PAGE_URL_PARAM), 'cursor']), {
    allowAbsolutePageDatetime: true,
    allowEmptyPeriod: true
  });

  if (!Object.keys(params).some(param => [sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_7__.URL_PARAM.START, sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_7__.URL_PARAM.END, sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_7__.URL_PARAM.UTC, sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_7__.URL_PARAM.PERIOD].includes(param))) {
    params[sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_7__.URL_PARAM.START] = releaseBounds.releaseStart;
    params[sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_7__.URL_PARAM.END] = releaseBounds.releaseEnd;
  }

  return params;
}

const adoptionStagesLink = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_5__["default"], {
  href: "https://docs.sentry.io/product/releases/health/#adoption-stages"
});

const ADOPTION_STAGE_LABELS = {
  low_adoption: {
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Low Adoption'),
    tooltipTitle: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)('This release has a low percentage of sessions compared to other releases in this project. [link:Learn more]', {
      link: adoptionStagesLink
    }),
    type: 'warning'
  },
  adopted: {
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Adopted'),
    tooltipTitle: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)('This release has a high percentage of sessions compared to other releases in this project. [link:Learn more]', {
      link: adoptionStagesLink
    }),
    type: 'success'
  },
  replaced: {
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Replaced'),
    tooltipTitle: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)('This release was previously Adopted, but now has a lower level of sessions compared to other releases in this project. [link:Learn more]', {
      link: adoptionStagesLink
    }),
    type: 'default'
  }
};
const isMobileRelease = releaseProjectPlatform => [...sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_8__.mobile, ...sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_8__.desktop].includes(releaseProjectPlatform);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_scoreCard_tsx-app_views_projectDetail_missingFeatureButtons_missingReleasesBut-05497c.c20b4fd7f6ec44684ae1ef537590d18e.js.map