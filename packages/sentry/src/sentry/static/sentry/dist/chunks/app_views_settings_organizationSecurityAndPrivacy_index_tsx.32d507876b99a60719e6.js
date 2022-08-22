"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_organizationSecurityAndPrivacy_index_tsx"],{

/***/ "./app/data/forms/organizationSecurityAndPrivacyGroups.tsx":
/*!*****************************************************************!*\
  !*** ./app/data/forms/organizationSecurityAndPrivacyGroups.tsx ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "route": () => (/* binding */ route)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_crashReports__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/crashReports */ "./app/utils/crashReports.tsx");


 // Export route to make these forms searchable by label/help

const route = '/settings/:orgId/security-and-privacy/';
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ([{
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Security & Privacy'),
  fields: [{
    name: 'require2FA',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Require Two-Factor Authentication'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Require and enforce two-factor authentication for all members'),
    confirm: {
      true: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('This will remove all members without two-factor authentication' + ' from your organization. It will also send them an email to setup 2FA' + ' and reinstate their access and settings. Do you want to continue?'),
      false: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Are you sure you want to allow users to access your organization without having two-factor authentication enabled?')
    }
  }, {
    name: 'requireEmailVerification',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Require Email Verification'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Require and enforce email address verification for all members'),
    visible: _ref => {
      let {
        features
      } = _ref;
      return features.has('required-email-verification');
    },
    confirm: {
      true: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('This will remove all members whose email addresses are not verified' + ' from your organization. It will also send them an email to verify their address' + ' and reinstate their access and settings. Do you want to continue?'),
      false: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Are you sure you want to allow users to access your organization without verifying their email address?')
    }
  }, {
    name: 'allowSharedIssues',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Allow Shared Issues'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Enable sharing of limited details on issues to anonymous users'),
    confirm: {
      true: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Are you sure you want to allow sharing issues to anonymous users?')
    }
  }, {
    name: 'enhancedPrivacy',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Enhanced Privacy'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Enable enhanced privacy controls to limit personally identifiable information (PII) as well as source code in things like notifications'),
    confirm: {
      false: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Disabling this can have privacy implications for ALL projects, are you sure you want to continue?')
    }
  }, {
    name: 'scrapeJavaScript',
    type: 'boolean',
    confirm: {
      false: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)("Are you sure you want to disable sourcecode fetching for JavaScript events? This will affect Sentry's ability to aggregate issues if you're not already uploading sourcemaps as artifacts.")
    },
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Allow JavaScript Source Fetching'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Allow Sentry to scrape missing JavaScript source context when possible')
  }, {
    name: 'storeCrashReports',
    type: 'select',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Store Native Crash Reports'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Store native crash reports such as Minidumps for improved processing and download in issue details'),
    visible: _ref2 => {
      let {
        features
      } = _ref2;
      return features.has('event-attachments');
    },
    // HACK: some organization can have limit of stored crash reports a number that's not in the options (legacy reasons),
    // we therefore display it in a placeholder
    placeholder: _ref3 => {
      let {
        value
      } = _ref3;
      return (0,sentry_utils_crashReports__WEBPACK_IMPORTED_MODULE_2__.formatStoreCrashReports)(value);
    },
    choices: () => (0,sentry_utils_crashReports__WEBPACK_IMPORTED_MODULE_2__.getStoreCrashReportsValues)(sentry_utils_crashReports__WEBPACK_IMPORTED_MODULE_2__.SettingScope.Organization).map(value => [value, (0,sentry_utils_crashReports__WEBPACK_IMPORTED_MODULE_2__.formatStoreCrashReports)(value)])
  }, {
    name: 'allowJoinRequests',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Allow Join Requests'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Allow users to request to join your organization'),
    confirm: {
      true: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Are you sure you want to allow users to request to join your organization?')
    },
    visible: _ref4 => {
      let {
        hasSsoEnabled
      } = _ref4;
      return !hasSsoEnabled;
    }
  }]
}, {
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Data Scrubbing'),
  fields: [{
    name: 'dataScrubber',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Require Data Scrubber'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Require server-side data scrubbing be enabled for all projects'),
    confirm: {
      false: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Disabling this can have privacy implications for ALL projects, are you sure you want to continue?')
    }
  }, {
    name: 'dataScrubberDefaults',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Require Using Default Scrubbers'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Require the default scrubbers be applied to prevent things like passwords and credit cards from being stored for all projects'),
    confirm: {
      false: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Disabling this can have privacy implications for ALL projects, are you sure you want to continue?')
    }
  }, {
    name: 'sensitiveFields',
    type: 'string',
    multiline: true,
    autosize: true,
    maxRows: 10,
    rows: 1,
    placeholder: 'e.g. email',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Global Sensitive Fields'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Additional field names to match against when scrubbing data for all projects. Separate multiple entries with a newline.'),
    extraHelp: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Note: These fields will be used in addition to project specific fields.'),
    getValue: val => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.extractMultilineFields)(val),
    setValue: val => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.convertMultilineFieldValue)(val)
  }, {
    name: 'safeFields',
    type: 'string',
    multiline: true,
    autosize: true,
    maxRows: 10,
    rows: 1,
    placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('e.g. business-email'),
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Global Safe Fields'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Field names which data scrubbers should ignore. Separate multiple entries with a newline.'),
    extraHelp: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Note: These fields will be used in addition to project specific fields'),
    getValue: val => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.extractMultilineFields)(val),
    setValue: val => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.convertMultilineFieldValue)(val)
  }, {
    name: 'scrubIPAddresses',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Prevent Storing of IP Addresses'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Preventing IP addresses from being stored for new events on all projects'),
    confirm: {
      false: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Disabling this can have privacy implications for ALL projects, are you sure you want to continue?')
    }
  }]
}]);

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

/***/ "./app/views/settings/organizationSecurityAndPrivacy/index.tsx":
/*!*********************************************************************!*\
  !*** ./app/views/settings/organizationSecurityAndPrivacy/index.tsx ***!
  \*********************************************************************/
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
/* harmony import */ var sentry_actionCreators_organizations__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/organizations */ "./app/actionCreators/organizations.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/jsonForm */ "./app/components/forms/jsonForm.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_data_forms_organizationSecurityAndPrivacyGroups__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/data/forms/organizationSecurityAndPrivacyGroups */ "./app/data/forms/organizationSecurityAndPrivacyGroups.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var _components_dataScrubbing__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ../components/dataScrubbing */ "./app/views/settings/components/dataScrubbing/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");

















class OrganizationSecurityAndPrivacyContent extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_11__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleUpdateOrganization", data => {
      // This will update OrganizationStore (as well as OrganizationsStore
      // which is slightly incorrect because it has summaries vs a detailed org)
      (0,sentry_actionCreators_organizations__WEBPACK_IMPORTED_MODULE_4__.updateOrganization)(data);
    });
  }

  getEndpoints() {
    const {
      orgId
    } = this.props.params;
    return [['authProvider', `/organizations/${orgId}/auth-provider/`]];
  }

  renderBody() {
    const {
      organization
    } = this.props;
    const {
      orgId
    } = this.props.params;
    const initialData = organization;
    const endpoint = `/organizations/${orgId}/`;
    const access = new Set(organization.access);
    const features = new Set(organization.features);
    const relayPiiConfig = organization.relayPiiConfig;
    const {
      authProvider
    } = this.state;
    const title = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Security & Privacy');
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_7__["default"], {
        title: title,
        orgSlug: organization.slug
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_12__["default"], {
        title: title
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_5__["default"], {
        "data-test-id": "organization-settings-security-and-privacy",
        apiMethod: "PUT",
        apiEndpoint: endpoint,
        initialData: initialData,
        additionalFieldProps: {
          hasSsoEnabled: !!authProvider
        },
        onSubmitSuccess: this.handleUpdateOrganization,
        onSubmitError: () => (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Unable to save change')),
        saveOnBlur: true,
        allowUndo: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_6__["default"], {
          features: features,
          forms: sentry_data_forms_organizationSecurityAndPrivacyGroups__WEBPACK_IMPORTED_MODULE_8__["default"],
          disabled: !access.has('org:write')
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(_components_dataScrubbing__WEBPACK_IMPORTED_MODULE_13__["default"], {
        additionalContext: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('These rules can be configured for each project.'),
        endpoint: endpoint,
        relayPiiConfig: relayPiiConfig,
        disabled: !access.has('org:write'),
        organization: organization,
        onSubmitSuccess: this.handleUpdateOrganization
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_10__["default"])(OrganizationSecurityAndPrivacyContent));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_organizationSecurityAndPrivacy_index_tsx.ff401d4acfb59d1ee41092a3f3866d99.js.map