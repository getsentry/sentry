"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_account_notifications_utils_tsx"],{

/***/ "./app/views/settings/account/notifications/constants.tsx":
/*!****************************************************************!*\
  !*** ./app/views/settings/account/notifications/constants.tsx ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ALL_PROVIDERS": () => (/* binding */ ALL_PROVIDERS),
/* harmony export */   "ALL_PROVIDER_NAMES": () => (/* binding */ ALL_PROVIDER_NAMES),
/* harmony export */   "CONFIRMATION_MESSAGE": () => (/* binding */ CONFIRMATION_MESSAGE),
/* harmony export */   "MIN_PROJECTS_FOR_CONFIRMATION": () => (/* binding */ MIN_PROJECTS_FOR_CONFIRMATION),
/* harmony export */   "MIN_PROJECTS_FOR_PAGINATION": () => (/* binding */ MIN_PROJECTS_FOR_PAGINATION),
/* harmony export */   "MIN_PROJECTS_FOR_SEARCH": () => (/* binding */ MIN_PROJECTS_FOR_SEARCH),
/* harmony export */   "NOTIFICATION_SETTINGS_TYPES": () => (/* binding */ NOTIFICATION_SETTINGS_TYPES),
/* harmony export */   "SELF_NOTIFICATION_SETTINGS_TYPES": () => (/* binding */ SELF_NOTIFICATION_SETTINGS_TYPES),
/* harmony export */   "VALUE_MAPPING": () => (/* binding */ VALUE_MAPPING)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



const ALL_PROVIDERS = {
  email: 'default',
  slack: 'never',
  msteams: 'never'
};
const ALL_PROVIDER_NAMES = Object.keys(ALL_PROVIDERS);
/**
 * These values are stolen from the DB.
 */

const VALUE_MAPPING = {
  default: 0,
  never: 10,
  always: 20,
  subscribe_only: 30,
  committed_only: 40
};
const MIN_PROJECTS_FOR_CONFIRMATION = 3;
const MIN_PROJECTS_FOR_SEARCH = 3;
const MIN_PROJECTS_FOR_PAGINATION = 100;
const NOTIFICATION_SETTINGS_TYPES = ['alerts', 'activeRelease', 'workflow', 'deploy', 'approval', 'quota', 'reports', 'email'];
const SELF_NOTIFICATION_SETTINGS_TYPES = ['personalActivityNotifications', 'selfAssignOnResolve'];
const CONFIRMATION_MESSAGE = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxs)("div", {
  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)("p", {
    style: {
      marginBottom: '20px'
    },
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)("strong", {
      children: "Are you sure you want to disable these notifications?"
    })
  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)("p", {
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Turning this off will irreversibly overwrite all of your fine-tuning settings to "off".')
  })]
});

/***/ }),

/***/ "./app/views/settings/account/notifications/fields2.tsx":
/*!**************************************************************!*\
  !*** ./app/views/settings/account/notifications/fields2.tsx ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "NOTIFICATION_SETTING_FIELDS": () => (/* binding */ NOTIFICATION_SETTING_FIELDS),
/* harmony export */   "QUOTA_FIELDS": () => (/* binding */ QUOTA_FIELDS)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/featureBadge */ "./app/components/featureBadge.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/settings/account/notifications/utils */ "./app/views/settings/account/notifications/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








const NOTIFICATION_SETTING_FIELDS = {
  alerts: {
    name: 'alerts',
    type: 'select',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Issue Alerts'),
    choices: [['always', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('On')], ['never', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Off')]],
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Notifications sent from Alert rules that your team has set up.')
  },
  activeRelease: {
    name: 'activeRelease',
    type: 'select',
    label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Release Issues'), " ", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_2__["default"], {
        type: "alpha"
      })]
    }),
    choices: [['always', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('On')], ['never', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Off')]],
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Notifications sent for issues likely caused by your code changes.')
  },
  workflow: {
    name: 'workflow',
    type: 'select',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Issue Workflow'),
    choices: [['always', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('On')], ['subscribe_only', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Only Subscribed Issues')], ['never', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Off')]],
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Changes in issue assignment, resolution status, and comments.')
  },
  deploy: {
    name: 'deploy',
    type: 'select',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Deploys'),
    choices: [['always', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('On')], ['committed_only', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Releases with My Commits')], ['never', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Off')]],
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Release, environment, and commit overviews.')
  },
  provider: {
    name: 'provider',
    type: 'select',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Delivery Method'),
    choices: [['email', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Email')], ['slack', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Slack')], ['msteams', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Microsoft Teams')]],
    multiple: true,
    onChange: val => {
      // This is a little hack to prevent this field from being empty.
      // TODO(nisanthan): need to prevent showing the clearable on. the multi-select when its only 1 value.
      if (!val || val.length === 0) {
        throw Error('Invalid selection. Field cannot be empty.');
      }
    }
  },
  approval: {
    name: 'approval',
    type: 'select',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Approvals'),
    choices: [['always', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('On')], ['never', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Off')]],
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Notifications from teammates that require review or approval.')
  },
  quota: {
    name: 'quota',
    type: 'select',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Quota'),
    choices: [['always', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('On')], ['never', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Off')]],
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Error, transaction, and attachment quota limits.')
  },
  reports: {
    name: 'weekly reports',
    type: 'blank',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Weekly Reports'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('A summary of the past week for an organization.')
  },
  email: {
    name: 'email routing',
    type: 'blank',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Email Routing'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Change the email address that receives notifications.')
  },
  personalActivityNotifications: {
    name: 'personalActivityNotifications',
    type: 'select',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('My Own Activity'),
    choices: [[true, (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('On')], [false, (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Off')]],
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Notifications about your own actions on Sentry.')
  },
  selfAssignOnResolve: {
    name: 'selfAssignOnResolve',
    type: 'select',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Claim Unassigned Issues I’ve Resolved'),
    choices: [[true, (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('On')], [false, (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Off')]],
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('You’ll receive notifications about any changes that happen afterwards.')
  }
}; // partial field definition for quota sub-categories

const QUOTA_FIELDS = [{
  name: 'quotaWarnings',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Set Quota Limit'),
  help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Receive notifications when your organization exceeeds the following limits.'),
  choices: [['always', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('100% and 80%')], ['never', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('100%')]]
}, {
  name: 'quotaErrors',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Errors'),
  help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)('Receive notifications about your error quotas. [learnMore:Learn more]', {
    learnMore: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_3__["default"], {
      href: (0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_5__.getDocsLinkForEventType)('error')
    })
  }),
  choices: [['always', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('On')], ['never', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Off')]]
}, {
  name: 'quotaTransactions',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Transactions'),
  help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)('Receive notifications about your transaction quota. [learnMore:Learn more]', {
    learnMore: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_3__["default"], {
      href: (0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_5__.getDocsLinkForEventType)('transaction')
    })
  }),
  choices: [['always', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('On')], ['never', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Off')]]
}, {
  name: 'quotaAttachments',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Attachments'),
  help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)('Receive notifications about your attachment quota. [learnMore:Learn more]', {
    learnMore: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_3__["default"], {
      href: (0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_5__.getDocsLinkForEventType)('attachment')
    })
  }),
  choices: [['always', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('On')], ['never', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Off')]]
}];

/***/ }),

/***/ "./app/views/settings/account/notifications/parentLabel.tsx":
/*!******************************************************************!*\
  !*** ./app/views/settings/account/notifications/parentLabel.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_avatar__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/avatar */ "./app/components/avatar/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/views/settings/account/notifications/utils */ "./app/views/settings/account/notifications/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







// TODO(mgaeta): Infer parentKey from parent.
const ParentLabel = _ref => {
  let {
    notificationType,
    parent
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(FieldLabel, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_avatar__WEBPACK_IMPORTED_MODULE_1__["default"], {
      [(0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_3__.getParentKey)(notificationType)]: parent
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("span", {
      children: parent.slug
    })]
  });
};

ParentLabel.displayName = "ParentLabel";

const FieldLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1lcoc5u0"
} : 0)("display:flex;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(0.5), ";line-height:16px;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ParentLabel);

/***/ }),

/***/ "./app/views/settings/account/notifications/utils.tsx":
/*!************************************************************!*\
  !*** ./app/views/settings/account/notifications/utils.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "backfillMissingProvidersWithFallback": () => (/* binding */ backfillMissingProvidersWithFallback),
/* harmony export */   "decideDefault": () => (/* binding */ decideDefault),
/* harmony export */   "getChoiceString": () => (/* binding */ getChoiceString),
/* harmony export */   "getCurrentDefault": () => (/* binding */ getCurrentDefault),
/* harmony export */   "getCurrentProviders": () => (/* binding */ getCurrentProviders),
/* harmony export */   "getDocsLinkForEventType": () => (/* binding */ getDocsLinkForEventType),
/* harmony export */   "getFallBackValue": () => (/* binding */ getFallBackValue),
/* harmony export */   "getParentData": () => (/* binding */ getParentData),
/* harmony export */   "getParentField": () => (/* binding */ getParentField),
/* harmony export */   "getParentIds": () => (/* binding */ getParentIds),
/* harmony export */   "getParentKey": () => (/* binding */ getParentKey),
/* harmony export */   "getParentValues": () => (/* binding */ getParentValues),
/* harmony export */   "getStateToPutForDefault": () => (/* binding */ getStateToPutForDefault),
/* harmony export */   "getStateToPutForParent": () => (/* binding */ getStateToPutForParent),
/* harmony export */   "getStateToPutForProvider": () => (/* binding */ getStateToPutForProvider),
/* harmony export */   "getUserDefaultValues": () => (/* binding */ getUserDefaultValues),
/* harmony export */   "groupByOrganization": () => (/* binding */ groupByOrganization),
/* harmony export */   "isEverythingDisabled": () => (/* binding */ isEverythingDisabled),
/* harmony export */   "isGroupedByProject": () => (/* binding */ isGroupedByProject),
/* harmony export */   "isSufficientlyComplex": () => (/* binding */ isSufficientlyComplex),
/* harmony export */   "mergeNotificationSettings": () => (/* binding */ mergeNotificationSettings),
/* harmony export */   "providerListToString": () => (/* binding */ providerListToString)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var lodash_set__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/set */ "../node_modules/lodash/set.js");
/* harmony import */ var lodash_set__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_set__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_settings_account_notifications_constants__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/settings/account/notifications/constants */ "./app/views/settings/account/notifications/constants.tsx");
/* harmony import */ var sentry_views_settings_account_notifications_fields2__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/views/settings/account/notifications/fields2 */ "./app/views/settings/account/notifications/fields2.tsx");
/* harmony import */ var sentry_views_settings_account_notifications_parentLabel__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/views/settings/account/notifications/parentLabel */ "./app/views/settings/account/notifications/parentLabel.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








/**
 * Which fine-tuning parts are grouped by project
 */


const isGroupedByProject = notificationType => ['alerts', 'email', 'workflow', 'activeRelease'].includes(notificationType);
const getParentKey = notificationType => {
  return isGroupedByProject(notificationType) ? 'project' : 'organization';
};
const groupByOrganization = projects => {
  return projects.reduce((acc, project) => {
    const orgSlug = project.organization.slug;

    if (acc.hasOwnProperty(orgSlug)) {
      acc[orgSlug].projects.push(project);
    } else {
      acc[orgSlug] = {
        organization: project.organization,
        projects: [project]
      };
    }

    return acc;
  }, {});
};
const getFallBackValue = notificationType => {
  switch (notificationType) {
    case 'alerts':
      return 'always';

    case 'deploy':
      return 'committed_only';

    case 'workflow':
      return 'subscribe_only';

    default:
      return '';
  }
};
const providerListToString = providers => {
  return providers.sort().join('+');
};
const getChoiceString = (choices, key) => {
  if (!choices) {
    return 'default';
  }

  const found = choices.find(row => row[0] === key);

  if (!found) {
    throw new Error(`Could not find ${key}`);
  }

  return found[1];
};

const isDataAllNever = data => !!Object.keys(data).length && Object.values(data).every(value => value === 'never');

const getNonNeverValue = data => Object.values(data).reduce((previousValue, currentValue) => currentValue === 'never' ? previousValue : currentValue, null);
/**
 * Transform `data`, a mapping of providers to values, so that all providers in
 * `providerList` are "on" in the resulting object. The "on" value is
 * determined by checking `data` for non-"never" values and falling back to the
 * value `fallbackValue`. The "off" value is either "default" or "never"
 * depending on whether `scopeType` is "parent" or "user" respectively.
 */


const backfillMissingProvidersWithFallback = (data, providerList, fallbackValue, scopeType) => {
  // First pass: What was this scope's previous value?
  let existingValue;

  if (scopeType === 'user') {
    existingValue = isDataAllNever(data) ? fallbackValue : getNonNeverValue(data) || fallbackValue;
  } else {
    existingValue = isDataAllNever(data) ? 'never' : getNonNeverValue(data) || 'default';
  } // Second pass: Fill in values for every provider.


  return Object.fromEntries(Object.keys(sentry_views_settings_account_notifications_constants__WEBPACK_IMPORTED_MODULE_5__.ALL_PROVIDERS).map(provider => [provider, providerList.includes(provider) ? existingValue : 'never']));
};
/**
 * Deeply merge N notification settings objects (usually just 2).
 */

const mergeNotificationSettings = function () {
  const output = {};

  for (var _len = arguments.length, objects = new Array(_len), _key = 0; _key < _len; _key++) {
    objects[_key] = arguments[_key];
  }

  objects.forEach(settingsByType => Object.entries(settingsByType).forEach(_ref => {
    let [type, settingsByScopeType] = _ref;
    return Object.entries(settingsByScopeType).forEach(_ref2 => {
      let [scopeType, settingsByScopeId] = _ref2;
      return Object.entries(settingsByScopeId).forEach(_ref3 => {
        let [scopeId, settingsByProvider] = _ref3;
        lodash_set__WEBPACK_IMPORTED_MODULE_3___default()(output, [type, scopeType, scopeId].join('.'), settingsByProvider);
      });
    });
  }));
  return output;
};
/**
 * Get the mapping of providers to values that describe a user's parent-
 * independent notification preferences. The data from the API uses the user ID
 * rather than "me" so we assume the first ID is the user's.
 */

const getUserDefaultValues = (notificationType, notificationSettings) => {
  var _notificationSettings;

  return Object.values(((_notificationSettings = notificationSettings[notificationType]) === null || _notificationSettings === void 0 ? void 0 : _notificationSettings.user) || {}).pop() || Object.fromEntries(Object.entries(sentry_views_settings_account_notifications_constants__WEBPACK_IMPORTED_MODULE_5__.ALL_PROVIDERS).map(_ref4 => {
    let [provider, value] = _ref4;
    return [provider, value === 'default' ? getFallBackValue(notificationType) : value];
  }));
};
/**
 * Get the list of providers currently active on this page. Note: this can be empty.
 */

const getCurrentProviders = (notificationType, notificationSettings) => {
  const userData = getUserDefaultValues(notificationType, notificationSettings);
  return Object.entries(userData).filter(_ref5 => {
    let [_, value] = _ref5;
    return !['never'].includes(value);
  }).map(_ref6 => {
    let [provider, _] = _ref6;
    return provider;
  });
};
/**
 * Calculate the currently selected provider.
 */

const getCurrentDefault = (notificationType, notificationSettings) => {
  const providersList = getCurrentProviders(notificationType, notificationSettings);
  return providersList.length ? getUserDefaultValues(notificationType, notificationSettings)[providersList[0]] : 'never';
};
/**
 * For a given notificationType, are the parent-independent setting "never" for
 * all providers and are the parent-specific settings "default" or "never". If
 * so, the API is telling us that the user has opted out of all notifications.
 */

const decideDefault = (notificationType, notificationSettings) => {
  var _notificationSettings2;

  const compare = (a, b) => sentry_views_settings_account_notifications_constants__WEBPACK_IMPORTED_MODULE_5__.VALUE_MAPPING[a] - sentry_views_settings_account_notifications_constants__WEBPACK_IMPORTED_MODULE_5__.VALUE_MAPPING[b];

  const parentIndependentSetting = Object.values(getUserDefaultValues(notificationType, notificationSettings)).sort(compare).pop() || 'never';

  if (parentIndependentSetting !== 'never') {
    return parentIndependentSetting;
  }

  const parentSpecificSetting = Object.values(((_notificationSettings2 = notificationSettings[notificationType]) === null || _notificationSettings2 === void 0 ? void 0 : _notificationSettings2[getParentKey(notificationType)]) || {}).flatMap(settingsByProvider => Object.values(settingsByProvider)).sort(compare).pop() || 'default';
  return parentSpecificSetting === 'default' ? 'never' : parentSpecificSetting;
};
/**
 * For a given notificationType, are the parent-independent setting "never" for
 * all providers and are the parent-specific settings "default" or "never"? If
 * so, the API is telling us that the user has opted out of all notifications.
 */

const isEverythingDisabled = (notificationType, notificationSettings) => ['never', 'default'].includes(decideDefault(notificationType, notificationSettings));
/**
 * Extract either the list of project or organization IDs from the notification
 * settings in state. This assumes that the notification settings object is
 * fully backfilled with settings for every parent.
 */

const getParentIds = (notificationType, notificationSettings) => {
  var _notificationSettings3;

  return Object.keys(((_notificationSettings3 = notificationSettings[notificationType]) === null || _notificationSettings3 === void 0 ? void 0 : _notificationSettings3[getParentKey(notificationType)]) || {});
};
const getParentValues = (notificationType, notificationSettings, parentId) => {
  var _notificationSettings4, _notificationSettings5;

  return ((_notificationSettings4 = notificationSettings[notificationType]) === null || _notificationSettings4 === void 0 ? void 0 : (_notificationSettings5 = _notificationSettings4[getParentKey(notificationType)]) === null || _notificationSettings5 === void 0 ? void 0 : _notificationSettings5[parentId]) || {
    email: 'default'
  };
};
/**
 * Get a mapping of all parent IDs to the notification setting for the current
 * providers.
 */

const getParentData = (notificationType, notificationSettings, parents) => {
  const provider = getCurrentProviders(notificationType, notificationSettings)[0];
  return Object.fromEntries(parents.map(parent => [parent.id, getParentValues(notificationType, notificationSettings, parent.id)[provider]]));
};
/**
 * Are there are more than N project or organization settings?
 */

const isSufficientlyComplex = (notificationType, notificationSettings) => getParentIds(notificationType, notificationSettings).length > sentry_views_settings_account_notifications_constants__WEBPACK_IMPORTED_MODULE_5__.MIN_PROJECTS_FOR_CONFIRMATION;
/**
 * This is triggered when we change the Delivery Method select. Don't update the
 * provider for EVERY one of the user's projects and organizations, just the user
 * and parents that have explicit settings.
 */

const getStateToPutForProvider = (notificationType, notificationSettings, changedData) => {
  const providerList = changedData.provider ? Object.values(changedData.provider) : [];
  const fallbackValue = getFallBackValue(notificationType); // If the user has no settings, we need to create them.

  if (!Object.keys(notificationSettings).length) {
    return {
      [notificationType]: {
        user: {
          me: Object.fromEntries(providerList.map(provider => [provider, fallbackValue]))
        }
      }
    };
  }

  return {
    [notificationType]: Object.fromEntries(Object.entries(notificationSettings[notificationType]).map(_ref7 => {
      let [scopeType, scopeTypeData] = _ref7;
      return [scopeType, Object.fromEntries(Object.entries(scopeTypeData).map(_ref8 => {
        let [scopeId, scopeIdData] = _ref8;
        return [scopeId, backfillMissingProvidersWithFallback(scopeIdData, providerList, fallbackValue, scopeType)];
      }))];
    }))
  };
};
/**
 * Update the current providers' parent-independent notification settings with
 * the new value. If the new value is "never", then also update all
 * parent-specific notification settings to "default". If the previous value
 * was "never", then assume providerList should be "email" only.
 */

const getStateToPutForDefault = (notificationType, notificationSettings, changedData, parentIds) => {
  const newValue = Object.values(changedData)[0];
  let providerList = getCurrentProviders(notificationType, notificationSettings);

  if (!providerList.length) {
    providerList = ['email'];
  }

  const updatedNotificationSettings = {
    [notificationType]: {
      user: {
        me: Object.fromEntries(providerList.map(provider => [provider, newValue]))
      }
    }
  };

  if (newValue === 'never') {
    updatedNotificationSettings[notificationType][getParentKey(notificationType)] = Object.fromEntries(parentIds.map(parentId => [parentId, Object.fromEntries(providerList.map(provider => [provider, 'default']))]));
  }

  return updatedNotificationSettings;
};
/**
 * Get the diff of the Notification Settings for this parent ID.
 */

const getStateToPutForParent = (notificationType, notificationSettings, changedData, parentId) => {
  const providerList = getCurrentProviders(notificationType, notificationSettings);
  const newValue = Object.values(changedData)[0];
  return {
    [notificationType]: {
      [getParentKey(notificationType)]: {
        [parentId]: Object.fromEntries(providerList.map(provider => [provider, newValue]))
      }
    }
  };
};
/**
 * Render each parent and add a default option to the the field choices.
 */

const getParentField = (notificationType, notificationSettings, parent, onChange) => {
  const defaultFields = sentry_views_settings_account_notifications_fields2__WEBPACK_IMPORTED_MODULE_6__.NOTIFICATION_SETTING_FIELDS[notificationType];
  let choices = defaultFields.choices;

  if (Array.isArray(choices)) {
    choices = choices.concat([['default', `${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Default')} (${getChoiceString(choices, getCurrentDefault(notificationType, notificationSettings))})`]]);
  }

  return Object.assign({}, defaultFields, {
    label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_views_settings_account_notifications_parentLabel__WEBPACK_IMPORTED_MODULE_7__["default"], {
      parent: parent,
      notificationType: notificationType
    }),
    getData: data => onChange(data, parent.id),
    name: parent.id,
    choices,
    defaultValue: 'default',
    help: undefined
  });
};
/**
 * Returns a link to docs on explaining how to manage quotas for that event type
 */

function getDocsLinkForEventType(event) {
  switch (event) {
    case 'transaction':
      return 'https://docs.sentry.io/product/performance/transaction-summary/#what-is-a-transaction';

    case 'attachment':
      return 'https://docs.sentry.io/product/accounts/quotas/manage-attachments-quota/#2-rate-limiting';

    default:
      return 'https://docs.sentry.io/product/accounts/quotas/manage-event-stream-guide/#common-workflows-for-managing-your-event-stream';
  }
}

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_account_notifications_utils_tsx.149b789b7ab2deda6f8a04e7a3678016.js.map