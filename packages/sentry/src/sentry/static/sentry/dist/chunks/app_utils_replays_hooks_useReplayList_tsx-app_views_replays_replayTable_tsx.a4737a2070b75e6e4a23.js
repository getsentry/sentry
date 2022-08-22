"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_utils_replays_hooks_useReplayList_tsx-app_views_replays_replayTable_tsx"],{

/***/ "./app/components/replays/replayHighlight.tsx":
/*!****************************************************!*\
  !*** ./app/components/replays/replayHighlight.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_scoreBar__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/scoreBar */ "./app/components/scoreBar.tsx");
/* harmony import */ var sentry_constants_chartPalette__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/constants/chartPalette */ "./app/constants/chartPalette.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




const palette = new Array(10).fill([sentry_constants_chartPalette__WEBPACK_IMPORTED_MODULE_2__["default"][0][0]]);

function ReplayHighlight(_ref) {
  let {
    replay
  } = _ref;
  let score = 1;

  if (replay) {
    const {
      countErrors,
      duration,
      urls
    } = replay;
    const pagesVisited = urls.length;
    const pagesVisitedOverTime = pagesVisited / (duration || 1);
    score = (countErrors * 25 + pagesVisited * 5 + pagesVisitedOverTime) / 10; // negatively score sub 5 second replays

    if (duration <= 5) {
      score = score - 10 / (duration || 1);
    }

    score = Math.floor(Math.min(10, Math.max(1, score)));
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_scoreBar__WEBPACK_IMPORTED_MODULE_1__["default"], {
    size: 20,
    score: score,
    palette: palette,
    radius: 0
  });
}

ReplayHighlight.displayName = "ReplayHighlight";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReplayHighlight);

/***/ }),

/***/ "./app/utils/replays/hooks/useReplayList.tsx":
/*!***************************************************!*\
  !*** ./app/utils/replays/hooks/useReplayList.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DEFAULT_SORT": () => (/* binding */ DEFAULT_SORT),
/* harmony export */   "REPLAY_LIST_FIELDS": () => (/* binding */ REPLAY_LIST_FIELDS),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_utils_replays_replayDataUtils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/replays/replayDataUtils */ "./app/utils/replays/replayDataUtils.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_useLocation__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/useLocation */ "./app/utils/useLocation.tsx");






const DEFAULT_SORT = '-startedAt';
const REPLAY_LIST_FIELDS = ['countErrors', 'duration', 'finishedAt', 'id', 'projectId', 'startedAt', 'urls', 'user'];

function useReplayList(_ref) {
  let {
    eventView,
    organization
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_3__["default"])();
  const location = (0,sentry_utils_useLocation__WEBPACK_IMPORTED_MODULE_4__.useLocation)();
  const [data, setData] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)({
    fetchError: undefined,
    isFetching: true,
    pageLinks: null,
    replays: []
  });
  const init = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async () => {
    try {
      var _resp$getResponseHead;

      setData(prev => ({ ...prev,
        isFetching: true
      }));
      const path = `/organizations/${organization.slug}/replays/`;
      const [{
        data: records
      }, _textStatus, resp] = await api.requestPromise(path, {
        includeAllArgs: true,
        query: { ...eventView.getEventsAPIPayload(location),
          cursor: location.query.cursor
        }
      });
      const pageLinks = (_resp$getResponseHead = resp === null || resp === void 0 ? void 0 : resp.getResponseHeader('Link')) !== null && _resp$getResponseHead !== void 0 ? _resp$getResponseHead : '';
      setData({
        fetchError: undefined,
        isFetching: false,
        pageLinks,
        replays: records.map(sentry_utils_replays_replayDataUtils__WEBPACK_IMPORTED_MODULE_2__.mapResponseToReplayRecord)
      });
    } catch (error) {
      _sentry_react__WEBPACK_IMPORTED_MODULE_5__.captureException(error);
      setData({
        fetchError: error,
        isFetching: false,
        pageLinks: null,
        replays: []
      });
    }
  }, [api, organization, location, eventView]);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    init();
  }, [init]);
  return data;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (useReplayList);

/***/ }),

/***/ "./app/views/replays/replayTable.tsx":
/*!*******************************************!*\
  !*** ./app/views/replays/replayTable.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var sentry_components_duration__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/duration */ "./app/components/duration.tsx");
/* harmony import */ var sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/idBadge/projectBadge */ "./app/components/idBadge/projectBadge.tsx");
/* harmony import */ var sentry_components_idBadge_userBadge__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/idBadge/userBadge */ "./app/components/idBadge/userBadge.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_replays_replayHighlight__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/replays/replayHighlight */ "./app/components/replays/replayHighlight.tsx");
/* harmony import */ var sentry_components_replays_walker_urlWalker__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/replays/walker/urlWalker */ "./app/components/replays/walker/urlWalker.tsx");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_useLocation__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/useLocation */ "./app/utils/useLocation.tsx");
/* harmony import */ var sentry_utils_useMedia__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/useMedia */ "./app/utils/useMedia.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/useProjects */ "./app/utils/useProjects.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }





















function SortableHeader(_ref) {
  let {
    fieldName,
    label,
    sort
  } = _ref;
  const location = (0,sentry_utils_useLocation__WEBPACK_IMPORTED_MODULE_13__.useLocation)();
  const arrowDirection = sort.kind === 'asc' ? 'up' : 'down';

  const sortArrow = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconArrow, {
    color: "gray300",
    size: "xs",
    direction: arrowDirection
  });

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(SortLink, {
    role: "columnheader",
    "aria-sort": sort.field.endsWith(fieldName) ? sort.kind === 'asc' ? 'ascending' : 'descending' : 'none',
    to: {
      pathname: location.pathname,
      query: { ...location.query,
        sort: sort.kind === 'desc' ? fieldName : '-' + fieldName
      }
    },
    children: [label, " ", sort.field === fieldName && sortArrow]
  });
}

SortableHeader.displayName = "SortableHeader";

function ReplayTable(_ref2) {
  let {
    isFetching,
    replays,
    showProjectColumn,
    sort
  } = _ref2;
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_15__["default"])();
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_18__.a)();
  const minWidthIsSmall = (0,sentry_utils_useMedia__WEBPACK_IMPORTED_MODULE_14__["default"])(`(min-width: ${theme.breakpoints.small})`);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(StyledPanelTable, {
    isLoading: isFetching,
    isEmpty: (replays === null || replays === void 0 ? void 0 : replays.length) === 0,
    showProjectColumn: showProjectColumn,
    headers: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Session'), showProjectColumn && minWidthIsSmall ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(SortableHeader, {
      sort: sort,
      fieldName: "projectId",
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Project')
    }, "projectId") : null, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(SortableHeader, {
      sort: sort,
      fieldName: "startedAt",
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Start Time')
    }, "startedAt"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(SortableHeader, {
      sort: sort,
      fieldName: "duration",
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Duration')
    }, "duration"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(SortableHeader, {
      sort: sort,
      fieldName: "countErrors",
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Errors')
    }, "countErrors"), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Activity')].filter(Boolean),
    children: replays === null || replays === void 0 ? void 0 : replays.map(replay => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(ReplayTableRow, {
      replay: replay,
      organization: organization,
      showProjectColumn: showProjectColumn,
      minWidthIsSmall: minWidthIsSmall
    }, replay.id))
  });
}

ReplayTable.displayName = "ReplayTable";

function ReplayTableRow(_ref3) {
  let {
    minWidthIsSmall,
    organization,
    replay,
    showProjectColumn
  } = _ref3;
  const {
    projects
  } = (0,sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_16__["default"])();
  const project = projects.find(p => p.id === replay.projectId);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_idBadge_userBadge__WEBPACK_IMPORTED_MODULE_4__["default"], {
      avatarSize: 32,
      displayName: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__["default"], {
        to: `/organizations/${organization.slug}/replays/${project === null || project === void 0 ? void 0 : project.slug}:${replay.id}/`,
        children: replay.user.username || replay.user.name || replay.user.email || replay.user.ip_address || replay.user.id || ''
      }),
      user: replay.user // this is the subheading for the avatar, so displayEmail in this case is a misnomer
      ,
      displayEmail: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_replays_walker_urlWalker__WEBPACK_IMPORTED_MODULE_8__.StringWalker, {
        urls: replay.urls
      })
    }), showProjectColumn && minWidthIsSmall && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(Item, {
      children: project ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_3__["default"], {
        project: project,
        avatarSize: 16
      }) : null
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(Item, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(TimeSinceWrapper, {
        children: [minWidthIsSmall && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(StyledIconCalendarWrapper, {
          color: "gray500",
          size: "sm"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_9__["default"], {
          date: replay.startedAt
        })]
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(Item, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_duration__WEBPACK_IMPORTED_MODULE_2__["default"], {
        seconds: Math.floor(replay.duration),
        exact: true,
        abbreviation: true
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(Item, {
      children: replay.countErrors || 0
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(Item, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_replays_replayHighlight__WEBPACK_IMPORTED_MODULE_7__["default"], {
        replay: replay
      })
    })]
  });
}

ReplayTableRow.displayName = "ReplayTableRow";

const StyledPanelTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelTable,  true ? {
  target: "e1imgzw04"
} : 0)(p => p.showProjectColumn ? `grid-template-columns: minmax(0, 1fr) repeat(5, max-content);` : `grid-template-columns: minmax(0, 1fr) repeat(4, max-content);`, "@media (max-width: ", p => p.theme.breakpoints.small, "){grid-template-columns:minmax(0, 1fr) repeat(4, max-content);}" + ( true ? "" : 0));

const SortLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e1imgzw03"
} : 0)( true ? {
  name: "1qowyn7",
  styles: "color:inherit;:hover{color:inherit;}svg{vertical-align:top;}"
} : 0);

const Item = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1imgzw02"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const TimeSinceWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1imgzw01"
} : 0)("display:grid;grid-template-columns:repeat(2, minmax(auto, max-content));align-items:center;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";" + ( true ? "" : 0));

const StyledIconCalendarWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconCalendar,  true ? {
  target: "e1imgzw00"
} : 0)( true ? {
  name: "hbxqi1",
  styles: "position:relative;top:-1px"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReplayTable);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_utils_replays_hooks_useReplayList_tsx-app_views_replays_replayTable_tsx.9961c9d5ea1fbfae7aff1693ace2de06.js.map