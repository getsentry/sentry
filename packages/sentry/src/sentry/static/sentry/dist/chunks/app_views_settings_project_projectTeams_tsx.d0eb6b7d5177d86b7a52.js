"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_project_projectTeams_tsx"],{

/***/ "./app/utils/routeTitle.tsx":
/*!**********************************!*\
  !*** ./app/utils/routeTitle.tsx ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
function routeTitleGen(routeName, orgSlug) {
  let withSentry = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
  let projectSlug = arguments.length > 3 ? arguments[3] : undefined;
  const tmplBase = `${routeName} - ${orgSlug}`;
  const tmpl = projectSlug ? `${tmplBase} - ${projectSlug}` : tmplBase;
  return withSentry ? `${tmpl} - Sentry` : tmpl;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (routeTitleGen);

/***/ }),

/***/ "./app/views/settings/project/projectTeams.tsx":
/*!*****************************************************!*\
  !*** ./app/views/settings/project/projectTeams.tsx ***!
  \*****************************************************/
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
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_actionCreators_projects__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/projects */ "./app/actionCreators/projects.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/routeTitle */ "./app/utils/routeTitle.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_components_teamSelect__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/settings/components/teamSelect */ "./app/views/settings/components/teamSelect.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



















class ProjectTeams extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_12__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "canCreateTeam", () => {
      const {
        organization
      } = this.props;
      const access = new Set(organization.access);
      return access.has('org:write') && access.has('team:write') && access.has('project:write');
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleRemove", teamSlug => {
      if (this.state.loading) {
        return;
      }

      const {
        orgId,
        projectId
      } = this.props.params;
      (0,sentry_actionCreators_projects__WEBPACK_IMPORTED_MODULE_6__.removeTeamFromProject)(this.api, orgId, projectId, teamSlug).then(() => this.handleRemovedTeam(teamSlug)).catch(() => {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Could not remove the %s team', teamSlug));
        this.setState({
          loading: false
        });
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleRemovedTeam", teamSlug => {
      this.setState(prevState => ({
        projectTeams: [...(prevState.projectTeams || []).filter(team => team.slug !== teamSlug)]
      }));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleAddedTeam", team => {
      this.setState(prevState => ({
        projectTeams: [...(prevState.projectTeams || []), team]
      }));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleAdd", team => {
      if (this.state.loading) {
        return;
      }

      const {
        orgId,
        projectId
      } = this.props.params;
      (0,sentry_actionCreators_projects__WEBPACK_IMPORTED_MODULE_6__.addTeamToProject)(this.api, orgId, projectId, team).then(() => {
        this.handleAddedTeam(team);
      }, () => {
        this.setState({
          error: true,
          loading: false
        });
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleCreateTeam", e => {
      const {
        project,
        organization
      } = this.props;

      if (!this.canCreateTeam()) {
        return;
      }

      e.stopPropagation();
      e.preventDefault();
      (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_5__.openCreateTeamModal)({
        project,
        organization,
        onClose: data => {
          (0,sentry_actionCreators_projects__WEBPACK_IMPORTED_MODULE_6__.addTeamToProject)(this.api, organization.slug, project.slug, data).then(this.remountComponent, this.remountComponent);
        }
      });
    });
  }

  getEndpoints() {
    const {
      orgId,
      projectId
    } = this.props.params;
    return [['projectTeams', `/projects/${orgId}/${projectId}/teams/`]];
  }

  getTitle() {
    const {
      projectId
    } = this.props.params;
    return (0,sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_11__["default"])((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Project Teams'), projectId, false);
  }

  renderBody() {
    const {
      params,
      organization
    } = this.props;
    const canCreateTeam = this.canCreateTeam();
    const hasAccess = organization.access.includes('project:write');
    const confirmRemove = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('This is the last team with access to this project. Removing it will mean ' + 'only organization owners and managers will be able to access the project pages. Are ' + 'you sure you want to remove this team from the project %s?', params.projectId);
    const {
      projectTeams
    } = this.state;

    const menuHeader = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(StyledTeamsLabel, {
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Teams'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_8__["default"], {
        disabled: canCreateTeam,
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('You must be a project admin to create teams'),
        position: "top",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(StyledCreateTeamLink, {
          to: "",
          disabled: !canCreateTeam,
          onClick: this.handleCreateTeam,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Create Team')
        })
      })]
    });

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_13__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('%s Teams', params.projectId)
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_views_settings_components_teamSelect__WEBPACK_IMPORTED_MODULE_14__["default"], {
        organization: organization,
        selectedTeams: projectTeams !== null && projectTeams !== void 0 ? projectTeams : [],
        onAddTeam: this.handleAdd,
        onRemoveTeam: this.handleRemove,
        menuHeader: menuHeader,
        confirmLastTeamRemoveMessage: confirmRemove,
        disabled: !hasAccess
      })]
    });
  }

}

const StyledTeamsLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1bk25b31"
} : 0)("font-size:0.875em;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(0.5), " 0px;text-transform:uppercase;" + ( true ? "" : 0));

const StyledCreateTeamLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "e1bk25b30"
} : 0)("float:right;text-transform:none;", p => p.disabled && /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_16__.css)("cursor:not-allowed;color:", p.theme.gray300, ";opacity:0.6;" + ( true ? "" : 0),  true ? "" : 0), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectTeams);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_project_projectTeams_tsx.bcde693b24c65079218fcebee711cdd3.js.map