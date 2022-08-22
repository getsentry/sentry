"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_projectSecurityAndPrivacy_index_tsx"],{

/***/ "./app/data/forms/projectSecurityAndPrivacyGroups.tsx":
/*!************************************************************!*\
  !*** ./app/data/forms/projectSecurityAndPrivacyGroups.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "route": () => (/* binding */ route)
/* harmony export */ });
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_crashReports__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/crashReports */ "./app/utils/crashReports.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



 // Export route to make these forms searchable by label/help


const route = '/settings/:orgId/projects/:projectId/security-and-privacy/';
const ORG_DISABLED_REASON = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)("This option is enforced by your organization's settings and cannot be customized per-project."); // Check if a field has been set AND IS TRUTHY at the organization level.

const hasOrgOverride = _ref => {
  let {
    organization,
    name
  } = _ref;
  return organization[name];
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ([{
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Security & Privacy'),
  fields: [{
    name: 'storeCrashReports',
    type: 'select',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Store Native Crash Reports'),
    help: _ref2 => {
      let {
        organization
      } = _ref2;
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.tct)('Store native crash reports such as Minidumps for improved processing and download in issue details. Overrides [organizationSettingsLink: organization settings].', {
        organizationSettingsLink: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_0__["default"], {
          to: `/settings/${organization.slug}/security-and-privacy/`
        })
      });
    },
    visible: _ref3 => {
      let {
        features
      } = _ref3;
      return features.has('event-attachments');
    },
    placeholder: _ref4 => {
      let {
        organization,
        value
      } = _ref4;

      // empty value means that this project should inherit organization settings
      if (value === '') {
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.tct)('Inherit organization settings ([organizationValue])', {
          organizationValue: (0,sentry_utils_crashReports__WEBPACK_IMPORTED_MODULE_3__.formatStoreCrashReports)(organization.storeCrashReports)
        });
      } // HACK: some organization can have limit of stored crash reports a number that's not in the options (legacy reasons),
      // we therefore display it in a placeholder


      return (0,sentry_utils_crashReports__WEBPACK_IMPORTED_MODULE_3__.formatStoreCrashReports)(value);
    },
    choices: _ref5 => {
      let {
        organization
      } = _ref5;
      return (0,sentry_utils_crashReports__WEBPACK_IMPORTED_MODULE_3__.getStoreCrashReportsValues)(sentry_utils_crashReports__WEBPACK_IMPORTED_MODULE_3__.SettingScope.Project).map(value => [value, (0,sentry_utils_crashReports__WEBPACK_IMPORTED_MODULE_3__.formatStoreCrashReports)(value, organization.storeCrashReports)]);
    }
  }]
}, {
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Data Scrubbing'),
  fields: [{
    name: 'dataScrubber',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Data Scrubber'),
    disabled: hasOrgOverride,
    disabledReason: ORG_DISABLED_REASON,
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Enable server-side data scrubbing'),
    // `props` are the props given to FormField
    setValue: (val, props) => props.organization && props.organization[props.name] || val,
    confirm: {
      false: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Are you sure you want to disable server-side data scrubbing?')
    }
  }, {
    name: 'dataScrubberDefaults',
    type: 'boolean',
    disabled: hasOrgOverride,
    disabledReason: ORG_DISABLED_REASON,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Use Default Scrubbers'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Apply default scrubbers to prevent things like passwords and credit cards from being stored'),
    // `props` are the props given to FormField
    setValue: (val, props) => props.organization && props.organization[props.name] || val,
    confirm: {
      false: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Are you sure you want to disable using default scrubbers?')
    }
  }, {
    name: 'scrubIPAddresses',
    type: 'boolean',
    disabled: hasOrgOverride,
    disabledReason: ORG_DISABLED_REASON,
    // `props` are the props given to FormField
    setValue: (val, props) => props.organization && props.organization[props.name] || val,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Prevent Storing of IP Addresses'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Preventing IP addresses from being stored for new events'),
    confirm: {
      false: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Are you sure you want to disable scrubbing IP addresses?')
    }
  }, {
    name: 'sensitiveFields',
    type: 'string',
    multiline: true,
    autosize: true,
    maxRows: 10,
    rows: 1,
    placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('email'),
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Additional Sensitive Fields'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Additional field names to match against when scrubbing data. Separate multiple entries with a newline'),
    getValue: val => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.extractMultilineFields)(val),
    setValue: val => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.convertMultilineFieldValue)(val)
  }, {
    name: 'safeFields',
    type: 'string',
    multiline: true,
    autosize: true,
    maxRows: 10,
    rows: 1,
    placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('business-email'),
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Safe Fields'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Field names which data scrubbers should ignore. Separate multiple entries with a newline'),
    getValue: val => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.extractMultilineFields)(val),
    setValue: val => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.convertMultilineFieldValue)(val)
  }]
}]);

/***/ }),

/***/ "./app/views/settings/projectSecurityAndPrivacy/index.tsx":
/*!****************************************************************!*\
  !*** ./app/views/settings/projectSecurityAndPrivacy/index.tsx ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actions/projectActions */ "./app/actions/projectActions.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/jsonForm */ "./app/components/forms/jsonForm.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_data_forms_projectSecurityAndPrivacyGroups__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/data/forms/projectSecurityAndPrivacyGroups */ "./app/data/forms/projectSecurityAndPrivacyGroups.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var _components_dataScrubbing__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ../components/dataScrubbing */ "./app/views/settings/components/dataScrubbing/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
















class ProjectSecurityAndPrivacy extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleUpdateProject", data => {
      // This will update our project global state
      sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_4__["default"].updateSuccess(data);
    });
  }

  render() {
    const {
      organization,
      project
    } = this.props;
    const initialData = project;
    const projectSlug = project.slug;
    const endpoint = `/projects/${organization.slug}/${projectSlug}/`;
    const access = new Set(organization.access);
    const features = new Set(organization.features);
    const relayPiiConfig = project.relayPiiConfig;
    const apiMethod = 'PUT';
    const title = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Security & Privacy');
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_8__["default"], {
        title: title,
        projectSlug: projectSlug
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_11__["default"], {
        title: title
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_5__["default"], {
        saveOnBlur: true,
        allowUndo: true,
        initialData: initialData,
        apiMethod: apiMethod,
        apiEndpoint: endpoint,
        onSubmitSuccess: this.handleUpdateProject,
        onSubmitError: () => (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)('Unable to save change'),
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_6__["default"], {
          additionalFieldProps: {
            organization
          },
          features: features,
          disabled: !access.has('project:write'),
          forms: sentry_data_forms_projectSecurityAndPrivacyGroups__WEBPACK_IMPORTED_MODULE_9__["default"]
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(_components_dataScrubbing__WEBPACK_IMPORTED_MODULE_12__["default"], {
        additionalContext: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("span", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.tct)('These rules can be configured at the organization level in [linkToOrganizationSecurityAndPrivacy].', {
            linkToOrganizationSecurityAndPrivacy: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__["default"], {
              to: `/settings/${organization.slug}/security-and-privacy/`,
              children: title
            })
          })
        }),
        endpoint: endpoint,
        relayPiiConfig: relayPiiConfig,
        disabled: !access.has('project:write'),
        organization: organization,
        projectId: project.id,
        onSubmitSuccess: this.handleUpdateProject
      })]
    });
  }

}

ProjectSecurityAndPrivacy.displayName = "ProjectSecurityAndPrivacy";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectSecurityAndPrivacy);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_projectSecurityAndPrivacy_index_tsx.47700845b1f75bdcfd3e3e70ac4edeec.js.map