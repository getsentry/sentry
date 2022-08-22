"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_organizationMembers_organizationMembersWrapper_tsx"],{

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

/***/ "./app/views/settings/organizationMembers/organizationMembersWrapper.tsx":
/*!*******************************************************************************!*\
  !*** ./app/views/settings/organizationMembers/organizationMembersWrapper.tsx ***!
  \*******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/acl/featureDisabled */ "./app/components/acl/featureDisabled.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_hookOrDefault__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/hookOrDefault */ "./app/components/hookOrDefault.tsx");
/* harmony import */ var sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/hovercard */ "./app/components/hovercard.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/routeTitle */ "./app/utils/routeTitle.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");

















const InviteMembersButtonHook = (0,sentry_components_hookOrDefault__WEBPACK_IMPORTED_MODULE_7__["default"])({
  hookName: 'member-invite-button:customization',
  defaultComponent: _ref => {
    let {
      children,
      organization,
      onTriggerModal
    } = _ref;
    return children({
      disabled: !organization.features.includes('invite-members'),
      onTriggerModal
    });
  }
});

class OrganizationMembersWrapper extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_13__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "removeAccessRequest", id => this.setState(state => ({
      requestList: state.requestList.filter(request => request.id !== id)
    })));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "removeInviteRequest", id => this.setState(state => ({
      inviteRequests: state.inviteRequests.filter(request => request.id !== id)
    })));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "updateInviteRequest", (id, data) => this.setState(state => {
      const inviteRequests = [...state.inviteRequests];
      const inviteIndex = inviteRequests.findIndex(request => request.id === id);
      inviteRequests[inviteIndex] = { ...inviteRequests[inviteIndex],
        ...data
      };
      return {
        inviteRequests
      };
    }));
  }

  getEndpoints() {
    const {
      orgId
    } = this.props.params;
    return [['inviteRequests', `/organizations/${orgId}/invite-requests/`], ['requestList', `/organizations/${orgId}/access-requests/`]];
  }

  getTitle() {
    const {
      orgId
    } = this.props.params;
    return (0,sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_11__["default"])((0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Members'), orgId, false);
  }

  get onRequestsTab() {
    return location.pathname.includes('/requests/');
  }

  get hasWriteAccess() {
    const {
      organization
    } = this.props;

    if (!organization || !organization.access) {
      return false;
    }

    return organization.access.includes('member:write');
  }

  get showInviteRequests() {
    return this.hasWriteAccess;
  }

  get showNavTabs() {
    const {
      requestList
    } = this.state; // show the requests tab if there are pending team requests,
    // or if the user has access to approve or deny invite requests

    return requestList && requestList.length > 0 || this.showInviteRequests;
  }

  get requestCount() {
    const {
      requestList,
      inviteRequests
    } = this.state;
    let count = requestList.length; // if the user can't see the invite requests panel,
    // exclude those requests from the total count

    if (this.showInviteRequests) {
      count += inviteRequests.length;
    }

    return count ? count.toString() : null;
  }

  renderBody() {
    const {
      children,
      organization
    } = this.props;
    const {
      requestList,
      inviteRequests
    } = this.state;

    const action = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(InviteMembersButtonHook, {
      organization: organization,
      onTriggerModal: () => (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_4__.openInviteMembersModal)({
        onClose: () => {
          this.fetchData();
        },
        source: 'members_settings'
      }),
      children: renderInviteMembersButton
    });

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_14__["default"], {
        title: "Members",
        action: action
      }), children && /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_3__.cloneElement)(children, {
        requestList,
        inviteRequests,
        onRemoveInviteRequest: this.removeInviteRequest,
        onUpdateInviteRequest: this.updateInviteRequest,
        onRemoveAccessRequest: this.removeAccessRequest,
        showInviteRequests: this.showInviteRequests
      })]
    });
  }

}

function renderInviteMembersButton(_ref2) {
  let {
    disabled,
    onTriggerModal
  } = _ref2;

  const action = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
    priority: "primary",
    size: "sm",
    onClick: onTriggerModal,
    "data-test-id": "email-invite",
    icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconMail, {}),
    disabled: disabled,
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Invite Members')
  });

  return disabled ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_8__.Hovercard, {
    body: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_5__["default"], {
      featureName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Invite Members'),
      features: ['organizations:invite-members'],
      hideHelpToggle: true
    }),
    children: action
  }) : action;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_12__["default"])(OrganizationMembersWrapper));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_organizationMembers_organizationMembersWrapper_tsx.54e3bb8adac2836cb64f86b79c4c0366.js.map