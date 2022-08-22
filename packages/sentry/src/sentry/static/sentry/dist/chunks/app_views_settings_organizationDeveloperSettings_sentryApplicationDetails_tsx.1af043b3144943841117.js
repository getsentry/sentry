(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_organizationDeveloperSettings_sentryApplicationDetails_tsx"],{

/***/ "./app/actionCreators/sentryAppTokens.tsx":
/*!************************************************!*\
  !*** ./app/actionCreators/sentryAppTokens.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "addSentryAppToken": () => (/* binding */ addSentryAppToken),
/* harmony export */   "removeSentryAppToken": () => (/* binding */ removeSentryAppToken)
/* harmony export */ });
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");



/**
 * Install a sentry application
 *
 * @param {Object} client ApiClient
 * @param {Object} app SentryApp
 */
async function addSentryAppToken(client, app) {
  (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addLoadingMessage)();

  try {
    const token = await client.requestPromise(`/sentry-apps/${app.slug}/api-tokens/`, {
      method: 'POST'
    });
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Token successfully added.'));
    return token;
  } catch (err) {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Unable to create token'));
    throw err;
  }
}
/**
 * Uninstall a sentry application
 *
 * @param {Object} client ApiClient
 * @param {Object} app SentryApp
 * @param {String} token Token string
 */

async function removeSentryAppToken(client, app, token) {
  (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addLoadingMessage)();

  try {
    await client.requestPromise(`/sentry-apps/${app.slug}/api-tokens/${token}/`, {
      method: 'DELETE'
    });
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Token successfully deleted.'));
    return;
  } catch (err) {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Unable to delete token'));
    throw err;
  }
}

/***/ }),

/***/ "./app/data/forms/sentryApplication.tsx":
/*!**********************************************!*\
  !*** ./app/data/forms/sentryApplication.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "internalIntegrationForms": () => (/* binding */ internalIntegrationForms),
/* harmony export */   "publicIntegrationForms": () => (/* binding */ publicIntegrationForms)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






const getPublicFormFields = () => [{
  name: 'name',
  type: 'string',
  required: true,
  placeholder: 'e.g. My Integration',
  label: 'Name',
  help: 'Human readable name of your Integration.'
}, {
  name: 'author',
  type: 'string',
  required: true,
  placeholder: 'e.g. Acme Software',
  label: 'Author',
  help: 'The company or person who built and maintains this Integration.'
}, {
  name: 'webhookUrl',
  type: 'string',
  required: true,
  label: 'Webhook URL',
  placeholder: 'e.g. https://example.com/sentry/webhook/',
  help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.tct)('All webhook requests for your integration will be sent to this URL. Visit the [webhook_docs:documentation] to see the different types and payloads.', {
    webhook_docs: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_1__["default"], {
      href: "https://docs.sentry.io/product/integrations/integration-platform/webhooks/"
    })
  })
}, {
  name: 'redirectUrl',
  type: 'string',
  label: 'Redirect URL',
  placeholder: 'e.g. https://example.com/sentry/setup/',
  help: 'The URL Sentry will redirect users to after installation.'
}, {
  name: 'verifyInstall',
  label: 'Verify Installation',
  type: 'boolean',
  help: 'If enabled, installations will need to be verified before becoming installed.'
}, {
  name: 'isAlertable',
  type: 'boolean',
  label: 'Alert Rule Action',
  disabled: _ref => {
    let {
      webhookDisabled
    } = _ref;
    return webhookDisabled;
  },
  disabledReason: 'Cannot enable alert rule action without a webhook url',
  help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.tct)('If enabled, this integration will be available in Issue Alert rules and Metric Alert rules in Sentry. The notification destination is the Webhook URL specified above. More on actions [learn_more:here].', {
    learn_more: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_1__["default"], {
      href: "https://docs.sentry.io/product/alerts-notifications/notifications/"
    })
  })
}, {
  name: 'schema',
  type: 'textarea',
  label: 'Schema',
  autosize: true,
  rows: 1,
  help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.tct)('Schema for your UI components. Click [schema_docs:here] for documentation.', {
    schema_docs: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_1__["default"], {
      href: "https://docs.sentry.io/product/integrations/integration-platform/ui-components/"
    })
  }),
  getValue: val => val === '' ? {} : JSON.parse(val),
  setValue: val => {
    const schema = JSON.stringify(val, null, 2);

    if (schema === '{}') {
      return '';
    }

    return schema;
  },
  validate: _ref2 => {
    let {
      id,
      form
    } = _ref2;

    if (!form.schema) {
      return [];
    }

    try {
      JSON.parse(form.schema);
    } catch (e) {
      return [[id, 'Invalid JSON']];
    }

    return [];
  }
}, {
  name: 'overview',
  type: 'textarea',
  label: 'Overview',
  autosize: true,
  rows: 1,
  help: 'Description of your Integration and its functionality.'
}, {
  name: 'allowedOrigins',
  type: 'string',
  multiline: true,
  placeholder: 'e.g. example.com',
  label: 'Authorized JavaScript Origins',
  help: 'Separate multiple entries with a newline.',
  getValue: val => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_3__.extractMultilineFields)(val),
  setValue: val => val && typeof val.join === 'function' && val.join('\n') || ''
}];

const publicIntegrationForms = [{
  title: 'Public Integration Details',
  fields: getPublicFormFields()
}];

const getInternalFormFields = () => {
  // Generate internal form fields copy copying the public form fields and
  // making adjustments:
  //
  //   1. remove fields not needed for internal integrations
  //   2. make webhookUrl optional
  const internalFormFields = getPublicFormFields().filter(formField => !['redirectUrl', 'verifyInstall', 'author'].includes(formField.name || ''));
  const webhookField = internalFormFields.find(field => field.name === 'webhookUrl');

  if (webhookField) {
    webhookField.required = false;
  }

  return internalFormFields;
};

const internalIntegrationForms = [{
  title: 'Internal Integration Details',
  fields: getInternalFormFields()
}];

/***/ }),

/***/ "./app/utils/consolidatedScopes.tsx":
/*!******************************************!*\
  !*** ./app/utils/consolidatedScopes.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "toPermissions": () => (/* binding */ toPermissions),
/* harmony export */   "toResourcePermissions": () => (/* binding */ toResourcePermissions)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var lodash_groupBy__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/groupBy */ "../node_modules/lodash/groupBy.js");
/* harmony import */ var lodash_groupBy__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_groupBy__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var lodash_invertBy__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/invertBy */ "../node_modules/lodash/invertBy.js");
/* harmony import */ var lodash_invertBy__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_invertBy__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_4__);





const PERMISSION_LEVELS = {
  read: 0,
  write: 1,
  admin: 2
};
const HUMAN_RESOURCE_NAMES = {
  project: 'Project',
  team: 'Team',
  release: 'Release',
  event: 'Event',
  org: 'Organization',
  member: 'Member'
};
const DEFAULT_RESOURCE_PERMISSIONS = {
  Project: 'no-access',
  Team: 'no-access',
  Release: 'no-access',
  Event: 'no-access',
  Organization: 'no-access',
  Member: 'no-access'
};
const PROJECT_RELEASES = 'project:releases';

/**
 * Numerical value of the scope where Admin is higher than Write,
 * which is higher than Read. Used to sort scopes by access.
 */
const permissionLevel = scope => {
  const permission = scope.split(':')[1];
  return PERMISSION_LEVELS[permission];
};

const compareScopes = (a, b) => permissionLevel(a) - permissionLevel(b);
/**
 * Return the most permissive scope for each resource.
 *
 * Example:
 *    Given the full list of scopes:
 *      ['project:read', 'project:write', 'team:read', 'team:write', 'team:admin']
 *
 *    this would return:
 *      ['project:write', 'team:admin']
 */


function topScopes(scopeList) {
  return Object.values(lodash_groupBy__WEBPACK_IMPORTED_MODULE_2___default()(scopeList, scope => scope.split(':')[0])).map(scopes => scopes.sort(compareScopes)).map(scopes => scopes.pop());
}
/**
 * Convert into a list of Permissions, grouped by resource.
 *
 * This is used in the new/edit Sentry App form. That page displays permissions
 * in a per-Resource manner, meaning one row for Project, one for Organization, etc.
 *
 * This exposes scopes in a way that works for that UI.
 *
 * Example:
 *    {
 *      'Project': 'read',
 *      'Organization': 'write',
 *      'Team': 'no-access',
 *      ...
 *    }
 */


function toResourcePermissions(scopes) {
  const permissions = { ...DEFAULT_RESOURCE_PERMISSIONS
  };
  let filteredScopes = [...scopes]; // The scope for releases is `project:releases`, but instead of displaying
  // it as a permission of Project, we want to separate it out into its own
  // row for Releases.

  if (scopes.includes(PROJECT_RELEASES)) {
    permissions.Release = 'admin';
    filteredScopes = scopes.filter(scope => scope !== PROJECT_RELEASES); // remove project:releases
  }

  topScopes(filteredScopes).forEach(scope => {
    if (scope) {
      const [resource, permission] = scope.split(':');
      permissions[HUMAN_RESOURCE_NAMES[resource]] = permission;
    }
  });
  return permissions;
}
/**
 * Convert into a list of Permissions, grouped by access and including a
 * list of resources per access level.
 *
 * This is used in the Permissions Modal when installing an App. It displays
 * scopes in a per-Permission way, meaning one row for Read, one for Write,
 * and one for Admin.
 *
 * This exposes scopes in a way that works for that UI.
 *
 * Example:
 *    {
 *      read:  ['Project', 'Organization'],
 *      write: ['Member'],
 *      admin: ['Release']
 *    }
 */


function toPermissions(scopes) {
  const defaultPermissions = {
    read: [],
    write: [],
    admin: []
  };
  const resourcePermissions = toResourcePermissions(scopes); // Filter out the 'no-access' permissions

  const permissions = lodash_pick__WEBPACK_IMPORTED_MODULE_4___default()(lodash_invertBy__WEBPACK_IMPORTED_MODULE_3___default()(resourcePermissions), ['read', 'write', 'admin']);
  return { ...defaultPermissions,
    ...permissions
  };
}



/***/ }),

/***/ "./app/views/asyncView.tsx":
/*!*********************************!*\
  !*** ./app/views/asyncView.tsx ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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

/***/ "./app/views/settings/organizationDeveloperSettings/permissionSelection.tsx":
/*!**********************************************************************************!*\
  !*** ./app/views/settings/organizationDeveloperSettings/permissionSelection.tsx ***!
  \**********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ PermissionSelection)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_find__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/find */ "../node_modules/lodash/find.js");
/* harmony import */ var lodash_find__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_find__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var lodash_flatMap__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/flatMap */ "../node_modules/lodash/flatMap.js");
/* harmony import */ var lodash_flatMap__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_flatMap__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_forms_formContext__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/formContext */ "./app/components/forms/formContext.tsx");
/* harmony import */ var sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/selectField */ "./app/components/forms/selectField.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











function findResource(r) {
  return lodash_find__WEBPACK_IMPORTED_MODULE_3___default()(sentry_constants__WEBPACK_IMPORTED_MODULE_7__.SENTRY_APP_PERMISSIONS, ['resource', r]);
}

class PermissionSelection extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      permissions: this.props.permissions
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onChange", (resource, choice) => {
      const {
        permissions
      } = this.state;
      permissions[resource] = choice;
      this.save(permissions);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "save", permissions => {
      this.setState({
        permissions
      });
      this.props.onChange(permissions);
      this.context.form.setValue('scopes', this.permissionStateToList());
    });
  }

  /**
   * Converts the "Permission" values held in `state` to a list of raw
   * API scopes we can send to the server. For example:
   *
   *    ['org:read', 'org:write', ...]
   *
   */
  permissionStateToList() {
    const {
      permissions
    } = this.state;
    return lodash_flatMap__WEBPACK_IMPORTED_MODULE_4___default()(Object.entries(permissions), _ref => {
      var _findResource, _findResource$choices, _findResource$choices2;

      let [r, p] = _ref;
      return (_findResource = findResource(r)) === null || _findResource === void 0 ? void 0 : (_findResource$choices = _findResource.choices) === null || _findResource$choices === void 0 ? void 0 : (_findResource$choices2 = _findResource$choices[p]) === null || _findResource$choices2 === void 0 ? void 0 : _findResource$choices2.scopes;
    });
  }

  render() {
    const {
      permissions
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: sentry_constants__WEBPACK_IMPORTED_MODULE_7__.SENTRY_APP_PERMISSIONS.map(config => {
        const options = Object.entries(config.choices).map(_ref2 => {
          let [value, {
            label
          }] = _ref2;
          return {
            value,
            label
          };
        });
        const value = permissions[config.resource];
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_6__["default"] // These are not real fields we want submitted, so we use
        // `--permission` as a suffix here, then filter these
        // fields out when submitting the form in
        // sentryApplicationDetails.jsx
        , {
          name: `${config.resource}--permission`,
          options: options,
          help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)(config.help),
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)(config.label || config.resource),
          onChange: this.onChange.bind(this, config.resource),
          value: value,
          defaultValue: value,
          disabled: this.props.appPublished,
          disabledReason: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Cannot update permissions on a published integration')
        }, config.resource);
      })
    });
  }

}
PermissionSelection.displayName = "PermissionSelection";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(PermissionSelection, "contextType", sentry_components_forms_formContext__WEBPACK_IMPORTED_MODULE_5__["default"]);

/***/ }),

/***/ "./app/views/settings/organizationDeveloperSettings/permissionsObserver.tsx":
/*!**********************************************************************************!*\
  !*** ./app/views/settings/organizationDeveloperSettings/permissionsObserver.tsx ***!
  \**********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ PermissionsObserver)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_consolidatedScopes__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/consolidatedScopes */ "./app/utils/consolidatedScopes.tsx");
/* harmony import */ var sentry_views_settings_organizationDeveloperSettings_permissionSelection__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/settings/organizationDeveloperSettings/permissionSelection */ "./app/views/settings/organizationDeveloperSettings/permissionSelection.tsx");
/* harmony import */ var sentry_views_settings_organizationDeveloperSettings_resourceSubscriptions__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/views/settings/organizationDeveloperSettings/resourceSubscriptions */ "./app/views/settings/organizationDeveloperSettings/resourceSubscriptions.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









class PermissionsObserver extends react__WEBPACK_IMPORTED_MODULE_1__.Component {
  constructor(props) {
    super(props);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onPermissionChange", permissions => {
      this.setState({
        permissions
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onEventChange", events => {
      this.setState({
        events
      });
    });

    this.state = {
      permissions: this.scopeListToPermissionState(),
      events: this.props.events
    };
  }
  /**
   * Converts the list of raw API scopes passed in to an object that can
   * before stored and used via `state`. This object is structured by
   * resource and holds "Permission" values. For example:
   *
   *    {
   *      'Project': 'read',
   *      ...,
   *    }
   *
   */


  scopeListToPermissionState() {
    return (0,sentry_utils_consolidatedScopes__WEBPACK_IMPORTED_MODULE_4__.toResourcePermissions)(this.props.scopes);
  }

  render() {
    const {
      permissions,
      events
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.PanelHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Permissions')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.PanelBody, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_views_settings_organizationDeveloperSettings_permissionSelection__WEBPACK_IMPORTED_MODULE_5__["default"], {
            permissions: permissions,
            onChange: this.onPermissionChange,
            appPublished: this.props.appPublished
          })
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.PanelHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Webhooks')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.PanelBody, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_views_settings_organizationDeveloperSettings_resourceSubscriptions__WEBPACK_IMPORTED_MODULE_6__["default"], {
            permissions: permissions,
            events: events,
            onChange: this.onEventChange,
            webhookDisabled: this.props.webhookDisabled
          })
        })]
      })]
    });
  }

}
PermissionsObserver.displayName = "PermissionsObserver";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(PermissionsObserver, "defaultProps", {
  webhookDisabled: false,
  appPublished: false
});

/***/ }),

/***/ "./app/views/settings/organizationDeveloperSettings/resourceSubscriptions.tsx":
/*!************************************************************************************!*\
  !*** ./app/views/settings/organizationDeveloperSettings/resourceSubscriptions.tsx ***!
  \************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Subscriptions)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_forms_formContext__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/formContext */ "./app/components/forms/formContext.tsx");
/* harmony import */ var sentry_views_settings_organizationDeveloperSettings_constants__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/views/settings/organizationDeveloperSettings/constants */ "./app/views/settings/organizationDeveloperSettings/constants.tsx");
/* harmony import */ var sentry_views_settings_organizationDeveloperSettings_subscriptionBox__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/views/settings/organizationDeveloperSettings/subscriptionBox */ "./app/views/settings/organizationDeveloperSettings/subscriptionBox.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









class Subscriptions extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor(props, context) {
    super(props, context);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onChange", (resource, checked) => {
      const events = new Set(this.props.events);
      checked ? events.add(resource) : events.delete(resource);
      this.save(Array.from(events));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "save", events => {
      this.props.onChange(events);
      this.context.form.setValue('events', events);
    });

    this.context.form.setValue('events', this.props.events);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    // if webhooks are disabled, unset the events
    if (nextProps.webhookDisabled && this.props.events.length) {
      this.save([]);
    }
  }

  componentDidUpdate() {
    const {
      permissions,
      events
    } = this.props;
    const permittedEvents = events.filter(resource => permissions[sentry_views_settings_organizationDeveloperSettings_constants__WEBPACK_IMPORTED_MODULE_6__.PERMISSIONS_MAP[resource]] !== 'no-access');

    if (JSON.stringify(events) !== JSON.stringify(permittedEvents)) {
      this.save(permittedEvents);
    }
  }

  render() {
    const {
      permissions,
      webhookDisabled,
      events
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(SubscriptionGrid, {
      children: sentry_views_settings_organizationDeveloperSettings_constants__WEBPACK_IMPORTED_MODULE_6__.EVENT_CHOICES.map(choice => {
        const disabledFromPermissions = permissions[sentry_views_settings_organizationDeveloperSettings_constants__WEBPACK_IMPORTED_MODULE_6__.PERMISSIONS_MAP[choice]] === 'no-access';
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_views_settings_organizationDeveloperSettings_subscriptionBox__WEBPACK_IMPORTED_MODULE_7__["default"], {
            disabledFromPermissions: disabledFromPermissions,
            webhookDisabled: webhookDisabled,
            checked: events.includes(choice) && !disabledFromPermissions,
            resource: choice,
            onChange: this.onChange,
            isNew: choice === 'comment'
          }, choice)
        }, choice);
      })
    });
  }

}
Subscriptions.displayName = "Subscriptions";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(Subscriptions, "defaultProps", {
  webhookDisabled: false
});

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(Subscriptions, "contextType", sentry_components_forms_formContext__WEBPACK_IMPORTED_MODULE_5__["default"]);

const SubscriptionGrid = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e3puty70"
} : 0)("display:grid;grid-template:auto/1fr 1fr 1fr;@media (max-width: ", props => props.theme.breakpoints.large, "){grid-template:1fr 1fr 1fr/auto;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/organizationDeveloperSettings/sentryApplicationDetails.tsx":
/*!***************************************************************************************!*\
  !*** ./app/views/settings/organizationDeveloperSettings/sentryApplicationDetails.tsx ***!
  \***************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ SentryApplicationDetails)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var core_js_modules_web_url_to_json_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! core-js/modules/web.url.to-json.js */ "../node_modules/core-js/modules/web.url.to-json.js");
/* harmony import */ var core_js_modules_web_url_to_json_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_url_to_json_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var mobx_react__WEBPACK_IMPORTED_MODULE_34__ = __webpack_require__(/*! mobx-react */ "../node_modules/mobx-react-lite/es/index.js");
/* harmony import */ var scroll_to_element__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! scroll-to-element */ "../node_modules/scroll-to-element/index.js");
/* harmony import */ var scroll_to_element__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(scroll_to_element__WEBPACK_IMPORTED_MODULE_8__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_sentryAppTokens__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/actionCreators/sentryAppTokens */ "./app/actionCreators/sentryAppTokens.tsx");
/* harmony import */ var sentry_components_avatar__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/avatar */ "./app/components/avatar/index.tsx");
/* harmony import */ var sentry_components_avatarChooser__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/avatarChooser */ "./app/components/avatarChooser.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/forms/formField */ "./app/components/forms/formField/index.tsx");
/* harmony import */ var sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/forms/jsonForm */ "./app/components/forms/jsonForm.tsx");
/* harmony import */ var sentry_components_forms_model__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/components/forms/model */ "./app/components/forms/model.tsx");
/* harmony import */ var sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/components/forms/textCopyInput */ "./app/components/forms/textCopyInput.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_data_forms_sentryApplication__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/data/forms/sentryApplication */ "./app/data/forms/sentryApplication.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_organizationDeveloperSettings_permissionsObserver__WEBPACK_IMPORTED_MODULE_32__ = __webpack_require__(/*! sentry/views/settings/organizationDeveloperSettings/permissionsObserver */ "./app/views/settings/organizationDeveloperSettings/permissionsObserver.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }
































const AVATAR_STYLES = {
  color: {
    size: 50,
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_26__.t)('Default Logo'),
    previewText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_26__.t)('The default icon for integrations'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_26__.t)('Image must be between 256px by 256px and 1024px by 1024px.')
  },
  simple: {
    size: 20,
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_26__.t)('Default Icon'),
    previewText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_26__.tct)('This is a silhouette icon used only for [uiDocs:UI Components]', {
      uiDocs: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_20__["default"], {
        href: "https://docs.sentry.io/product/integrations/integration-platform/ui-components/"
      })
    }),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_26__.t)('Image must be between 256px by 256px and 1024px by 1024px, and may only use black and transparent pixels.')
  }
};
/**
 * Finds the resource in SENTRY_APP_PERMISSIONS that contains a given scope
 * We should always find a match unless there is a bug
 * @param {Scope} scope
 * @return {Resource | undefined}
 */

const getResourceFromScope = scope => {
  for (const permObj of sentry_constants__WEBPACK_IMPORTED_MODULE_23__.SENTRY_APP_PERMISSIONS) {
    const allChoices = Object.values(permObj.choices);
    const allScopes = allChoices.reduce((_allScopes, choice) => {
      var _choice$scopes;

      return _allScopes.concat((_choice$scopes = choice === null || choice === void 0 ? void 0 : choice.scopes) !== null && _choice$scopes !== void 0 ? _choice$scopes : []);
    }, []);

    if (allScopes.includes(scope)) {
      return permObj.resource;
    }
  }

  return undefined;
};

class SentryAppFormModel extends sentry_components_forms_model__WEBPACK_IMPORTED_MODULE_18__["default"] {
  /**
   * Filter out Permission input field values.
   *
   * Permissions (API Scopes) are presented as a list of SelectFields.
   * Instead of them being submitted individually, we want them rolled
   * up into a single list of scopes (this is done in `PermissionSelection`).
   *
   * Because they are all individual inputs, we end up with attributes
   * in the JSON we send to the API that we don't want.
   *
   * This function filters those attributes out of the data that is
   * ultimately sent to the API.
   */
  getData() {
    return this.fields.toJSON().reduce((data, _ref) => {
      let [k, v] = _ref;

      if (!k.endsWith('--permission')) {
        data[k] = v;
      }

      return data;
    }, {});
  }
  /**
   * We need to map the API response errors to the actual form fields.
   * We do this by pulling out scopes and mapping each scope error to the correct input.
   * @param {Object} responseJSON
   */


  mapFormErrors(responseJSON) {
    if (!responseJSON) {
      return responseJSON;
    }

    const formErrors = lodash_omit__WEBPACK_IMPORTED_MODULE_7___default()(responseJSON, ['scopes']);

    if (responseJSON.scopes) {
      responseJSON.scopes.forEach(message => {
        // find the scope from the error message of a specific format
        const matches = message.match(/Requested permission of (\w+:\w+)/);

        if (matches) {
          const scope = matches[1];
          const resource = getResourceFromScope(scope); // should always match but technically resource can be undefined

          if (resource) {
            formErrors[`${resource}--permission`] = [message];
          }
        }
      });
    }

    return formErrors;
  }

}

class SentryApplicationDetails extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_29__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "form", new SentryAppFormModel());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmitSuccess", data => {
      const {
        app
      } = this.state;
      const {
        orgId
      } = this.props.params;
      const type = this.isInternal ? 'internal' : 'public';
      const baseUrl = `/settings/${orgId}/developer-settings/`;
      const url = app ? `${baseUrl}?type=${type}` : `${baseUrl}${data.slug}/`;

      if (app) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_9__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_26__.t)('%s successfully saved.', data.name));
      } else {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_9__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_26__.t)('%s successfully created.', data.name));
      }

      react_router__WEBPACK_IMPORTED_MODULE_6__.browserHistory.push(url);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmitError", err => {
      let errorMessage = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_26__.t)('Unknown Error');

      if (err.status >= 400 && err.status < 500) {
        var _err$responseJSON$det;

        errorMessage = (_err$responseJSON$det = err === null || err === void 0 ? void 0 : err.responseJSON.detail) !== null && _err$responseJSON$det !== void 0 ? _err$responseJSON$det : errorMessage;
      }

      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_9__.addErrorMessage)(errorMessage);

      if (this.form.formErrors) {
        const firstErrorFieldId = Object.keys(this.form.formErrors)[0];

        if (firstErrorFieldId) {
          scroll_to_element__WEBPACK_IMPORTED_MODULE_8___default()(`#${firstErrorFieldId}`, {
            align: 'middle',
            offset: 0
          });
        }
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onAddToken", async evt => {
      evt.preventDefault();
      const {
        app,
        tokens
      } = this.state;

      if (!app) {
        return;
      }

      const api = this.api;
      const token = await (0,sentry_actionCreators_sentryAppTokens__WEBPACK_IMPORTED_MODULE_10__.addSentryAppToken)(api, app);
      const newTokens = tokens.concat(token);
      this.setState({
        tokens: newTokens
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onRemoveToken", async (token, evt) => {
      evt.preventDefault();
      const {
        app,
        tokens
      } = this.state;

      if (!app) {
        return;
      }

      const api = this.api;
      const newTokens = tokens.filter(tok => tok.token !== token.token);
      await (0,sentry_actionCreators_sentryAppTokens__WEBPACK_IMPORTED_MODULE_10__.removeSentryAppToken)(api, app, token.token);
      this.setState({
        tokens: newTokens
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderTokens", () => {
      const {
        tokens
      } = this.state;

      if (tokens.length > 0) {
        return tokens.map(token => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsxs)(StyledPanelItem, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(TokenItem, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_22__["default"], {
              disabled: this.showAuthInfo,
              position: "right",
              containerDisplayMode: "inline",
              title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_26__.t)('You do not have access to view these credentials because the permissions for this integration exceed those of your role.'),
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_19__["default"], {
                children: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_28__["default"])({
                  value: token.token,
                  fixed: 'xxxxxx'
                })
              })
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsxs)(CreatedDate, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(CreatedTitle, {
              children: "Created:"
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_14__["default"], {
              date: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_28__["default"])({
                value: token.dateCreated,
                fixed: new Date(1508208080000)
              })
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_13__["default"], {
            onClick: this.onRemoveToken.bind(this, token),
            size: "sm",
            icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_25__.IconDelete, {}),
            "data-test-id": "token-delete",
            type: "button",
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_26__.t)('Revoke')
          })]
        }, token.token));
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_30__["default"], {
        description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_26__.t)('No tokens created yet.')
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onFieldChange", (name, value) => {
      if (name === 'webhookUrl' && !value && this.isInternal) {
        // if no webhook, then set isAlertable to false
        this.form.setValue('isAlertable', false);
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "addAvatar", _ref2 => {
      let {
        avatar
      } = _ref2;
      const {
        app
      } = this.state;

      if (app && avatar) {
        var _app$avatars;

        const avatars = (app === null || app === void 0 ? void 0 : (_app$avatars = app.avatars) === null || _app$avatars === void 0 ? void 0 : _app$avatars.filter(prevAvatar => prevAvatar.color !== avatar.color)) || [];
        avatars.push(avatar);
        this.setState({
          app: { ...app,
            avatars
          }
        });
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getAvatarModel", isColor => {
      var _app$avatars2;

      const {
        app
      } = this.state;
      const defaultModel = {
        avatar: {
          avatarType: 'default',
          avatarUuid: null
        }
      };

      if (!app) {
        return defaultModel;
      }

      return {
        avatar: (app === null || app === void 0 ? void 0 : (_app$avatars2 = app.avatars) === null || _app$avatars2 === void 0 ? void 0 : _app$avatars2.find(_ref3 => {
          let {
            color
          } = _ref3;
          return color === isColor;
        })) || defaultModel.avatar
      };
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getAvatarPreview", isColor => {
      const {
        app
      } = this.state;

      if (!app) {
        return null;
      }

      const avatarStyle = isColor ? 'color' : 'simple';
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsxs)(AvatarPreview, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(StyledPreviewAvatar, {
          size: AVATAR_STYLES[avatarStyle].size,
          sentryApp: app,
          isDefault: true
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(AvatarPreviewTitle, {
          children: AVATAR_STYLES[avatarStyle].title
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(AvatarPreviewText, {
          children: AVATAR_STYLES[avatarStyle].previewText
        })]
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getAvatarChooser", isColor => {
      const {
        app
      } = this.state;

      if (!app) {
        return null;
      }

      const avatarStyle = isColor ? 'color' : 'simple';
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_avatarChooser__WEBPACK_IMPORTED_MODULE_12__["default"], {
        type: isColor ? 'sentryAppColor' : 'sentryAppSimple',
        allowGravatar: false,
        allowLetter: false,
        endpoint: `/sentry-apps/${app.slug}/avatar/`,
        model: this.getAvatarModel(isColor),
        onSave: this.addAvatar,
        title: isColor ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_26__.t)('Logo') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_26__.t)('Small Icon'),
        help: AVATAR_STYLES[avatarStyle].help.concat(this.isInternal ? '' : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_26__.t)(' Required for publishing.')),
        savedDataUrl: undefined,
        defaultChoice: {
          allowDefault: true,
          choiceText: isColor ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_26__.t)('Default logo') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_26__.t)('Default small icon'),
          preview: this.getAvatarPreview(isColor)
        }
      });
    });
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      app: null,
      tokens: []
    };
  }

  getEndpoints() {
    const {
      appSlug
    } = this.props.params;

    if (appSlug) {
      return [['app', `/sentry-apps/${appSlug}/`], ['tokens', `/sentry-apps/${appSlug}/api-tokens/`]];
    }

    return [];
  }

  getHeaderTitle() {
    const {
      app
    } = this.state;
    const action = app ? 'Edit' : 'Create';
    const type = this.isInternal ? 'Internal' : 'Public';
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_26__.tct)('[action] [type] Integration', {
      action,
      type
    });
  } // Events may come from the API as "issue.created" when we just want "issue" here.


  normalize(events) {
    if (events.length === 0) {
      return events;
    }

    return events.map(e => e.split('.').shift());
  }

  get isInternal() {
    const {
      app
    } = this.state;

    if (app) {
      // if we are editing an existing app, check the status of the app
      return app.status === 'internal';
    }

    return this.props.route.path === 'new-internal/';
  }

  get showAuthInfo() {
    const {
      app
    } = this.state;
    return !(app && app.clientSecret && app.clientSecret[0] === '*');
  }

  renderBody() {
    const {
      orgId
    } = this.props.params;
    const {
      app
    } = this.state;
    const scopes = app && [...app.scopes] || [];
    const events = app && this.normalize(app.events) || [];
    const method = app ? 'PUT' : 'POST';
    const endpoint = app ? `/sentry-apps/${app.slug}/` : '/sentry-apps/';
    const forms = this.isInternal ? sentry_data_forms_sentryApplication__WEBPACK_IMPORTED_MODULE_24__.internalIntegrationForms : sentry_data_forms_sentryApplication__WEBPACK_IMPORTED_MODULE_24__.publicIntegrationForms;
    let verifyInstall;

    if (this.isInternal) {
      // force verifyInstall to false for all internal apps
      verifyInstall = false;
    } else {
      // use the existing value for verifyInstall if the app exists, otherwise default to true
      verifyInstall = app ? app.verifyInstall : true;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_31__["default"], {
        title: this.getHeaderTitle()
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsxs)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_15__["default"], {
        apiMethod: method,
        apiEndpoint: endpoint,
        allowUndo: true,
        initialData: {
          organization: orgId,
          isAlertable: false,
          isInternal: this.isInternal,
          schema: {},
          scopes: [],
          ...app,
          verifyInstall // need to overwrite the value in app for internal if it is true

        },
        model: this.form,
        onSubmitSuccess: this.handleSubmitSuccess,
        onSubmitError: this.handleSubmitError,
        onFieldChange: this.onFieldChange,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(mobx_react__WEBPACK_IMPORTED_MODULE_34__.Observer, {
          children: () => {
            const webhookDisabled = this.isInternal && !this.form.getValue('webhookUrl');
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsxs)(react__WEBPACK_IMPORTED_MODULE_5__.Fragment, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_17__["default"], {
                additionalFieldProps: {
                  webhookDisabled
                },
                forms: forms
              }), this.getAvatarChooser(true), this.getAvatarChooser(false), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_views_settings_organizationDeveloperSettings_permissionsObserver__WEBPACK_IMPORTED_MODULE_32__["default"], {
                webhookDisabled: webhookDisabled,
                appPublished: app ? app.status === 'published' : false,
                scopes: scopes,
                events: events
              })]
            });
          }
        }), app && app.status === 'internal' && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_21__.Panel, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_21__.PanelHeader, {
            hasButtons: true,
            children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_26__.t)('Tokens'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_13__["default"], {
              size: "xs",
              icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_25__.IconAdd, {
                size: "xs",
                isCircled: true
              }),
              onClick: evt => this.onAddToken(evt),
              "data-test-id": "token-add",
              type: "button",
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_26__.t)('New Token')
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_21__.PanelBody, {
            children: this.renderTokens()
          })]
        }), app && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_21__.Panel, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_21__.PanelHeader, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_26__.t)('Credentials')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_21__.PanelBody, {
            children: [app.status !== 'internal' && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_16__["default"], {
              name: "clientId",
              label: "Client ID",
              children: _ref4 => {
                let {
                  value
                } = _ref4;
                return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_19__["default"], {
                  children: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_28__["default"])({
                    value,
                    fixed: 'CI_CLIENT_ID'
                  })
                });
              }
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_16__["default"], {
              name: "clientSecret",
              label: "Client Secret",
              children: _ref5 => {
                let {
                  value
                } = _ref5;
                return value ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_22__["default"], {
                  disabled: this.showAuthInfo,
                  position: "right",
                  containerDisplayMode: "inline",
                  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_26__.t)('You do not have access to view these credentials because the permissions for this integration exceed those of your role.'),
                  children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_19__["default"], {
                    children: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_28__["default"])({
                      value,
                      fixed: 'CI_CLIENT_SECRET'
                    })
                  })
                }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)("em", {
                  children: "hidden"
                });
              }
            })]
          })]
        })]
      })]
    });
  }

}

const StyledPanelItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_21__.PanelItem,  true ? {
  target: "e1yio6dz7"
} : 0)( true ? {
  name: "1eoy87d",
  styles: "display:flex;justify-content:space-between"
} : 0);

const TokenItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1yio6dz6"
} : 0)( true ? {
  name: "maimdf",
  styles: "width:70%"
} : 0);

const CreatedTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e1yio6dz5"
} : 0)("color:", p => p.theme.gray300, ";margin-bottom:2px;" + ( true ? "" : 0));

const CreatedDate = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1yio6dz4"
} : 0)( true ? {
  name: "mdywmg",
  styles: "display:flex;flex-direction:column;font-size:14px;margin:0 10px"
} : 0);

const AvatarPreview = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1yio6dz3"
} : 0)( true ? {
  name: "1it56gg",
  styles: "flex:1;display:grid;grid:25px 25px/50px 1fr"
} : 0);

const StyledPreviewAvatar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_avatar__WEBPACK_IMPORTED_MODULE_11__["default"],  true ? {
  target: "e1yio6dz2"
} : 0)( true ? {
  name: "7zlmy7",
  styles: "grid-area:1/1/3/2;justify-self:end"
} : 0);

const AvatarPreviewTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e1yio6dz1"
} : 0)("display:block;grid-area:1/2/2/3;padding-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_27__["default"])(2), ";font-weight:bold;" + ( true ? "" : 0));

const AvatarPreviewText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e1yio6dz0"
} : 0)("display:block;grid-area:2/2/3/3;padding-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_27__["default"])(2), ";" + ( true ? "" : 0));

/***/ }),

/***/ "../node_modules/lodash/invertBy.js":
/*!******************************************!*\
  !*** ../node_modules/lodash/invertBy.js ***!
  \******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseIteratee = __webpack_require__(/*! ./_baseIteratee */ "../node_modules/lodash/_baseIteratee.js"),
    createInverter = __webpack_require__(/*! ./_createInverter */ "../node_modules/lodash/_createInverter.js");

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString = objectProto.toString;

/**
 * This method is like `_.invert` except that the inverted object is generated
 * from the results of running each element of `object` thru `iteratee`. The
 * corresponding inverted value of each inverted key is an array of keys
 * responsible for generating the inverted value. The iteratee is invoked
 * with one argument: (value).
 *
 * @static
 * @memberOf _
 * @since 4.1.0
 * @category Object
 * @param {Object} object The object to invert.
 * @param {Function} [iteratee=_.identity] The iteratee invoked per element.
 * @returns {Object} Returns the new inverted object.
 * @example
 *
 * var object = { 'a': 1, 'b': 2, 'c': 1 };
 *
 * _.invertBy(object);
 * // => { '1': ['a', 'c'], '2': ['b'] }
 *
 * _.invertBy(object, function(value) {
 *   return 'group' + value;
 * });
 * // => { 'group1': ['a', 'c'], 'group2': ['b'] }
 */
var invertBy = createInverter(function(result, value, key) {
  if (value != null &&
      typeof value.toString != 'function') {
    value = nativeObjectToString.call(value);
  }

  if (hasOwnProperty.call(result, value)) {
    result[value].push(key);
  } else {
    result[value] = [key];
  }
}, baseIteratee);

module.exports = invertBy;


/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_organizationDeveloperSettings_sentryApplicationDetails_tsx.ffa036090253d4d326eb51679ba7f4bd.js.map