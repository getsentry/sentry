"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_organizationTeams_teamProjects_tsx"],{

/***/ "./app/views/settings/components/settingsProjectItem.tsx":
/*!***************************************************************!*\
  !*** ./app/views/settings/components/settingsProjectItem.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/idBadge/projectBadge */ "./app/components/idBadge/projectBadge.tsx");
/* harmony import */ var sentry_components_projects_bookmarkStar__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/projects/bookmarkStar */ "./app/components/projects/bookmarkStar.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









function ProjectItem(_ref) {
  let {
    project,
    organization
  } = _ref;
  const [isBookmarked, setBookmarked] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(project.isBookmarked);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(Wrapper, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_projects_bookmarkStar__WEBPACK_IMPORTED_MODULE_4__["default"], {
      organization: organization,
      project: project,
      isBookmarked: isBookmarked,
      onToggle: state => setBookmarked(state)
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_3__["default"], {
      to: `/settings/${organization.slug}/projects/${project.slug}/`,
      avatarSize: 18,
      project: project
    })]
  });
}

ProjectItem.displayName = "ProjectItem";

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e3cl2ic0"
} : 0)("display:grid;grid-template-columns:max-content 1fr;align-items:center;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1.5), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectItem);

/***/ }),

/***/ "./app/views/settings/organizationTeams/teamProjects.tsx":
/*!***************************************************************!*\
  !*** ./app/views/settings/organizationTeams/teamProjects.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TeamProjects": () => (/* binding */ TeamProjects),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actions/projectActions */ "./app/actions/projectActions.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_dropdownAutoComplete__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/dropdownAutoComplete */ "./app/components/dropdownAutoComplete/index.tsx");
/* harmony import */ var sentry_components_dropdownButton__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/dropdownButton */ "./app/components/dropdownButton.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var sentry_views_settings_components_settingsProjectItem__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/views/settings/components/settingsProjectItem */ "./app/views/settings/components/settingsProjectItem.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");

























class TeamProjects extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      error: false,
      loading: true,
      pageLinks: null,
      unlinkedProjects: [],
      linkedProjects: []
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchAll", () => {
      this.fetchTeamProjects();
      this.fetchUnlinkedProjects();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleLinkProject", (project, action) => {
      const {
        orgId,
        teamId
      } = this.props.params;
      this.props.api.request(`/projects/${orgId}/${project.slug}/teams/${teamId}/`, {
        method: action === 'add' ? 'POST' : 'DELETE',
        success: resp => {
          this.fetchAll();
          sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].updateSuccess(resp);
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)(action === 'add' ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Successfully added project to team.') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Successfully removed project from team'));
        },
        error: () => {
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)("Wasn't able to change project association."));
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleProjectSelected", selection => {
      const project = this.state.unlinkedProjects.find(p => p.id === selection.value);

      if (project) {
        this.handleLinkProject(project, 'add');
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleQueryUpdate", evt => {
      this.fetchUnlinkedProjects(evt.target.value);
    });
  }

  componentDidMount() {
    this.fetchAll();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.params.orgId !== this.props.params.orgId || prevProps.params.teamId !== this.props.params.teamId) {
      this.fetchAll();
    }

    if (prevProps.location !== this.props.location) {
      this.fetchTeamProjects();
    }
  }

  fetchTeamProjects() {
    const {
      location,
      params: {
        orgId,
        teamId
      }
    } = this.props;
    this.setState({
      loading: true
    });
    this.props.api.requestPromise(`/organizations/${orgId}/projects/`, {
      query: {
        query: `team:${teamId}`,
        cursor: location.query.cursor || ''
      },
      includeAllArgs: true
    }).then(_ref => {
      var _resp$getResponseHead;

      let [linkedProjects, _, resp] = _ref;
      this.setState({
        loading: false,
        error: false,
        linkedProjects,
        pageLinks: (_resp$getResponseHead = resp === null || resp === void 0 ? void 0 : resp.getResponseHeader('Link')) !== null && _resp$getResponseHead !== void 0 ? _resp$getResponseHead : null
      });
    }).catch(() => {
      this.setState({
        loading: false,
        error: true
      });
    });
  }

  fetchUnlinkedProjects() {
    let query = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
    const {
      params: {
        orgId,
        teamId
      }
    } = this.props;
    this.props.api.requestPromise(`/organizations/${orgId}/projects/`, {
      query: {
        query: query ? `!team:${teamId} ${query}` : `!team:${teamId}`
      }
    }).then(unlinkedProjects => {
      this.setState({
        unlinkedProjects
      });
    });
  }

  projectPanelContents(projects) {
    const {
      organization
    } = this.props;
    const access = new Set(organization.access);
    const canWrite = access.has('org:write');
    return projects.length ? (0,sentry_utils__WEBPACK_IMPORTED_MODULE_17__.sortProjects)(projects).map(project => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(StyledPanelItem, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_views_settings_components_settingsProjectItem__WEBPACK_IMPORTED_MODULE_21__["default"], {
        project: project,
        organization: organization
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_13__["default"], {
        disabled: canWrite,
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('You do not have enough permission to change project association.'),
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
          size: "sm",
          disabled: !canWrite,
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconSubtract, {
            isCircled: true,
            size: "xs"
          }),
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Remove'),
          onClick: () => {
            this.handleLinkProject(project, 'remove');
          },
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Remove')
        })
      })]
    }, project.id)) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_20__["default"], {
      size: "large",
      icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconFlag, {
        size: "xl"
      }),
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)("This team doesn't have access to any projects.")
    });
  }

  render() {
    const {
      linkedProjects,
      unlinkedProjects,
      error,
      loading
    } = this.state;

    if (error) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_9__["default"], {
        onRetry: () => this.fetchAll()
      });
    }

    if (loading) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_10__["default"], {});
    }

    const access = new Set(this.props.organization.access);
    const otherProjects = unlinkedProjects.map(p => ({
      value: p.id,
      searchKey: p.slug,
      label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(ProjectListElement, {
        children: p.slug
      })
    }));
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelHeader, {
          hasButtons: true,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)("div", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Projects')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)("div", {
            style: {
              textTransform: 'none'
            },
            children: !access.has('org:write') ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_dropdownButton__WEBPACK_IMPORTED_MODULE_8__["default"], {
              disabled: true,
              title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('You do not have enough permission to associate a project.'),
              size: "xs",
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Add Project')
            }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_dropdownAutoComplete__WEBPACK_IMPORTED_MODULE_7__["default"], {
              items: otherProjects,
              onChange: this.handleQueryUpdate,
              onSelect: this.handleProjectSelected,
              emptyMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('No projects'),
              alignMenu: "right",
              children: _ref2 => {
                let {
                  isOpen
                } = _ref2;
                return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_dropdownButton__WEBPACK_IMPORTED_MODULE_8__["default"], {
                  isOpen: isOpen,
                  size: "xs",
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Add Project')
                });
              }
            })
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelBody, {
          children: this.projectPanelContents(linkedProjects)
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_11__["default"], {
        pageLinks: this.state.pageLinks,
        ...this.props
      })]
    });
  }

}

TeamProjects.displayName = "TeamProjects";

const StyledPanelItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelItem,  true ? {
  target: "eofet41"
} : 0)("display:flex;align-items:center;justify-content:space-between;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(2), ";" + ( true ? "" : 0));

const ProjectListElement = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eofet40"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(0.25), " 0;" + ( true ? "" : 0));


/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_18__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_19__["default"])(TeamProjects)));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_organizationTeams_teamProjects_tsx.268c9f53c47566bca1a1823fe0b95da5.js.map