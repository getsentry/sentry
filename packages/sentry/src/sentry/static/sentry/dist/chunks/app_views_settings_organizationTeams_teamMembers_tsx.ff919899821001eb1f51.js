"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_organizationTeams_teamMembers_tsx"],{

/***/ "./app/components/roleSelectControl.tsx":
/*!**********************************************!*\
  !*** ./app/components/roleSelectControl.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }




function RoleSelectControl(_ref) {
  let {
    roles,
    disableUnallowed,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_1__["default"], {
    options: roles === null || roles === void 0 ? void 0 : roles.map(r => ({
      value: r.id,
      label: r.name,
      disabled: disableUnallowed && !r.allowed,
      details: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(Details, {
        children: r.desc
      })
    })),
    showDividers: true,
    ...props
  });
}

RoleSelectControl.displayName = "RoleSelectControl";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (RoleSelectControl);

const Details = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1cjlayn0"
} : 0)( true ? {
  name: "vad6xm",
  styles: "display:inline-block;width:20rem"
} : 0);

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

/***/ }),

/***/ "./app/views/settings/organizationTeams/teamMembers.tsx":
/*!**************************************************************!*\
  !*** ./app/views/settings/organizationTeams/teamMembers.tsx ***!
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
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_actionCreators_teams__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/actionCreators/teams */ "./app/actionCreators/teams.tsx");
/* harmony import */ var sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/avatar/userAvatar */ "./app/components/avatar/userAvatar.tsx");
/* harmony import */ var sentry_components_dropdownAutoComplete__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/dropdownAutoComplete */ "./app/components/dropdownAutoComplete/index.tsx");
/* harmony import */ var sentry_components_dropdownButton__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/dropdownButton */ "./app/components/dropdownButton.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withConfig__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/withConfig */ "./app/utils/withConfig.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var _teamMembersRow__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! ./teamMembersRow */ "./app/views/settings/organizationTeams/teamMembersRow.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


























class TeamMembers extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_23__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "debouncedFetchMembersRequest", lodash_debounce__WEBPACK_IMPORTED_MODULE_5___default()(query => this.setState({
      dropdownBusy: true
    }, () => this.fetchMembersRequest(query)), 200));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchMembersRequest", async query => {
      const {
        params,
        api
      } = this.props;
      const {
        orgId
      } = params;

      try {
        const data = await api.requestPromise(`/organizations/${orgId}/members/`, {
          query: {
            query
          }
        });
        this.setState({
          orgMembers: data,
          dropdownBusy: false
        });
      } catch (_err) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Unable to load organization members.'), {
          duration: 2000
        });
        this.setState({
          dropdownBusy: false
        });
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "addTeamMember", selection => {
      const {
        params
      } = this.props;
      const {
        orgMembers,
        teamMembers
      } = this.state;
      this.setState({
        loading: true
      }); // Reset members list after adding member to team

      this.debouncedFetchMembersRequest('');
      (0,sentry_actionCreators_teams__WEBPACK_IMPORTED_MODULE_8__.joinTeam)(this.props.api, {
        orgId: params.orgId,
        teamId: params.teamId,
        memberId: selection.value
      }, {
        success: () => {
          const orgMember = orgMembers.find(member => member.id === selection.value);

          if (orgMember === undefined) {
            return;
          }

          this.setState({
            loading: false,
            error: false,
            teamMembers: teamMembers.concat([orgMember])
          });
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Successfully added member to team.'));
        },
        error: () => {
          this.setState({
            loading: false
          });
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Unable to add team member.'));
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "removeTeamMember", member => {
      const {
        params
      } = this.props;
      const {
        teamMembers
      } = this.state;
      (0,sentry_actionCreators_teams__WEBPACK_IMPORTED_MODULE_8__.leaveTeam)(this.props.api, {
        orgId: params.orgId,
        teamId: params.teamId,
        memberId: member.id
      }, {
        success: () => {
          this.setState({
            teamMembers: teamMembers.filter(m => m.id !== member.id)
          });
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Successfully removed member from team.'));
        },
        error: () => (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('There was an error while trying to remove a member from the team.'))
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "updateTeamMemberRole", (member, newRole) => {
      const {
        orgId,
        teamId
      } = this.props.params;
      const endpoint = `/organizations/${orgId}/members/${member.id}/teams/${teamId}/`;
      this.props.api.request(endpoint, {
        method: 'PUT',
        data: {
          teamRole: newRole
        },
        success: data => {
          const teamMembers = [...this.state.teamMembers];
          const i = teamMembers.findIndex(m => m.id === member.id);
          teamMembers[i] = { ...member,
            teamRole: data.teamRole
          };
          this.setState({
            teamMembers
          });
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Successfully changed role for team member.'));
        },
        error: () => {
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('There was an error while trying to change the roles for a team member.'));
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleMemberFilterChange", e => {
      this.setState({
        dropdownBusy: true
      });
      this.debouncedFetchMembersRequest(e.target.value);
    });
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      loading: true,
      error: false,
      dropdownBusy: false,
      teamMembers: [],
      orgMembers: []
    };
  }

  componentDidMount() {
    // Initialize "add member" dropdown with data
    this.fetchMembersRequest('');
  }

  getEndpoints() {
    const {
      params
    } = this.props;
    return [['teamMembers', `/teams/${params.orgId}/${params.teamId}/members/`, {}, {
      paginate: true
    }]];
  }

  renderDropdown(hasWriteAccess) {
    const {
      organization,
      params
    } = this.props;
    const {
      orgMembers
    } = this.state;
    const existingMembers = new Set(this.state.teamMembers.map(member => member.id)); // members can add other members to a team if the `Open Membership` setting is enabled
    // otherwise, `org:write` or `team:admin` permissions are required

    const hasOpenMembership = !!(organization !== null && organization !== void 0 && organization.openMembership);
    const canAddMembers = hasOpenMembership || hasWriteAccess;
    const items = (orgMembers || []).filter(m => !existingMembers.has(m.id)).map(m => ({
      searchKey: `${m.name} ${m.email}`,
      value: m.id,
      label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(StyledUserListElement, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(StyledAvatar, {
          user: m,
          size: 24,
          className: "avatar"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(StyledNameOrEmail, {
          children: m.name || m.email
        })]
      })
    }));

    const menuHeader = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(StyledMembersLabel, {
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Members'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(StyledCreateMemberLink, {
        to: "",
        onClick: () => (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_7__.openInviteMembersModal)({
          source: 'teams'
        }),
        "data-test-id": "invite-member",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Invite Member')
      })]
    });

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_dropdownAutoComplete__WEBPACK_IMPORTED_MODULE_10__["default"], {
      items: items,
      alignMenu: "right",
      onSelect: canAddMembers ? this.addTeamMember : selection => (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_7__.openTeamAccessRequestModal)({
        teamId: params.teamId,
        orgId: params.orgId,
        memberId: selection.value
      }),
      menuHeader: menuHeader,
      emptyMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('No members'),
      onChange: this.handleMemberFilterChange,
      busy: this.state.dropdownBusy,
      onClose: () => this.debouncedFetchMembersRequest(''),
      children: _ref => {
        let {
          isOpen
        } = _ref;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_dropdownButton__WEBPACK_IMPORTED_MODULE_11__["default"], {
          isOpen: isOpen,
          size: "xs",
          "data-test-id": "add-member",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Add Member')
        });
      }
    });
  }

  render() {
    if (this.state.loading) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_14__["default"], {});
    }

    if (this.state.error) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_13__["default"], {
        onRetry: this.fetchData
      });
    }

    const {
      organization,
      config
    } = this.props;
    const {
      teamMembersPageLinks
    } = this.state;
    const {
      access
    } = organization;
    const hasWriteAccess = access.includes('org:write') || access.includes('team:admin');
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_16__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_16__.PanelHeader, {
          hasButtons: true,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)("div", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Members')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)("div", {
            style: {
              textTransform: 'none'
            },
            children: this.renderDropdown(hasWriteAccess)
          })]
        }), this.state.teamMembers.length ? this.state.teamMembers.map(member => {
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(_teamMembersRow__WEBPACK_IMPORTED_MODULE_25__["default"], {
            hasWriteAccess: hasWriteAccess,
            member: member,
            organization: organization,
            removeMember: this.removeTeamMember,
            updateMemberRole: this.updateTeamMemberRole,
            user: config.user
          }, member.id);
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_24__["default"], {
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_17__.IconUser, {
            size: "xl"
          }),
          size: "large",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('This team has no members')
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_15__["default"], {
        pageLinks: teamMembersPageLinks
      })]
    });
  }

}

TeamMembers.displayName = "TeamMembers";

const StyledUserListElement = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ekipw4c4"
} : 0)("display:grid;grid-template-columns:max-content 1fr;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_19__["default"])(0.5), ";align-items:center;" + ( true ? "" : 0));

const StyledNameOrEmail = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ekipw4c3"
} : 0)("font-size:", p => p.theme.fontSizeSmall, ";", p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

const StyledAvatar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(props => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_9__["default"], { ...props
}),  true ? {
  target: "ekipw4c2"
} : 0)( true ? {
  name: "1dy9mco",
  styles: "min-width:1.75em;min-height:1.75em;width:1.5em;height:1.5em"
} : 0);

const StyledMembersLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ekipw4c1"
} : 0)("display:grid;grid-template-columns:1fr max-content;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_19__["default"])(1), " 0;font-size:", p => p.theme.fontSizeExtraSmall, ";text-transform:uppercase;" + ( true ? "" : 0));

const StyledCreateMemberLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_12__["default"],  true ? {
  target: "ekipw4c0"
} : 0)( true ? {
  name: "kxbue8",
  styles: "text-transform:none"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withConfig__WEBPACK_IMPORTED_MODULE_21__["default"])((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_20__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_22__["default"])(TeamMembers))));

/***/ }),

/***/ "./app/views/settings/organizationTeams/teamMembersRow.tsx":
/*!*****************************************************************!*\
  !*** ./app/views/settings/organizationTeams/teamMembersRow.tsx ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/idBadge */ "./app/components/idBadge/index.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_roleSelectControl__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/roleSelectControl */ "./app/components/roleSelectControl.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_settings_organizationTeams_roleOverwriteWarning__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/views/settings/organizationTeams/roleOverwriteWarning */ "./app/views/settings/organizationTeams/roleOverwriteWarning.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }












const TeamMembersRow = props => {
  const {
    organization,
    member,
    user,
    hasWriteAccess,
    removeMember,
    updateMemberRole
  } = props;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(TeamRolesPanelItem, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("div", {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_3__["default"], {
        avatarSize: 36,
        member: member,
        useLink: true,
        orgId: organization.slug
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("div", {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(TeamRoleSelect, {
        hasWriteAccess: hasWriteAccess,
        updateMemberRole: updateMemberRole,
        organization: organization,
        member: member
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("div", {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(RemoveButton, {
        hasWriteAccess: hasWriteAccess,
        onClick: () => removeMember(member),
        member: member,
        user: user
      })
    })]
  }, member.id);
};

TeamMembersRow.displayName = "TeamMembersRow";

const TeamRoleSelect = props => {
  const {
    hasWriteAccess,
    organization,
    member,
    updateMemberRole
  } = props;
  const {
    orgRoleList,
    teamRoleList,
    features
  } = organization;

  if (!features.includes('team-roles')) {
    return null;
  }

  const {
    orgRole: orgRoleId
  } = member;
  const orgRole = orgRoleList.find(r => r.id === orgRoleId);
  const teamRoleId = member.teamRole || (orgRole === null || orgRole === void 0 ? void 0 : orgRole.minimumTeamRole);
  const teamRole = teamRoleList.find(r => r.id === teamRoleId) || teamRoleList[0];

  if (!hasWriteAccess || (0,sentry_views_settings_organizationTeams_roleOverwriteWarning__WEBPACK_IMPORTED_MODULE_9__.hasOrgRoleOverwrite)({
    orgRole: orgRoleId,
    orgRoleList,
    teamRoleList
  })) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(RoleName, {
      children: [teamRole.name, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(IconWrapper, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_views_settings_organizationTeams_roleOverwriteWarning__WEBPACK_IMPORTED_MODULE_9__.RoleOverwriteIcon, {
          orgRole: orgRoleId,
          orgRoleList: orgRoleList,
          teamRoleList: teamRoleList
        })
      })]
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(RoleSelectWrapper, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_roleSelectControl__WEBPACK_IMPORTED_MODULE_5__["default"], {
      roles: teamRoleList,
      value: teamRole.id,
      onChange: option => updateMemberRole(member, option.value),
      disableUnallowed: true
    })
  });
};

TeamRoleSelect.displayName = "TeamRoleSelect";

const RemoveButton = props => {
  const {
    member,
    user,
    hasWriteAccess,
    onClick
  } = props;
  const isSelf = member.email === user.email;
  const canRemoveMember = hasWriteAccess || isSelf;

  if (!canRemoveMember) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
    size: "xs",
    disabled: !canRemoveMember,
    icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_6__.IconSubtract, {
      size: "xs",
      isCircled: true
    }),
    onClick: onClick,
    "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Remove'),
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Remove')
  });
};

RemoveButton.displayName = "RemoveButton";

const RoleName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e130n5f43"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const IconWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e130n5f42"
} : 0)("height:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(2), ";margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";" + ( true ? "" : 0));

const RoleSelectWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e130n5f41"
} : 0)( true ? {
  name: "5b6t4c",
  styles: "display:flex;flex-direction:row;align-items:center;>div:first-child{flex-grow:1;}"
} : 0);

const TeamRolesPanelItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__.PanelItem,  true ? {
  target: "e130n5f40"
} : 0)("display:grid;grid-template-columns:minmax(120px, 4fr) minmax(120px, 2fr) minmax(100px, 1fr);gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(2), ";align-items:center;>div:last-child{margin-left:auto;}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TeamMembersRow);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_organizationTeams_teamMembers_tsx.1b70f5f580f12ee17c7d55967d44469d.js.map