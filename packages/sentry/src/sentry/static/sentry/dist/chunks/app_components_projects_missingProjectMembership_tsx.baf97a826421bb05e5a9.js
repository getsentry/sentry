"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_projects_missingProjectMembership_tsx"],{

/***/ "./app/components/projects/missingProjectMembership.tsx":
/*!**************************************************************!*\
  !*** ./app/components/projects/missingProjectMembership.tsx ***!
  \**************************************************************/
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
/* harmony import */ var sentry_actionCreators_teams__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/teams */ "./app/actionCreators/teams.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_teamStore__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/stores/teamStore */ "./app/stores/teamStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }
















class MissingProjectMembership extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      loading: false,
      error: false,
      project: this.props.project,
      team: ''
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getPendingTeamOption", team => {
      return {
        value: team,
        label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(DisabledLabel, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)(`#${team}`)
        })
      };
    });
  }

  joinTeam(teamSlug) {
    this.setState({
      loading: true
    });
    (0,sentry_actionCreators_teams__WEBPACK_IMPORTED_MODULE_5__.joinTeam)(this.props.api, {
      orgId: this.props.organization.slug,
      teamId: teamSlug
    }, {
      success: () => {
        this.setState({
          loading: false,
          error: false
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Request to join team sent.'));
      },
      error: () => {
        this.setState({
          loading: false,
          error: true
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('There was an error while trying to request access.'));
      }
    });
  }

  renderJoinTeam(teamSlug, features) {
    const team = sentry_stores_teamStore__WEBPACK_IMPORTED_MODULE_11__["default"].getBySlug(teamSlug);

    if (!team) {
      return null;
    }

    if (this.state.loading) {
      if (features.has('open-membership')) {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
          busy: true,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Join Team')
        });
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
        busy: true,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Request Access')
      });
    }

    if (team !== null && team !== void 0 && team.isPending) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
        disabled: true,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Request Pending')
      });
    }

    if (features.has('open-membership')) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
        priority: "primary",
        type: "button",
        onClick: this.joinTeam.bind(this, teamSlug),
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Join Team')
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
      priority: "primary",
      type: "button",
      onClick: this.joinTeam.bind(this, teamSlug),
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Request Access')
    });
  }

  getTeamsForAccess() {
    var _this$state$project$t, _this$state$project;

    const request = [];
    const pending = [];
    const teams = (_this$state$project$t = (_this$state$project = this.state.project) === null || _this$state$project === void 0 ? void 0 : _this$state$project.teams) !== null && _this$state$project$t !== void 0 ? _this$state$project$t : [];
    teams.forEach(_ref => {
      let {
        slug
      } = _ref;
      const team = sentry_stores_teamStore__WEBPACK_IMPORTED_MODULE_11__["default"].getBySlug(slug);

      if (!team) {
        return;
      }

      team.isPending ? pending.push(team.slug) : request.push(team.slug);
    });
    return [request, pending];
  }

  render() {
    var _this$state$project$t2, _this$state$project2;

    const {
      organization
    } = this.props;
    const teamSlug = this.state.team;
    const teams = (_this$state$project$t2 = (_this$state$project2 = this.state.project) === null || _this$state$project2 === void 0 ? void 0 : _this$state$project2.teams) !== null && _this$state$project$t2 !== void 0 ? _this$state$project$t2 : [];
    const features = new Set(organization.features);
    const teamAccess = [{
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Request Access'),
      options: this.getTeamsForAccess()[0].map(request => ({
        value: request,
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)(`#${request}`)
      }))
    }, {
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Pending Requests'),
      options: this.getTeamsForAccess()[1].map(pending => this.getPendingTeamOption(pending))
    }];
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(StyledPanel, {
      children: !teams.length ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_14__["default"], {
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconFlag, {
          size: "xl"
        }),
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('No teams have access to this project yet. Ask an admin to add your team to this project.')
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_14__["default"], {
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconFlag, {
          size: "xl"
        }),
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)("You're not a member of this project."),
        description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)(`You'll need to join a team with access before you can view this data.`),
        action: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(Field, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(StyledSelectControl, {
            name: "select",
            placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Select a Team'),
            options: teamAccess,
            onChange: teamObj => {
              const team = teamObj ? teamObj.value : null;
              this.setState({
                team
              });
            }
          }), teamSlug ? this.renderJoinTeam(teamSlug, features) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
            disabled: true,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Select a Team')
          })]
        })
      })
    });
  }

}

MissingProjectMembership.displayName = "MissingProjectMembership";

const StyledPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.Panel,  true ? {
  target: "e1cfryqt3"
} : 0)("margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(2), " 0;" + ( true ? "" : 0));

const Field = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1cfryqt2"
} : 0)("display:grid;grid-auto-flow:column;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(2), ";text-align:left;" + ( true ? "" : 0));

const StyledSelectControl = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "e1cfryqt1"
} : 0)( true ? {
  name: "xu0q36",
  styles: "width:250px"
} : 0);

const DisabledLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1cfryqt0"
} : 0)( true ? {
  name: "v6ye5b",
  styles: "display:flex;opacity:0.5;overflow:hidden"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_13__["default"])(MissingProjectMembership));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_projects_missingProjectMembership_tsx.1d82402255d4867e2f08667bfda483b3.js.map