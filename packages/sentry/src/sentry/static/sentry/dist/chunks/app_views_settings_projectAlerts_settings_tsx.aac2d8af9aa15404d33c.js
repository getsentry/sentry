"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_projectAlerts_settings_tsx"],{

/***/ "./app/data/forms/projectAlerts.tsx":
/*!******************************************!*\
  !*** ./app/data/forms/projectAlerts.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "fields": () => (/* binding */ fields),
/* harmony export */   "route": () => (/* binding */ route)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
 // Export route to make these forms searchable by label/help

const route = '/settings/:orgId/projects/:projectId/alerts/';

const formatMinutes = value => {
  value = Number(value) / 60;
  return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.tn)('%s minute', '%s minutes', value);
};

const fields = {
  subjectTemplate: {
    name: 'subjectTemplate',
    type: 'string',
    // additional data/props that is related to rendering of form field rather than data
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Subject Template'),
    placeholder: 'e.g. $shortID - $title',
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('The email subject to use (excluding the prefix) for individual alerts. Usable variables include: $title, $shortID, $projectID, $orgID, and ${tag:key}, such as ${tag:environment} or ${tag:release}.')
  },
  digestsMinDelay: {
    name: 'digestsMinDelay',
    type: 'range',
    min: 60,
    max: 3600,
    step: 60,
    defaultValue: 300,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Minimum delivery interval'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Notifications will be delivered at most this often.'),
    formatLabel: formatMinutes
  },
  digestsMaxDelay: {
    name: 'digestsMaxDelay',
    type: 'range',
    min: 60,
    max: 3600,
    step: 60,
    defaultValue: 300,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Maximum delivery interval'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Notifications will be delivered at least this often.'),
    formatLabel: formatMinutes
  }
};

/***/ }),

/***/ "./app/utils/routeTitle.tsx":
/*!**********************************!*\
  !*** ./app/utils/routeTitle.tsx ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
function routeTitleGen(routeName, orgSlug) {
  let withSentry = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
  let projectSlug = arguments.length > 3 ? arguments[3] : undefined;
  const tmplBase = `${routeName} - ${orgSlug}`;
  const tmpl = projectSlug ? `${tmplBase} - ${projectSlug}` : tmplBase;
  return withSentry ? `${tmpl} - Sentry` : tmpl;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (routeTitleGen);

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

/***/ "./app/views/settings/project/permissionAlert.tsx":
/*!********************************************************!*\
  !*** ./app/views/settings/project/permissionAlert.tsx ***!
  \********************************************************/
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
    access = ['project:write'],
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
        ...props,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('These settings can only be edited by users with the organization owner, manager, or admin role.')
      });
    }
  });
};

PermissionAlert.displayName = "PermissionAlert";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PermissionAlert);

/***/ }),

/***/ "./app/views/settings/projectAlerts/settings.tsx":
/*!*******************************************************!*\
  !*** ./app/views/settings/projectAlerts/settings.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_alertLink__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/alertLink */ "./app/components/alertLink.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/jsonForm */ "./app/components/forms/jsonForm.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_pluginList__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/pluginList */ "./app/components/pluginList.tsx");
/* harmony import */ var sentry_data_forms_projectAlerts__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/data/forms/projectAlerts */ "./app/data/forms/projectAlerts.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/routeTitle */ "./app/utils/routeTitle.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_project_permissionAlert__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/settings/project/permissionAlert */ "./app/views/settings/project/permissionAlert.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



















class Settings extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_13__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleEnablePlugin", plugin => {
      this.setState(prevState => {
        var _prevState$pluginList;

        return {
          pluginList: ((_prevState$pluginList = prevState.pluginList) !== null && _prevState$pluginList !== void 0 ? _prevState$pluginList : []).map(p => {
            if (p.id !== plugin.id) {
              return p;
            }

            return { ...plugin,
              enabled: true
            };
          })
        };
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDisablePlugin", plugin => {
      this.setState(prevState => {
        var _prevState$pluginList2;

        return {
          pluginList: ((_prevState$pluginList2 = prevState.pluginList) !== null && _prevState$pluginList2 !== void 0 ? _prevState$pluginList2 : []).map(p => {
            if (p.id !== plugin.id) {
              return p;
            }

            return { ...plugin,
              enabled: false
            };
          })
        };
      });
    });
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      project: null,
      pluginList: []
    };
  }

  getProjectEndpoint(_ref) {
    let {
      orgId,
      projectId
    } = _ref;
    return `/projects/${orgId}/${projectId}/`;
  }

  getEndpoints() {
    const {
      params
    } = this.props;
    const {
      orgId,
      projectId
    } = params;
    const projectEndpoint = this.getProjectEndpoint(params);
    return [['project', projectEndpoint], ['pluginList', `/projects/${orgId}/${projectId}/plugins/`]];
  }

  getTitle() {
    const {
      projectId
    } = this.props.params;
    return (0,sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_12__["default"])((0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Alerts Settings'), projectId, false);
  }

  renderBody() {
    const {
      canEditRule,
      organization,
      params
    } = this.props;
    const {
      orgId
    } = params;
    const {
      project,
      pluginList
    } = this.state;

    if (!project) {
      return null;
    }

    const projectEndpoint = this.getProjectEndpoint(params);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_14__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Alerts Settings'),
        action: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
          to: {
            pathname: `/organizations/${orgId}/alerts/rules/`,
            query: {
              project: project.id
            }
          },
          size: "sm",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('View Alert Rules')
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_views_settings_project_permissionAlert__WEBPACK_IMPORTED_MODULE_15__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_alertLink__WEBPACK_IMPORTED_MODULE_3__["default"], {
        to: "/settings/account/notifications/",
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconMail, {}),
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Looking to fine-tune your personal notification preferences? Visit your Account Settings')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_5__["default"], {
        saveOnBlur: true,
        allowUndo: true,
        initialData: {
          subjectTemplate: project.subjectTemplate,
          digestsMinDelay: project.digestsMinDelay,
          digestsMaxDelay: project.digestsMaxDelay
        },
        apiMethod: "PUT",
        apiEndpoint: projectEndpoint,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_6__["default"], {
          disabled: !canEditRule,
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Email Settings'),
          fields: [sentry_data_forms_projectAlerts__WEBPACK_IMPORTED_MODULE_9__.fields.subjectTemplate]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_6__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Digests'),
          disabled: !canEditRule,
          fields: [sentry_data_forms_projectAlerts__WEBPACK_IMPORTED_MODULE_9__.fields.digestsMinDelay, sentry_data_forms_projectAlerts__WEBPACK_IMPORTED_MODULE_9__.fields.digestsMaxDelay],
          renderHeader: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__.PanelAlert, {
            type: "info",
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Sentry will automatically digest alerts sent by some services to avoid flooding your inbox with individual issue notifications. To control how frequently notifications are delivered, use the sliders below.')
          })
        })]
      }), canEditRule && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_pluginList__WEBPACK_IMPORTED_MODULE_8__["default"], {
        organization: organization,
        project: project,
        pluginList: (pluginList !== null && pluginList !== void 0 ? pluginList : []).filter(p => p.type === 'notification' && p.hasConfiguration),
        onEnablePlugin: this.handleEnablePlugin,
        onDisablePlugin: this.handleDisablePlugin
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Settings);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_projectAlerts_settings_tsx.c5f9a59792fcf9586260277ae681efeb.js.map