"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_organizationGeneralSettings_index_tsx"],{

/***/ "./app/data/forms/organizationGeneralSettings.tsx":
/*!********************************************************!*\
  !*** ./app/data/forms/organizationGeneralSettings.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "route": () => (/* binding */ route)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_slugify__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/slugify */ "./app/utils/slugify.tsx");

 // Export route to make these forms searchable by label/help

const route = '/settings/:orgId/';
const formGroups = [{
  // Form "section"/"panel"
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('General'),
  fields: [{
    name: 'slug',
    type: 'string',
    required: true,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Organization Slug'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('A unique ID used to identify this organization'),
    transformInput: sentry_utils_slugify__WEBPACK_IMPORTED_MODULE_1__["default"],
    saveOnBlur: false,
    saveMessageAlertType: 'info',
    saveMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('You will be redirected to the new organization slug after saving')
  }, {
    name: 'name',
    type: 'string',
    required: true,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Display Name'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('A human-friendly name for the organization')
  }, {
    name: 'isEarlyAdopter',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Early Adopter'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)("Opt-in to new features before they're released to the public")
  }]
}, {
  title: 'Membership',
  fields: [{
    name: 'defaultRole',
    type: 'select',
    required: true,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Default Role'),
    // seems weird to have choices in initial form data
    choices: function () {
      var _initialData$orgRoleL, _initialData$orgRoleL2;

      let {
        initialData
      } = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      return (_initialData$orgRoleL = initialData === null || initialData === void 0 ? void 0 : (_initialData$orgRoleL2 = initialData.orgRoleList) === null || _initialData$orgRoleL2 === void 0 ? void 0 : _initialData$orgRoleL2.map(r => [r.id, r.name])) !== null && _initialData$orgRoleL !== void 0 ? _initialData$orgRoleL : [];
    },
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('The default role new members will receive'),
    disabled: _ref => {
      let {
        access
      } = _ref;
      return !access.has('org:admin');
    }
  }, {
    name: 'openMembership',
    type: 'boolean',
    required: true,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Open Membership'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Allow organization members to freely join or leave any team')
  }, {
    name: 'eventsMemberAdmin',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Let Members Delete Events'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Allow members to delete events (including the delete & discard action) by granting them the `event:admin` scope.')
  }, {
    name: 'alertsMemberWrite',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Let Members Create and Edit Alerts'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Allow members to create, edit, and delete alert rules by granting them the `alerts:write` scope.')
  }, {
    name: 'attachmentsRole',
    type: 'select',
    choices: _ref2 => {
      var _initialData$orgRoleL3, _initialData$orgRoleL4;

      let {
        initialData = {}
      } = _ref2;
      return (_initialData$orgRoleL3 = initialData === null || initialData === void 0 ? void 0 : (_initialData$orgRoleL4 = initialData.orgRoleList) === null || _initialData$orgRoleL4 === void 0 ? void 0 : _initialData$orgRoleL4.map(r => [r.id, r.name])) !== null && _initialData$orgRoleL3 !== void 0 ? _initialData$orgRoleL3 : [];
    },
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Attachments Access'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Role required to download event attachments, such as native crash reports or log files.'),
    visible: _ref3 => {
      let {
        features
      } = _ref3;
      return features.has('event-attachments');
    }
  }, {
    name: 'debugFilesRole',
    type: 'select',
    choices: _ref4 => {
      var _initialData$orgRoleL5, _initialData$orgRoleL6;

      let {
        initialData = {}
      } = _ref4;
      return (_initialData$orgRoleL5 = initialData === null || initialData === void 0 ? void 0 : (_initialData$orgRoleL6 = initialData.orgRoleList) === null || _initialData$orgRoleL6 === void 0 ? void 0 : _initialData$orgRoleL6.map(r => [r.id, r.name])) !== null && _initialData$orgRoleL5 !== void 0 ? _initialData$orgRoleL5 : [];
    },
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Debug Files Access'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Role required to download debug information files, proguard mappings and source maps.')
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

/***/ "./app/views/settings/organization/permissionAlert.tsx":
/*!*************************************************************!*\
  !*** ./app/views/settings/organization/permissionAlert.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





const PermissionAlert = _ref => {
  let {
    access = ['org:write'],
    message = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('These settings can only be edited by users with the organization owner or manager role.'),
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_0__["default"], {
    access: access,
    children: _ref2 => {
      let {
        hasAccess
      } = _ref2;
      return !hasAccess && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__["default"], {
        type: "warning",
        showIcon: true,
        ...props,
        children: message
      });
    }
  });
};

PermissionAlert.displayName = "PermissionAlert";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PermissionAlert);

/***/ }),

/***/ "./app/views/settings/organizationGeneralSettings/index.tsx":
/*!******************************************************************!*\
  !*** ./app/views/settings/organizationGeneralSettings/index.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_organizations__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/organizations */ "./app/actionCreators/organizations.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_components_list__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/list */ "./app/components/list/index.tsx");
/* harmony import */ var sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/list/listItem */ "./app/components/list/listItem.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var sentry_views_settings_organization_permissionAlert__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/views/settings/organization/permissionAlert */ "./app/views/settings/organization/permissionAlert.tsx");
/* harmony import */ var _organizationSettingsForm__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ./organizationSettingsForm */ "./app/views/settings/organizationGeneralSettings/organizationSettingsForm.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
























function OrganizationGeneralSettings(props) {
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_14__["default"])();
  const {
    organization,
    projects,
    params
  } = props;
  const {
    orgId
  } = params;
  const access = new Set(organization.access);

  const removeConfirmMessage = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_18__["default"], {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.tct)('Removing the organization, [name] is permanent and cannot be undone! Are you sure you want to continue?', {
        name: organization && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)("strong", {
          children: organization.name
        })
      })
    }), !!projects.length && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_18__["default"], {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('This will also remove the following associated projects:')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_list__WEBPACK_IMPORTED_MODULE_9__["default"], {
        symbol: "bullet",
        "data-test-id": "removed-projects-list",
        children: projects.map(project => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_10__["default"], {
          children: project.slug
        }, project.slug))
      })]
    })]
  });

  const handleSaveForm = (prevData, data) => {
    if (data.slug && data.slug !== prevData.slug) {
      (0,sentry_actionCreators_organizations__WEBPACK_IMPORTED_MODULE_5__.changeOrganizationSlug)(prevData, data);
      react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.replace(`/settings/${data.slug}/`);
    } else {
      // This will update OrganizationStore (as well as OrganizationsStore
      // which is slightly incorrect because it has summaries vs a detailed org)
      (0,sentry_actionCreators_organizations__WEBPACK_IMPORTED_MODULE_5__.updateOrganization)(data);
    }
  };

  const handleConfirmRemoveOrg = () => {
    if (!organization) {
      return;
    }

    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addLoadingMessage)();
    (0,sentry_actionCreators_organizations__WEBPACK_IMPORTED_MODULE_5__.removeAndRedirectToRemainingOrganization)(api, {
      orgId: params.orgId,
      successMessage: `${organization.name} is queued for deletion.`,
      errorMessage: `Error removing the ${organization.name} organization`
    });
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_12__["default"], {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('General Settings'),
      orgSlug: orgId
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_17__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Organization Settings')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_views_settings_organization_permissionAlert__WEBPACK_IMPORTED_MODULE_19__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(_organizationSettingsForm__WEBPACK_IMPORTED_MODULE_20__["default"], { ...props,
        initialData: organization,
        access: access,
        onSave: handleSaveForm
      }), access.has('org:admin') && !organization.isDefault && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__.PanelHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Remove Organization')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_8__["default"], {
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Remove Organization'),
          help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Removing this organization will delete all data including projects and their associated events.'),
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)("div", {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_7__["default"], {
              priority: "danger",
              confirmText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Remove Organization'),
              message: removeConfirmMessage,
              onConfirm: handleConfirmRemoveOrg,
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
                priority: "danger",
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Remove Organization')
              })
            })
          })
        })]
      })]
    })]
  });
}

OrganizationGeneralSettings.displayName = "OrganizationGeneralSettings";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_16__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_15__["default"])(OrganizationGeneralSettings)));

/***/ }),

/***/ "./app/views/settings/organizationGeneralSettings/organizationSettingsForm.tsx":
/*!*************************************************************************************!*\
  !*** ./app/views/settings/organizationGeneralSettings/organizationSettingsForm.tsx ***!
  \*************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_organizations__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/organizations */ "./app/actionCreators/organizations.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_avatarChooser__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/avatarChooser */ "./app/components/avatarChooser.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/jsonForm */ "./app/components/forms/jsonForm.tsx");
/* harmony import */ var sentry_data_forms_organizationGeneralSettings__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/data/forms/organizationGeneralSettings */ "./app/data/forms/organizationGeneralSettings.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












class OrganizationSettingsForm extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_3__["default"] {
  getEndpoints() {
    const {
      organization
    } = this.props;
    return [['authProvider', `/organizations/${organization.slug}/auth-provider/`]];
  }

  render() {
    const {
      initialData,
      organization,
      onSave,
      access
    } = this.props;
    const {
      authProvider
    } = this.state;
    const endpoint = `/organizations/${organization.slug}/`;
    const jsonFormSettings = {
      additionalFieldProps: {
        hasSsoEnabled: !!authProvider
      },
      features: new Set(organization.features),
      access,
      location: this.props.location,
      disabled: !access.has('org:write')
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_5__["default"], {
      "data-test-id": "organization-settings",
      apiMethod: "PUT",
      apiEndpoint: endpoint,
      saveOnBlur: true,
      allowUndo: true,
      initialData: initialData,
      onSubmitSuccess: (_resp, model) => {
        // Special case for slug, need to forward to new slug
        if (typeof onSave === 'function') {
          onSave(initialData, model.initialData);
        }
      },
      onSubmitError: () => (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addErrorMessage)('Unable to save change'),
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_6__["default"], { ...jsonFormSettings,
        forms: sentry_data_forms_organizationGeneralSettings__WEBPACK_IMPORTED_MODULE_7__["default"]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_avatarChooser__WEBPACK_IMPORTED_MODULE_4__["default"], {
        type: "organization",
        allowGravatar: false,
        endpoint: `${endpoint}avatar/`,
        model: initialData,
        onSave: sentry_actionCreators_organizations__WEBPACK_IMPORTED_MODULE_2__.updateOrganization,
        disabled: !access.has('org:write')
      })]
    });
  }

}

OrganizationSettingsForm.displayName = "OrganizationSettingsForm";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_8__["default"])(OrganizationSettingsForm));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_organizationGeneralSettings_index_tsx.fc2463cc641fb1bfa652c0915d31d89d.js.map