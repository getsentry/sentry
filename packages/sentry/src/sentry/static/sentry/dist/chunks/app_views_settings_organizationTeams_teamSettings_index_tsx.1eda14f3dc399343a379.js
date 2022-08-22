"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_organizationTeams_teamSettings_index_tsx"],{

/***/ "./app/data/forms/teamSettingsFields.tsx":
/*!***********************************************!*\
  !*** ./app/data/forms/teamSettingsFields.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "route": () => (/* binding */ route)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_slugify__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/slugify */ "./app/utils/slugify.tsx");

 // Export route to make these forms searchable by label/help

const route = '/settings/:orgId/teams/:teamId/settings/';
const formGroups = [{
  // Form "section"/"panel"
  title: 'Team Settings',
  fields: [{
    name: 'slug',
    type: 'string',
    required: true,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Name'),
    placeholder: 'e.g. api-team',
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('A unique ID used to identify the team'),
    disabled: _ref => {
      let {
        access
      } = _ref;
      return !access.has('team:write');
    },
    transformInput: sentry_utils_slugify__WEBPACK_IMPORTED_MODULE_1__["default"],
    saveOnBlur: false,
    saveMessageAlertType: 'info',
    saveMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('You will be redirected to the new team slug after saving')
  }]
}];
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (formGroups);

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

/***/ "./app/views/settings/organizationTeams/teamSettings/index.tsx":
/*!*********************************************************************!*\
  !*** ./app/views/settings/organizationTeams/teamSettings/index.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_teams__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/teams */ "./app/actionCreators/teams.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/forms/jsonForm */ "./app/components/forms/jsonForm.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_data_forms_teamSettingsFields__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/data/forms/teamSettingsFields */ "./app/data/forms/teamSettingsFields.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





















class TeamSettings extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_17__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmitSuccess", (resp, model, id) => {
      // Use the old slug when triggering the update so we correctly replace the
      // previous team in the store
      (0,sentry_actionCreators_teams__WEBPACK_IMPORTED_MODULE_6__.updateTeamSuccess)(this.props.team.slug, resp);

      if (id === 'slug') {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Team name changed'));
        react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.replace(`/settings/${this.props.params.orgId}/teams/${model.getValue(id)}/settings/`);
        this.setState({
          loading: true
        });
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleRemoveTeam", async () => {
      await (0,sentry_actionCreators_teams__WEBPACK_IMPORTED_MODULE_6__.removeTeam)(this.api, this.props.params);
      react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.replace(`/settings/${this.props.params.orgId}/teams/`);
    });
  }

  getTitle() {
    return 'Team Settings';
  }

  getEndpoints() {
    return [];
  }

  renderBody() {
    const {
      organization,
      team,
      params
    } = this.props;
    const access = new Set(organization.access);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_10__["default"], {
        apiMethod: "PUT",
        apiEndpoint: `/teams/${params.orgId}/${team.slug}/`,
        saveOnBlur: true,
        allowUndo: true,
        onSubmitSuccess: this.handleSubmitSuccess,
        onSubmitError: () => (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Unable to save change')),
        initialData: {
          name: team.name,
          slug: team.slug
        },
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_11__["default"], {
          access: access,
          forms: sentry_data_forms_teamSettingsFields__WEBPACK_IMPORTED_MODULE_13__["default"]
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Remove Team')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_9__["default"], {
          help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)("This may affect team members' access to projects and associated alert delivery."),
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("div", {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_8__["default"], {
              disabled: !access.has('team:admin'),
              onConfirm: this.handleRemoveTeam,
              priority: "danger",
              message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('Are you sure you want to remove the team [team]?', {
                team: `#${team.slug}`
              }),
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
                icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconDelete, {}),
                priority: "danger",
                disabled: !access.has('team:admin'),
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Remove Team')
              })
            })
          })
        })]
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_16__["default"])(TeamSettings));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_organizationTeams_teamSettings_index_tsx.dcc808c8a1547c9a2b4e93764ffc4380.js.map