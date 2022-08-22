"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_alerts_list_incidents_index_tsx"],{

/***/ "./app/components/onboardingPanel.tsx":
/*!********************************************!*\
  !*** ./app/components/onboardingPanel.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function OnboardingPanel(_ref) {
  let {
    className,
    image,
    children
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__.Panel, {
    className: className,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(Container, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(IlloBox, {
        children: image
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(StyledBox, {
        children: children
      })]
    })
  });
}

OnboardingPanel.displayName = "OnboardingPanel";

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e19tujos2"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(3), ";position:relative;@media (min-width: ", p => p.theme.breakpoints.small, "){display:flex;align-items:center;flex-direction:row;justify-content:center;flex-wrap:wrap;min-height:300px;max-width:1000px;margin:0 auto;}@media (min-width: ", p => p.theme.breakpoints.medium, "){min-height:350px;}" + ( true ? "" : 0));

const StyledBox = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e19tujos1"
} : 0)("z-index:1;@media (min-width: ", p => p.theme.breakpoints.small, "){flex:2;}" + ( true ? "" : 0));

const IlloBox = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(StyledBox,  true ? {
  target: "e19tujos0"
} : 0)("position:relative;min-height:100px;max-width:300px;margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(2), " auto;@media (min-width: ", p => p.theme.breakpoints.small, "){flex:1;margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(3), ";max-width:auto;}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OnboardingPanel);

/***/ }),

/***/ "./app/views/alerts/list/incidents/index.tsx":
/*!***************************************************!*\
  !*** ./app/views/alerts/list/incidents/index.tsx ***!
  \***************************************************/
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
/* harmony import */ var sentry_actionCreators_prompts__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/prompts */ "./app/actionCreators/prompts.tsx");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_createAlertButton__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/createAlertButton */ "./app/components/createAlertButton.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/container */ "./app/components/organizations/pageFilters/container.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_projects__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/projects */ "./app/utils/projects.tsx");
/* harmony import */ var _filterBar__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ../../filterBar */ "./app/views/alerts/filterBar.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ../../utils */ "./app/views/alerts/utils/index.tsx");
/* harmony import */ var _header__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ../header */ "./app/views/alerts/list/header.tsx");
/* harmony import */ var _onboarding__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ../onboarding */ "./app/views/alerts/list/onboarding.tsx");
/* harmony import */ var _row__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! ./row */ "./app/views/alerts/list/incidents/row.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



























const DOCS_URL = 'https://docs.sentry.io/workflow/alerts-notifications/alerts/?_ga=2.21848383.580096147.1592364314-1444595810.1582160976';

class IncidentsList extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_7__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeSearch", title => {
      const {
        router,
        location
      } = this.props;
      const {
        cursor: _cursor,
        page: _page,
        ...currentQuery
      } = location.query;
      router.push({
        pathname: location.pathname,
        query: { ...currentQuery,
          title
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeFilter", activeFilters => {
      const {
        router,
        location
      } = this.props;
      const {
        cursor: _cursor,
        page: _page,
        ...currentQuery
      } = location.query;
      router.push({
        pathname: location.pathname,
        query: { ...currentQuery,
          // Preserve empty team query parameter
          team: activeFilters.length > 0 ? activeFilters : ''
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeStatus", value => {
      const {
        router,
        location
      } = this.props;
      const {
        cursor: _cursor,
        page: _page,
        ...currentQuery
      } = location.query;
      router.push({
        pathname: location.pathname,
        query: { ...currentQuery,
          status: value === 'all' ? undefined : value
        }
      });
    });
  }

  getEndpoints() {
    const {
      params,
      location
    } = this.props;
    const {
      query
    } = location;
    const status = (0,_utils__WEBPACK_IMPORTED_MODULE_21__.getQueryStatus)(query.status);
    return [['incidentList', `/organizations/${params === null || params === void 0 ? void 0 : params.orgId}/incidents/`, {
      query: { ...query,
        status: status === 'all' ? undefined : status,
        team: (0,_utils__WEBPACK_IMPORTED_MODULE_21__.getTeamParams)(query.team),
        expand: ['original_alert_rule']
      }
    }]];
  }
  /**
   * If our incidentList is empty, determine if we've configured alert rules or
   * if the user has seen the welcome prompt.
   */


  async onLoadAllEndpointsSuccess() {
    const {
      incidentList
    } = this.state;

    if (!incidentList || incidentList.length !== 0) {
      this.setState({
        hasAlertRule: true,
        firstVisitShown: false
      });
      return;
    }

    this.setState({
      loading: true
    }); // Check if they have rules or not, to know which empty state message to
    // display

    const {
      params,
      location,
      organization
    } = this.props;
    const alertRules = await this.api.requestPromise(`/organizations/${params === null || params === void 0 ? void 0 : params.orgId}/alert-rules/`, {
      method: 'GET',
      query: location.query
    });
    const hasAlertRule = alertRules.length > 0; // We've already configured alert rules, no need to check if we should show
    // the "first time welcome" prompt

    if (hasAlertRule) {
      this.setState({
        hasAlertRule,
        firstVisitShown: false,
        loading: false
      });
      return;
    } // Check if they have already seen the prompt for the alert stream


    const prompt = await (0,sentry_actionCreators_prompts__WEBPACK_IMPORTED_MODULE_4__.promptsCheck)(this.api, {
      organizationId: organization.id,
      feature: 'alert_stream'
    });
    const firstVisitShown = !(prompt !== null && prompt !== void 0 && prompt.dismissedTime);

    if (firstVisitShown) {
      // Prompt has not been seen, mark the prompt as seen immediately so they
      // don't see it again
      (0,sentry_actionCreators_prompts__WEBPACK_IMPORTED_MODULE_4__.promptsUpdate)(this.api, {
        feature: 'alert_stream',
        organizationId: organization.id,
        status: 'dismissed'
      });
    }

    this.setState({
      hasAlertRule,
      firstVisitShown,
      loading: false
    });
  }

  get projectsFromIncidents() {
    const {
      incidentList
    } = this.state;
    return [...new Set(incidentList === null || incidentList === void 0 ? void 0 : incidentList.map(_ref => {
      let {
        projects
      } = _ref;
      return projects;
    }).flat())];
  }

  tryRenderOnboarding() {
    const {
      firstVisitShown
    } = this.state;
    const {
      organization
    } = this.props;

    if (!firstVisitShown) {
      return null;
    }

    const actions = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"], {
        size: "sm",
        external: true,
        href: DOCS_URL,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('View Features')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_createAlertButton__WEBPACK_IMPORTED_MODULE_9__["default"], {
        organization: organization,
        iconProps: {
          size: 'xs'
        },
        size: "sm",
        priority: "primary",
        referrer: "alert_stream",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Create Alert')
      })]
    });

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(_onboarding__WEBPACK_IMPORTED_MODULE_23__["default"], {
      actions: actions
    });
  }

  renderLoading() {
    return this.renderBody();
  }

  renderList() {
    var _this$tryRenderOnboar;

    const {
      loading,
      incidentList,
      incidentListPageLinks,
      hasAlertRule
    } = this.state;
    const {
      params: {
        orgId
      },
      organization
    } = this.props;
    const checkingForAlertRules = (incidentList === null || incidentList === void 0 ? void 0 : incidentList.length) === 0 && hasAlertRule === undefined;
    const showLoadingIndicator = loading || checkingForAlertRules;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(_this$tryRenderOnboar = this.tryRenderOnboarding()) !== null && _this$tryRenderOnboar !== void 0 ? _this$tryRenderOnboar : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(StyledPanelTable, {
        isLoading: showLoadingIndicator,
        isEmpty: (incidentList === null || incidentList === void 0 ? void 0 : incidentList.length) === 0,
        emptyMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('No incidents exist for the current query.'),
        emptyAction: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(EmptyStateAction, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.tct)('Learn more about [link:Metric Alerts]', {
            link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_11__["default"], {
              href: DOCS_URL
            })
          })
        }),
        headers: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Alert Rule'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Triggered'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Duration'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Project'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Alert ID'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Team')],
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_utils_projects__WEBPACK_IMPORTED_MODULE_19__["default"], {
          orgId: orgId,
          slugs: this.projectsFromIncidents,
          children: _ref2 => {
            let {
              initiallyLoaded,
              projects
            } = _ref2;
            return incidentList.map(incident => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(_row__WEBPACK_IMPORTED_MODULE_24__["default"], {
              projectsLoaded: initiallyLoaded,
              projects: projects,
              incident: incident,
              organization: organization
            }, incident.id));
          }
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_13__["default"], {
        pageLinks: incidentListPageLinks
      })]
    });
  }

  renderBody() {
    const {
      params,
      organization,
      router,
      location
    } = this.props;
    const {
      orgId
    } = params;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_15__["default"], {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Alerts'),
      orgSlug: orgId,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_12__["default"], {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(_header__WEBPACK_IMPORTED_MODULE_22__["default"], {
          organization: organization,
          router: router,
          activeTab: "stream",
          projectSlugs: this.projectsFromIncidents
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_10__.Body, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_10__.Main, {
            fullWidth: true,
            children: [!this.tryRenderOnboarding() && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(StyledAlert, {
                showIcon: true,
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('This page only shows metric alerts.')
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(_filterBar__WEBPACK_IMPORTED_MODULE_20__["default"], {
                location: location,
                onChangeFilter: this.handleChangeFilter,
                onChangeSearch: this.handleChangeSearch,
                onChangeStatus: this.handleChangeStatus,
                hasStatusFilters: true
              })]
            }), this.renderList()]
          })
        })]
      })
    });
  }

}

function IncidentsListContainer(props) {
  (0,react__WEBPACK_IMPORTED_MODULE_3__.useEffect)(() => {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_18__["default"])('alert_stream.viewed', {
      organization: props.organization
    }); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderDisabled = () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_10__.Body, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_10__.Main, {
      fullWidth: true,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_6__["default"], {
        type: "warning",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)("You don't have access to this feature")
      })
    })
  });

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_5__["default"], {
    features: ['incidents'],
    hookName: "feature-disabled:alerts-page",
    renderDisabled: renderDisabled,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(IncidentsList, { ...props
    })
  });
}

IncidentsListContainer.displayName = "IncidentsListContainer";

const StyledPanelTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_14__.PanelTable,  true ? {
  target: "ebcblm52"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

const StyledAlert = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_alert__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "ebcblm51"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(1.5), ";" + ( true ? "" : 0));

const EmptyStateAction = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('p',  true ? {
  target: "ebcblm50"
} : 0)("font-size:", p => p.theme.fontSizeLarge, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (IncidentsListContainer);

/***/ }),

/***/ "./app/views/alerts/list/incidents/row.tsx":
/*!*************************************************!*\
  !*** ./app/views/alerts/list/incidents/row.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_components_avatar_actorAvatar__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/avatar/actorAvatar */ "./app/components/avatar/actorAvatar.tsx");
/* harmony import */ var sentry_components_duration__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/duration */ "./app/components/duration.tsx");
/* harmony import */ var sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/errorBoundary */ "./app/components/errorBoundary.tsx");
/* harmony import */ var sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/idBadge */ "./app/components/idBadge/index.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_tag__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/tag */ "./app/components/tag.tsx");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_teamStore__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/stores/teamStore */ "./app/stores/teamStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/alerts/types */ "./app/views/alerts/types.tsx");
/* harmony import */ var sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/alerts/utils */ "./app/views/alerts/utils/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }



















function AlertListRow(_ref) {
  var _incident$alertRule$o;

  let {
    incident,
    projectsLoaded,
    projects,
    organization
  } = _ref;
  const slug = incident.projects[0];
  const started = moment__WEBPACK_IMPORTED_MODULE_2___default()(incident.dateStarted);
  const duration = moment__WEBPACK_IMPORTED_MODULE_2___default().duration(moment__WEBPACK_IMPORTED_MODULE_2___default()(incident.dateClosed || new Date()).diff(started)).as('seconds');
  const project = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => projects.find(p => p.slug === slug), [slug, projects]);
  const alertLink = {
    pathname: (0,sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_15__.alertDetailsLink)(organization, incident),
    query: {
      alert: incident.identifier
    }
  };
  const ownerId = (_incident$alertRule$o = incident.alertRule.owner) === null || _incident$alertRule$o === void 0 ? void 0 : _incident$alertRule$o.split(':')[1];
  let teamName = '';

  if (ownerId) {
    var _TeamStore$getById$na, _TeamStore$getById;

    teamName = (_TeamStore$getById$na = (_TeamStore$getById = sentry_stores_teamStore__WEBPACK_IMPORTED_MODULE_11__["default"].getById(ownerId)) === null || _TeamStore$getById === void 0 ? void 0 : _TeamStore$getById.name) !== null && _TeamStore$getById$na !== void 0 ? _TeamStore$getById$na : '';
  }

  const teamActor = ownerId ? {
    type: 'team',
    id: ownerId,
    name: teamName
  } : null;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_5__["default"], {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Title, {
      "data-test-id": "alert-title",
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__["default"], {
        to: alertLink,
        children: incident.title
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(NoWrapNumeric, {
      children: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_13__["default"])({
        value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_9__["default"], {
          date: incident.dateStarted,
          extraShort: true
        }),
        fixed: '1w ago'
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(NoWrapNumeric, {
      children: incident.status === sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_14__.IncidentStatus.CLOSED ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_duration__WEBPACK_IMPORTED_MODULE_4__["default"], {
        seconds: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_13__["default"])({
          value: duration,
          fixed: 1200
        })
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_tag__WEBPACK_IMPORTED_MODULE_8__["default"], {
        type: "warning",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Still Active')
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(ProjectBadge, {
      avatarSize: 18,
      project: !projectsLoaded ? {
        slug
      } : project
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(NoWrapNumeric, {
      children: ["#", incident.id]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(FlexCenter, {
      children: teamActor ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledActorAvatar, {
          actor: teamActor,
          size: 24,
          hasTooltip: false
        }), ' ', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(TeamWrapper, {
          children: teamActor.name
        })]
      }) : '-'
    })]
  });
}

AlertListRow.displayName = "AlertListRow";

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "espmvj95"
} : 0)(p => p.theme.overflowEllipsis, " min-width:130px;" + ( true ? "" : 0));

const NoWrapNumeric = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "espmvj94"
} : 0)( true ? {
  name: "1s45tu0",
  styles: "white-space:nowrap;font-variant-numeric:tabular-nums"
} : 0);

const ProjectBadge = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "espmvj93"
} : 0)( true ? {
  name: "ozd7xs",
  styles: "flex-shrink:0"
} : 0);

const FlexCenter = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "espmvj92"
} : 0)(p => p.theme.overflowEllipsis, " display:flex;align-items:center;" + ( true ? "" : 0));

const TeamWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "espmvj91"
} : 0)(p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

const StyledActorAvatar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_avatar_actorAvatar__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "espmvj90"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AlertListRow);

/***/ }),

/***/ "./app/views/alerts/list/onboarding.tsx":
/*!**********************************************!*\
  !*** ./app/views/alerts/list/onboarding.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_images_spot_alerts_empty_state_svg__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry-images/spot/alerts-empty-state.svg */ "./images/spot/alerts-empty-state.svg");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_onboardingPanel__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/onboardingPanel */ "./app/components/onboardingPanel.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }








function Onboarding(_ref) {
  let {
    actions
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(sentry_components_onboardingPanel__WEBPACK_IMPORTED_MODULE_3__["default"], {
    image: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(AlertsImage, {
      src: sentry_images_spot_alerts_empty_state_svg__WEBPACK_IMPORTED_MODULE_1__
    }),
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("h3", {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('More signal, less noise')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("p", {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Not every error is worth an email. Set your own rules for alerts you need, with information that helps.')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(ButtonList, {
      gap: 1,
      children: actions
    })]
  });
}

Onboarding.displayName = "Onboarding";

const AlertsImage = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('img',  true ? {
  target: "evp2sp81"
} : 0)("@media (min-width: ", p => p.theme.breakpoints.small, "){user-select:none;position:absolute;top:0;bottom:0;width:220px;margin-top:auto;margin-bottom:auto;transform:translateX(-50%);left:50%;}@media (min-width: ", p => p.theme.breakpoints.large, "){transform:translateX(-60%);width:280px;}@media (min-width: ", p => p.theme.breakpoints.xlarge, "){transform:translateX(-75%);width:320px;}" + ( true ? "" : 0));

const ButtonList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_2__["default"],  true ? {
  target: "evp2sp80"
} : 0)( true ? {
  name: "vpj881",
  styles: "grid-template-columns:repeat(auto-fit, minmax(130px, max-content))"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Onboarding);

/***/ }),

/***/ "./images/spot/alerts-empty-state.svg":
/*!********************************************!*\
  !*** ./images/spot/alerts-empty-state.svg ***!
  \********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__.p + "assets/alerts-empty-state.4d03bc7c2675b8facd23.svg";

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_alerts_list_incidents_index_tsx.514563d0569918769a944996332ba7ea.js.map