"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_account_accountNotificationFineTuning_tsx"],{

/***/ "./app/data/forms/accountNotificationSettings.tsx":
/*!********************************************************!*\
  !*** ./app/data/forms/accountNotificationSettings.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "fields": () => (/* binding */ fields),
/* harmony export */   "route": () => (/* binding */ route)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
 // TODO: cleanup unused fields and exports
// Export route to make these forms searchable by label/help

const route = '/settings/account/notifications/';
const fields = {
  subscribeByDefault: {
    name: 'subscribeByDefault',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Send Me Alerts'),
    // TODO(billy): Make this a real link
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Enable this to receive notifications for Alerts sent to your teams. You will always receive alerts configured to be sent directly to you.')
  },
  workflowNotifications: {
    name: 'workflowNotifications',
    type: 'radio',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Send Me Workflow Notifications'),
    choices: [[0, (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Always')], [1, (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Only On Issues I Subscribe To')], [2, (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Never')]],
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('E.g. changes in issue assignment, resolution status, and comments.')
  },
  weeklyReports: {
    // Form is not visible because currently not implemented
    name: 'weeklyReports',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Send Me Weekly Reports'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)("Reports contain a summary of what's happened within your organization."),
    disabled: true
  },
  deployNotifications: {
    name: 'deployNotifications',
    type: 'radio',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Send Me Deploy Notifications'),
    choices: [[2, (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Always')], [3, (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Only On Deploys With My Commits')], [4, (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Never')]],
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Deploy emails include release, environment and commit overviews.')
  },
  personalActivityNotifications: {
    name: 'personalActivityNotifications',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Notify Me About My Own Activity'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Enable this to receive notifications about your own actions on Sentry.')
  },
  selfAssignOnResolve: {
    name: 'selfAssignOnResolve',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)("Claim Unassigned Issues I've Resolved"),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)("You'll receive notifications about any changes that happen afterwards.")
  }
};

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

/***/ "./app/views/settings/account/accountNotificationFineTuning.tsx":
/*!**********************************************************************!*\
  !*** ./app/views/settings/account/accountNotificationFineTuning.tsx ***!
  \**********************************************************************/
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
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/jsonForm */ "./app/components/forms/jsonForm.tsx");
/* harmony import */ var sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/selectField */ "./app/components/forms/selectField.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_data_forms_accountNotificationSettings__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/data/forms/accountNotificationSettings */ "./app/data/forms/accountNotificationSettings.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_withOrganizations__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/withOrganizations */ "./app/utils/withOrganizations.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_account_notifications_fields__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/settings/account/notifications/fields */ "./app/views/settings/account/notifications/fields.tsx");
/* harmony import */ var sentry_views_settings_account_notifications_notificationSettingsByType__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/settings/account/notifications/notificationSettingsByType */ "./app/views/settings/account/notifications/notificationSettingsByType.tsx");
/* harmony import */ var sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/settings/account/notifications/utils */ "./app/views/settings/account/notifications/utils.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }




















const PanelBodyLineItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.PanelBody,  true ? {
  target: "euheq541"
} : 0)("font-size:1rem;&:not(:last-child){border-bottom:1px solid ", p => p.theme.innerBorder, ";}" + ( true ? "" : 0));

const AccountNotificationsByProject = _ref => {
  let {
    projects,
    field
  } = _ref;
  const projectsByOrg = (0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_15__.groupByOrganization)(projects); // eslint-disable-next-line @typescript-eslint/no-unused-vars

  const {
    title,
    description,
    ...fieldConfig
  } = field; // Display as select box in this view regardless of the type specified in the config

  const data = Object.values(projectsByOrg).map(org => ({
    name: org.organization.name,
    projects: org.projects.map(project => ({ ...fieldConfig,
      // `name` key refers to field name
      // we use project.id because slugs are not unique across orgs
      name: project.id,
      label: project.slug
    }))
  }));
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
    children: data.map(_ref2 => {
      let {
        name,
        projects: projectFields
      } = _ref2;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)("div", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.PanelHeader, {
          children: name
        }), projectFields.map(f => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(PanelBodyLineItem, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_6__["default"], {
            defaultValue: f.defaultValue,
            name: f.name,
            options: f.options,
            label: f.label
          })
        }, f.name))]
      }, name);
    })
  });
};

AccountNotificationsByProject.displayName = "AccountNotificationsByProject";

const AccountNotificationsByOrganization = _ref3 => {
  let {
    organizations,
    field
  } = _ref3;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {
    title,
    description,
    ...fieldConfig
  } = field; // Display as select box in this view regardless of the type specified in the config

  const data = organizations.map(org => ({ ...fieldConfig,
    // `name` key refers to field name
    // we use org.id to remain consistent project.id use (which is required because slugs are not unique across orgs)
    name: org.id,
    label: org.slug
  }));
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
    children: data.map(f => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(PanelBodyLineItem, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_6__["default"], {
        defaultValue: f.defaultValue,
        name: f.name,
        options: f.options,
        label: f.label
      })
    }, f.name))
  });
};

AccountNotificationsByOrganization.displayName = "AccountNotificationsByOrganization";
const AccountNotificationsByOrganizationContainer = (0,sentry_utils_withOrganizations__WEBPACK_IMPORTED_MODULE_11__["default"])(AccountNotificationsByOrganization);

class AccountNotificationFineTuning extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_12__["default"] {
  getEndpoints() {
    const {
      fineTuneType
    } = this.props.params;
    const endpoints = [['notifications', '/users/me/notifications/'], ['fineTuneData', `/users/me/notifications/${fineTuneType}/`]];

    if ((0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_15__.isGroupedByProject)(fineTuneType)) {
      endpoints.push(['projects', '/projects/']);
    }

    endpoints.push(['emails', '/users/me/emails/']);

    if (fineTuneType === 'email') {
      endpoints.push(['emails', '/users/me/emails/']);
    }

    return endpoints;
  } // Return a sorted list of user's verified emails


  get emailChoices() {
    var _this$state$emails$fi, _this$state$emails, _this$state$emails$fi2;

    return (_this$state$emails$fi = (_this$state$emails = this.state.emails) === null || _this$state$emails === void 0 ? void 0 : (_this$state$emails$fi2 = _this$state$emails.filter(_ref4 => {
      let {
        isVerified
      } = _ref4;
      return isVerified;
    })) === null || _this$state$emails$fi2 === void 0 ? void 0 : _this$state$emails$fi2.sort((a, b) => {
      // Sort by primary -> email
      if (a.isPrimary) {
        return -1;
      }

      if (b.isPrimary) {
        return 1;
      }

      return a.email < b.email ? -1 : 1;
    })) !== null && _this$state$emails$fi !== void 0 ? _this$state$emails$fi : [];
  }

  renderBody() {
    const {
      params
    } = this.props;
    const {
      fineTuneType
    } = params;

    if (['alerts', 'deploy', 'workflow', 'activeRelease', 'approval', 'quota'].includes(fineTuneType)) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_views_settings_account_notifications_notificationSettingsByType__WEBPACK_IMPORTED_MODULE_14__["default"], {
        notificationType: fineTuneType
      });
    }

    const {
      notifications,
      projects,
      fineTuneData,
      projectsPageLinks
    } = this.state;
    const isProject = (0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_15__.isGroupedByProject)(fineTuneType);
    const field = sentry_views_settings_account_notifications_fields__WEBPACK_IMPORTED_MODULE_13__.ACCOUNT_NOTIFICATION_FIELDS[fineTuneType];
    const {
      title,
      description
    } = field;
    const [stateKey, url] = isProject ? this.getEndpoints()[2] : [];
    const hasProjects = !!(projects !== null && projects !== void 0 && projects.length);

    if (fineTuneType === 'email') {
      // Fetch verified email addresses
      field.options = this.emailChoices.map(_ref5 => {
        let {
          email
        } = _ref5;
        return {
          value: email,
          label: email
        };
      });
    }

    if (!notifications || !fineTuneData) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_17__["default"], {
        title: title
      }), description && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_18__["default"], {
        children: description
      }), field && field.defaultFieldName && // not implemented yet
      field.defaultFieldName !== 'weeklyReports' && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_4__["default"], {
        saveOnBlur: true,
        apiMethod: "PUT",
        apiEndpoint: "/users/me/notifications/",
        initialData: notifications,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_5__["default"], {
          title: `Default ${title}`,
          fields: [sentry_data_forms_accountNotificationSettings__WEBPACK_IMPORTED_MODULE_9__.fields[field.defaultFieldName]]
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.Panel, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.PanelBody, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.PanelHeader, {
            hasButtons: isProject,
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(Heading, {
              children: isProject ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Projects') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Organizations')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)("div", {
              children: isProject && this.renderSearchInput({
                placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Search Projects'),
                url,
                stateKey
              })
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_4__["default"], {
            saveOnBlur: true,
            apiMethod: "PUT",
            apiEndpoint: `/users/me/notifications/${fineTuneType}/`,
            initialData: fineTuneData,
            children: [isProject && hasProjects && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(AccountNotificationsByProject, {
              projects: projects,
              field: field
            }), isProject && !hasProjects && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_16__["default"], {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('No projects found')
            }), !isProject && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(AccountNotificationsByOrganizationContainer, {
              field: field
            })]
          })]
        })
      }), projects && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_7__["default"], {
        pageLinks: projectsPageLinks,
        ...this.props
      })]
    });
  }

}

const Heading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "euheq540"
} : 0)( true ? {
  name: "82a6rk",
  styles: "flex:1"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AccountNotificationFineTuning);

/***/ }),

/***/ "./app/views/settings/account/notifications/fields.tsx":
/*!*************************************************************!*\
  !*** ./app/views/settings/account/notifications/fields.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ACCOUNT_NOTIFICATION_FIELDS": () => (/* binding */ ACCOUNT_NOTIFICATION_FIELDS)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");

// TODO: clean up unused fields
const ACCOUNT_NOTIFICATION_FIELDS = {
  alerts: {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Issue Alert Notifications'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Notifications from Alert Rules that your team has setup. You’ll always receive notifications from Alerts configured to be sent directly to you.'),
    type: 'select',
    options: [{
      value: '-1',
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Default')
    }, {
      value: '1',
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('On')
    }, {
      value: '0',
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Off')
    }],
    defaultValue: '-1',
    defaultFieldName: 'subscribeByDefault'
  },
  workflow: {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Workflow Notifications'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Control workflow notifications, e.g. changes in issue assignment, resolution status, and comments.'),
    type: 'select',
    options: [{
      value: '-1',
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Default')
    }, {
      value: '0',
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Always')
    }, {
      value: '1',
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Only on issues I subscribe to')
    }, {
      value: '2',
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Never')
    }],
    defaultValue: '-1',
    defaultFieldName: 'workflowNotifications'
  },
  activeRelease: {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Release Issues'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Notifications sent for issues likely caused by your code changes.'),
    type: 'select',
    defaultValue: '0',
    options: [{
      value: '1',
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('On')
    }, {
      value: '0',
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Off')
    }],
    defaultFieldName: 'activeReleaseNotifications'
  },
  deploy: {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Deploy Notifications'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Control deploy notifications that include release, environment, and commit overviews.'),
    type: 'select',
    options: [{
      value: '-1',
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Default')
    }, {
      value: '2',
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Always')
    }, {
      value: '3',
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Only on deploys with my commits')
    }, {
      value: '4',
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Never')
    }],
    defaultValue: '-1',
    defaultFieldName: 'deployNotifications'
  },
  reports: {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Weekly Reports'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)("Reports contain a summary of what's happened within the organization."),
    type: 'select',
    // API only saves organizations that have this disabled, so we should default to "On"
    defaultValue: '1',
    options: [{
      value: '1',
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('On')
    }, {
      value: '0',
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Off')
    }],
    defaultFieldName: 'weeklyReports'
  },
  approval: {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Approvals'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Notifications from teammates that require review or approval.'),
    type: 'select' // No choices here because it's going to have dynamic content
    // Component will create choices,

  },
  quota: {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Quota Notifications'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Control the notifications you receive for error, transaction, and attachment quota limits.'),
    type: 'select' // No choices here because it's going to have dynamic content
    // Component will create choices,

  },
  email: {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Email Routing'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('On a per project basis, route emails to an alternative email address.'),
    type: 'select' // No choices here because it's going to have dynamic content
    // Component will create choices

  }
};

/***/ }),

/***/ "./app/views/settings/account/notifications/notificationSettingsByOrganization.tsx":
/*!*****************************************************************************************!*\
  !*** ./app/views/settings/account/notifications/notificationSettingsByOrganization.tsx ***!
  \*****************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/forms/jsonForm */ "./app/components/forms/jsonForm.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_withOrganizations__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/withOrganizations */ "./app/utils/withOrganizations.tsx");
/* harmony import */ var sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/settings/account/notifications/utils */ "./app/views/settings/account/notifications/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








class NotificationSettingsByOrganization extends react__WEBPACK_IMPORTED_MODULE_0__.Component {
  render() {
    const {
      notificationType,
      notificationSettings,
      onChange,
      onSubmitSuccess,
      organizations
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_1__["default"], {
      saveOnBlur: true,
      apiMethod: "PUT",
      apiEndpoint: "/users/me/notification-settings/",
      initialData: (0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_5__.getParentData)(notificationType, notificationSettings, organizations),
      onSubmitSuccess: onSubmitSuccess,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_2__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Organizations'),
        fields: organizations.map(organization => (0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_5__.getParentField)(notificationType, notificationSettings, organization, onChange))
      })
    });
  }

}

NotificationSettingsByOrganization.displayName = "NotificationSettingsByOrganization";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganizations__WEBPACK_IMPORTED_MODULE_4__["default"])(NotificationSettingsByOrganization));

/***/ }),

/***/ "./app/views/settings/account/notifications/notificationSettingsByProjects.tsx":
/*!*************************************************************************************!*\
  !*** ./app/views/settings/account/notifications/notificationSettingsByProjects.tsx ***!
  \*************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/jsonForm */ "./app/components/forms/jsonForm.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_views_settings_account_notifications_constants__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/settings/account/notifications/constants */ "./app/views/settings/account/notifications/constants.tsx");
/* harmony import */ var sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/settings/account/notifications/utils */ "./app/views/settings/account/notifications/utils.tsx");
/* harmony import */ var sentry_views_settings_components_defaultSearchBar__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/settings/components/defaultSearchBar */ "./app/views/settings/components/defaultSearchBar.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }















class NotificationSettingsByProjects extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_4__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getProjectCount", () => {
      var _notificationSettings;

      const {
        notificationType,
        notificationSettings
      } = this.props;
      return Object.values(((_notificationSettings = notificationSettings[notificationType]) === null || _notificationSettings === void 0 ? void 0 : _notificationSettings.project) || {}).length;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getGroupedProjects", () => {
      const {
        projects: stateProjects
      } = this.state;
      return Object.fromEntries(Object.values((0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_11__.groupByOrganization)((0,sentry_utils__WEBPACK_IMPORTED_MODULE_9__.sortProjects)(stateProjects))).map(_ref => {
        let {
          organization,
          projects
        } = _ref;
        return [`${organization.name} Projects`, projects];
      }));
    });
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      projects: []
    };
  }

  getEndpoints() {
    return [['projects', '/projects/']];
  }
  /**
   * Check the notification settings for how many projects there are.
   */


  renderBody() {
    const {
      notificationType,
      notificationSettings,
      onChange,
      onSubmitSuccess
    } = this.props;
    const {
      projects,
      projectsPageLinks
    } = this.state;
    const canSearch = this.getProjectCount() >= sentry_views_settings_account_notifications_constants__WEBPACK_IMPORTED_MODULE_10__.MIN_PROJECTS_FOR_SEARCH;
    const shouldPaginate = projects.length >= sentry_views_settings_account_notifications_constants__WEBPACK_IMPORTED_MODULE_10__.MIN_PROJECTS_FOR_PAGINATION;

    const renderSearch = _ref2 => {
      let {
        defaultSearchBar
      } = _ref2;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StyledSearchWrapper, {
        children: defaultSearchBar
      });
    };

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [canSearch && this.renderSearchInput({
        stateKey: 'projects',
        url: '/projects/',
        placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Search Projects'),
        children: renderSearch
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_5__["default"], {
        saveOnBlur: true,
        apiMethod: "PUT",
        apiEndpoint: "/users/me/notification-settings/",
        initialData: (0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_11__.getParentData)(notificationType, notificationSettings, projects),
        onSubmitSuccess: onSubmitSuccess,
        children: projects.length === 0 ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_13__["default"], {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('No projects found')
        }) : Object.entries(this.getGroupedProjects()).map(_ref3 => {
          let [groupTitle, parents] = _ref3;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_6__["default"], {
            collapsible: true,
            title: groupTitle,
            fields: parents.map(parent => (0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_11__.getParentField)(notificationType, notificationSettings, parent, onChange))
          }, groupTitle);
        })
      }), canSearch && shouldPaginate && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_7__["default"], {
        pageLinks: projectsPageLinks,
        ...this.props
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (NotificationSettingsByProjects);

const StyledSearchWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_views_settings_components_defaultSearchBar__WEBPACK_IMPORTED_MODULE_12__.SearchWrapper,  true ? {
  target: "e1ab1zjl0"
} : 0)( true ? {
  name: "1ekhw56",
  styles: "*{width:100%;}"
} : 0);

/***/ }),

/***/ "./app/views/settings/account/notifications/notificationSettingsByType.tsx":
/*!*********************************************************************************!*\
  !*** ./app/views/settings/account/notifications/notificationSettingsByType.tsx ***!
  \*********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/jsonForm */ "./app/components/forms/jsonForm.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_withOrganizations__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/withOrganizations */ "./app/utils/withOrganizations.tsx");
/* harmony import */ var sentry_views_settings_account_notifications_constants__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/settings/account/notifications/constants */ "./app/views/settings/account/notifications/constants.tsx");
/* harmony import */ var sentry_views_settings_account_notifications_fields__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/settings/account/notifications/fields */ "./app/views/settings/account/notifications/fields.tsx");
/* harmony import */ var sentry_views_settings_account_notifications_fields2__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/settings/account/notifications/fields2 */ "./app/views/settings/account/notifications/fields2.tsx");
/* harmony import */ var sentry_views_settings_account_notifications_notificationSettingsByOrganization__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/settings/account/notifications/notificationSettingsByOrganization */ "./app/views/settings/account/notifications/notificationSettingsByOrganization.tsx");
/* harmony import */ var sentry_views_settings_account_notifications_notificationSettingsByProjects__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/settings/account/notifications/notificationSettingsByProjects */ "./app/views/settings/account/notifications/notificationSettingsByProjects.tsx");
/* harmony import */ var sentry_views_settings_account_notifications_unlinkedAlert__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/settings/account/notifications/unlinkedAlert */ "./app/views/settings/account/notifications/unlinkedAlert.tsx");
/* harmony import */ var sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/views/settings/account/notifications/utils */ "./app/views/settings/account/notifications/utils.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





















const typeMappedChildren = {
  quota: ['quotaErrors', 'quotaTransactions', 'quotaAttachments', 'quotaWarnings']
};

const getQueryParams = notificationType => {
  // if we need multiple settings on this page
  // then omit the type so we can load all settings
  if (notificationType in typeMappedChildren) {
    return null;
  }

  return {
    type: notificationType
  };
};

class NotificationSettingsByType extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_4__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getStateToPutForProvider", changedData => {
      const {
        notificationType
      } = this.props;
      const {
        notificationSettings
      } = this.state;
      const updatedNotificationSettings = (0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_16__.getStateToPutForProvider)(notificationType, notificationSettings, changedData);
      this.setState({
        notificationSettings: (0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_16__.mergeNotificationSettings)(notificationSettings, updatedNotificationSettings)
      });
      return updatedNotificationSettings;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getStateToPutForDependentSetting", (changedData, notificationType) => {
      const value = changedData[notificationType];
      const {
        notificationSettings
      } = this.state; // parent setting will control the which providers we send to
      // just set every provider to the same value for the child/dependent setting

      const userSettings = sentry_views_settings_account_notifications_constants__WEBPACK_IMPORTED_MODULE_10__.ALL_PROVIDER_NAMES.reduce((accum, provider) => {
        accum[provider] = value;
        return accum;
      }, {}); // setting is a user-only setting

      const updatedNotificationSettings = {
        [notificationType]: {
          user: {
            me: userSettings
          }
        }
      };
      this.setState({
        notificationSettings: (0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_16__.mergeNotificationSettings)(notificationSettings, updatedNotificationSettings)
      });
      return updatedNotificationSettings;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getStateToPutForDefault", changedData => {
      const {
        notificationType
      } = this.props;
      const {
        notificationSettings
      } = this.state;
      const updatedNotificationSettings = (0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_16__.getStateToPutForDefault)(notificationType, notificationSettings, changedData, (0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_16__.getParentIds)(notificationType, notificationSettings));
      this.setState({
        notificationSettings: (0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_16__.mergeNotificationSettings)(notificationSettings, updatedNotificationSettings)
      });
      return updatedNotificationSettings;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getStateToPutForParent", (changedData, parentId) => {
      const {
        notificationType
      } = this.props;
      const {
        notificationSettings
      } = this.state;
      const updatedNotificationSettings = (0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_16__.getStateToPutForParent)(notificationType, notificationSettings, changedData, parentId);
      this.setState({
        notificationSettings: (0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_16__.mergeNotificationSettings)(notificationSettings, updatedNotificationSettings)
      });
      return updatedNotificationSettings;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getUnlinkedOrgs", () => {
      const {
        organizations
      } = this.props;
      const {
        identities,
        organizationIntegrations
      } = this.state;
      const integrationExternalIDsByOrganizationID = Object.fromEntries(organizationIntegrations.map(organizationIntegration => [organizationIntegration.organizationId, organizationIntegration.externalId]));
      const identitiesByExternalId = Object.fromEntries(identities.map(identity => {
        var _identity$identityPro;

        return [identity === null || identity === void 0 ? void 0 : (_identity$identityPro = identity.identityProvider) === null || _identity$identityPro === void 0 ? void 0 : _identity$identityPro.externalId, identity];
      }));
      return organizations.filter(organization => {
        const externalID = integrationExternalIDsByOrganizationID[organization.id];
        const identity = identitiesByExternalId[externalID];
        return identity === undefined || identity === null;
      });
    });
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      notificationSettings: {},
      identities: [],
      organizationIntegrations: []
    };
  }

  getEndpoints() {
    const {
      notificationType
    } = this.props;
    return [['notificationSettings', `/users/me/notification-settings/`, {
      query: getQueryParams(notificationType)
    }], ['identities', `/users/me/identities/`, {
      query: {
        provider: 'slack'
      }
    }], ['organizationIntegrations', `/users/me/organization-integrations/`, {
      query: {
        provider: 'slack'
      }
    }]];
  }

  componentDidMount() {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__["default"])('notification_settings.tuning_page_viewed', {
      organization: null,
      notification_type: this.props.notificationType
    });
  }

  trackTuningUpdated(tuningFieldType) {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__["default"])('notification_settings.updated_tuning_setting', {
      organization: null,
      notification_type: this.props.notificationType,
      tuning_field_type: tuningFieldType
    });
  }
  /* Methods responsible for updating state and hitting the API. */


  /* Methods responsible for rendering the page. */
  getInitialData() {
    const {
      notificationType
    } = this.props;
    const {
      notificationSettings
    } = this.state; // TODO: Backend should be in charge of providing defaults since it depends on the type

    const provider = !(0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_16__.isEverythingDisabled)(notificationType, notificationSettings) ? (0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_16__.getCurrentProviders)(notificationType, notificationSettings) : ['email', 'slack'];
    const childTypes = typeMappedChildren[notificationType] || [];
    const childTypesDefaults = Object.fromEntries(childTypes.map(childType => [childType, (0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_16__.getCurrentDefault)(childType, notificationSettings)]));
    return {
      [notificationType]: (0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_16__.getCurrentDefault)(notificationType, notificationSettings),
      provider,
      ...childTypesDefaults
    };
  }

  getFields() {
    const {
      notificationType
    } = this.props;
    const {
      notificationSettings
    } = this.state;
    const help = (0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_16__.isGroupedByProject)(notificationType) ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('This is the default for all projects.') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('This is the default for all organizations.');
    const defaultField = Object.assign({}, sentry_views_settings_account_notifications_fields2__WEBPACK_IMPORTED_MODULE_12__.NOTIFICATION_SETTING_FIELDS[notificationType], {
      help,
      getData: data => this.getStateToPutForDefault(data)
    });

    if ((0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_16__.isSufficientlyComplex)(notificationType, notificationSettings)) {
      defaultField.confirm = {
        never: sentry_views_settings_account_notifications_constants__WEBPACK_IMPORTED_MODULE_10__.CONFIRMATION_MESSAGE
      };
    }

    const fields = [defaultField];

    if (!(0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_16__.isEverythingDisabled)(notificationType, notificationSettings)) {
      fields.push(Object.assign({
        help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Where personal notifications will be sent.'),
        getData: data => this.getStateToPutForProvider(data)
      }, sentry_views_settings_account_notifications_fields2__WEBPACK_IMPORTED_MODULE_12__.NOTIFICATION_SETTING_FIELDS.provider));
    } // if a quota notification is not disabled, add in our dependent fields


    if (notificationType === 'quota' && !(0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_16__.isEverythingDisabled)(notificationType, notificationSettings)) {
      fields.push(...sentry_views_settings_account_notifications_fields2__WEBPACK_IMPORTED_MODULE_12__.QUOTA_FIELDS.map(field => ({ ...field,
        type: 'select',
        getData: data => this.getStateToPutForDependentSetting(data, field.name)
      })));
    }

    return fields;
  }

  renderBody() {
    const {
      notificationType
    } = this.props;
    const {
      notificationSettings
    } = this.state;
    const hasSlack = (0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_16__.getCurrentProviders)(notificationType, notificationSettings).includes('slack');
    const unlinkedOrgs = this.getUnlinkedOrgs();
    const {
      title,
      description
    } = sentry_views_settings_account_notifications_fields__WEBPACK_IMPORTED_MODULE_11__.ACCOUNT_NOTIFICATION_FIELDS[notificationType];
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_17__["default"], {
        title: title
      }), description && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_18__["default"], {
        children: description
      }), hasSlack && unlinkedOrgs.length > 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_views_settings_account_notifications_unlinkedAlert__WEBPACK_IMPORTED_MODULE_15__["default"], {
        organizations: unlinkedOrgs
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_5__["default"], {
        saveOnBlur: true,
        apiMethod: "PUT",
        apiEndpoint: "/users/me/notification-settings/",
        initialData: this.getInitialData(),
        onSubmitSuccess: () => this.trackTuningUpdated('general'),
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_6__["default"], {
          title: (0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_16__.isGroupedByProject)(notificationType) ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('All Projects') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('All Organizations'),
          fields: this.getFields()
        })
      }), !(0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_16__.isEverythingDisabled)(notificationType, notificationSettings) && ((0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_16__.isGroupedByProject)(notificationType) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_views_settings_account_notifications_notificationSettingsByProjects__WEBPACK_IMPORTED_MODULE_14__["default"], {
        notificationType: notificationType,
        notificationSettings: notificationSettings,
        onChange: this.getStateToPutForParent,
        onSubmitSuccess: () => this.trackTuningUpdated('project')
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_views_settings_account_notifications_notificationSettingsByOrganization__WEBPACK_IMPORTED_MODULE_13__["default"], {
        notificationType: notificationType,
        notificationSettings: notificationSettings,
        onChange: this.getStateToPutForParent,
        onSubmitSuccess: () => this.trackTuningUpdated('organization')
      }))]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganizations__WEBPACK_IMPORTED_MODULE_9__["default"])(NotificationSettingsByType));

/***/ }),

/***/ "./app/views/settings/account/notifications/unlinkedAlert.tsx":
/*!********************************************************************!*\
  !*** ./app/views/settings/account/notifications/unlinkedAlert.tsx ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






function UnlinkedAlert(_ref) {
  let {
    organizations
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(StyledAlert, {
    type: "warning",
    showIcon: true,
    children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('You\'ve selected Slack as your delivery method, but do not have a linked account for the following organizations. You\'ll receive email notifications instead until you type "/sentry link" into your Slack workspace to link your account. If slash commands are not working, please re-install the Slack integration.'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("ul", {
      children: organizations.map(organization => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("li", {
        children: organization.slug
      }, organization.id))
    })]
  });
}

UnlinkedAlert.displayName = "UnlinkedAlert";

const StyledAlert = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "e1w8osu50"
} : 0)( true ? {
  name: "12jd8yt",
  styles: "margin:20px 0px"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (UnlinkedAlert);

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

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_account_accountNotificationFineTuning_tsx.df9407a5fdf670e7b99e8eda1b546eaa.js.map