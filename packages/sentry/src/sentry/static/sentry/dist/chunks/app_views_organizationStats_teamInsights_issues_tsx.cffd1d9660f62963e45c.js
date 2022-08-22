"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_organizationStats_teamInsights_issues_tsx"],{

/***/ "./app/views/organizationStats/teamInsights/issues.tsx":
/*!*************************************************************!*\
  !*** ./app/views/organizationStats/teamInsights/issues.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_noProjectMessage__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/noProjectMessage */ "./app/components/noProjectMessage.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/localStorage */ "./app/utils/localStorage.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var sentry_utils_useTeams__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/useTeams */ "./app/utils/useTeams.tsx");
/* harmony import */ var _header__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ../header */ "./app/views/organizationStats/header.tsx");
/* harmony import */ var _controls__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./controls */ "./app/views/organizationStats/teamInsights/controls.tsx");
/* harmony import */ var _descriptionCard__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./descriptionCard */ "./app/views/organizationStats/teamInsights/descriptionCard.tsx");
/* harmony import */ var _teamIssuesAge__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./teamIssuesAge */ "./app/views/organizationStats/teamInsights/teamIssuesAge.tsx");
/* harmony import */ var _teamIssuesBreakdown__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./teamIssuesBreakdown */ "./app/views/organizationStats/teamInsights/teamIssuesBreakdown.tsx");
/* harmony import */ var _teamResolutionTime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ./teamResolutionTime */ "./app/views/organizationStats/teamInsights/teamResolutionTime.tsx");
/* harmony import */ var _teamUnresolvedIssues__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ./teamUnresolvedIssues */ "./app/views/organizationStats/teamInsights/teamUnresolvedIssues.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ./utils */ "./app/views/organizationStats/teamInsights/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






















function TeamStatsIssues(_ref) {
  var _location$query, _query$team, _localTeamId, _teams$, _currentTeam$projects;

  let {
    location,
    router
  } = _ref;
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_9__["default"])();
  const {
    teams,
    initiallyLoaded
  } = (0,sentry_utils_useTeams__WEBPACK_IMPORTED_MODULE_10__["default"])({
    provideUserTeams: true
  });
  const query = (_location$query = location === null || location === void 0 ? void 0 : location.query) !== null && _location$query !== void 0 ? _location$query : {};
  const localStorageKey = `teamInsightsSelectedTeamId:${organization.slug}`;
  let localTeamId = (_query$team = query.team) !== null && _query$team !== void 0 ? _query$team : sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_8__["default"].getItem(localStorageKey);

  if (localTeamId && !teams.find(team => team.id === localTeamId)) {
    localTeamId = null;
  }

  const currentTeamId = (_localTeamId = localTeamId) !== null && _localTeamId !== void 0 ? _localTeamId : (_teams$ = teams[0]) === null || _teams$ === void 0 ? void 0 : _teams$.id;
  const currentTeam = teams.find(team => team.id === currentTeamId);
  const projects = (_currentTeam$projects = currentTeam === null || currentTeam === void 0 ? void 0 : currentTeam.projects) !== null && _currentTeam$projects !== void 0 ? _currentTeam$projects : [];
  const environment = query.environment;
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_7__["default"])('team_insights.viewed', {
      organization
    });
  }, [organization]);
  const {
    period,
    start,
    end,
    utc
  } = (0,_utils__WEBPACK_IMPORTED_MODULE_18__.dataDatetime)(query);

  if (teams.length === 0) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_noProjectMessage__WEBPACK_IMPORTED_MODULE_4__["default"], {
      organization: organization,
      superuserNeedsToBeProjectMember: true
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_5__["default"], {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Team Issues'),
      orgSlug: organization.slug
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(_header__WEBPACK_IMPORTED_MODULE_11__["default"], {
      organization: organization,
      activeTab: "issues"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(Body, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(_controls__WEBPACK_IMPORTED_MODULE_12__["default"], {
        showEnvironment: true,
        location: location,
        router: router,
        currentTeam: currentTeam,
        currentEnvironment: environment
      }), !initiallyLoaded && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_3__["default"], {}), initiallyLoaded && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_2__.Main, {
        fullWidth: true,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(_descriptionCard__WEBPACK_IMPORTED_MODULE_13__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('All Unresolved Issues'),
          description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('This includes New and Returning issues in the last 7 days as well as those that haven’t been resolved or ignored in the past.'),
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(_teamUnresolvedIssues__WEBPACK_IMPORTED_MODULE_17__["default"], {
            projects: projects,
            organization: organization,
            teamSlug: currentTeam.slug,
            environment: environment,
            period: period,
            start: start,
            end: end,
            utc: utc
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(_descriptionCard__WEBPACK_IMPORTED_MODULE_13__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('New and Returning Issues'),
          description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('The new, regressed, and unignored issues that were assigned to your team.'),
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(_teamIssuesBreakdown__WEBPACK_IMPORTED_MODULE_15__["default"], {
            organization: organization,
            projects: projects,
            teamSlug: currentTeam.slug,
            environment: environment,
            period: period,
            start: start === null || start === void 0 ? void 0 : start.toString(),
            end: end === null || end === void 0 ? void 0 : end.toString(),
            location: location,
            statuses: ['new', 'regressed', 'unignored']
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(_descriptionCard__WEBPACK_IMPORTED_MODULE_13__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Issues Triaged'),
          description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('How many new and returning issues were reviewed by your team each week. Reviewing an issue includes marking as reviewed, resolving, assigning to another team, or deleting.'),
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(_teamIssuesBreakdown__WEBPACK_IMPORTED_MODULE_15__["default"], {
            organization: organization,
            projects: projects,
            teamSlug: currentTeam.slug,
            environment: environment,
            period: period,
            start: start === null || start === void 0 ? void 0 : start.toString(),
            end: end === null || end === void 0 ? void 0 : end.toString(),
            location: location,
            statuses: ['resolved', 'ignored', 'deleted']
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(_descriptionCard__WEBPACK_IMPORTED_MODULE_13__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Age of Unresolved Issues'),
          description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('How long ago since unresolved issues were first created.'),
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(_teamIssuesAge__WEBPACK_IMPORTED_MODULE_14__["default"], {
            organization: organization,
            teamSlug: currentTeam.slug
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(_descriptionCard__WEBPACK_IMPORTED_MODULE_13__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Time to Resolution'),
          description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)(`The mean time it took for issues to be resolved by your team.`),
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(_teamResolutionTime__WEBPACK_IMPORTED_MODULE_16__["default"], {
            organization: organization,
            environment: environment,
            teamSlug: currentTeam.slug,
            period: period,
            start: start === null || start === void 0 ? void 0 : start.toString(),
            end: end === null || end === void 0 ? void 0 : end.toString(),
            location: location
          })
        })]
      })]
    })]
  });
}

TeamStatsIssues.displayName = "TeamStatsIssues";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TeamStatsIssues);

const Body = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_2__.Body,  true ? {
  target: "e16zrx8x0"
} : 0)("@media (min-width: ", p => p.theme.breakpoints.medium, "){display:block;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/organizationStats/teamInsights/teamIssuesAge.tsx":
/*!********************************************************************!*\
  !*** ./app/views/organizationStats/teamInsights/teamIssuesAge.tsx ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_charts_barChart__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/barChart */ "./app/components/charts/barChart.tsx");
/* harmony import */ var sentry_components_count__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/count */ "./app/components/count.tsx");
/* harmony import */ var sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/idBadge/projectBadge */ "./app/components/idBadge/projectBadge.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_panels_panelTable__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/panels/panelTable */ "./app/components/panels/panelTable.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_events__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/events */ "./app/utils/events.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }



















/**
 * takes "< 1 hour" and returns a datetime of 1 hour ago
 */
function parseBucket(bucket) {
  if (bucket === '> 1 year') {
    return moment__WEBPACK_IMPORTED_MODULE_4___default()().subtract(1, 'y').subtract(1, 'd').valueOf();
  }

  const [_, num, unit] = bucket.split(' ');
  return moment__WEBPACK_IMPORTED_MODULE_4___default()().subtract(num, unit).valueOf();
}

const bucketLabels = {
  '< 1 hour': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('1 hour'),
  '< 4 hour': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('4 hours'),
  '< 12 hour': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('12 hours'),
  '< 1 day': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('1 day'),
  '< 1 week': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('1 week'),
  '< 4 week': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('1 month'),
  '< 24 week': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('6 months'),
  '< 1 year': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('1 year'),
  '> 1 year': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('> 1 year')
};

class TeamIssuesAge extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_5__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "shouldRenderBadRequests", true);
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      oldestIssues: null,
      unresolvedIssueAge: null
    };
  }

  getEndpoints() {
    const {
      organization,
      teamSlug
    } = this.props;
    return [['oldestIssues', `/teams/${organization.slug}/${teamSlug}/issues/old/`, {
      query: {
        limit: 7
      }
    }], ['unresolvedIssueAge', `/teams/${organization.slug}/${teamSlug}/unresolved-issue-age/`]];
  }

  componentDidUpdate(prevProps) {
    const {
      teamSlug
    } = this.props;

    if (prevProps.teamSlug !== teamSlug) {
      this.remountComponent();
    }
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {
      organization
    } = this.props;
    const {
      unresolvedIssueAge,
      oldestIssues,
      loading
    } = this.state;
    const seriesData = Object.entries(unresolvedIssueAge !== null && unresolvedIssueAge !== void 0 ? unresolvedIssueAge : {}).map(_ref => {
      let [bucket, value] = _ref;
      return {
        name: bucket,
        value
      };
    }).sort((a, b) => parseBucket(b.name) - parseBucket(a.name));
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(ChartWrapper, {
        children: [loading && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_11__["default"], {
          height: "200px"
        }), !loading && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_charts_barChart__WEBPACK_IMPORTED_MODULE_6__.BarChart, {
          style: {
            height: 190
          },
          legend: {
            right: 3,
            top: 0
          },
          yAxis: {
            minInterval: 1
          },
          xAxis: {
            splitNumber: seriesData.length,
            type: 'category',
            min: 0,
            axisLabel: {
              showMaxLabel: true,
              showMinLabel: true,
              formatter: bucket => {
                var _bucketLabels$bucket;

                return (_bucketLabels$bucket = bucketLabels[bucket]) !== null && _bucketLabels$bucket !== void 0 ? _bucketLabels$bucket : bucket;
              }
            }
          },
          series: [{
            seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Unresolved Issues'),
            silent: true,
            data: seriesData,
            barCategoryGap: '5%'
          }]
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(StyledPanelTable, {
        isEmpty: !oldestIssues || oldestIssues.length === 0,
        emptyMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('No unresolved issues for this team’s projects'),
        headers: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Oldest Issues'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(RightAligned, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Events')
        }, "events"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(RightAligned, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Users')
        }, "users"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(RightAligned, {
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Age'), " ", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_13__.IconArrow, {
            direction: "down",
            size: "12px",
            color: "gray300"
          })]
        }, "age")],
        isLoading: loading,
        children: oldestIssues === null || oldestIssues === void 0 ? void 0 : oldestIssues.map(issue => {
          const {
            title
          } = (0,sentry_utils_events__WEBPACK_IMPORTED_MODULE_16__.getTitle)(issue, organization === null || organization === void 0 ? void 0 : organization.features, false);
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(ProjectTitleContainer, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(ShadowlessProjectBadge, {
                disableLink: true,
                hideName: true,
                avatarSize: 18,
                project: issue.project
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(TitleOverflow, {
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_9__["default"], {
                  to: {
                    pathname: `/organizations/${organization.slug}/issues/${issue.id}/`
                  },
                  children: title
                })
              })]
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(RightAligned, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_7__["default"], {
                value: issue.count
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(RightAligned, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_7__["default"], {
                value: issue.userCount
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(RightAligned, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_12__["default"], {
                date: issue.firstSeen
              })
            })]
          }, issue.id);
        })
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TeamIssuesAge);

const ChartWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e131frq15"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(2), " 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(2), ";border-bottom:1px solid ", p => p.theme.border, ";" + ( true ? "" : 0));

const StyledPanelTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels_panelTable__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "e131frq14"
} : 0)("grid-template-columns:1fr 0.15fr 0.15fr 0.25fr;white-space:nowrap;margin-bottom:0;border:0;font-size:", p => p.theme.fontSizeMedium, ";box-shadow:unset;>*{padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(2), ";}", p => p.isEmpty && /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_18__.css)("&>div:last-child{padding:48px ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(2), ";}" + ( true ? "" : 0),  true ? "" : 0), ";" + ( true ? "" : 0));

const RightAligned = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e131frq13"
} : 0)( true ? {
  name: "19mh0x6",
  styles: "display:flex;align-items:center;justify-content:flex-end"
} : 0);

const ProjectTitleContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e131frq12"
} : 0)(p => p.theme.overflowEllipsis, ";display:flex;align-items:center;" + ( true ? "" : 0));

const TitleOverflow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e131frq11"
} : 0)(p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

const ShadowlessProjectBadge = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "e131frq10"
} : 0)("display:inline-flex;align-items:center;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1), ";*>img{box-shadow:none;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/organizationStats/teamInsights/teamIssuesBreakdown.tsx":
/*!**************************************************************************!*\
  !*** ./app/views/organizationStats/teamInsights/teamIssuesBreakdown.tsx ***!
  \**************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_charts_barChart__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/barChart */ "./app/components/charts/barChart.tsx");
/* harmony import */ var sentry_components_collapsePanel__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/collapsePanel */ "./app/components/collapsePanel.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_components_panels_panelTable__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/panels/panelTable */ "./app/components/panels/panelTable.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/stores/projectsStore */ "./app/stores/projectsStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _styles__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./styles */ "./app/views/organizationStats/teamInsights/styles.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ./utils */ "./app/views/organizationStats/teamInsights/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

















const keys = ['deleted', 'ignored', 'resolved', 'unignored', 'regressed', 'new', 'total'];

class TeamIssuesBreakdown extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_5__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "shouldRenderBadRequests", true);
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      issuesBreakdown: null
    };
  }

  getEndpoints() {
    const {
      organization,
      start,
      end,
      period,
      utc,
      teamSlug,
      statuses,
      environment
    } = this.props;
    const datetime = {
      start,
      end,
      period,
      utc
    };
    return [['issuesBreakdown', `/teams/${organization.slug}/${teamSlug}/issue-breakdown/`, {
      query: { ...(0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_8__.normalizeDateTimeParams)(datetime),
        statuses,
        environment
      }
    }]];
  }

  componentDidUpdate(prevProps) {
    const {
      start,
      end,
      period,
      utc,
      teamSlug,
      projects,
      environment
    } = this.props;

    if (prevProps.start !== start || prevProps.end !== end || prevProps.period !== period || prevProps.utc !== utc || prevProps.teamSlug !== teamSlug || prevProps.environment !== environment || !lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default()(prevProps.projects, projects)) {
      this.remountComponent();
    }
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    var _this$state$issuesBre, _allSeries$0$data$len, _allSeries$;

    const {
      loading
    } = this.state;
    const issuesBreakdown = (_this$state$issuesBre = this.state.issuesBreakdown) !== null && _this$state$issuesBre !== void 0 ? _this$state$issuesBre : {};
    const {
      projects,
      statuses
    } = this.props;
    const allReviewedByDay = {}; // Total statuses & total reviewed keyed by project ID

    const projectTotals = {}; // The issues breakdown is keyed by projectId

    for (const [projectId, entries] of Object.entries(issuesBreakdown)) {
      // Each bucket is 1 day
      for (const [bucket, counts] of Object.entries(entries)) {
        if (!projectTotals[projectId]) {
          projectTotals[projectId] = {
            deleted: 0,
            ignored: 0,
            resolved: 0,
            unignored: 0,
            regressed: 0,
            new: 0,
            total: 0
          };
        }

        for (const key of keys) {
          projectTotals[projectId][key] += counts[key];
        }

        if (!allReviewedByDay[projectId]) {
          allReviewedByDay[projectId] = {};
        }

        if (allReviewedByDay[projectId][bucket] === undefined) {
          allReviewedByDay[projectId][bucket] = counts.total;
        } else {
          allReviewedByDay[projectId][bucket] += counts.total;
        }
      }
    }

    const sortedProjectIds = Object.entries(projectTotals).map(_ref => {
      let [projectId, {
        total
      }] = _ref;
      return {
        projectId,
        total
      };
    }).sort((a, b) => b.total - a.total);
    const allSeries = Object.keys(allReviewedByDay).map((projectId, idx) => {
      var _ProjectsStore$getByI, _ProjectsStore$getByI2;

      return {
        seriesName: (_ProjectsStore$getByI = (_ProjectsStore$getByI2 = sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_13__["default"].getById(projectId)) === null || _ProjectsStore$getByI2 === void 0 ? void 0 : _ProjectsStore$getByI2.slug) !== null && _ProjectsStore$getByI !== void 0 ? _ProjectsStore$getByI : projectId,
        data: (0,_utils__WEBPACK_IMPORTED_MODULE_16__.sortSeriesByDay)((0,_utils__WEBPACK_IMPORTED_MODULE_16__.convertDayValueObjectToSeries)(allReviewedByDay[projectId])),
        animationDuration: 500,
        animationDelay: idx * 500,
        silent: true,
        barCategoryGap: '5%'
      };
    });
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(IssuesChartWrapper, {
        children: [loading && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_10__["default"], {
          height: "200px"
        }), !loading && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_charts_barChart__WEBPACK_IMPORTED_MODULE_6__.BarChart, {
          style: {
            height: 200
          },
          stacked: true,
          isGroupedByDate: true,
          useShortDate: true,
          legend: {
            right: 0,
            top: 0
          },
          xAxis: (0,_utils__WEBPACK_IMPORTED_MODULE_16__.barAxisLabel)((_allSeries$0$data$len = (_allSeries$ = allSeries[0]) === null || _allSeries$ === void 0 ? void 0 : _allSeries$.data.length) !== null && _allSeries$0$data$len !== void 0 ? _allSeries$0$data$len : 0),
          yAxis: {
            minInterval: 1
          },
          series: allSeries
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_collapsePanel__WEBPACK_IMPORTED_MODULE_7__["default"], {
        items: sortedProjectIds.length,
        children: _ref2 => {
          let {
            isExpanded,
            showMoreButton
          } = _ref2;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(StyledPanelTable, {
              numActions: statuses.length,
              headers: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Project'), ...statuses.map(action => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(AlignRight, {
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)(action)
              }, action)), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(AlignRight, {
                children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('total'), ' ', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconArrow, {
                  direction: "down",
                  size: "12px",
                  color: "gray300"
                })]
              }, "total")],
              isLoading: loading,
              children: sortedProjectIds.map((_ref3, idx) => {
                let {
                  projectId
                } = _ref3;
                const project = projects.find(p => p.id === projectId);

                if (idx >= sentry_components_collapsePanel__WEBPACK_IMPORTED_MODULE_7__.COLLAPSE_COUNT && !isExpanded) {
                  return null;
                }

                return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_15__.ProjectBadgeContainer, {
                    children: project && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_15__.ProjectBadge, {
                      avatarSize: 18,
                      project: project
                    })
                  }), statuses.map(action => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(AlignRight, {
                    children: projectTotals[projectId][action]
                  }, action)), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(AlignRight, {
                    children: projectTotals[projectId].total
                  })]
                }, projectId);
              })
            }), !loading && showMoreButton]
          });
        }
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TeamIssuesBreakdown);

const ChartWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1kdpoq3"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(2), " 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(2), ";" + ( true ? "" : 0));

const IssuesChartWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(ChartWrapper,  true ? {
  target: "e1kdpoq2"
} : 0)("border-bottom:1px solid ", p => p.theme.border, ";" + ( true ? "" : 0));

const StyledPanelTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels_panelTable__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "e1kdpoq1"
} : 0)("grid-template-columns:1fr ", p => ' 0.2fr'.repeat(p.numActions), " 0.2fr;font-size:", p => p.theme.fontSizeMedium, ";white-space:nowrap;margin-bottom:0;border:0;box-shadow:unset;&>div{padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(2), ";}" + ( true ? "" : 0));

const AlignRight = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1kdpoq0"
} : 0)( true ? {
  name: "mnwtso",
  styles: "text-align:right;font-variant-numeric:tabular-nums"
} : 0);

/***/ }),

/***/ "./app/views/organizationStats/teamInsights/teamResolutionTime.tsx":
/*!*************************************************************************!*\
  !*** ./app/views/organizationStats/teamInsights/teamResolutionTime.tsx ***!
  \*************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_charts_barChart__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/barChart */ "./app/components/charts/barChart.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./utils */ "./app/views/organizationStats/teamInsights/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













class TeamResolutionTime extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_3__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "shouldRenderBadRequests", true);
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      resolutionTime: null
    };
  }

  getEndpoints() {
    const {
      organization,
      start,
      end,
      period,
      utc,
      teamSlug,
      environment
    } = this.props;
    const datetime = {
      start,
      end,
      period,
      utc
    };
    return [['resolutionTime', `/teams/${organization.slug}/${teamSlug}/time-to-resolution/`, {
      query: { ...(0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_6__.normalizeDateTimeParams)(datetime),
        environment
      }
    }]];
  }

  componentDidUpdate(prevProps) {
    const {
      start,
      end,
      period,
      utc,
      teamSlug,
      environment
    } = this.props;

    if (prevProps.start !== start || prevProps.end !== end || prevProps.period !== period || prevProps.utc !== utc || prevProps.teamSlug !== teamSlug || prevProps.environment !== environment) {
      this.remountComponent();
    }
  }

  renderLoading() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(ChartWrapper, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_5__["default"], {})
    });
  }

  renderBody() {
    const {
      resolutionTime
    } = this.state;
    const data = Object.entries(resolutionTime !== null && resolutionTime !== void 0 ? resolutionTime : {}).map(_ref => {
      let [bucket, {
        avg
      }] = _ref;
      return {
        value: avg,
        name: new Date(bucket).getTime()
      };
    });
    const seriesData = (0,_utils__WEBPACK_IMPORTED_MODULE_10__.sortSeriesByDay)(data);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(ChartWrapper, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_charts_barChart__WEBPACK_IMPORTED_MODULE_4__.BarChart, {
        style: {
          height: 190
        },
        isGroupedByDate: true,
        useShortDate: true,
        period: "7d",
        tooltip: {
          valueFormatter: value => (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_9__.getDuration)(value, 1)
        },
        yAxis: {
          // Each yAxis marker will increase by 1 day
          minInterval: 86400,
          axisLabel: {
            formatter: value => {
              if (value === 0) {
                return '';
              }

              return (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_9__.getDuration)(value, 0, true, true);
            }
          }
        },
        legend: {
          right: 0,
          top: 0
        },
        xAxis: (0,_utils__WEBPACK_IMPORTED_MODULE_10__.barAxisLabel)(seriesData.length),
        series: [{
          seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Time to Resolution'),
          data: seriesData,
          silent: true,
          barCategoryGap: '5%'
        }]
      })
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TeamResolutionTime);

const ChartWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1s8s0fe0"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(2), " 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(2), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/organizationStats/teamInsights/teamUnresolvedIssues.tsx":
/*!***************************************************************************!*\
  !*** ./app/views/organizationStats/teamInsights/teamUnresolvedIssues.tsx ***!
  \***************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_charts_barChart__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/barChart */ "./app/components/charts/barChart.tsx");
/* harmony import */ var sentry_components_collapsePanel__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/collapsePanel */ "./app/components/collapsePanel.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_components_panels_panelTable__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/panels/panelTable */ "./app/components/panels/panelTable.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var _styles__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./styles */ "./app/views/organizationStats/teamInsights/styles.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./utils */ "./app/views/organizationStats/teamInsights/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

















class TeamUnresolvedIssues extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_4__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "shouldRenderBadRequests", true);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleExpandTable", () => {
      this.setState({
        expandTable: true
      });
    });
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      periodIssues: null,
      expandTable: false
    };
  }

  getEndpoints() {
    const {
      organization,
      start,
      end,
      period,
      utc,
      teamSlug,
      environment
    } = this.props;
    const datetime = {
      start,
      end,
      period,
      utc
    };
    const endpoints = [['periodIssues', `/teams/${organization.slug}/${teamSlug}/all-unresolved-issues/`, {
      query: { ...(0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_7__.normalizeDateTimeParams)(datetime),
        environment
      }
    }]];
    return endpoints;
  }

  componentDidUpdate(prevProps) {
    const {
      teamSlug,
      start,
      end,
      period,
      utc,
      environment
    } = this.props;

    if (prevProps.start !== start || prevProps.end !== end || prevProps.period !== period || prevProps.utc !== utc || prevProps.environment !== environment || prevProps.teamSlug !== teamSlug) {
      this.remountComponent();
    }
  }

  getTotalUnresolved(projectId) {
    var _periodIssues$project;

    const {
      periodIssues
    } = this.state;
    const entries = Object.values((_periodIssues$project = periodIssues === null || periodIssues === void 0 ? void 0 : periodIssues[projectId]) !== null && _periodIssues$project !== void 0 ? _periodIssues$project : {});
    const total = entries.reduce((acc, current) => acc + current.unresolved, 0);
    return Math.round(total / entries.length);
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    var _this$state$periodIss;

    const {
      projects,
      period
    } = this.props;
    const {
      loading
    } = this.state;
    const periodIssues = (_this$state$periodIss = this.state.periodIssues) !== null && _this$state$periodIss !== void 0 ? _this$state$periodIss : {};
    const projectTotals = {};

    for (const projectId of Object.keys(periodIssues)) {
      var _periodIssues$project2, _projectPeriodEntries, _projectPeriodEntries2;

      const periodAvg = this.getTotalUnresolved(Number(projectId));
      const projectPeriodEntries = Object.values((_periodIssues$project2 = periodIssues === null || periodIssues === void 0 ? void 0 : periodIssues[projectId]) !== null && _periodIssues$project2 !== void 0 ? _periodIssues$project2 : {});
      const today = (_projectPeriodEntries = (_projectPeriodEntries2 = projectPeriodEntries[projectPeriodEntries.length - 1]) === null || _projectPeriodEntries2 === void 0 ? void 0 : _projectPeriodEntries2.unresolved) !== null && _projectPeriodEntries !== void 0 ? _projectPeriodEntries : 0;
      const percentChange = Math.abs((today - periodAvg) / periodAvg);
      projectTotals[projectId] = {
        projectId,
        periodAvg,
        today,
        percentChange: Number.isNaN(percentChange) ? 0 : percentChange
      };
    }

    const sortedProjects = projects.map(project => {
      var _projectTotals$projec, _projectTotals$projec2;

      return {
        project,
        trend: (_projectTotals$projec = (_projectTotals$projec2 = projectTotals[project.id]) === null || _projectTotals$projec2 === void 0 ? void 0 : _projectTotals$projec2.percentChange) !== null && _projectTotals$projec !== void 0 ? _projectTotals$projec : 0
      };
    }).sort((a, b) => Math.abs(b.trend) - Math.abs(a.trend));
    const groupedProjects = (0,_utils__WEBPACK_IMPORTED_MODULE_15__.groupByTrend)(sortedProjects); // All data will contain all pairs of [day, unresolved_count].

    const allData = Object.values(periodIssues).flatMap(data => Object.entries(data).map(_ref => {
      let [bucket, {
        unresolved
      }] = _ref;
      return [bucket, unresolved];
    })); // Total by day for all projects

    const totalByDay = allData.reduce((acc, _ref2) => {
      let [bucket, unresolved] = _ref2;

      if (acc[bucket] === undefined) {
        acc[bucket] = 0;
      }

      acc[bucket] += unresolved;
      return acc;
    }, {});
    const seriesData = (0,_utils__WEBPACK_IMPORTED_MODULE_15__.sortSeriesByDay)((0,_utils__WEBPACK_IMPORTED_MODULE_15__.convertDayValueObjectToSeries)(totalByDay));
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(ChartWrapper, {
        children: [loading && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_9__["default"], {
          height: "200px"
        }), !loading && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_charts_barChart__WEBPACK_IMPORTED_MODULE_5__.BarChart, {
          style: {
            height: 190
          },
          isGroupedByDate: true,
          useShortDate: true,
          legend: {
            right: 3,
            top: 0
          },
          yAxis: {
            minInterval: 1
          },
          xAxis: (0,_utils__WEBPACK_IMPORTED_MODULE_15__.barAxisLabel)(seriesData.length),
          series: [{
            seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Unresolved Issues'),
            silent: true,
            data: seriesData,
            barCategoryGap: '6%'
          }]
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_collapsePanel__WEBPACK_IMPORTED_MODULE_6__["default"], {
        items: groupedProjects.length,
        children: _ref3 => {
          let {
            isExpanded,
            showMoreButton
          } = _ref3;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledPanelTable, {
              isEmpty: projects.length === 0,
              isLoading: loading,
              headers: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Project'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(RightAligned, {
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.tct)('Last [period] Average', {
                  period
                })
              }, "last"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(RightAligned, {
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Today')
              }, "curr"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(RightAligned, {
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Change')
              }, "diff")],
              children: groupedProjects.map((_ref4, idx) => {
                var _projectTotals$projec3;

                let {
                  project
                } = _ref4;
                const totals = (_projectTotals$projec3 = projectTotals[project.id]) !== null && _projectTotals$projec3 !== void 0 ? _projectTotals$projec3 : {};

                if (idx >= sentry_components_collapsePanel__WEBPACK_IMPORTED_MODULE_6__.COLLAPSE_COUNT && !isExpanded) {
                  return null;
                }

                return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_14__.ProjectBadgeContainer, {
                    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_14__.ProjectBadge, {
                      avatarSize: 18,
                      project: project
                    })
                  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(ScoreWrapper, {
                    children: totals.periodAvg
                  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(ScoreWrapper, {
                    children: totals.today
                  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(ScoreWrapper, {
                    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(SubText, {
                      color: totals.percentChange === 0 ? 'gray300' : totals.percentChange > 0 ? 'red300' : 'green300',
                      children: [(0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_13__.formatPercentage)(Number.isNaN(totals.percentChange) ? 0 : totals.percentChange, 0), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(PaddedIconArrow, {
                        direction: totals.percentChange > 0 ? 'up' : 'down',
                        size: "xs"
                      })]
                    })
                  })]
                }, project.id);
              })
            }), !loading && showMoreButton]
          });
        }
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TeamUnresolvedIssues);

const ChartWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eahkfcz5"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(2), " 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(2), ";border-bottom:1px solid ", p => p.theme.border, ";" + ( true ? "" : 0));

const StyledPanelTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels_panelTable__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "eahkfcz4"
} : 0)("grid-template-columns:1fr 0.2fr 0.2fr 0.2fr;white-space:nowrap;margin-bottom:0;border:0;font-size:", p => p.theme.fontSizeMedium, ";box-shadow:unset;&>div{padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(2), ";}" + ( true ? "" : 0));

const RightAligned = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "eahkfcz3"
} : 0)( true ? {
  name: "2qga7i",
  styles: "text-align:right"
} : 0);

const ScoreWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eahkfcz2"
} : 0)( true ? {
  name: "4os8x4",
  styles: "display:flex;align-items:center;justify-content:flex-end;text-align:right"
} : 0);

const PaddedIconArrow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconArrow,  true ? {
  target: "eahkfcz1"
} : 0)("margin:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(0.5), ";" + ( true ? "" : 0));

const SubText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eahkfcz0"
} : 0)("color:", p => p.theme[p.color], ";" + ( true ? "" : 0));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_organizationStats_teamInsights_issues_tsx.d4d84492008625e21f64d4867127e2dc.js.map