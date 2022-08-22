"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_organizationMembers_organizationMemberDetail_tsx"],{

/***/ "./app/utils/isMemberDisabledFromLimit.tsx":
/*!*************************************************!*\
  !*** ./app/utils/isMemberDisabledFromLimit.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ isMemberDisabledFromLimit)
/* harmony export */ });
// check to see if a member has been disabled because of the member limit
function isMemberDisabledFromLimit(member) {
  var _member$flags$member;

  return (_member$flags$member = member === null || member === void 0 ? void 0 : member.flags['member-limit:restricted']) !== null && _member$flags$member !== void 0 ? _member$flags$member : false;
}

/***/ }),

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

/***/ "./app/views/settings/organizationMembers/inviteMember/orgRoleSelect.tsx":
/*!*******************************************************************************!*\
  !*** ./app/views/settings/organizationMembers/inviteMember/orgRoleSelect.tsx ***!
  \*******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_radio__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/radio */ "./app/components/radio.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









const Label = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('label',  true ? {
  target: "e15ifuvq0"
} : 0)( true ? {
  name: "ddvan8",
  styles: "display:flex;flex:1;align-items:center;margin-bottom:0"
} : 0);

class OrganizationRoleSelect extends react__WEBPACK_IMPORTED_MODULE_1__.Component {
  render() {
    const {
      disabled,
      enforceRetired,
      enforceAllowed,
      roleList,
      roleSelected,
      setSelected
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.Panel, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.PanelHeader, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Organization Role')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.PanelBody, {
        children: roleList.map(role => {
          const {
            desc,
            name,
            id,
            allowed,
            isRetired: roleRetired
          } = role;
          const isRetired = enforceRetired && roleRetired;
          const isDisabled = disabled || isRetired || enforceAllowed && !allowed;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.PanelItem, {
            onClick: () => !isDisabled && setSelected(id),
            css: !isDisabled ? {} : {
              color: 'grey',
              cursor: 'default'
            },
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(Label, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_radio__WEBPACK_IMPORTED_MODULE_3__["default"], {
                id: id,
                value: name,
                checked: id === roleSelected,
                readOnly: true
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("div", {
                style: {
                  flex: 1,
                  padding: '0 16px'
                },
                children: [name, " ", isRetired && (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('(Deprecated)'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_5__["default"], {
                  noMargin: true,
                  children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("div", {
                    className: "help-block",
                    children: desc
                  })
                })]
              })]
            })
          }, id);
        })
      })]
    });
  }

}

OrganizationRoleSelect.displayName = "OrganizationRoleSelect";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OrganizationRoleSelect);

/***/ }),

/***/ "./app/views/settings/organizationMembers/organizationMemberDetail.tsx":
/*!*****************************************************************************!*\
  !*** ./app/views/settings/organizationMembers/organizationMemberDetail.tsx ***!
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
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_actionCreators_account__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/account */ "./app/actionCreators/account.tsx");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_members__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/actionCreators/members */ "./app/actionCreators/members.tsx");
/* harmony import */ var sentry_components_autoSelectText__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/autoSelectText */ "./app/components/autoSelectText.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_errors_notFound__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/errors/notFound */ "./app/components/errors/notFound.tsx");
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_components_hookOrDefault__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/hookOrDefault */ "./app/components/hookOrDefault.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_input__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/styles/input */ "./app/styles/input.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_isMemberDisabledFromLimit__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/isMemberDisabledFromLimit */ "./app/utils/isMemberDisabledFromLimit.tsx");
/* harmony import */ var sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/recreateRoute */ "./app/utils/recreateRoute.tsx");
/* harmony import */ var sentry_utils_teams__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/utils/teams */ "./app/utils/teams.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_components_teamSelect__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! sentry/views/settings/components/teamSelect */ "./app/views/settings/components/teamSelect.tsx");
/* harmony import */ var _inviteMember_orgRoleSelect__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! ./inviteMember/orgRoleSelect */ "./app/views/settings/organizationMembers/inviteMember/orgRoleSelect.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






























const MULTIPLE_ORGS = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Cannot be reset since user is in more than one organization');
const NOT_ENROLLED = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Not enrolled in two-factor authentication');
const NO_PERMISSION = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('You do not have permission to perform this action');
const TWO_FACTOR_REQUIRED = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Cannot be reset since two-factor is required for this organization');
const DisabledMemberTooltip = (0,sentry_components_hookOrDefault__WEBPACK_IMPORTED_MODULE_15__["default"])({
  hookName: 'component:disabled-member-tooltip',
  defaultComponent: _ref => {
    let {
      children
    } = _ref;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: children
    });
  }
});

class OrganizationMemberDetail extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_26__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSave", async () => {
      const {
        organization,
        params
      } = this.props;
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_7__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Saving...'));
      this.setState({
        busy: true
      });

      try {
        await (0,sentry_actionCreators_members__WEBPACK_IMPORTED_MODULE_8__.updateMember)(this.api, {
          orgId: organization.slug,
          memberId: params.memberId,
          data: this.state.member
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_7__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Saved'));
        this.redirectToMemberPage();
      } catch (resp) {
        const errorMessage = resp && resp.responseJSON && resp.responseJSON.detail || (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Could not save...');
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_7__.addErrorMessage)(errorMessage);
      }

      this.setState({
        busy: false
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleInvite", async regenerate => {
      const {
        organization,
        params
      } = this.props;
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_7__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Sending invite...'));
      this.setState({
        busy: true
      });

      try {
        const data = await (0,sentry_actionCreators_members__WEBPACK_IMPORTED_MODULE_8__.resendMemberInvite)(this.api, {
          orgId: organization.slug,
          memberId: params.memberId,
          regenerate
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_7__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Sent invite!'));

        if (regenerate) {
          this.setState(state => ({
            member: { ...state.member,
              ...data
            }
          }));
        }
      } catch (_err) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_7__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Could not send invite'));
      }

      this.setState({
        busy: false
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleAddTeam", team => {
      const {
        member
      } = this.state;

      if (!member.teams.includes(team.slug)) {
        member.teams.push(team.slug);
      }

      this.setState({
        member
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleRemoveTeam", removedTeam => {
      const {
        member
      } = this.state;
      this.setState({
        member: { ...member,
          teams: member.teams.filter(slug => slug !== removedTeam)
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handle2faReset", async () => {
      const {
        organization,
        router
      } = this.props;
      const {
        user
      } = this.state.member;
      const requests = user.authenticators.map(auth => (0,sentry_actionCreators_account__WEBPACK_IMPORTED_MODULE_6__.removeAuthenticator)(this.api, user.id, auth.id));

      try {
        await Promise.all(requests);
        router.push(`/settings/${organization.slug}/members/`);
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_7__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('All authenticators have been removed'));
      } catch (err) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_7__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Error removing authenticators'));
        _sentry_react__WEBPACK_IMPORTED_MODULE_31__.captureException(err);
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "showResetButton", () => {
      const {
        organization
      } = this.props;
      const {
        member
      } = this.state;
      const {
        user
      } = member;

      if (!user || !user.authenticators || organization.require2FA) {
        return false;
      }

      const hasAuth = user.authenticators.length >= 1;
      return hasAuth && user.canReset2fa;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getTooltip", () => {
      const {
        organization
      } = this.props;
      const {
        member
      } = this.state;
      const {
        user
      } = member;

      if (!user) {
        return '';
      }

      if (!user.authenticators) {
        return NO_PERMISSION;
      }

      if (!user.authenticators.length) {
        return NOT_ENROLLED;
      }

      if (!user.canReset2fa) {
        return MULTIPLE_ORGS;
      }

      if (organization.require2FA) {
        return TWO_FACTOR_REQUIRED;
      }

      return '';
    });
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      roleList: [],
      selectedRole: '',
      member: null
    };
  }

  getEndpoints() {
    const {
      organization,
      params
    } = this.props;
    return [['member', `/organizations/${organization.slug}/members/${params.memberId}/`]];
  }

  redirectToMemberPage() {
    const {
      location,
      params,
      routes
    } = this.props;
    const members = (0,sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_23__["default"])('members/', {
      location,
      routes,
      params,
      stepBack: -2
    });
    react_router__WEBPACK_IMPORTED_MODULE_5__.browserHistory.push(members);
  }

  get memberDeactivated() {
    return (0,sentry_utils_isMemberDisabledFromLimit__WEBPACK_IMPORTED_MODULE_22__["default"])(this.state.member);
  }

  renderMemberStatus(member) {
    if (this.memberDeactivated) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)("em", {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(DisabledMemberTooltip, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Deactivated')
        })
      });
    }

    if (member.expired) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)("em", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Invitation Expired')
      });
    }

    if (member.pending) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)("em", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Invitation Pending')
      });
    }

    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Active');
  }

  renderBody() {
    const {
      organization
    } = this.props;
    const {
      member
    } = this.state;

    if (!member) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_components_errors_notFound__WEBPACK_IMPORTED_MODULE_13__["default"], {});
    }

    const {
      access,
      features
    } = organization;
    const inviteLink = member.invite_link;
    const canEdit = access.includes('org:write') && !this.memberDeactivated;
    const hasTeamRoles = features.includes('team-roles');
    const {
      email,
      expired,
      pending
    } = member;
    const canResend = !expired;
    const showAuth = !pending;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_27__["default"], {
        title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)("div", {
            children: member.name
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(ExtraHeaderText, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Member Settings')
          })]
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_17__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_17__.PanelHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Basics')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_17__.PanelBody, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_17__.PanelItem, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsxs)(OverflowWrapper, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsxs)(Details, {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsxs)("div", {
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(DetailLabel, {
                    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Email')
                  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)("div", {
                    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_16__["default"], {
                      href: `mailto:${email}`,
                      children: email
                    })
                  })]
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsxs)("div", {
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(DetailLabel, {
                    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Status')
                  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)("div", {
                    "data-test-id": "member-status",
                    children: this.renderMemberStatus(member)
                  })]
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsxs)("div", {
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(DetailLabel, {
                    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Added')
                  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)("div", {
                    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_12__["default"], {
                      dateOnly: true,
                      date: member.dateCreated
                    })
                  })]
                })]
              }), inviteLink && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsxs)(InviteSection, {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsxs)("div", {
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(DetailLabel, {
                    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Invite Link')
                  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_components_autoSelectText__WEBPACK_IMPORTED_MODULE_9__["default"], {
                    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(CodeInput, {
                      children: inviteLink
                    })
                  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)("p", {
                    className: "help-block",
                    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('This unique invite link may only be used by this member.')
                  })]
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsxs)(InviteActions, {
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_10__["default"], {
                    onClick: () => this.handleInvite(true),
                    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Generate New Invite')
                  }), canResend && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_10__["default"], {
                    "data-test-id": "resend-invite",
                    onClick: () => this.handleInvite(false),
                    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Resend Invite')
                  })]
                })]
              })]
            })
          })
        })]
      }), showAuth && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_17__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_17__.PanelHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Authentication')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_17__.PanelBody, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_14__["default"], {
            alignRight: true,
            flexibleControlStateSize: true,
            label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Reset two-factor authentication'),
            help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Resetting two-factor authentication will remove all two-factor authentication methods for this member.'),
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_18__["default"], {
              "data-test-id": "reset-2fa-tooltip",
              disabled: this.showResetButton(),
              title: this.getTooltip(),
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_11__["default"], {
                disabled: !this.showResetButton(),
                message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.tct)('Are you sure you want to disable all two-factor authentication methods for [name]?', {
                  name: member.name ? member.name : 'this member'
                }),
                onConfirm: this.handle2faReset,
                "data-test-id": "reset-2fa-confirm",
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_10__["default"], {
                  "data-test-id": "reset-2fa",
                  priority: "danger",
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Reset two-factor authentication')
                })
              })
            })
          })
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(_inviteMember_orgRoleSelect__WEBPACK_IMPORTED_MODULE_29__["default"], {
        enforceAllowed: false,
        enforceRetired: hasTeamRoles,
        disabled: !canEdit,
        roleList: member.roles,
        roleSelected: member.role,
        setSelected: slug => this.setState({
          member: { ...member,
            role: slug
          }
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_utils_teams__WEBPACK_IMPORTED_MODULE_24__["default"], {
        slugs: member.teams,
        children: _ref2 => {
          let {
            teams,
            initiallyLoaded
          } = _ref2;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_views_settings_components_teamSelect__WEBPACK_IMPORTED_MODULE_28__["default"], {
            organization: organization,
            selectedTeams: teams,
            disabled: !canEdit,
            onAddTeam: this.handleAddTeam,
            onRemoveTeam: this.handleRemoveTeam,
            loadingTeams: !initiallyLoaded
          });
        }
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(Footer, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_10__["default"], {
          priority: "primary",
          busy: this.state.busy,
          onClick: this.handleSave,
          disabled: !canEdit,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Save Member')
        })
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_25__["default"])(OrganizationMemberDetail));

const ExtraHeaderText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "euxp5937"
} : 0)("color:", p => p.theme.gray300, ";font-weight:normal;font-size:", p => p.theme.fontSizeLarge, ";" + ( true ? "" : 0));

const Details = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "euxp5936"
} : 0)("display:grid;grid-auto-flow:column;grid-template-columns:2fr 1fr 1fr;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(2), ";width:100%;@media (max-width: ", p => p.theme.breakpoints.small, "){grid-auto-flow:row;grid-template-columns:auto;}" + ( true ? "" : 0));

const DetailLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "euxp5935"
} : 0)("font-weight:bold;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(0.5), ";color:", p => p.theme.textColor, ";" + ( true ? "" : 0));

const OverflowWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "euxp5934"
} : 0)( true ? {
  name: "8za49e",
  styles: "overflow:hidden;flex:1"
} : 0);

const InviteSection = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "euxp5933"
} : 0)("border-top:1px solid ", p => p.theme.border, ";margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(2), ";padding-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(2), ";" + ( true ? "" : 0));

const CodeInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('code',  true ? {
  target: "euxp5932"
} : 0)(p => (0,sentry_styles_input__WEBPACK_IMPORTED_MODULE_20__.inputStyles)(p), ";" + ( true ? "" : 0));

const InviteActions = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "euxp5931"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(1), ";grid-auto-flow:column;justify-content:flex-end;margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(2), ";" + ( true ? "" : 0));

const Footer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "euxp5930"
} : 0)( true ? {
  name: "skgbeu",
  styles: "display:flex;justify-content:flex-end"
} : 0);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_organizationMembers_organizationMemberDetail_tsx.7fadb76ca6bff933f403f1e687dde139.js.map