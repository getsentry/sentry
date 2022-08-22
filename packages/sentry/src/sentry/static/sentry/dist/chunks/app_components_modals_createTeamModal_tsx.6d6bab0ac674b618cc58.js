"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_modals_createTeamModal_tsx"],{

/***/ "./app/actionCreators/teams.tsx":
/*!**************************************!*\
  !*** ./app/actionCreators/teams.tsx ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "createTeam": () => (/* binding */ createTeam),
/* harmony export */   "fetchTeamDetails": () => (/* binding */ fetchTeamDetails),
/* harmony export */   "fetchTeams": () => (/* binding */ fetchTeams),
/* harmony export */   "fetchUserTeams": () => (/* binding */ fetchUserTeams),
/* harmony export */   "joinTeam": () => (/* binding */ joinTeam),
/* harmony export */   "leaveTeam": () => (/* binding */ leaveTeam),
/* harmony export */   "removeTeam": () => (/* binding */ removeTeam),
/* harmony export */   "updateTeamSuccess": () => (/* binding */ updateTeamSuccess)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actions/teamActions */ "./app/actions/teamActions.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/callIfFunction */ "./app/utils/callIfFunction.tsx");
/* harmony import */ var sentry_utils_guid__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/guid */ "./app/utils/guid.tsx");







const doCallback = function () {
  let params = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  let name = arguments.length > 1 ? arguments[1] : undefined;

  for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
    args[_key - 2] = arguments[_key];
  }

  (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_4__.callIfFunction)(params[name], ...args);
};
/**
 * Note these are both slugs
 */


// Fetch teams for org
function fetchTeams(api, params, options) {
  sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].fetchAll(params.orgId);
  return api.request(`/teams/${params.orgId}/`, {
    success: data => {
      sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].fetchAllSuccess(params.orgId, data);
      doCallback(options, 'success', data);
    },
    error: error => {
      sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].fetchAllError(params.orgId, error);
      doCallback(options, 'error', error);
    }
  });
} // Fetch user teams for current org and place them in the team store

async function fetchUserTeams(api, params) {
  const teams = await api.requestPromise(`/organizations/${params.orgId}/user-teams/`);
  sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].loadUserTeams(teams);
}
function fetchTeamDetails(api, params, options) {
  sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].fetchDetails(params.teamId);
  return api.request(`/teams/${params.orgId}/${params.teamId}/`, {
    success: data => {
      sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].fetchDetailsSuccess(params.teamId, data);
      doCallback(options, 'success', data);
    },
    error: error => {
      sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].fetchDetailsError(params.teamId, error);
      doCallback(options, 'error', error);
    }
  });
}
function updateTeamSuccess(teamId, data) {
  sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].updateSuccess(teamId, data);
}
function joinTeam(api, params, options) {
  var _params$memberId;

  const endpoint = `/organizations/${params.orgId}/members/${(_params$memberId = params.memberId) !== null && _params$memberId !== void 0 ? _params$memberId : 'me'}/teams/${params.teamId}/`;
  const id = (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_5__.uniqueId)();
  sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].update(id, params.teamId);
  return api.request(endpoint, {
    method: 'POST',
    success: data => {
      sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].updateSuccess(params.teamId, data);
      doCallback(options, 'success', data);
    },
    error: error => {
      sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].updateError(id, params.teamId, error);
      doCallback(options, 'error', error);
    }
  });
}
function leaveTeam(api, params, options) {
  const endpoint = `/organizations/${params.orgId}/members/${params.memberId || 'me'}/teams/${params.teamId}/`;
  const id = (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_5__.uniqueId)();
  sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].update(id, params.teamId);
  return api.request(endpoint, {
    method: 'DELETE',
    success: data => {
      sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].updateSuccess(params.teamId, data);
      doCallback(options, 'success', data);
    },
    error: error => {
      sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].updateError(id, params.teamId, error);
      doCallback(options, 'error', error);
    }
  });
}
function createTeam(api, team, params) {
  sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].createTeam(team);
  return api.requestPromise(`/organizations/${params.orgId}/teams/`, {
    method: 'POST',
    data: team
  }).then(data => {
    sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].createTeamSuccess(data);
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tct)('[team] has been added to the [organization] organization', {
      team: `#${data.slug}`,
      organization: params.orgId
    }));
    return data;
  }, err => {
    sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].createTeamError(team.slug, err);
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tct)('Unable to create [team] in the [organization] organization', {
      team: `#${team.slug}`,
      organization: params.orgId
    }));
    throw err;
  });
}
function removeTeam(api, params) {
  sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].removeTeam(params.teamId);
  return api.requestPromise(`/teams/${params.orgId}/${params.teamId}/`, {
    method: 'DELETE'
  }).then(data => {
    sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].removeTeamSuccess(params.teamId, data);
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tct)('[team] has been removed from the [organization] organization', {
      team: `#${params.teamId}`,
      organization: params.orgId
    }));
    return data;
  }, err => {
    sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].removeTeamError(params.teamId, err);
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tct)('Unable to remove [team] from the [organization] organization', {
      team: `#${params.teamId}`,
      organization: params.orgId
    }));
    throw err;
  });
}

/***/ }),

/***/ "./app/components/modals/createTeamModal.tsx":
/*!***************************************************!*\
  !*** ./app/components/modals/createTeamModal.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_teams__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actionCreators/teams */ "./app/actionCreators/teams.tsx");
/* harmony import */ var sentry_components_teams_createTeamForm__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/teams/createTeamForm */ "./app/components/teams/createTeamForm.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








function CreateTeamModal(_ref) {
  let {
    Body,
    Header,
    ...props
  } = _ref;
  const {
    onClose,
    closeModal,
    organization
  } = props;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_4__["default"])();

  async function handleSubmit(data, onSuccess, onError) {
    try {
      const team = await (0,sentry_actionCreators_teams__WEBPACK_IMPORTED_MODULE_1__.createTeam)(api, data, {
        orgId: organization.slug
      });
      closeModal();
      onClose === null || onClose === void 0 ? void 0 : onClose(team);
      onSuccess(team);
    } catch (err) {
      onError(err);
    }
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Header, {
      closeButton: true,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Create Team')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Body, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_teams_createTeamForm__WEBPACK_IMPORTED_MODULE_2__["default"], { ...props,
        onSubmit: handleSubmit
      })
    })]
  });
}

CreateTeamModal.displayName = "CreateTeamModal";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (CreateTeamModal);

/***/ }),

/***/ "./app/components/teams/createTeamForm.tsx":
/*!*************************************************!*\
  !*** ./app/components/teams/createTeamForm.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_textField__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/forms/textField */ "./app/components/forms/textField.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_slugify__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/slugify */ "./app/utils/slugify.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








function CreateTeamForm(_ref) {
  let {
    organization,
    formProps,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("p", {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Members of a team have access to specific areas, such as a new release or a new application feature.')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_1__["default"], {
      submitLabel: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Create Team'),
      apiEndpoint: `/organizations/${organization.slug}/teams/`,
      apiMethod: "POST",
      onSubmit: (data, onSuccess, onError) => {
        var _props$onSubmit;

        return (_props$onSubmit = props.onSubmit) === null || _props$onSubmit === void 0 ? void 0 : _props$onSubmit.call(props, data, onSuccess, onError);
      },
      onSubmitSuccess: data => {
        var _props$onSuccess;

        return (_props$onSuccess = props.onSuccess) === null || _props$onSuccess === void 0 ? void 0 : _props$onSuccess.call(props, data);
      },
      requireChanges: true,
      "data-test-id": "create-team-form",
      ...formProps,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_forms_textField__WEBPACK_IMPORTED_MODULE_2__["default"], {
        name: "slug",
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Team Name'),
        placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('e.g. operations, web-frontend, desktop'),
        help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('May contain lowercase letters, numbers, dashes and underscores.'),
        required: true,
        stacked: true,
        flexibleControlStateSize: true,
        inline: false,
        transformInput: sentry_utils_slugify__WEBPACK_IMPORTED_MODULE_4__["default"]
      })
    })]
  });
}

CreateTeamForm.displayName = "CreateTeamForm";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (CreateTeamForm);

/***/ }),

/***/ "./app/utils/slugify.tsx":
/*!*******************************!*\
  !*** ./app/utils/slugify.tsx ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ slugify)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__);

// XXX: This is NOT an exhaustive slugify function
// Only forces lowercase and replaces spaces with hyphens
function slugify(str) {
  return typeof str === 'string' ? str.toLowerCase().replace(' ', '-') : '';
}

/***/ }),

/***/ "./app/utils/useApi.tsx":
/*!******************************!*\
  !*** ./app/utils/useApi.tsx ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_api__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/api */ "./app/api.tsx");



/**
 * Returns an API client that will have it's requests canceled when the owning
 * React component is unmounted (may be disabled via options).
 */
function useApi() {
  let {
    persistInFlight,
    api: providedApi
  } = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  const localApi = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(); // Lazily construct the client if we weren't provided with one

  if (localApi.current === undefined && providedApi === undefined) {
    localApi.current = new sentry_api__WEBPACK_IMPORTED_MODULE_1__.Client();
  } // Use the provided client if available


  const api = providedApi !== null && providedApi !== void 0 ? providedApi : localApi.current; // Clear API calls on unmount (if persistInFlight is disabled

  const clearOnUnmount = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(() => {
    if (!persistInFlight) {
      api.clear();
    }
  }, [api, persistInFlight]);
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => clearOnUnmount, [clearOnUnmount]);
  return api;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (useApi);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_modals_createTeamModal_tsx.225cc4fd84a5ab5f189a7707634fe2f6.js.map