"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_account_notifications_notificationSettings_tsx"],{

/***/ "./app/views/settings/account/notifications/notificationSettings.tsx":
/*!***************************************************************************!*\
  !*** ./app/views/settings/account/notifications/notificationSettings.tsx ***!
  \***************************************************************************/
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
/* harmony import */ var sentry_components_alertLink__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/alertLink */ "./app/components/alertLink.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/forms/jsonForm */ "./app/components/forms/jsonForm.tsx");
/* harmony import */ var sentry_components_forms_model__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/forms/model */ "./app/components/forms/model.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_withOrganizations__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/withOrganizations */ "./app/utils/withOrganizations.tsx");
/* harmony import */ var sentry_views_settings_account_notifications_constants__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/settings/account/notifications/constants */ "./app/views/settings/account/notifications/constants.tsx");
/* harmony import */ var sentry_views_settings_account_notifications_fields2__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/settings/account/notifications/fields2 */ "./app/views/settings/account/notifications/fields2.tsx");
/* harmony import */ var sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/views/settings/account/notifications/utils */ "./app/views/settings/account/notifications/utils.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






















class NotificationSettings extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_5__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "model", new sentry_components_forms_model__WEBPACK_IMPORTED_MODULE_8__["default"]());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getStateToPutForDefault", (changedData, notificationType) => {
      /**
       * Update the current providers' parent-independent notification settings
       * with the new value. If the new value is "never", then also update all
       * parent-specific notification settings to "default". If the previous value
       * was "never", then assume providerList should be "email" only.
       */
      const {
        notificationSettings
      } = this.state;
      const updatedNotificationSettings = (0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_16__.getStateToPutForDefault)(notificationType, notificationSettings, changedData, (0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_16__.getParentIds)(notificationType, notificationSettings));
      this.setState({
        notificationSettings: (0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_16__.mergeNotificationSettings)(notificationSettings, updatedNotificationSettings)
      });
      return updatedNotificationSettings;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onFieldChange", fieldName => {
      if (sentry_views_settings_account_notifications_constants__WEBPACK_IMPORTED_MODULE_14__.SELF_NOTIFICATION_SETTINGS_TYPES.includes(fieldName)) {
        const endpointDetails = {
          apiEndpoint: '/users/me/notifications/'
        };
        this.model.setFormOptions({ ...this.model.options,
          ...endpointDetails
        });
      } else {
        const endpointDetails = {
          apiEndpoint: '/users/me/notification-settings/'
        };
        this.model.setFormOptions({ ...this.model.options,
          ...endpointDetails
        });
      }
    });
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      notificationSettings: {},
      legacyData: {}
    };
  }

  getEndpoints() {
    return [['notificationSettings', `/users/me/notification-settings/`], ['legacyData', '/users/me/notifications/']];
  }

  componentDidMount() {
    // only tied to a user
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_12__["default"])('notification_settings.index_page_viewed', {
      organization: null
    });
  }

  get notificationSettingsType() {
    // filter out quotas if the feature flag isn't set
    const hasSlackOverage = this.props.organizations.some(org => {
      var _org$features;

      return (_org$features = org.features) === null || _org$features === void 0 ? void 0 : _org$features.includes('slack-overage-notifications');
    });
    const hasActiveRelease = this.props.organizations.some(org => {
      var _org$features2;

      return (_org$features2 = org.features) === null || _org$features2 === void 0 ? void 0 : _org$features2.includes('active-release-monitor-alpha');
    });
    return sentry_views_settings_account_notifications_constants__WEBPACK_IMPORTED_MODULE_14__.NOTIFICATION_SETTINGS_TYPES.filter(type => {
      if (type === 'quota' && !hasSlackOverage) {
        return false;
      }

      if (type === 'activeRelease' && !hasActiveRelease) {
        return false;
      }

      return true;
    });
  }

  getInitialData() {
    const {
      notificationSettings,
      legacyData
    } = this.state;
    const notificationsInitialData = Object.fromEntries(this.notificationSettingsType.map(notificationType => [notificationType, (0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_16__.decideDefault)(notificationType, notificationSettings)]));
    const allInitialData = { ...notificationsInitialData,
      ...legacyData
    };
    return allInitialData;
  }

  getFields() {
    const {
      notificationSettings
    } = this.state;
    const fields = [];
    const endOfFields = [];

    for (const notificationType of this.notificationSettingsType) {
      const field = Object.assign({}, sentry_views_settings_account_notifications_fields2__WEBPACK_IMPORTED_MODULE_15__.NOTIFICATION_SETTING_FIELDS[notificationType], {
        getData: data => this.getStateToPutForDefault(data, notificationType),
        help: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)("p", {
            children: [sentry_views_settings_account_notifications_fields2__WEBPACK_IMPORTED_MODULE_15__.NOTIFICATION_SETTING_FIELDS[notificationType].help, "\xA0", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_9__["default"], {
              "data-test-id": "fine-tuning",
              to: `/settings/account/notifications/${notificationType}`,
              children: "Fine tune"
            })]
          })
        })
      });

      if ((0,sentry_views_settings_account_notifications_utils__WEBPACK_IMPORTED_MODULE_16__.isSufficientlyComplex)(notificationType, notificationSettings) && typeof field !== 'function') {
        field.confirm = {
          never: sentry_views_settings_account_notifications_constants__WEBPACK_IMPORTED_MODULE_14__.CONFIRMATION_MESSAGE
        };
      }

      if (field.type === 'blank') {
        endOfFields.push(field);
      } else {
        fields.push(field);
      }
    }

    const legacyField = sentry_views_settings_account_notifications_constants__WEBPACK_IMPORTED_MODULE_14__.SELF_NOTIFICATION_SETTINGS_TYPES.map(type => sentry_views_settings_account_notifications_fields2__WEBPACK_IMPORTED_MODULE_15__.NOTIFICATION_SETTING_FIELDS[type]);
    fields.push(...legacyField);
    const allFields = [...fields, ...endOfFields];
    return allFields;
  }

  renderBody() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_17__["default"], {
        title: "Notifications"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_18__["default"], {
        children: "Personal notifications sent by email or an integration."
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_6__["default"], {
        model: this.model,
        saveOnBlur: true,
        apiMethod: "PUT",
        onFieldChange: this.onFieldChange,
        initialData: this.getInitialData(),
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_7__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Notifications'),
          fields: this.getFields()
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_alertLink__WEBPACK_IMPORTED_MODULE_4__["default"], {
        to: "/settings/account/emails",
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconMail, {}),
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Looking to add or remove an email address? Use the emails panel.')
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganizations__WEBPACK_IMPORTED_MODULE_13__["default"])(NotificationSettings));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_account_notifications_notificationSettings_tsx.a2c543bf7705c16720b85dc4fc7eb4fe.js.map