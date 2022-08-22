"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_actionCreators_projects_tsx-app_components_deprecatedforms_selectField_tsx"],{

/***/ "./app/actionCreators/projects.tsx":
/*!*****************************************!*\
  !*** ./app/actionCreators/projects.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "_debouncedLoadStats": () => (/* binding */ _debouncedLoadStats),
/* harmony export */   "addTeamToProject": () => (/* binding */ addTeamToProject),
/* harmony export */   "changeProjectSlug": () => (/* binding */ changeProjectSlug),
/* harmony export */   "createProject": () => (/* binding */ createProject),
/* harmony export */   "fetchAnyReleaseExistence": () => (/* binding */ fetchAnyReleaseExistence),
/* harmony export */   "fetchProjectsCount": () => (/* binding */ fetchProjectsCount),
/* harmony export */   "loadDocs": () => (/* binding */ loadDocs),
/* harmony export */   "loadStats": () => (/* binding */ loadStats),
/* harmony export */   "loadStatsForProject": () => (/* binding */ loadStatsForProject),
/* harmony export */   "removeProject": () => (/* binding */ removeProject),
/* harmony export */   "removeTeamFromProject": () => (/* binding */ removeTeamFromProject),
/* harmony export */   "sendSampleEvent": () => (/* binding */ sendSampleEvent),
/* harmony export */   "setActiveProject": () => (/* binding */ setActiveProject),
/* harmony export */   "transferProject": () => (/* binding */ transferProject),
/* harmony export */   "update": () => (/* binding */ update)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var lodash_chunk__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/chunk */ "../node_modules/lodash/chunk.js");
/* harmony import */ var lodash_chunk__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_chunk__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actions/projectActions */ "./app/actions/projectActions.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_projectsStatsStore__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/stores/projectsStatsStore */ "./app/stores/projectsStatsStore.tsx");








function update(api, params) {
  sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].update(params.projectId, params.data);
  const endpoint = `/projects/${params.orgId}/${params.projectId}/`;
  return api.requestPromise(endpoint, {
    method: 'PUT',
    data: params.data
  }).then(data => {
    sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].updateSuccess(data);
    return data;
  }, err => {
    sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].updateError(err, params.projectId);
    throw err;
  });
}
function loadStats(api, params) {
  sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].loadStats(params.orgId, params.data);
  const endpoint = `/organizations/${params.orgId}/stats/`;
  api.request(endpoint, {
    query: params.query,
    success: data => {
      sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].loadStatsSuccess(data);
    },
    error: data => {
      sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].loadStatsError(data);
    }
  });
} // This is going to queue up a list of project ids we need to fetch stats for
// Will be cleared when debounced function fires

const _projectStatsToFetch = new Set(); // Max projects to query at a time, otherwise if we fetch too many in the same request
// it can timeout


const MAX_PROJECTS_TO_FETCH = 10;

const _queryForStats = (api, projects, orgId, additionalQuery) => {
  const idQueryParams = projects.map(project => `id:${project}`).join(' ');
  const endpoint = `/organizations/${orgId}/projects/`;
  const query = {
    statsPeriod: '24h',
    query: idQueryParams,
    ...additionalQuery
  };
  return api.requestPromise(endpoint, {
    query
  });
};

const _debouncedLoadStats = lodash_debounce__WEBPACK_IMPORTED_MODULE_3___default()((api, projectSet, params) => {
  const storedProjects = sentry_stores_projectsStatsStore__WEBPACK_IMPORTED_MODULE_7__["default"].getAll();
  const existingProjectStats = Object.values(storedProjects).map(_ref => {
    let {
      id
    } = _ref;
    return id;
  });
  const projects = Array.from(projectSet).filter(project => !existingProjectStats.includes(project));

  if (!projects.length) {
    _projectStatsToFetch.clear();

    return;
  } // Split projects into more manageable chunks to query, otherwise we can
  // potentially face server timeouts


  const queries = lodash_chunk__WEBPACK_IMPORTED_MODULE_2___default()(projects, MAX_PROJECTS_TO_FETCH).map(chunkedProjects => _queryForStats(api, chunkedProjects, params.orgId, params.query));
  Promise.all(queries).then(results => {
    sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].loadStatsForProjectSuccess(results.reduce((acc, result) => acc.concat(result), []));
  }).catch(() => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Unable to fetch all project stats'));
  }); // Reset projects list

  _projectStatsToFetch.clear();
}, 50);
function loadStatsForProject(api, project, params) {
  // Queue up a list of projects that we need stats for
  // and call a debounced function to fetch stats for list of projects
  _projectStatsToFetch.add(project);

  _debouncedLoadStats(api, _projectStatsToFetch, params);
}
function setActiveProject(project) {
  sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].setActive(project);
}
function removeProject(api, orgId, project) {
  const endpoint = `/projects/${orgId}/${project.slug}/`;
  sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].removeProject(project);
  return api.requestPromise(endpoint, {
    method: 'DELETE'
  }).then(() => {
    sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].removeProjectSuccess(project);
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)('[project] was successfully removed', {
      project: project.slug
    }));
  }, err => {
    sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].removeProjectError(project);
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)('Error removing [project]', {
      project: project.slug
    }));
    throw err;
  });
}
function transferProject(api, orgId, project, email) {
  const endpoint = `/projects/${orgId}/${project.slug}/transfer/`;
  return api.requestPromise(endpoint, {
    method: 'POST',
    data: {
      email
    }
  }).then(() => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)('A request was sent to move [project] to a different organization', {
      project: project.slug
    }));
  }, err => {
    let message = ''; // Handle errors with known failures

    if (err.status >= 400 && err.status < 500 && err.responseJSON) {
      var _err$responseJSON;

      message = (_err$responseJSON = err.responseJSON) === null || _err$responseJSON === void 0 ? void 0 : _err$responseJSON.detail;
    }

    if (message) {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)('Error transferring [project]. [message]', {
        project: project.slug,
        message
      }));
    } else {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)('Error transferring [project]', {
        project: project.slug
      }));
    }

    throw err;
  });
}
/**
 * Associate a team with a project
 */

/**
 *  Adds a team to a project
 *
 * @param api API Client
 * @param orgSlug Organization Slug
 * @param projectSlug Project Slug
 * @param team Team data object
 */

function addTeamToProject(api, orgSlug, projectSlug, team) {
  const endpoint = `/projects/${orgSlug}/${projectSlug}/teams/${team.slug}/`;
  (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addLoadingMessage)();
  sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].addTeam(team);
  return api.requestPromise(endpoint, {
    method: 'POST'
  }).then(project => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)('[team] has been added to the [project] project', {
      team: `#${team.slug}`,
      project: projectSlug
    }));
    sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].addTeamSuccess(team, projectSlug);
    sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].updateSuccess(project);
  }, err => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)('Unable to add [team] to the [project] project', {
      team: `#${team.slug}`,
      project: projectSlug
    }));
    sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].addTeamError();
    throw err;
  });
}
/**
 * Removes a team from a project
 *
 * @param api API Client
 * @param orgSlug Organization Slug
 * @param projectSlug Project Slug
 * @param teamSlug Team Slug
 */

function removeTeamFromProject(api, orgSlug, projectSlug, teamSlug) {
  const endpoint = `/projects/${orgSlug}/${projectSlug}/teams/${teamSlug}/`;
  (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addLoadingMessage)();
  sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].removeTeam(teamSlug);
  return api.requestPromise(endpoint, {
    method: 'DELETE'
  }).then(project => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)('[team] has been removed from the [project] project', {
      team: `#${teamSlug}`,
      project: projectSlug
    }));
    sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].removeTeamSuccess(teamSlug, projectSlug);
    sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].updateSuccess(project);
  }, err => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)('Unable to remove [team] from the [project] project', {
      team: `#${teamSlug}`,
      project: projectSlug
    }));
    sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].removeTeamError(err);
    throw err;
  });
}
/**
 * Change a project's slug
 *
 * @param prev Previous slug
 * @param next New slug
 */

function changeProjectSlug(prev, next) {
  sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].changeSlug(prev, next);
}
/**
 * Send a sample event
 *
 * @param api API Client
 * @param orgSlug Organization Slug
 * @param projectSlug Project Slug
 */

function sendSampleEvent(api, orgSlug, projectSlug) {
  const endpoint = `/projects/${orgSlug}/${projectSlug}/create-sample/`;
  return api.requestPromise(endpoint, {
    method: 'POST'
  });
}
/**
 * Creates a project
 *
 * @param api API Client
 * @param orgSlug Organization Slug
 * @param team The team slug to assign the project to
 * @param name Name of the project
 * @param platform The platform key of the project
 * @param options Additional options such as creating default alert rules
 */

function createProject(api, orgSlug, team, name, platform) {
  let options = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : {};
  return api.requestPromise(`/teams/${orgSlug}/${team}/projects/`, {
    method: 'POST',
    data: {
      name,
      platform,
      default_rules: options.defaultRules
    }
  });
}
/**
 * Load platform documentation specific to the project. The DSN and various
 * other project specific secrets will be included in the documentation.
 *
 * @param api API Client
 * @param orgSlug Organization Slug
 * @param projectSlug Project Slug
 * @param platform Project platform.
 */

function loadDocs(api, orgSlug, projectSlug, platform) {
  return api.requestPromise(`/projects/${orgSlug}/${projectSlug}/docs/${platform}/`);
}
/**
 * Load the counts of my projects and all projects for the current user
 *
 * @param api API Client
 * @param orgSlug Organization Slug
 */

function fetchProjectsCount(api, orgSlug) {
  return api.requestPromise(`/organizations/${orgSlug}/projects-count/`);
}
/**
 * Check if there are any releases in the last 90 days.
 * Used for checking if project is using releases.
 *
 * @param api API Client
 * @param orgSlug Organization Slug
 * @param projectId Project Id
 */

async function fetchAnyReleaseExistence(api, orgSlug, projectId) {
  const data = await api.requestPromise(`/organizations/${orgSlug}/releases/stats/`, {
    method: 'GET',
    query: {
      statsPeriod: '90d',
      project: projectId,
      per_page: 1
    }
  });
  return data.length > 0;
}

/***/ }),

/***/ "./app/components/deprecatedforms/form.tsx":
/*!*************************************************!*\
  !*** ./app/components/deprecatedforms/form.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "StyledForm": () => (/* binding */ StyledForm),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_deprecatedforms_formContext__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/deprecatedforms/formContext */ "./app/components/deprecatedforms/formContext.tsx");
/* harmony import */ var sentry_components_forms_state__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/forms/state */ "./app/components/forms/state.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












class Form extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor(props, context) {
    super(props, context);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onSubmit", e => {
      e.preventDefault();

      if (!this.props.onSubmit) {
        throw new Error('onSubmit is a required prop');
      }

      this.props.onSubmit(this.state.data, this.onSubmitSuccess, this.onSubmitError);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onSubmitSuccess", data => {
      this.setState({
        state: sentry_components_forms_state__WEBPACK_IMPORTED_MODULE_7__["default"].READY,
        errors: {},
        initialData: { ...this.state.data,
          ...(data || {})
        }
      });
      this.props.onSubmitSuccess && this.props.onSubmitSuccess(data);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onSubmitError", error => {
      this.setState({
        state: sentry_components_forms_state__WEBPACK_IMPORTED_MODULE_7__["default"].ERROR,
        errors: error.responseJSON
      });

      if (this.props.resetOnError) {
        this.setState({
          initialData: {}
        });
      }

      this.props.onSubmitError && this.props.onSubmitError(error);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onFieldChange", (name, value) => {
      this.setState(state => ({
        data: { ...state.data,
          [name]: value
        }
      }));
    });

    this.state = {
      data: { ...this.props.initialData
      },
      errors: {},
      initialData: { ...this.props.initialData
      },
      state: sentry_components_forms_state__WEBPACK_IMPORTED_MODULE_7__["default"].READY
    };
  }

  getContext() {
    const {
      data,
      errors
    } = this.state;
    return {
      form: {
        data,
        errors,
        onFieldChange: this.onFieldChange
      }
    };
  }

  render() {
    var _this$props$submitLab, _this$props$cancelLab;

    const isSaving = this.state.state === sentry_components_forms_state__WEBPACK_IMPORTED_MODULE_7__["default"].SAVING;
    const {
      initialData,
      data
    } = this.state;
    const {
      errorMessage,
      hideErrors,
      requireChanges
    } = this.props;
    const hasChanges = requireChanges ? Object.keys(data).length && !lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default()(data, initialData) : true;
    const isError = this.state.state === sentry_components_forms_state__WEBPACK_IMPORTED_MODULE_7__["default"].ERROR;
    const nonFieldErrors = this.state.errors && this.state.errors.non_field_errors;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_deprecatedforms_formContext__WEBPACK_IMPORTED_MODULE_6__["default"].Provider, {
      value: this.getContext(),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(StyledForm, {
        onSubmit: this.onSubmit,
        className: this.props.className,
        "aria-label": this.props['aria-label'],
        children: [isError && !hideErrors && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("div", {
          className: "alert alert-error alert-block",
          children: nonFieldErrors ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)("div", {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("p", {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Unable to save your changes. Please correct the following errors try again.')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("ul", {
              children: nonFieldErrors.map((e, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("li", {
                children: e
              }, i))
            })]
          }) : errorMessage
        }), this.props.children, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)("div", {
          className: this.props.footerClass,
          style: {
            marginTop: 25
          },
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
            priority: "primary",
            disabled: isSaving || this.props.submitDisabled || !hasChanges,
            type: "submit",
            "aria-label": (_this$props$submitLab = this.props.submitLabel) !== null && _this$props$submitLab !== void 0 ? _this$props$submitLab : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Submit'),
            children: this.props.submitLabel
          }), this.props.onCancel && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
            type: "button",
            disabled: isSaving,
            onClick: this.props.onCancel,
            style: {
              marginLeft: 5
            },
            "aria-label": (_this$props$cancelLab = this.props.cancelLabel) !== null && _this$props$cancelLab !== void 0 ? _this$props$cancelLab : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Cancel'),
            children: this.props.cancelLabel
          }), this.props.extraButton]
        })]
      })
    });
  }

}

Form.displayName = "Form";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(Form, "defaultProps", {
  cancelLabel: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Cancel'),
  submitLabel: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Save Changes'),
  submitDisabled: false,
  footerClass: 'form-actions align-right',
  className: 'form-stacked',
  requireChanges: false,
  hideErrors: false,
  resetOnError: false,
  errorMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Unable to save your changes. Please ensure all fields are valid and try again.')
});

// Note: this is so we can use this as a selector for SelectField
// We need to keep `Form` as a React Component because ApiForm extends it :/
const StyledForm = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('form',  true ? {
  target: "e1t9al3x0"
} : 0)( true ? "" : 0);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Form);

/***/ }),

/***/ "./app/components/deprecatedforms/formContext.tsx":
/*!********************************************************!*\
  !*** ./app/components/deprecatedforms/formContext.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");

/**
 * Context type used on 'classic' or 'old' forms.
 *
 * This is a very different type than what is used on the 'settings'
 * forms which have MobX under the hood.
 */

/**
 * Default to undefined to preserve backwards compatibility.
 * The FormField component uses a truthy test to see if it is connected
 * to context or if the control is 'uncontrolled'.
 */
const FormContext = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_0__.createContext)({});
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (FormContext);

/***/ }),

/***/ "./app/components/deprecatedforms/formField.tsx":
/*!******************************************************!*\
  !*** ./app/components/deprecatedforms/formField.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ FormField)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! classnames */ "../node_modules/classnames/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(classnames__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_deprecatedforms_formContext__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/deprecatedforms/formContext */ "./app/components/deprecatedforms/formContext.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










class FormField extends react__WEBPACK_IMPORTED_MODULE_3__.PureComponent {
  constructor(props, context) {
    super(props, context);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onChange", e => {
      const value = e.target.value;
      this.setValue(value);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "setValue", value => {
      const form = (this.context || {}).form;
      this.setState({
        value
      }, () => {
        var _this$props$onChange, _this$props;

        const finalValue = this.coerceValue(this.state.value);
        (_this$props$onChange = (_this$props = this.props).onChange) === null || _this$props$onChange === void 0 ? void 0 : _this$props$onChange.call(_this$props, finalValue);
        form === null || form === void 0 ? void 0 : form.onFieldChange(this.props.name, finalValue);
      });
    });

    this.state = {
      error: null,
      value: this.getValue(props, context)
    };
  }

  componentDidMount() {}

  UNSAFE_componentWillReceiveProps(nextProps, nextContext) {
    const newError = this.getError(nextProps, nextContext);

    if (newError !== this.state.error) {
      this.setState({
        error: newError
      });
    }

    if (this.props.value !== nextProps.value || (0,sentry_utils__WEBPACK_IMPORTED_MODULE_7__.defined)(nextContext.form)) {
      const newValue = this.getValue(nextProps, nextContext);

      if (newValue !== this.state.value) {
        this.setValue(newValue);
      }
    }
  }

  componentWillUnmount() {}

  getValue(props, context) {
    const form = (context || this.context || {}).form;
    props = props || this.props;

    if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_7__.defined)(props.value)) {
      return props.value;
    }

    if (form && form.data.hasOwnProperty(props.name)) {
      return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_7__.defined)(form.data[props.name]) ? form.data[props.name] : '';
    }

    return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_7__.defined)(props.defaultValue) ? props.defaultValue : '';
  }

  getError(props, context) {
    const form = (context || this.context || {}).form;
    props = props || this.props;

    if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_7__.defined)(props.error)) {
      return props.error;
    }

    return form && form.errors[props.name] || null;
  }

  getId() {
    return `id-${this.props.name}`;
  }

  coerceValue(value) {
    return value;
  }

  getField() {
    throw new Error('Must be implemented by child.');
  }

  getClassName() {
    throw new Error('Must be implemented by child.');
  }

  getFinalClassNames() {
    const {
      className,
      required
    } = this.props;
    const {
      error
    } = this.state;
    return classnames__WEBPACK_IMPORTED_MODULE_4___default()(className, this.getClassName(), {
      'has-error': !!error,
      required
    });
  }

  renderDisabledReason() {
    const {
      disabled,
      disabledReason
    } = this.props;

    if (!disabled) {
      return null;
    }

    if (!disabledReason) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_6__["default"], {
      title: disabledReason,
      position: "top",
      size: "sm"
    });
  }

  render() {
    const {
      label,
      hideErrorMessage,
      help,
      style
    } = this.props;
    const {
      error
    } = this.state;
    const cx = this.getFinalClassNames();
    const shouldShowErrorMessage = error && !hideErrorMessage;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("div", {
      style: style,
      className: cx,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)("div", {
        className: "controls",
        children: [label && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("label", {
          htmlFor: this.getId(),
          className: "control-label",
          children: label
        }), this.getField(), this.renderDisabledReason(), (0,sentry_utils__WEBPACK_IMPORTED_MODULE_7__.defined)(help) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("p", {
          className: "help-block",
          children: help
        }), shouldShowErrorMessage && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(ErrorMessage, {
          children: error
        })]
      })
    });
  }

}
FormField.displayName = "FormField";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(FormField, "defaultProps", {
  hideErrorMessage: false,
  disabled: false,
  required: false
});

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(FormField, "contextType", sentry_components_deprecatedforms_formContext__WEBPACK_IMPORTED_MODULE_5__["default"]);

const ErrorMessage = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('p',  true ? {
  target: "e1wh8pos0"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";color:", p => p.theme.red300, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/deprecatedforms/selectField.tsx":
/*!********************************************************!*\
  !*** ./app/components/deprecatedforms/selectField.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ SelectField)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _form__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./form */ "./app/components/deprecatedforms/form.tsx");
/* harmony import */ var _formField__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./formField */ "./app/components/deprecatedforms/formField.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








class SelectField extends _formField__WEBPACK_IMPORTED_MODULE_6__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onChange", opt => {
      // Changing this will most likely break react-select (e.g. you won't be able to select
      // a menu option that is from an async request, or a multi select).
      this.setValue(opt);
    });
  }

  UNSAFE_componentWillReceiveProps(nextProps, nextContext) {
    const newError = this.getError(nextProps, nextContext);

    if (newError !== this.state.error) {
      this.setState({
        error: newError
      });
    }

    if (this.props.value !== nextProps.value || (0,sentry_utils__WEBPACK_IMPORTED_MODULE_4__.defined)(nextContext.form)) {
      const newValue = this.getValue(nextProps, nextContext); // This is the only thing that is different from parent, we compare newValue against coerced value in state
      // To remain compatible with react-select, we need to store the option object that
      // includes `value` and `label`, but when we submit the format, we need to coerce it
      // to just return `value`. Also when field changes, it propagates the coerced value up

      const coercedValue = this.coerceValue(this.state.value); // newValue can be empty string because of `getValue`, while coerceValue needs to return null (to differentiate
      // empty string from cleared item). We could use `!=` to compare, but lets be a bit more explicit with strict equality
      //
      // This can happen when this is apart of a field, and it re-renders onChange for a different field,
      // there will be a mismatch between this component's state.value and `this.getValue` result above

      if (newValue !== coercedValue && !!newValue !== !!coercedValue) {
        this.setValue(newValue);
      }
    }
  } // Overriding this so that we can support `multi` fields through property


  getValue(props, context) {
    const form = (context || this.context || {}).form;
    props = props || this.props; // Don't use `isMultiple` here because we're taking props from args as well

    const defaultValue = this.isMultiple(props) ? [] : '';

    if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_4__.defined)(props.value)) {
      return props.value;
    }

    if (form && form.data.hasOwnProperty(props.name)) {
      return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_4__.defined)(form.data[props.name]) ? form.data[props.name] : defaultValue;
    }

    return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_4__.defined)(props.defaultValue) ? props.defaultValue : defaultValue;
  } // We need this to get react-select's `Creatable` to work properly
  // Otherwise, when you hit "enter" to create a new item, the "selected value" does
  // not update with new value (and also new value is not displayed in dropdown)
  //
  // This is also needed to get `multi` select working since we need the {label, value} object
  // for react-select (but forms expect just the value to be propagated)


  coerceValue(value) {
    if (!value) {
      return '';
    }

    if (this.isMultiple()) {
      return value.map(v => v.value);
    }

    if (value.hasOwnProperty('value')) {
      return value.value;
    }

    return value;
  }

  isMultiple(props) {
    props = props || this.props; // this is to maintain compatibility with the 'multi' prop

    return props.multi || props.multiple;
  }

  getClassName() {
    return '';
  }

  getField() {
    const {
      options,
      clearable,
      creatable,
      choices,
      placeholder,
      disabled,
      name,
      isLoading
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(StyledSelectControl, {
      creatable: creatable,
      id: this.getId(),
      choices: choices,
      options: options,
      placeholder: placeholder,
      disabled: disabled,
      value: this.state.value,
      onChange: this.onChange,
      clearable: clearable,
      multiple: this.isMultiple(),
      name: name,
      isLoading: isLoading
    });
  }

} // This is to match other fields that are wrapped by a `div.control-group`

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(SelectField, "defaultProps", { ..._formField__WEBPACK_IMPORTED_MODULE_6__["default"].defaultProps,
  clearable: true,
  multiple: false
});

const StyledSelectControl = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e1lvk2vs0"
} : 0)(_form__WEBPACK_IMPORTED_MODULE_5__.StyledForm, " &,.form-stacked &{margin-bottom:15px;.control-group &{margin-bottom:0;}}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/stores/projectsStatsStore.tsx":
/*!*******************************************!*\
  !*** ./app/stores/projectsStatsStore.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actions/projectActions */ "./app/actions/projectActions.tsx");
/* harmony import */ var sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/makeSafeRefluxStore */ "./app/utils/makeSafeRefluxStore.ts");





/**
 * This is a store specifically used by the dashboard, so that we can
 * clear the store when the Dashboard unmounts
 * (as to not disrupt ProjectsStore which a lot more components use)
 */
const storeConfig = {
  itemsBySlug: {},
  unsubscribeListeners: [],

  init() {
    this.reset();
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_2__["default"].loadStatsForProjectSuccess, this.onStatsLoadSuccess));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_2__["default"].update, this.onUpdate));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_2__["default"].updateError, this.onUpdateError));
  },

  getInitialState() {
    return this.itemsBySlug;
  },

  reset() {
    this.itemsBySlug = {};
    this.updatingItems = new Map();
  },

  onStatsLoadSuccess(projects) {
    projects.forEach(project => {
      this.itemsBySlug[project.slug] = project;
    });
    this.trigger(this.itemsBySlug);
  },

  /**
   * Optimistic updates
   * @param projectSlug Project slug
   * @param data Project data
   */
  onUpdate(projectSlug, data) {
    const project = this.getBySlug(projectSlug);
    this.updatingItems.set(projectSlug, project);

    if (!project) {
      return;
    }

    const newProject = { ...project,
      ...data
    };
    this.itemsBySlug = { ...this.itemsBySlug,
      [project.slug]: newProject
    };
    this.trigger(this.itemsBySlug);
  },

  onUpdateSuccess(data) {
    // Remove project from updating map
    this.updatingItems.delete(data.slug);
  },

  /**
   * Revert project data when there was an error updating project details
   * @param err Error object
   * @param data Previous project data
   */
  onUpdateError(_err, projectSlug) {
    const project = this.updatingItems.get(projectSlug);

    if (!project) {
      return;
    }

    this.updatingItems.delete(projectSlug); // Restore old project

    this.itemsBySlug = { ...this.itemsBySlug,
      [project.slug]: { ...project
      }
    };
    this.trigger(this.itemsBySlug);
  },

  getAll() {
    return this.itemsBySlug;
  },

  getBySlug(slug) {
    return this.itemsBySlug[slug];
  }

};
const ProjectsStatsStore = (0,reflux__WEBPACK_IMPORTED_MODULE_1__.createStore)((0,sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_3__.makeSafeRefluxStore)(storeConfig));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectsStatsStore);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_actionCreators_projects_tsx-app_components_deprecatedforms_selectField_tsx.d2d30aa713db7ee05cfdd147231d01dc.js.map