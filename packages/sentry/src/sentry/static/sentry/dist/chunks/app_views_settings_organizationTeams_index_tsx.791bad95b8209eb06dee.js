"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_organizationTeams_index_tsx"],{

/***/ "./app/utils/recreateRoute.tsx":
/*!*************************************!*\
  !*** ./app/utils/recreateRoute.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ recreateRoute)
/* harmony export */ });
/* harmony import */ var lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash/findLastIndex */ "../node_modules/lodash/findLastIndex.js");
/* harmony import */ var lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils_replaceRouterParams__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/replaceRouterParams */ "./app/utils/replaceRouterParams.tsx");



/**
 * Given a route object or a string and a list of routes + params from router, this will attempt to recreate a location string while replacing url params.
 * Can additionally specify the number of routes to move back
 *
 * See tests for examples
 */
function recreateRoute(to, options) {
  var _location$search, _location$hash;

  const {
    routes,
    params,
    location,
    stepBack
  } = options;
  const paths = routes.map(_ref => {
    let {
      path
    } = _ref;
    return path || '';
  });
  let lastRootIndex;
  let routeIndex; // TODO(ts): typescript things

  if (typeof to !== 'string') {
    routeIndex = routes.indexOf(to) + 1;
    lastRootIndex = lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0___default()(paths.slice(0, routeIndex), path => path[0] === '/');
  } else {
    lastRootIndex = lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0___default()(paths, path => path[0] === '/');
  }

  let baseRoute = paths.slice(lastRootIndex, routeIndex);

  if (typeof stepBack !== 'undefined') {
    baseRoute = baseRoute.slice(0, stepBack);
  }

  const search = (_location$search = location === null || location === void 0 ? void 0 : location.search) !== null && _location$search !== void 0 ? _location$search : '';
  const hash = (_location$hash = location === null || location === void 0 ? void 0 : location.hash) !== null && _location$hash !== void 0 ? _location$hash : '';
  const fullRoute = `${baseRoute.join('')}${typeof to !== 'string' ? '' : to}${search}${hash}`;
  return (0,sentry_utils_replaceRouterParams__WEBPACK_IMPORTED_MODULE_1__["default"])(fullRoute, params);
}

/***/ }),

/***/ "./app/views/asyncView.tsx":
/*!*********************************!*\
  !*** ./app/views/asyncView.tsx ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AsyncView)
/* harmony export */ });
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



class AsyncView extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_0__["default"] {
  getTitle() {
    return '';
  }

  render() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_1__["default"], {
      title: this.getTitle(),
      children: this.renderComponent()
    });
  }

}
AsyncView.displayName = "AsyncView";

/***/ }),

/***/ "./app/views/settings/organizationTeams/allTeamsList.tsx":
/*!***************************************************************!*\
  !*** ./app/views/settings/organizationTeams/allTeamsList.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var _allTeamsRow__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./allTeamsRow */ "./app/views/settings/organizationTeams/allTeamsRow.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










function AllTeamsList(_ref) {
  let {
    organization,
    urlPrefix,
    openMembership,
    teamList,
    access
  } = _ref;
  const teamNodes = teamList.map(team => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_allTeamsRow__WEBPACK_IMPORTED_MODULE_7__["default"], {
    urlPrefix: urlPrefix,
    team: team,
    organization: organization,
    openMembership: openMembership
  }, team.slug));

  if (!teamNodes.length) {
    const canCreateTeam = access.has('project:admin');
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_5__["default"], {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)('No teams here. [teamCreate]', {
        root: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_6__["default"], {
          noMargin: true
        }),
        teamCreate: canCreateTeam ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)('You can always [link:create one].', {
          link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(StyledButton, {
            priority: "link",
            onClick: () => (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_2__.openCreateTeamModal)({
              organization
            }),
            "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Create team')
          })
        }) : null
      })
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: teamNodes
  });
}

AllTeamsList.displayName = "AllTeamsList";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AllTeamsList);

const StyledButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e10i0msm0"
} : 0)("font-size:", p => p.theme.fontSizeLarge, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/organizationTeams/allTeamsRow.tsx":
/*!**************************************************************!*\
  !*** ./app/views/settings/organizationTeams/allTeamsRow.tsx ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AllTeamsRow": () => (/* binding */ AllTeamsRow),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_organizations__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/actionCreators/organizations */ "./app/actionCreators/organizations.tsx");
/* harmony import */ var sentry_actionCreators_teams__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/actionCreators/teams */ "./app/actionCreators/teams.tsx");
/* harmony import */ var sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/actions/teamActions */ "./app/actions/teamActions.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/idBadge */ "./app/components/idBadge/index.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




















class AllTeamsRow extends react__WEBPACK_IMPORTED_MODULE_5__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      loading: false,
      error: false
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleRequestAccess", () => {
      const {
        team
      } = this.props;

      try {
        this.joinTeam({
          successMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.tct)('You have requested access to [team]', {
            team: `#${team.slug}`
          }),
          errorMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.tct)('Unable to request access to [team]', {
            team: `#${team.slug}`
          })
        }); // Update team so that `isPending` is true

        sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_9__["default"].updateSuccess(team.slug, { ...team,
          isPending: true
        });
      } catch (_err) {// No need to do anything
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleJoinTeam", async () => {
      const {
        team
      } = this.props;
      await this.joinTeam({
        successMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.tct)('You have joined [team]', {
          team: `#${team.slug}`
        }),
        errorMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.tct)('Unable to join [team]', {
          team: `#${team.slug}`
        })
      });
      this.reloadProjects();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "joinTeam", _ref => {
      let {
        successMessage,
        errorMessage
      } = _ref;
      const {
        api,
        organization,
        team
      } = this.props;
      this.setState({
        loading: true
      });
      return new Promise((resolve, reject) => (0,sentry_actionCreators_teams__WEBPACK_IMPORTED_MODULE_8__.joinTeam)(api, {
        orgId: organization.slug,
        teamId: team.slug
      }, {
        success: () => {
          this.setState({
            loading: false,
            error: false
          });
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addSuccessMessage)(successMessage);
          resolve();
        },
        error: () => {
          this.setState({
            loading: false,
            error: true
          });
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addErrorMessage)(errorMessage);
          reject(new Error('Unable to join team'));
        }
      }));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleLeaveTeam", () => {
      const {
        api,
        organization,
        team
      } = this.props;
      this.setState({
        loading: true
      });
      (0,sentry_actionCreators_teams__WEBPACK_IMPORTED_MODULE_8__.leaveTeam)(api, {
        orgId: organization.slug,
        teamId: team.slug
      }, {
        success: () => {
          this.setState({
            loading: false,
            error: false
          });
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.tct)('You have left [team]', {
            team: `#${team.slug}`
          })); // Reload ProjectsStore

          this.reloadProjects();
        },
        error: () => {
          this.setState({
            loading: false,
            error: true
          });
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.tct)('Unable to leave [team]', {
            team: `#${team.slug}`
          }));
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getTeamRoleName", () => {
      var _teamRoleList$find;

      const {
        organization,
        team
      } = this.props;

      if (!organization.features.includes('team-roles') || !team.teamRole) {
        return null;
      }

      const {
        teamRoleList
      } = organization;
      const roleName = (_teamRoleList$find = teamRoleList.find(r => r.id === team.teamRole)) === null || _teamRoleList$find === void 0 ? void 0 : _teamRoleList$find.name;
      return roleName;
    });
  }

  reloadProjects() {
    const {
      organization
    } = this.props; // After a change in teams has happened, refresh the project store

    (0,sentry_actionCreators_organizations__WEBPACK_IMPORTED_MODULE_7__.fetchOrganizationDetails)(organization.slug, {
      loadProjects: true
    });
  }

  render() {
    const {
      team,
      urlPrefix,
      openMembership
    } = this.props;

    const display = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_11__["default"], {
      team: team,
      avatarSize: 36,
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.tn)('%s Member', '%s Members', team.memberCount)
    }); // You can only view team details if you have access to team -- this should account
    // for your role + org open membership


    const canViewTeam = team.hasAccess;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(TeamPanelItem, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("div", {
        children: canViewTeam ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(TeamLink, {
          "data-test-id": "team-link",
          to: `${urlPrefix}teams/${team.slug}/`,
          children: display
        }) : display
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("div", {
        children: this.getTeamRoleName()
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("div", {
        children: this.state.loading ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_10__["default"], {
          size: "sm",
          disabled: true,
          children: "..."
        }) : team.isMember ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_10__["default"], {
          size: "sm",
          onClick: this.handleLeaveTeam,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Leave Team')
        }) : team.isPending ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_10__["default"], {
          size: "sm",
          disabled: true,
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Your request to join this team is being reviewed by organization owners'),
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Request Pending')
        }) : openMembership ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_10__["default"], {
          size: "sm",
          onClick: this.handleJoinTeam,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Join Team')
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_10__["default"], {
          size: "sm",
          onClick: this.handleRequestAccess,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Request Access')
        })
      })]
    });
  }

}

AllTeamsRow.displayName = "AllTeamsRow";

const TeamLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_12__["default"],  true ? {
  target: "epi3l7t1"
} : 0)("display:inline-block;&.focus-visible{margin:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1), ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1), ";background:#f2eff5;border-radius:3px;outline:none;}" + ( true ? "" : 0));


/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_16__["default"])(AllTeamsRow));

const TeamPanelItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__.PanelItem,  true ? {
  target: "epi3l7t0"
} : 0)("display:grid;grid-template-columns:minmax(150px, 4fr) minmax(90px, 1fr) min-content;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(2), ";align-items:center;>div:last-child{margin-left:auto;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/organizationTeams/index.tsx":
/*!********************************************************!*\
  !*** ./app/views/settings/organizationTeams/index.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "OrganizationTeamsContainer": () => (/* binding */ OrganizationTeamsContainer),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_actionCreators_projects__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/projects */ "./app/actionCreators/projects.tsx");
/* harmony import */ var sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actions/teamActions */ "./app/actions/teamActions.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var _organizationTeams__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./organizationTeams */ "./app/views/settings/organizationTeams/organizationTeams.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










class OrganizationTeamsContainer extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_6__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "removeAccessRequest", (id, isApproved) => {
      const requestToRemove = this.state.requestList.find(request => request.id === id);
      this.setState(state => ({
        requestList: state.requestList.filter(request => request.id !== id)
      }));

      if (isApproved && requestToRemove) {
        const team = requestToRemove.team;
        sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_3__["default"].updateSuccess(team.slug, { ...team,
          memberCount: team.memberCount + 1
        });
      }
    });
  }

  getEndpoints() {
    const {
      orgId
    } = this.props.params;
    return [['requestList', `/organizations/${orgId}/access-requests/`]];
  }

  componentDidMount() {
    this.fetchStats();
  }

  fetchStats() {
    (0,sentry_actionCreators_projects__WEBPACK_IMPORTED_MODULE_2__.loadStats)(this.props.api, {
      orgId: this.props.params.orgId,
      query: {
        since: (new Date().getTime() / 1000 - 3600 * 24).toString(),
        stat: 'generated',
        group: 'project'
      }
    });
  }

  renderBody() {
    const {
      organization
    } = this.props;

    if (!organization) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_organizationTeams__WEBPACK_IMPORTED_MODULE_7__["default"], { ...this.props,
      access: new Set(organization.access),
      features: new Set(organization.features),
      organization: organization,
      requestList: this.state.requestList,
      onRemoveAccessRequest: this.removeAccessRequest
    });
  }

}


/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_4__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_5__["default"])(OrganizationTeamsContainer)));

/***/ }),

/***/ "./app/views/settings/organizationTeams/organizationAccessRequests.tsx":
/*!*****************************************************************************!*\
  !*** ./app/views/settings/organizationTeams/organizationAccessRequests.tsx ***!
  \*****************************************************************************/
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
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













class OrganizationAccessRequests extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      accessRequestBusy: {}
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleApprove", (id, e) => {
      e.stopPropagation();
      this.handleAction({
        id,
        isApproved: true,
        successMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Team request approved'),
        errorMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Error approving team request')
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDeny", (id, e) => {
      e.stopPropagation();
      this.handleAction({
        id,
        isApproved: false,
        successMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Team request denied'),
        errorMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Error denying team request')
      });
    });
  }

  async handleAction(_ref) {
    let {
      id,
      isApproved,
      successMessage,
      errorMessage
    } = _ref;
    const {
      api,
      orgId,
      onRemoveAccessRequest
    } = this.props;
    this.setState(state => ({
      accessRequestBusy: { ...state.accessRequestBusy,
        [id]: true
      }
    }));

    try {
      await api.requestPromise(`/organizations/${orgId}/access-requests/${id}/`, {
        method: 'PUT',
        data: {
          isApproved
        }
      });
      onRemoveAccessRequest(id, isApproved);
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)(successMessage);
    } catch {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)(errorMessage);
    }

    this.setState(state => ({
      accessRequestBusy: { ...state.accessRequestBusy,
        [id]: false
      }
    }));
  }

  render() {
    const {
      requestList
    } = this.props;
    const {
      accessRequestBusy
    } = this.state;

    if (!requestList || !requestList.length) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.Panel, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelHeader, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Pending Team Requests')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelBody, {
        children: requestList.map(_ref2 => {
          let {
            id,
            member,
            team,
            requester
          } = _ref2;
          const memberName = member.user && (member.user.name || member.user.email || member.user.username);
          const requesterName = requester && (requester.name || requester.email || requester.username);
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(StyledPanelItem, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("div", {
              "data-test-id": "request-message",
              children: requesterName ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.tct)('[requesterName] requests to add [name] to the [team] team.', {
                requesterName,
                name: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("strong", {
                  children: memberName
                }),
                team: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)("strong", {
                  children: ["#", team.slug]
                })
              }) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.tct)('[name] requests access to the [team] team.', {
                name: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("strong", {
                  children: memberName
                }),
                team: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)("strong", {
                  children: ["#", team.slug]
                })
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)("div", {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(StyledButton, {
                priority: "primary",
                size: "sm",
                onClick: e => this.handleApprove(id, e),
                busy: accessRequestBusy[id],
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Approve')
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
                busy: accessRequestBusy[id],
                onClick: e => this.handleDeny(id, e),
                size: "sm",
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Deny')
              })]
            })]
          }, id);
        })
      })]
    });
  }

}

OrganizationAccessRequests.displayName = "OrganizationAccessRequests";

const StyledPanelItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelItem,  true ? {
  target: "e1sgruwn1"
} : 0)("display:grid;grid-template-columns:auto max-content;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(2), ";align-items:center;" + ( true ? "" : 0));

const StyledButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e1sgruwn0"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_9__["default"])(OrganizationAccessRequests));

/***/ }),

/***/ "./app/views/settings/organizationTeams/organizationTeams.tsx":
/*!********************************************************************!*\
  !*** ./app/views/settings/organizationTeams/organizationTeams.tsx ***!
  \********************************************************************/
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
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var lodash_partition__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/partition */ "../node_modules/lodash/partition.js");
/* harmony import */ var lodash_partition__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_partition__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/searchBar */ "./app/components/searchBar.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/recreateRoute */ "./app/utils/recreateRoute.tsx");
/* harmony import */ var sentry_utils_useTeams__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/useTeams */ "./app/utils/useTeams.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_organizationTeams_roleOverwriteWarning__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/views/settings/organizationTeams/roleOverwriteWarning */ "./app/views/settings/organizationTeams/roleOverwriteWarning.tsx");
/* harmony import */ var _allTeamsList__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ./allTeamsList */ "./app/views/settings/organizationTeams/allTeamsList.tsx");
/* harmony import */ var _organizationAccessRequests__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ./organizationAccessRequests */ "./app/views/settings/organizationTeams/organizationAccessRequests.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");

























function OrganizationTeams(_ref) {
  let {
    organization,
    access,
    features,
    routes,
    params,
    requestList,
    onRemoveAccessRequest
  } = _ref;
  const [teamQuery, setTeamQuery] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)('');
  const {
    initiallyLoaded
  } = (0,sentry_utils_useTeams__WEBPACK_IMPORTED_MODULE_17__["default"])({
    provideUserTeams: true
  });
  const {
    teams,
    onSearch,
    loadMore,
    hasMore,
    fetching
  } = (0,sentry_utils_useTeams__WEBPACK_IMPORTED_MODULE_17__["default"])();

  if (!organization) {
    return null;
  }

  const canCreateTeams = access.has('project:admin');

  const action = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
    priority: "primary",
    size: "sm",
    disabled: !canCreateTeams,
    title: !canCreateTeams ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('You do not have permission to create teams') : undefined,
    onClick: () => (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_6__.openCreateTeamModal)({
      organization
    }),
    icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_13__.IconAdd, {
      size: "xs",
      isCircled: true
    }),
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Create Team')
  });

  const teamRoute = routes.find(_ref2 => {
    let {
      path
    } = _ref2;
    return path === 'teams/';
  });
  const urlPrefix = teamRoute ? (0,sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_16__["default"])(teamRoute, {
    routes,
    params,
    stepBack: -2
  }) : '';
  const title = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Teams');
  const debouncedSearch = lodash_debounce__WEBPACK_IMPORTED_MODULE_4___default()(onSearch, sentry_constants__WEBPACK_IMPORTED_MODULE_12__.DEFAULT_DEBOUNCE_DURATION);

  function handleSearch(query) {
    setTeamQuery(query);
    debouncedSearch(query);
  }

  const {
    slug: orgSlug,
    orgRole,
    orgRoleList,
    teamRoleList
  } = organization;
  const filteredTeams = teams.filter(team => `#${team.slug}`.toLowerCase().includes(teamQuery.toLowerCase()));
  const [userTeams, otherTeams] = lodash_partition__WEBPACK_IMPORTED_MODULE_5___default()(filteredTeams, team => team.isMember);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)("div", {
    "data-test-id": "team-list",
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_11__["default"], {
      title: title,
      orgSlug: orgSlug
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_18__["default"], {
      title: title,
      action: action
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(_organizationAccessRequests__WEBPACK_IMPORTED_MODULE_21__["default"], {
      orgId: params.orgId,
      requestList: requestList,
      onRemoveAccessRequest: onRemoveAccessRequest
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(StyledSearchBar, {
      placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Search teams'),
      onChange: handleSearch,
      query: teamQuery
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.Panel, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.PanelHeader, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Your Teams')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.PanelBody, {
        children: [features.has('team-roles') && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_views_settings_organizationTeams_roleOverwriteWarning__WEBPACK_IMPORTED_MODULE_19__.RoleOverwritePanelAlert, {
          orgRole: orgRole,
          orgRoleList: orgRoleList,
          teamRoleList: teamRoleList,
          isSelf: true
        }), initiallyLoaded ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(_allTeamsList__WEBPACK_IMPORTED_MODULE_20__["default"], {
          urlPrefix: urlPrefix,
          organization: organization,
          teamList: userTeams.filter(team => team.slug.includes(teamQuery)),
          access: access,
          openMembership: false
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_8__["default"], {})]
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.Panel, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.PanelHeader, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Other Teams')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.PanelBody, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(_allTeamsList__WEBPACK_IMPORTED_MODULE_20__["default"], {
          urlPrefix: urlPrefix,
          organization: organization,
          teamList: otherTeams,
          access: access,
          openMembership: !!(features.has('open-membership') || access.has('org:write'))
        })
      })]
    }), hasMore && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(LoadMoreWrapper, {
      children: [fetching && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_8__["default"], {
        mini: true
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
        onClick: () => loadMore(teamQuery),
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Show more')
      })]
    })]
  });
}

OrganizationTeams.displayName = "OrganizationTeams";

const StyledSearchBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "ev1z5xc1"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(2), ";" + ( true ? "" : 0));

const LoadMoreWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ev1z5xc0"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(2), ";align-items:center;justify-content:end;grid-auto-flow:column;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OrganizationTeams);

/***/ }),

/***/ "./app/views/settings/organizationTeams/roleOverwriteWarning.tsx":
/*!***********************************************************************!*\
  !*** ./app/views/settings/organizationTeams/roleOverwriteWarning.tsx ***!
  \***********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "RoleOverwriteIcon": () => (/* binding */ RoleOverwriteIcon),
/* harmony export */   "RoleOverwritePanelAlert": () => (/* binding */ RoleOverwritePanelAlert),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "getOverwriteString": () => (/* binding */ getOverwriteString),
/* harmony export */   "hasOrgRoleOverwrite": () => (/* binding */ hasOrgRoleOverwrite)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






const RoleOverwriteIcon = props => {
  const hasOverride = hasOrgRoleOverwrite(props);

  if (!hasOverride) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_2__["default"], {
    title: getOverwriteString(props),
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconInfo, {
      size: "sm",
      color: "gray300"
    })
  });
};
RoleOverwriteIcon.displayName = "RoleOverwriteIcon";
const RoleOverwritePanelAlert = props => {
  const hasOverride = hasOrgRoleOverwrite(props);

  if (!hasOverride) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__.PanelAlert, {
    children: getOverwriteString(props)
  });
};
RoleOverwritePanelAlert.displayName = "RoleOverwritePanelAlert";

/**
 * Check that the user's org role has a minimum team role that maps to the lowest
 * possible team role
 */
function hasOrgRoleOverwrite(props) {
  const {
    orgRole,
    orgRoleList,
    teamRoleList
  } = props;
  const orgRoleObj = orgRoleList.find(r => r.id === orgRole);
  return teamRoleList.findIndex(r => r.id === (orgRoleObj === null || orgRoleObj === void 0 ? void 0 : orgRoleObj.minimumTeamRole)) > 0;
}
/**
 * Standardize string so situations where org-level vs team-level roles is easier to recognize
 */

function getOverwriteString(props) {
  const {
    orgRole,
    orgRoleList,
    teamRoleList,
    isSelf
  } = props;
  const orgRoleObj = orgRoleList.find(r => r.id === orgRole);
  const teamRoleObj = teamRoleList.find(r => r.id === (orgRoleObj === null || orgRoleObj === void 0 ? void 0 : orgRoleObj.minimumTeamRole));

  if (!orgRoleObj || !teamRoleObj) {
    return '';
  }

  return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)('[selfNoun] organization role as [article] [orgRole] has granted [selfPronoun] a minimum team-level role of [teamRole]', {
    selfNoun: isSelf ? 'Your' : "This user's",
    selfPronoun: isSelf ? 'you' : 'them',
    article: 'AEIOU'.includes(orgRoleObj.name[0]) ? 'an' : 'a',
    orgRole: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("strong", {
      children: orgRoleObj.name
    }),
    teamRole: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("strong", {
      children: teamRoleObj.name
    })
  });
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (RoleOverwriteIcon);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_organizationTeams_index_tsx.aab032b058660ece3966d8cee0176f5a.js.map