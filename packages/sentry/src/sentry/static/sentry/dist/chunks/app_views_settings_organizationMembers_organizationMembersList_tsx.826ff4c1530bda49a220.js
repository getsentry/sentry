"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_organizationMembers_organizationMembersList_tsx"],{

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

/***/ "./app/views/settings/components/defaultSearchBar.tsx":
/*!************************************************************!*\
  !*** ./app/views/settings/components/defaultSearchBar.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SearchWrapper": () => (/* binding */ SearchWrapper)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");


const SearchWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1pq3sjx0"
} : 0)("display:flex;grid-template-columns:1fr max-content;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1.5), ";margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(4), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1.5), ";position:relative;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/organizationMembers/components/membersFilter.tsx":
/*!*****************************************************************************!*\
  !*** ./app/views/settings/organizationMembers/components/membersFilter.tsx ***!
  \*****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_components_checkbox__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/checkbox */ "./app/components/checkbox.tsx");
/* harmony import */ var sentry_components_switchButton__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/switchButton */ "./app/components/switchButton.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











const getBoolean = list => Array.isArray(list) && list.length ? list && list.map(v => v.toLowerCase()).includes('true') : null;

const MembersFilter = _ref => {
  let {
    className,
    roles,
    query,
    onChange
  } = _ref;
  const search = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_7__.MutableSearch(query);
  const filters = {
    roles: search.getFilterValues('role') || [],
    isInvited: getBoolean(search.getFilterValues('isInvited')),
    ssoLinked: getBoolean(search.getFilterValues('ssoLinked')),
    has2fa: getBoolean(search.getFilterValues('has2fa'))
  };

  const handleRoleFilter = id => () => {
    const roleList = new Set(search.getFilterValues('role') ? [...search.getFilterValues('role')] : []);

    if (roleList.has(id)) {
      roleList.delete(id);
    } else {
      roleList.add(id);
    }

    const newSearch = search.copy();
    newSearch.setFilterValues('role', [...roleList]);
    onChange(newSearch.formatString());
  };

  const handleBoolFilter = key => value => {
    const newQueryObject = search.copy();
    newQueryObject.removeFilter(key);

    if (value !== null) {
      newQueryObject.setFilterValues(key, [Boolean(value).toString()]);
    }

    onChange(newQueryObject.formatString());
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(FilterContainer, {
    className: className,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(FilterHeader, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Filter By')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(FilterLists, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(FilterList, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("h3", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('User Role')
        }), roles.map(_ref2 => {
          let {
            id,
            name
          } = _ref2;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)("label", {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_checkbox__WEBPACK_IMPORTED_MODULE_3__["default"], {
              "data-test-id": `filter-role-${id}`,
              checked: filters.roles.includes(id),
              onChange: handleRoleFilter(id)
            }), name]
          }, id);
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(FilterList, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("h3", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Status')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(BooleanFilter, {
          "data-test-id": "filter-isInvited",
          onChange: handleBoolFilter('isInvited'),
          value: filters.isInvited,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Invited')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(BooleanFilter, {
          "data-test-id": "filter-has2fa",
          onChange: handleBoolFilter('has2fa'),
          value: filters.has2fa,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('2FA')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(BooleanFilter, {
          "data-test-id": "filter-ssoLinked",
          onChange: handleBoolFilter('ssoLinked'),
          value: filters.ssoLinked,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('SSO Linked')
        })]
      })]
    })]
  });
};

MembersFilter.displayName = "MembersFilter";

const BooleanFilter = _ref3 => {
  let {
    onChange,
    value,
    children
  } = _ref3;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)("label", {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_checkbox__WEBPACK_IMPORTED_MODULE_3__["default"], {
      checked: value !== null,
      onChange: () => onChange(value === null ? true : null)
    }), children, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_switchButton__WEBPACK_IMPORTED_MODULE_4__["default"], {
      isDisabled: value === null,
      isActive: value === true,
      toggle: () => onChange(!value)
    })]
  });
};

BooleanFilter.displayName = "BooleanFilter";

const FilterContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e2fzkim3"
} : 0)("border-radius:4px;background:", p => p.theme.background, ";box-shadow:", p => p.theme.dropShadowLight, ";border:1px solid ", p => p.theme.border, ";" + ( true ? "" : 0));

const FilterHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('h2',  true ? {
  target: "e2fzkim2"
} : 0)("border-top-left-radius:4px;border-top-right-radius:4px;border-bottom:1px solid ", p => p.theme.border, ";background:", p => p.theme.backgroundSecondary, ";color:", p => p.theme.subText, ";text-transform:uppercase;font-size:", p => p.theme.fontSizeExtraSmall, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1), ";margin:0;" + ( true ? "" : 0));

const FilterLists = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e2fzkim1"
} : 0)("display:grid;grid-template-columns:100px max-content;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(3), ";margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1.5), ";margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(0.75), ";" + ( true ? "" : 0));

const FilterList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e2fzkim0"
} : 0)("display:grid;grid-template-rows:repeat(auto-fit, minmax(0, max-content));gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1), ";font-size:", p => p.theme.fontSizeMedium, ";h3{color:#000;font-size:", p => p.theme.fontSizeSmall, ";text-transform:uppercase;margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1), " 0;}label{display:grid;grid-template-columns:max-content 1fr max-content;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(0.75), ";align-items:center;font-weight:normal;white-space:nowrap;height:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(2), ";}input,label{margin:0;}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MembersFilter);

/***/ }),

/***/ "./app/views/settings/organizationMembers/inviteRequestRow.tsx":
/*!*********************************************************************!*\
  !*** ./app/views/settings/organizationMembers/inviteRequestRow.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_forms_teamSelector__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/teamSelector */ "./app/components/forms/teamSelector.tsx");
/* harmony import */ var sentry_components_hookOrDefault__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/hookOrDefault */ "./app/components/hookOrDefault.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_roleSelectControl__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/roleSelectControl */ "./app/components/roleSelectControl.tsx");
/* harmony import */ var sentry_components_tag__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/tag */ "./app/components/tag.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }















const InviteModalHook = (0,sentry_components_hookOrDefault__WEBPACK_IMPORTED_MODULE_6__["default"])({
  hookName: 'member-invite-modal:customization',
  defaultComponent: _ref => {
    let {
      onSendInvites,
      children
    } = _ref;
    return children({
      sendInvites: onSendInvites,
      canSend: true
    });
  }
});

const InviteRequestRow = _ref2 => {
  let {
    inviteRequest,
    inviteRequestBusy,
    organization,
    onApprove,
    onDeny,
    onUpdate,
    allRoles
  } = _ref2;
  const role = allRoles.find(r => r.id === inviteRequest.role);
  const roleDisallowed = !(role && role.allowed);
  const {
    access
  } = organization;
  const canApprove = access.includes('member:admin'); // eslint-disable-next-line react/prop-types

  const hookRenderer = _ref3 => {
    let {
      sendInvites,
      canSend,
      headerInfo
    } = _ref3;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(StyledPanelItem, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)("div", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("h5", {
          style: {
            marginBottom: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(0.5)
          },
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(UserName, {
            children: inviteRequest.email
          })
        }), inviteRequest.inviteStatus === 'requested_to_be_invited' ? inviteRequest.inviterName && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(Description, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_10__["default"], {
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('An existing member has asked to invite this user to your organization'),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('Requested by [inviterName]', {
              inviterName: inviteRequest.inviterName
            })
          })
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(JoinRequestIndicator, {
          tooltipText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('This user has asked to join your organization.'),
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Join request')
        })]
      }), canApprove ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StyledRoleSelectControl, {
        name: "role",
        disableUnallowed: true,
        onChange: r => onUpdate({
          role: r.value
        }),
        value: inviteRequest.role,
        roles: allRoles
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("div", {
        children: inviteRequest.roleName
      }), canApprove ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(TeamSelectControl, {
        name: "teams",
        placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Add to teams\u2026'),
        onChange: teams => onUpdate({
          teams: (teams || []).map(team => team.value)
        }),
        value: inviteRequest.teams,
        clearable: true,
        multiple: true
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("div", {
        children: inviteRequest.teams.join(', ')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(ButtonGroup, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
          size: "sm",
          busy: inviteRequestBusy[inviteRequest.id],
          onClick: () => onDeny(inviteRequest),
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconClose, {}),
          disabled: !canApprove,
          title: canApprove ? undefined : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('This request needs to be reviewed by a privileged user'),
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Deny')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_4__["default"], {
          onConfirm: sendInvites,
          disableConfirmButton: !canSend,
          disabled: !canApprove || roleDisallowed,
          message: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
            children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('Are you sure you want to invite [email] to your organization?', {
              email: inviteRequest.email
            }), headerInfo]
          }),
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
            priority: "primary",
            size: "sm",
            busy: inviteRequestBusy[inviteRequest.id],
            title: canApprove ? roleDisallowed ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)(`You do not have permission to approve a user of this role.
                      Select a different role to approve this user.`) : undefined : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('This request needs to be reviewed by a privileged user'),
            icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconCheckmark, {}),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Approve')
          })
        })]
      })]
    });
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(InviteModalHook, {
    willInvite: true,
    organization: organization,
    onSendInvites: () => onApprove(inviteRequest),
    children: hookRenderer
  });
};

InviteRequestRow.displayName = "InviteRequestRow";

const JoinRequestIndicator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_tag__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "e1ohn77a6"
} : 0)( true ? {
  name: "50zrmy",
  styles: "text-transform:uppercase"
} : 0);

const StyledPanelItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__.PanelItem,  true ? {
  target: "e1ohn77a5"
} : 0)("display:grid;grid-template-columns:minmax(150px, auto) minmax(100px, 140px) 220px max-content;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(2), ";align-items:center;" + ( true ? "" : 0));

const UserName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1ohn77a4"
} : 0)("font-size:", p => p.theme.fontSizeLarge, ";overflow:hidden;text-overflow:ellipsis;" + ( true ? "" : 0));

const Description = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1ohn77a3"
} : 0)("display:block;color:", p => p.theme.subText, ";font-size:14px;overflow:hidden;text-overflow:ellipsis;" + ( true ? "" : 0));

const StyledRoleSelectControl = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_roleSelectControl__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "e1ohn77a2"
} : 0)( true ? {
  name: "pqgixs",
  styles: "max-width:140px"
} : 0);

const TeamSelectControl = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_forms_teamSelector__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e1ohn77a1"
} : 0)( true ? {
  name: "1qnipy5",
  styles: "max-width:220px;.Select-value-label{max-width:150px;word-break:break-all;}"
} : 0);

const ButtonGroup = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1ohn77a0"
} : 0)("display:inline-grid;grid-template-columns:repeat(2, max-content);gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (InviteRequestRow);

/***/ }),

/***/ "./app/views/settings/organizationMembers/organizationMemberRow.tsx":
/*!**************************************************************************!*\
  !*** ./app/views/settings/organizationMembers/organizationMemberRow.tsx ***!
  \**************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ OrganizationMemberRow)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/avatar/userAvatar */ "./app/components/avatar/userAvatar.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_hookOrDefault__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/hookOrDefault */ "./app/components/hookOrDefault.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_isMemberDisabledFromLimit__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/isMemberDisabledFromLimit */ "./app/utils/isMemberDisabledFromLimit.tsx");
/* harmony import */ var sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/recreateRoute */ "./app/utils/recreateRoute.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }
















const DisabledMemberTooltip = (0,sentry_components_hookOrDefault__WEBPACK_IMPORTED_MODULE_7__["default"])({
  hookName: 'component:disabled-member-tooltip',
  defaultComponent: _ref => {
    let {
      children
    } = _ref;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: children
    });
  }
});
class OrganizationMemberRow extends react__WEBPACK_IMPORTED_MODULE_3__.PureComponent {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      busy: false
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleRemove", () => {
      const {
        onRemove
      } = this.props;

      if (typeof onRemove !== 'function') {
        return;
      }

      this.setState({
        busy: true
      });
      onRemove(this.props.member);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleLeave", () => {
      const {
        onLeave
      } = this.props;

      if (typeof onLeave !== 'function') {
        return;
      }

      this.setState({
        busy: true
      });
      onLeave(this.props.member);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSendInvite", () => {
      const {
        onSendInvite,
        member
      } = this.props;

      if (typeof onSendInvite !== 'function') {
        return;
      }

      onSendInvite(member);
    });
  }

  renderMemberRole() {
    const {
      member
    } = this.props;
    const {
      roleName,
      pending,
      expired
    } = member;

    if ((0,sentry_utils_isMemberDisabledFromLimit__WEBPACK_IMPORTED_MODULE_14__["default"])(member)) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(DisabledMemberTooltip, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Deactivated')
      });
    }

    if (pending) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(InvitedRole, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconMail, {
          size: "md"
        }), expired ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Expired Invite') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('Invited [roleName]', {
          roleName
        })]
      });
    }

    return roleName;
  }

  render() {
    const {
      params,
      routes,
      member,
      orgName,
      status,
      requireLink,
      memberCanLeave,
      currentUser,
      canRemoveMembers,
      canAddMembers
    } = this.props;
    const {
      id,
      flags,
      email,
      name,
      pending,
      user
    } = member; // if member is not the only owner, they can leave

    const needsSso = !flags['sso:linked'] && requireLink;
    const isCurrentUser = currentUser.email === email;
    const showRemoveButton = !isCurrentUser;
    const showLeaveButton = isCurrentUser;
    const canRemoveMember = canRemoveMembers && !isCurrentUser; // member has a `user` property if they are registered with sentry
    // i.e. has accepted an invite to join org

    const has2fa = user && user.has2fa;
    const detailsUrl = (0,sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_15__["default"])(id, {
      routes,
      params
    });
    const isInviteSuccessful = status === 'success';
    const isInviting = status === 'loading';
    const showResendButton = pending || needsSso;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(StyledPanelItem, {
      "data-test-id": email,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(MemberHeading, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_4__["default"], {
          size: 32,
          user: user !== null && user !== void 0 ? user : {
            id: email,
            email
          }
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(MemberDescription, {
          to: detailsUrl,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("h5", {
            style: {
              margin: '0 0 3px'
            },
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(UserName, {
              children: name
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Email, {
            children: email
          })]
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("div", {
        "data-test-id": "member-role",
        children: this.renderMemberRole()
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("div", {
        "data-test-id": "member-status",
        children: showResendButton ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
          children: [isInviting && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(LoadingContainer, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_9__["default"], {
              mini: true
            })
          }), isInviteSuccessful && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("span", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Sent!')
          }), !isInviting && !isInviteSuccessful && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
            disabled: !canAddMembers,
            priority: "primary",
            size: "sm",
            onClick: this.handleSendInvite,
            children: pending ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Resend invite') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Resend SSO link')
          })]
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(AuthStatus, {
          children: [has2fa ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconCheckmark, {
            isCircled: true,
            color: "success"
          }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconFlag, {
            color: "error"
          }), has2fa ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('2FA Enabled') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('2FA Not Enabled')]
        })
      }), showRemoveButton || showLeaveButton ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(RightColumn, {
        children: [showRemoveButton && canRemoveMember && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_6__["default"], {
          message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('Are you sure you want to remove [name] from [orgName]?', {
            name,
            orgName
          }),
          onConfirm: this.handleRemove,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
            "data-test-id": "remove",
            icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconSubtract, {
              isCircled: true,
              size: "xs"
            }),
            size: "sm",
            busy: this.state.busy,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Remove')
          })
        }), showRemoveButton && !canRemoveMember && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
          disabled: true,
          size: "sm",
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('You do not have access to remove members'),
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconSubtract, {
            isCircled: true,
            size: "xs"
          }),
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Remove')
        }), showLeaveButton && memberCanLeave && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_6__["default"], {
          message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('Are you sure you want to leave [orgName]?', {
            orgName
          }),
          onConfirm: this.handleLeave,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
            priority: "danger",
            size: "sm",
            icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconClose, {
              size: "xs"
            }),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Leave')
          })
        }), showLeaveButton && !memberCanLeave && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
          size: "sm",
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconClose, {
            size: "xs"
          }),
          disabled: true,
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('You cannot leave this organization as you are the only organization owner.'),
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Leave')
        })]
      }) : null]
    });
  }

}
OrganizationMemberRow.displayName = "OrganizationMemberRow";

const StyledPanelItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.PanelItem,  true ? {
  target: "eq39mcy9"
} : 0)("display:grid;grid-template-columns:minmax(150px, 4fr) minmax(90px, 2fr) minmax(120px, 2fr) minmax(\n      100px,\n      1fr\n    );gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(2), ";align-items:center;" + ( true ? "" : 0)); // Force action button at the end to align to right


const RightColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eq39mcy8"
} : 0)( true ? {
  name: "skgbeu",
  styles: "display:flex;justify-content:flex-end"
} : 0);

const Section = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eq39mcy7"
} : 0)("display:inline-grid;grid-template-columns:max-content auto;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1), ";align-items:center;" + ( true ? "" : 0));

const MemberHeading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(Section,  true ? {
  target: "eq39mcy6"
} : 0)( true ? "" : 0);

const MemberDescription = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "eq39mcy5"
} : 0)( true ? {
  name: "d3v9zr",
  styles: "overflow:hidden"
} : 0);

const UserName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eq39mcy4"
} : 0)("display:block;overflow:hidden;font-size:", p => p.theme.fontSizeMedium, ";text-overflow:ellipsis;" + ( true ? "" : 0));

const Email = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eq39mcy3"
} : 0)("color:", p => p.theme.subText, ";font-size:", p => p.theme.fontSizeSmall, ";overflow:hidden;text-overflow:ellipsis;" + ( true ? "" : 0));

const InvitedRole = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(Section,  true ? {
  target: "eq39mcy2"
} : 0)( true ? "" : 0);

const LoadingContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eq39mcy1"
} : 0)("margin-top:0;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1.5), ";" + ( true ? "" : 0));

const AuthStatus = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(Section,  true ? {
  target: "eq39mcy0"
} : 0)( true ? "" : 0);

/***/ }),

/***/ "./app/views/settings/organizationMembers/organizationMembersList.tsx":
/*!****************************************************************************!*\
  !*** ./app/views/settings/organizationMembers/organizationMembersList.tsx ***!
  \****************************************************************************/
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
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_members__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/members */ "./app/actionCreators/members.tsx");
/* harmony import */ var sentry_actionCreators_organizations__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/actionCreators/organizations */ "./app/actionCreators/organizations.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_deprecatedDropdownMenu__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/deprecatedDropdownMenu */ "./app/components/deprecatedDropdownMenu.tsx");
/* harmony import */ var sentry_components_hookOrDefault__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/hookOrDefault */ "./app/components/hookOrDefault.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/routeTitle */ "./app/utils/routeTitle.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_defaultSearchBar__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/views/settings/components/defaultSearchBar */ "./app/views/settings/components/defaultSearchBar.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var _components_membersFilter__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! ./components/membersFilter */ "./app/views/settings/organizationMembers/components/membersFilter.tsx");
/* harmony import */ var _inviteRequestRow__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! ./inviteRequestRow */ "./app/views/settings/organizationMembers/inviteRequestRow.tsx");
/* harmony import */ var _organizationMemberRow__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! ./organizationMemberRow */ "./app/views/settings/organizationMembers/organizationMemberRow.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }




























const MemberListHeader = (0,sentry_components_hookOrDefault__WEBPACK_IMPORTED_MODULE_10__["default"])({
  hookName: 'component:member-list-header',
  defaultComponent: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelHeader, {
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Active Members')
  })
});

class OrganizationMembersList extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_22__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "removeMember", async id => {
      const {
        orgId
      } = this.props.params;
      await this.api.requestPromise(`/organizations/${orgId}/members/${id}/`, {
        method: 'DELETE',
        data: {}
      });
      this.setState(state => ({
        members: state.members.filter(_ref => {
          let {
            id: existingId
          } = _ref;
          return existingId !== id;
        })
      }));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleRemove", async _ref2 => {
      let {
        id,
        name
      } = _ref2;
      const {
        organization
      } = this.props;
      const {
        slug: orgName
      } = organization;

      try {
        await this.removeMember(id);
      } catch {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('Error removing [name] from [orgName]', {
          name,
          orgName
        }));
        return;
      }

      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('Removed [name] from [orgName]', {
        name,
        orgName
      }));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleLeave", async _ref3 => {
      let {
        id
      } = _ref3;
      const {
        organization
      } = this.props;
      const {
        slug: orgName
      } = organization;

      try {
        await this.removeMember(id);
      } catch {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('Error leaving [orgName]', {
          orgName
        }));
        return;
      }

      (0,sentry_actionCreators_organizations__WEBPACK_IMPORTED_MODULE_7__.redirectToRemainingOrganization)({
        orgId: orgName,
        removeOrg: true
      });
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('You left [orgName]', {
        orgName
      }));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSendInvite", async _ref4 => {
      let {
        id,
        expired
      } = _ref4;
      this.setState(state => ({
        invited: { ...state.invited,
          [id]: 'loading'
        }
      }));

      try {
        await (0,sentry_actionCreators_members__WEBPACK_IMPORTED_MODULE_6__.resendMemberInvite)(this.api, {
          orgId: this.props.params.orgId,
          memberId: id,
          regenerate: expired
        });
      } catch {
        this.setState(state => ({
          invited: { ...state.invited,
            [id]: null
          }
        }));
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Error sending invite'));
        return;
      }

      this.setState(state => ({
        invited: { ...state.invited,
          [id]: 'success'
        }
      }));
    });

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

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "removeInviteRequest", id => this.setState(state => ({
      inviteRequests: state.inviteRequests.filter(request => request.id !== id)
    })));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleInviteRequestAction", async _ref5 => {
      let {
        inviteRequest,
        method,
        data,
        successMessage,
        errorMessage,
        eventKey
      } = _ref5;
      const {
        params,
        organization
      } = this.props;
      this.setState(state => ({
        inviteRequestBusy: { ...state.inviteRequestBusy,
          [inviteRequest.id]: true
        }
      }));

      try {
        await this.api.requestPromise(`/organizations/${params.orgId}/invite-requests/${inviteRequest.id}/`, {
          method,
          data
        });
        this.removeInviteRequest(inviteRequest.id);
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addSuccessMessage)(successMessage);
        (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_18__["default"])(eventKey, {
          member_id: parseInt(inviteRequest.id, 10),
          invite_status: inviteRequest.inviteStatus,
          organization
        });
      } catch {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)(errorMessage);
      }

      this.setState(state => ({
        inviteRequestBusy: { ...state.inviteRequestBusy,
          [inviteRequest.id]: false
        }
      }));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleInviteRequestApprove", inviteRequest => {
      this.handleInviteRequestAction({
        inviteRequest,
        method: 'PUT',
        data: {
          role: inviteRequest.role,
          teams: inviteRequest.teams,
          approve: 1
        },
        successMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[email] has been invited', {
          email: inviteRequest.email
        }),
        errorMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('Error inviting [email]', {
          email: inviteRequest.email
        }),
        eventKey: 'invite_request.approved'
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleInviteRequestDeny", inviteRequest => {
      this.handleInviteRequestAction({
        inviteRequest,
        method: 'DELETE',
        data: {},
        successMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('Invite request for [email] denied', {
          email: inviteRequest.email
        }),
        errorMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('Error denying invite request for [email]', {
          email: inviteRequest.email
        }),
        eventKey: 'invite_request.denied'
      });
    });
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      members: [],
      invited: {}
    };
  }

  onLoadAllEndpointsSuccess() {
    const {
      organization
    } = this.props;
    const {
      inviteRequests,
      members
    } = this.state;
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_18__["default"])('member_settings_page.loaded', {
      organization,
      num_members: members === null || members === void 0 ? void 0 : members.length,
      num_invite_requests: inviteRequests === null || inviteRequests === void 0 ? void 0 : inviteRequests.length
    });
  }

  getEndpoints() {
    const {
      orgId
    } = this.props.params;
    return [['members', `/organizations/${orgId}/members/`, {}, {
      paginate: true
    }], ['member', `/organizations/${orgId}/members/me/`, {}, {
      allowError: error => error.status === 404
    }], ['authProvider', `/organizations/${orgId}/auth-provider/`, {}, {
      allowError: error => error.status === 403
    }], ['inviteRequests', `/organizations/${orgId}/invite-requests/`]];
  }

  getTitle() {
    const orgId = this.props.organization.slug;
    return (0,sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_19__["default"])((0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Members'), orgId, false);
  }

  renderBody() {
    const {
      params,
      organization,
      routes
    } = this.props;
    const {
      membersPageLinks,
      members,
      member: currentMember,
      inviteRequests
    } = this.state;
    const {
      name: orgName,
      access
    } = organization;
    const canAddMembers = access.includes('member:write');
    const canRemove = access.includes('member:admin');
    const currentUser = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_16__["default"].get('user'); // Find out if current user is the only owner

    const isOnlyOwner = !members.find(_ref6 => {
      let {
        role,
        email,
        pending
      } = _ref6;
      return role === 'owner' && email !== currentUser.email && !pending;
    }); // Only admins/owners can remove members

    const requireLink = !!this.state.authProvider && this.state.authProvider.require_link; // eslint-disable-next-line react/prop-types

    const renderSearch = _ref7 => {
      let {
        defaultSearchBar,
        value,
        handleChange
      } = _ref7;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)(SearchWrapperWithFilter, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_deprecatedDropdownMenu__WEBPACK_IMPORTED_MODULE_9__["default"], {
          closeOnEscape: true,
          children: _ref8 => {
            var _currentMember$roles;

            let {
              getActorProps,
              isOpen
            } = _ref8;
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)(FilterWrapper, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"], {
                icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconSliders, {
                  size: "xs"
                }),
                ...getActorProps({}),
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Filter')
              }), isOpen && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(StyledMembersFilter, {
                roles: (_currentMember$roles = currentMember === null || currentMember === void 0 ? void 0 : currentMember.roles) !== null && _currentMember$roles !== void 0 ? _currentMember$roles : sentry_constants__WEBPACK_IMPORTED_MODULE_13__.ORG_ROLES,
                query: value,
                onChange: query => handleChange(query)
              })]
            });
          }
        }), defaultSearchBar]
      });
    };

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_emotion_react__WEBPACK_IMPORTED_MODULE_29__.ClassNames, {
        children: _ref9 => {
          let {
            css
          } = _ref9;
          return this.renderSearchInput({
            updateRoute: true,
            placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Search Members'),
            children: renderSearch,
            className: css`
                font-size: ${sentry_utils_theme__WEBPACK_IMPORTED_MODULE_20__["default"].fontSizeMedium};
              `
          });
        }
      }), inviteRequests && inviteRequests.length > 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelHeader, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)(StyledPanelItem, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)("div", {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Pending Members')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)("div", {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Role')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)("div", {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Teams')
            })]
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelBody, {
          children: inviteRequests.map(inviteRequest => {
            var _currentMember$roles2;

            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_inviteRequestRow__WEBPACK_IMPORTED_MODULE_26__["default"], {
              organization: organization,
              inviteRequest: inviteRequest,
              inviteRequestBusy: {},
              allRoles: (_currentMember$roles2 = currentMember === null || currentMember === void 0 ? void 0 : currentMember.roles) !== null && _currentMember$roles2 !== void 0 ? _currentMember$roles2 : sentry_constants__WEBPACK_IMPORTED_MODULE_13__.ORG_ROLES,
              onApprove: this.handleInviteRequestApprove,
              onDeny: this.handleInviteRequestDeny,
              onUpdate: data => this.updateInviteRequest(inviteRequest.id, data)
            }, inviteRequest.id);
          })
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.Panel, {
        "data-test-id": "org-member-list",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(MemberListHeader, {
          members: members,
          organization: organization
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelBody, {
          children: [members.map(member => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_organizationMemberRow__WEBPACK_IMPORTED_MODULE_27__["default"], {
            routes: routes,
            params: params,
            member: member,
            status: this.state.invited[member.id],
            orgName: orgName,
            memberCanLeave: !isOnlyOwner,
            currentUser: currentUser,
            canRemoveMembers: canRemove,
            canAddMembers: canAddMembers,
            requireLink: requireLink,
            onSendInvite: this.handleSendInvite,
            onRemove: this.handleRemove,
            onLeave: this.handleLeave
          }, member.id)), members.length === 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_24__["default"], {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('No members found.')
          })]
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_11__["default"], {
        pageLinks: membersPageLinks
      })]
    });
  }

}

const SearchWrapperWithFilter = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_views_settings_components_defaultSearchBar__WEBPACK_IMPORTED_MODULE_23__.SearchWrapper,  true ? {
  target: "e1vx0h113"
} : 0)( true ? {
  name: "15dvb6g",
  styles: "display:grid;grid-template-columns:max-content 1fr;margin-top:0"
} : 0);

const FilterWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1vx0h112"
} : 0)( true ? {
  name: "bjn8wh",
  styles: "position:relative"
} : 0);

const StyledMembersFilter = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(_components_membersFilter__WEBPACK_IMPORTED_MODULE_25__["default"],  true ? {
  target: "e1vx0h111"
} : 0)("position:absolute;right:0;top:42px;z-index:", p => p.theme.zIndex.dropdown, ";&:before,&:after{position:absolute;top:-16px;right:32px;content:'';height:16px;width:16px;border:8px solid transparent;border-bottom-color:", p => p.theme.backgroundSecondary, ";}&:before{margin-top:-1px;border-bottom-color:", p => p.theme.border, ";}" + ( true ? "" : 0));

const StyledPanelItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1vx0h110"
} : 0)("display:grid;grid-template-columns:minmax(150px, auto) minmax(100px, 140px) 420px;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(2), ";align-items:center;width:100%;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_21__["default"])(OrganizationMembersList));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_organizationMembers_organizationMembersList_tsx.196c9290fc9604383737d7015abefcb0.js.map