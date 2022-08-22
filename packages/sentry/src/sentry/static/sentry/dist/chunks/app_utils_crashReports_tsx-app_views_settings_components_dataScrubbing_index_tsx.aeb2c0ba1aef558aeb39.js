"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_utils_crashReports_tsx-app_views_settings_components_dataScrubbing_index_tsx"],{

/***/ "./app/components/confirmDelete.tsx":
/*!******************************************!*\
  !*** ./app/components/confirmDelete.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_components_input__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/input */ "./app/components/input.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









const ConfirmDelete = _ref => {
  let {
    message,
    confirmInput,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_2__["default"], { ...props,
    bypass: false,
    disableConfirmButton: true,
    renderMessage: _ref2 => {
      let {
        disableConfirmButton
      } = _ref2;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__["default"], {
          type: "error",
          children: message
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_3__["default"], {
          flexibleControlStateSize: true,
          inline: false,
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Please enter %s to confirm the deletion', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("code", {
            children: confirmInput
          })),
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_input__WEBPACK_IMPORTED_MODULE_4__["default"], {
            type: "text",
            placeholder: confirmInput,
            onChange: e => disableConfirmButton(e.target.value !== confirmInput)
          })
        })]
      });
    }
  });
};

ConfirmDelete.displayName = "ConfirmDelete";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ConfirmDelete);

/***/ }),

/***/ "./app/utils/crashReports.tsx":
/*!************************************!*\
  !*** ./app/utils/crashReports.tsx ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SettingScope": () => (/* binding */ SettingScope),
/* harmony export */   "formatStoreCrashReports": () => (/* binding */ formatStoreCrashReports),
/* harmony export */   "getStoreCrashReportsValues": () => (/* binding */ getStoreCrashReportsValues)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");


function formatStoreCrashReports(value, organizationValue) {
  if (value === null && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(organizationValue)) {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.tct)('Inherit organization settings ([organizationValue])', {
      organizationValue: formatStoreCrashReports(organizationValue)
    });
  }

  if (value === -1) {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Unlimited');
  }

  if (value === 0) {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Disabled');
  }

  return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.tct)('[value] per issue', {
    value
  });
}
let SettingScope;

(function (SettingScope) {
  SettingScope[SettingScope["Organization"] = 0] = "Organization";
  SettingScope[SettingScope["Project"] = 1] = "Project";
})(SettingScope || (SettingScope = {}));

function getStoreCrashReportsValues(settingScope) {
  const values = [0, // disabled
  1, // limited per issue
  5, 10, 20, 50, 100, -1 // unlimited
  ];

  if (settingScope === SettingScope.Project) {
    values.unshift(null); // inherit option
  }

  return values;
}

/***/ }),

/***/ "./app/views/settings/components/dataScrubbing/content.tsx":
/*!*****************************************************************!*\
  !*** ./app/views/settings/components/dataScrubbing/content.tsx ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var _rules__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./rules */ "./app/views/settings/components/dataScrubbing/rules.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






const Content = _ref => {
  let {
    rules,
    disabled,
    onDeleteRule,
    onEditRule
  } = _ref;

  if (rules.length === 0) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_2__["default"], {
      icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_0__.IconWarning, {
        size: "xl"
      }),
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('You have no data scrubbing rules')
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_rules__WEBPACK_IMPORTED_MODULE_3__["default"], {
    rules: rules,
    onDeleteRule: onDeleteRule,
    onEditRule: onEditRule,
    disabled: disabled
  });
};

Content.displayName = "Content";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Content);

/***/ }),

/***/ "./app/views/settings/components/dataScrubbing/convertRelayPiiConfig.tsx":
/*!*******************************************************************************!*\
  !*** ./app/views/settings/components/dataScrubbing/convertRelayPiiConfig.tsx ***!
  \*******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./types */ "./app/views/settings/components/dataScrubbing/types.tsx");

 // Remap PII config format to something that is more usable in React. Ideally
// we would stop doing this at some point and make some updates to how we
// store this configuration on the server.
//
// For the time being the PII config format is documented at
// https://getsentry.github.io/relay/pii-config/

function convertRelayPiiConfig(relayPiiConfig) {
  const piiConfig = relayPiiConfig ? JSON.parse(relayPiiConfig) : {};
  const rules = piiConfig.rules || {};
  const applications = piiConfig.applications || {};
  const convertedRules = [];

  for (const application in applications) {
    for (const rule of applications[application]) {
      const resolvedRule = rules[rule];
      const id = convertedRules.length;
      const source = application;

      if (!resolvedRule) {
        // Convert a "built-in" rule like "@anything:remove" to an object {
        //   type: "anything",
        //   method: "remove"
        // }
        if (rule[0] === '@') {
          const typeAndMethod = rule.slice(1).split(':');
          let [type] = typeAndMethod;
          const [, method] = typeAndMethod;

          if (type === 'urlauth') {
            type = 'url_auth';
          }

          if (type === 'usssn') {
            type = 'us_ssn';
          }

          convertedRules.push({
            id,
            method: method,
            type: type,
            source
          });
        }

        continue;
      }

      const {
        type,
        redaction
      } = resolvedRule;
      const method = redaction.method;

      if (method === _types__WEBPACK_IMPORTED_MODULE_1__.MethodType.REPLACE && resolvedRule.type === _types__WEBPACK_IMPORTED_MODULE_1__.RuleType.PATTERN) {
        convertedRules.push({
          id,
          method: _types__WEBPACK_IMPORTED_MODULE_1__.MethodType.REPLACE,
          type: _types__WEBPACK_IMPORTED_MODULE_1__.RuleType.PATTERN,
          source,
          placeholder: redaction === null || redaction === void 0 ? void 0 : redaction.text,
          pattern: resolvedRule.pattern
        });
        continue;
      }

      if (method === _types__WEBPACK_IMPORTED_MODULE_1__.MethodType.REPLACE) {
        convertedRules.push({
          id,
          method: _types__WEBPACK_IMPORTED_MODULE_1__.MethodType.REPLACE,
          type,
          source,
          placeholder: redaction === null || redaction === void 0 ? void 0 : redaction.text
        });
        continue;
      }

      if (resolvedRule.type === _types__WEBPACK_IMPORTED_MODULE_1__.RuleType.PATTERN) {
        convertedRules.push({
          id,
          method,
          type: _types__WEBPACK_IMPORTED_MODULE_1__.RuleType.PATTERN,
          source,
          pattern: resolvedRule.pattern
        });
        continue;
      }

      convertedRules.push({
        id,
        method,
        type,
        source
      });
    }
  }

  return convertedRules;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (convertRelayPiiConfig);

/***/ }),

/***/ "./app/views/settings/components/dataScrubbing/index.tsx":
/*!***************************************************************!*\
  !*** ./app/views/settings/components/dataScrubbing/index.tsx ***!
  \***************************************************************/
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
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_api__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/api */ "./app/api.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _modals_add__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./modals/add */ "./app/views/settings/components/dataScrubbing/modals/add.tsx");
/* harmony import */ var _modals_edit__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./modals/edit */ "./app/views/settings/components/dataScrubbing/modals/edit.tsx");
/* harmony import */ var _content__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./content */ "./app/views/settings/components/dataScrubbing/content.tsx");
/* harmony import */ var _convertRelayPiiConfig__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./convertRelayPiiConfig */ "./app/views/settings/components/dataScrubbing/convertRelayPiiConfig.tsx");
/* harmony import */ var _organizationRules__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ./organizationRules */ "./app/views/settings/components/dataScrubbing/organizationRules.tsx");
/* harmony import */ var _submitRules__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ./submitRules */ "./app/views/settings/components/dataScrubbing/submitRules.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




















const ADVANCED_DATASCRUBBING_LINK = 'https://docs.sentry.io/product/data-management-settings/scrubbing/advanced-datascrubbing/';

class DataScrubbing extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      rules: [],
      savedRules: [],
      relayPiiConfig: this.props.relayPiiConfig,
      orgRules: []
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "api", new sentry_api__WEBPACK_IMPORTED_MODULE_6__.Client());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleOpenAddModal", () => {
      const {
        rules
      } = this.state;
      (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_5__.openModal)(modalProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(_modals_add__WEBPACK_IMPORTED_MODULE_12__["default"], { ...modalProps,
        projectId: this.props.projectId,
        savedRules: rules,
        api: this.api,
        endpoint: this.props.endpoint,
        orgSlug: this.props.organization.slug,
        onSubmitSuccess: response => {
          this.successfullySaved(response, (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Successfully added data scrubbing rule'));
        }
      }));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleOpenEditModal", id => () => {
      const {
        rules
      } = this.state;
      (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_5__.openModal)(modalProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(_modals_edit__WEBPACK_IMPORTED_MODULE_13__["default"], { ...modalProps,
        rule: rules[id],
        projectId: this.props.projectId,
        savedRules: rules,
        api: this.api,
        endpoint: this.props.endpoint,
        orgSlug: this.props.organization.slug,
        onSubmitSuccess: response => {
          this.successfullySaved(response, (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Successfully updated data scrubbing rule'));
        }
      }));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDelete", id => async () => {
      const {
        rules
      } = this.state;
      const filteredRules = rules.filter(rule => rule.id !== id);

      try {
        const data = await (0,_submitRules__WEBPACK_IMPORTED_MODULE_17__["default"])(this.api, this.props.endpoint, filteredRules);

        if (data !== null && data !== void 0 && data.relayPiiConfig) {
          const convertedRules = (0,_convertRelayPiiConfig__WEBPACK_IMPORTED_MODULE_15__["default"])(data.relayPiiConfig);
          this.setState({
            rules: convertedRules
          });
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Successfully deleted data scrubbing rule'));
        }
      } catch {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('An unknown error occurred while deleting data scrubbing rule'));
      }
    });
  }

  componentDidMount() {
    this.loadRules();
    this.loadOrganizationRules();
  }

  componentDidUpdate(_prevProps, prevState) {
    if (prevState.relayPiiConfig !== this.state.relayPiiConfig) {
      this.loadRules();
    }
  }

  componentWillUnmount() {
    this.api.clear();
  }

  loadOrganizationRules() {
    const {
      organization,
      projectId
    } = this.props;

    if (projectId) {
      try {
        this.setState({
          orgRules: (0,_convertRelayPiiConfig__WEBPACK_IMPORTED_MODULE_15__["default"])(organization.relayPiiConfig)
        });
      } catch {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Unable to load organization rules'));
      }
    }
  }

  loadRules() {
    try {
      const convertedRules = (0,_convertRelayPiiConfig__WEBPACK_IMPORTED_MODULE_15__["default"])(this.state.relayPiiConfig);
      this.setState({
        rules: convertedRules,
        savedRules: convertedRules
      });
    } catch {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Unable to load project rules'));
    }
  }

  successfullySaved(response, successMessage) {
    const {
      onSubmitSuccess
    } = this.props;
    this.setState({
      rules: (0,_convertRelayPiiConfig__WEBPACK_IMPORTED_MODULE_15__["default"])(response.relayPiiConfig)
    });
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)(successMessage);
    onSubmitSuccess === null || onSubmitSuccess === void 0 ? void 0 : onSubmitSuccess(response);
  }

  render() {
    const {
      additionalContext,
      disabled,
      projectId
    } = this.props;
    const {
      orgRules,
      rules
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.Panel, {
      "data-test-id": "advanced-data-scrubbing",
      id: "advanced-data-scrubbing",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.PanelHeader, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("div", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Advanced Data Scrubbing')
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.PanelAlert, {
        type: "info",
        children: [additionalContext, ' ', `${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('The new rules will only apply to upcoming events. ')}`, ' ', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.tct)('For more details, see [linkToDocs].', {
          linkToDocs: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_8__["default"], {
            href: ADVANCED_DATASCRUBBING_LINK,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('full documentation on data scrubbing')
          })
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.PanelBody, {
        children: [projectId && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(_organizationRules__WEBPACK_IMPORTED_MODULE_16__["default"], {
          rules: orgRules
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(_content__WEBPACK_IMPORTED_MODULE_14__["default"], {
          rules: rules,
          onDeleteRule: this.handleDelete,
          onEditRule: this.handleOpenEditModal,
          disabled: disabled
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(PanelAction, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
            href: ADVANCED_DATASCRUBBING_LINK,
            external: true,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Read Docs')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
            disabled: disabled,
            onClick: this.handleOpenAddModal,
            priority: "primary",
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Add Rule')
          })]
        })]
      })]
    });
  }

}

DataScrubbing.displayName = "DataScrubbing";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DataScrubbing);

const PanelAction = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eqomu9m0"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(2), ";position:relative;display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(1), ";grid-template-columns:auto auto;justify-content:flex-end;border-top:1px solid ", p => p.theme.border, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/components/dataScrubbing/modals/add.tsx":
/*!********************************************************************!*\
  !*** ./app/views/settings/components/dataScrubbing/modals/add.tsx ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _modalManager__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./modalManager */ "./app/views/settings/components/dataScrubbing/modals/modalManager.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





const Add = _ref => {
  let {
    savedRules,
    ...props
  } = _ref;

  const handleGetNewRules = values => {
    return [...savedRules, { ...values,
      id: savedRules.length
    }];
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_modalManager__WEBPACK_IMPORTED_MODULE_2__["default"], { ...props,
    savedRules: savedRules,
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Add an advanced data scrubbing rule'),
    onGetNewRules: handleGetNewRules
  });
};

Add.displayName = "Add";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Add);

/***/ }),

/***/ "./app/views/settings/components/dataScrubbing/modals/edit.tsx":
/*!*********************************************************************!*\
  !*** ./app/views/settings/components/dataScrubbing/modals/edit.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _modalManager__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./modalManager */ "./app/views/settings/components/dataScrubbing/modals/modalManager.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




const Edit = _ref => {
  let {
    savedRules,
    rule,
    ...props
  } = _ref;

  const handleGetNewRules = values => {
    const updatedRule = { ...values,
      id: rule.id
    };
    const newRules = savedRules.map(savedRule => {
      if (savedRule.id === updatedRule.id) {
        return updatedRule;
      }

      return savedRule;
    });
    return newRules;
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(_modalManager__WEBPACK_IMPORTED_MODULE_1__["default"], { ...props,
    savedRules: savedRules,
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Edit an advanced data scrubbing rule'),
    initialState: rule,
    onGetNewRules: handleGetNewRules
  });
};

Edit.displayName = "Edit";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Edit);

/***/ }),

/***/ "./app/views/settings/components/dataScrubbing/modals/form/eventIdField.tsx":
/*!**********************************************************************************!*\
  !*** ./app/views/settings/components/dataScrubbing/modals/form/eventIdField.tsx ***!
  \**********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_components_input__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/input */ "./app/components/input.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ../../types */ "./app/views/settings/components/dataScrubbing/types.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ../utils */ "./app/views/settings/components/dataScrubbing/modals/utils.tsx");
/* harmony import */ var _eventIdFieldStatusIcon__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./eventIdFieldStatusIcon */ "./app/views/settings/components/dataScrubbing/modals/form/eventIdFieldStatusIcon.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }













class EventIdField extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", { ...this.props.eventId
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChange", event => {
      const eventId = event.target.value.replace(/-/g, '').trim();

      if (eventId !== this.state.value) {
        this.setState({
          value: eventId,
          status: _types__WEBPACK_IMPORTED_MODULE_10__.EventIdStatus.UNDEFINED
        });
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleBlur", event => {
      event.preventDefault();

      if (this.isEventIdValid()) {
        this.props.onUpdateEventId(this.state.value);
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleKeyDown", event => {
      const {
        keyCode
      } = event;

      if (keyCode === 13 && this.isEventIdValid()) {
        this.props.onUpdateEventId(this.state.value);
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleClickIconClose", () => {
      this.setState({
        value: '',
        status: _types__WEBPACK_IMPORTED_MODULE_10__.EventIdStatus.UNDEFINED
      });
    });
  }

  componentDidUpdate(prevProps) {
    if (!lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(prevProps.eventId, this.props.eventId)) {
      this.loadState();
    }
  }

  loadState() {
    this.setState({ ...this.props.eventId
    });
  }

  getErrorMessage() {
    const {
      status
    } = this.state;

    switch (status) {
      case _types__WEBPACK_IMPORTED_MODULE_10__.EventIdStatus.INVALID:
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('This event ID is invalid');

      case _types__WEBPACK_IMPORTED_MODULE_10__.EventIdStatus.ERROR:
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('An error occurred while fetching the suggestions based on this event ID');

      case _types__WEBPACK_IMPORTED_MODULE_10__.EventIdStatus.NOT_FOUND:
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('The chosen event ID was not found in projects you have access to');

      default:
        return undefined;
    }
  }

  isEventIdValid() {
    const {
      value,
      status
    } = this.state;

    if (value && value.length !== 32) {
      if (status !== _types__WEBPACK_IMPORTED_MODULE_10__.EventIdStatus.INVALID) {
        (0,_utils__WEBPACK_IMPORTED_MODULE_11__.saveToSourceGroupData)({
          value,
          status
        });
        this.setState({
          status: _types__WEBPACK_IMPORTED_MODULE_10__.EventIdStatus.INVALID
        });
      }

      return false;
    }

    return true;
  }

  render() {
    const {
      disabled
    } = this.props;
    const {
      value,
      status
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_6__["default"], {
      "data-test-id": "event-id-field",
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Event ID (Optional)'),
      help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Providing an event ID will automatically provide you a list of suggested sources'),
      inline: false,
      error: this.getErrorMessage(),
      flexibleControlStateSize: true,
      stacked: true,
      showHelpInTooltip: true,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(FieldWrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(StyledInput, {
          type: "text",
          name: "eventId",
          disabled: disabled,
          value: value,
          placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('XXXXXXXXXXXXXX'),
          onChange: this.handleChange,
          onKeyDown: this.handleKeyDown,
          onBlur: this.handleBlur
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(Status, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(_eventIdFieldStatusIcon__WEBPACK_IMPORTED_MODULE_12__["default"], {
            onClickIconClose: this.handleClickIconClose,
            status: status
          })
        })]
      })
    });
  }

}

EventIdField.displayName = "EventIdField";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EventIdField);

const StyledInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_input__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "e1noqa6o2"
} : 0)("flex:1;font-weight:400;input{padding-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1.5), ";}margin-bottom:0;" + ( true ? "" : 0));

const Status = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1noqa6o1"
} : 0)("height:40px;position:absolute;right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1.5), ";top:0;display:flex;align-items:center;" + ( true ? "" : 0));

const FieldWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1noqa6o0"
} : 0)( true ? {
  name: "9iujih",
  styles: "position:relative;display:flex;align-items:center"
} : 0);

/***/ }),

/***/ "./app/views/settings/components/dataScrubbing/modals/form/eventIdFieldStatusIcon.tsx":
/*!********************************************************************************************!*\
  !*** ./app/views/settings/components/dataScrubbing/modals/form/eventIdFieldStatusIcon.tsx ***!
  \********************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_forms_field_controlState__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/forms/field/controlState */ "./app/components/forms/field/controlState.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../../types */ "./app/views/settings/components/dataScrubbing/types.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }








const EventIdFieldStatusIcon = _ref => {
  let {
    status,
    onClickIconClose
  } = _ref;

  switch (status) {
    case _types__WEBPACK_IMPORTED_MODULE_5__.EventIdStatus.ERROR:
    case _types__WEBPACK_IMPORTED_MODULE_5__.EventIdStatus.INVALID:
    case _types__WEBPACK_IMPORTED_MODULE_5__.EventIdStatus.NOT_FOUND:
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(CloseIcon, {
        onClick: onClickIconClose,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_2__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Clear event ID'),
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(StyledIconClose, {
            size: "xs"
          })
        })
      });

    case _types__WEBPACK_IMPORTED_MODULE_5__.EventIdStatus.LOADING:
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_forms_field_controlState__WEBPACK_IMPORTED_MODULE_1__["default"], {
        isSaving: true
      });

    case _types__WEBPACK_IMPORTED_MODULE_5__.EventIdStatus.LOADED:
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconCheckmark, {
        color: "green300"
      });

    default:
      return null;
  }
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EventIdFieldStatusIcon);

const CloseIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1r9uw6i1"
} : 0)( true ? {
  name: "15o8flj",
  styles: ":first-child{line-height:0;}"
} : 0);

const StyledIconClose = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconClose,  true ? {
  target: "e1r9uw6i0"
} : 0)("color:", p => p.theme.gray200, ";:hover{color:", p => p.theme.gray300, ";}cursor:pointer;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/components/dataScrubbing/modals/form/index.tsx":
/*!***************************************************************************!*\
  !*** ./app/views/settings/components/dataScrubbing/modals/form/index.tsx ***!
  \***************************************************************************/
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
/* harmony import */ var lodash_sortBy__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/sortBy */ "../node_modules/lodash/sortBy.js");
/* harmony import */ var lodash_sortBy__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_sortBy__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_components_input__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/input */ "./app/components/input.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ../../types */ "./app/views/settings/components/dataScrubbing/types.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ../../utils */ "./app/views/settings/components/dataScrubbing/utils.tsx");
/* harmony import */ var _eventIdField__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./eventIdField */ "./app/views/settings/components/dataScrubbing/modals/form/eventIdField.tsx");
/* harmony import */ var _selectField__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./selectField */ "./app/views/settings/components/dataScrubbing/modals/form/selectField.tsx");
/* harmony import */ var _sourceField__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./sourceField */ "./app/views/settings/components/dataScrubbing/modals/form/sourceField.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

















class Form extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    var _this$props$eventId;

    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      displayEventId: !!((_this$props$eventId = this.props.eventId) !== null && _this$props$eventId !== void 0 && _this$props$eventId.value)
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChange", field => event => {
      this.props.onChange(field, event.target.value);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleToggleEventId", () => {
      this.setState(prevState => ({
        displayEventId: !prevState.displayEventId
      }));
    });
  }

  render() {
    const {
      values,
      onChange,
      errors,
      onValidate,
      sourceSuggestions,
      onUpdateEventId,
      eventId
    } = this.props;
    const {
      method,
      type,
      source
    } = values;
    const {
      displayEventId
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(FieldGroup, {
        hasTwoColumns: values.method === _types__WEBPACK_IMPORTED_MODULE_11__.MethodType.REPLACE,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_6__["default"], {
          "data-test-id": "method-field",
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Method'),
          help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('What to do'),
          inline: false,
          flexibleControlStateSize: true,
          stacked: true,
          showHelpInTooltip: true,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_selectField__WEBPACK_IMPORTED_MODULE_14__["default"], {
            placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Select method'),
            name: "method",
            options: lodash_sortBy__WEBPACK_IMPORTED_MODULE_4___default()(Object.values(_types__WEBPACK_IMPORTED_MODULE_11__.MethodType)).map(value => ({ ...(0,_utils__WEBPACK_IMPORTED_MODULE_12__.getMethodLabel)(value),
              value
            })),
            value: method,
            onChange: value => onChange('method', value === null || value === void 0 ? void 0 : value.value)
          })
        }), values.method === _types__WEBPACK_IMPORTED_MODULE_11__.MethodType.REPLACE && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_6__["default"], {
          "data-test-id": "placeholder-field",
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Custom Placeholder (Optional)'),
          help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('It will replace the default placeholder [Filtered]'),
          inline: false,
          flexibleControlStateSize: true,
          stacked: true,
          showHelpInTooltip: true,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_input__WEBPACK_IMPORTED_MODULE_7__["default"], {
            type: "text",
            name: "placeholder",
            placeholder: `[${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Filtered')}]`,
            onChange: this.handleChange('placeholder'),
            value: values.placeholder
          })
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(FieldGroup, {
        hasTwoColumns: values.type === _types__WEBPACK_IMPORTED_MODULE_11__.RuleType.PATTERN,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_6__["default"], {
          "data-test-id": "type-field",
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Data Type'),
          help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('What to look for. Use an existing pattern or define your own using regular expressions.'),
          inline: false,
          flexibleControlStateSize: true,
          stacked: true,
          showHelpInTooltip: true,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_selectField__WEBPACK_IMPORTED_MODULE_14__["default"], {
            placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Select type'),
            name: "type",
            options: lodash_sortBy__WEBPACK_IMPORTED_MODULE_4___default()(Object.values(_types__WEBPACK_IMPORTED_MODULE_11__.RuleType)).map(value => ({
              label: (0,_utils__WEBPACK_IMPORTED_MODULE_12__.getRuleLabel)(value),
              value
            })),
            value: type,
            onChange: value => onChange('type', value === null || value === void 0 ? void 0 : value.value)
          })
        }), values.type === _types__WEBPACK_IMPORTED_MODULE_11__.RuleType.PATTERN && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_6__["default"], {
          "data-test-id": "regex-field",
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Regex matches'),
          help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Custom regular expression (see documentation)'),
          inline: false,
          error: errors === null || errors === void 0 ? void 0 : errors.pattern,
          flexibleControlStateSize: true,
          stacked: true,
          required: true,
          showHelpInTooltip: true,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(RegularExpression, {
            type: "text",
            name: "pattern",
            placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('[a-zA-Z0-9]+'),
            onChange: this.handleChange('pattern'),
            value: values.pattern,
            onBlur: onValidate('pattern')
          })
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(ToggleWrapper, {
        children: displayEventId ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(Toggle, {
          priority: "link",
          onClick: this.handleToggleEventId,
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Hide event ID field'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_8__.IconChevron, {
            direction: "up",
            size: "xs"
          })]
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(Toggle, {
          priority: "link",
          onClick: this.handleToggleEventId,
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Use event ID for auto-completion'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_8__.IconChevron, {
            direction: "down",
            size: "xs"
          })]
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(SourceGroup, {
        isExpanded: displayEventId,
        children: [displayEventId && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_eventIdField__WEBPACK_IMPORTED_MODULE_13__["default"], {
          onUpdateEventId: onUpdateEventId,
          eventId: eventId
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_sourceField__WEBPACK_IMPORTED_MODULE_15__["default"], {
          onChange: value => onChange('source', value),
          value: source,
          error: errors === null || errors === void 0 ? void 0 : errors.source,
          onBlur: onValidate('source'),
          isRegExMatchesSelected: type === _types__WEBPACK_IMPORTED_MODULE_11__.RuleType.PATTERN,
          suggestions: sourceSuggestions
        })]
      })]
    });
  }

}

Form.displayName = "Form";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Form);

const FieldGroup = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eph2y5h4"
} : 0)("display:grid;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(2), ";@media (min-width: ", p => p.theme.breakpoints.small, "){gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(2), ";", p => p.hasTwoColumns && `grid-template-columns: 1fr 1fr;`, " margin-bottom:", p => p.hasTwoColumns ? 0 : (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(2), ";}" + ( true ? "" : 0));

const SourceGroup = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eph2y5h3"
} : 0)("height:65px;transition:all 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;transition-property:height;", p => p.isExpanded && `
    border-radius: ${p.theme.borderRadius};
    border: 1px solid ${p.theme.border};
    box-shadow: ${p.theme.dropShadowLight};
    margin: ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(2)} 0 ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(3)} 0;
    padding: ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(2)};
    height: 180px;
  `, ";" + ( true ? "" : 0));

const RegularExpression = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_input__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "eph2y5h2"
} : 0)("font-family:", p => p.theme.text.familyMono, ";" + ( true ? "" : 0));

const ToggleWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eph2y5h1"
} : 0)( true ? {
  name: "skgbeu",
  styles: "display:flex;justify-content:flex-end"
} : 0);

const Toggle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "eph2y5h0"
} : 0)("font-weight:700;color:", p => p.theme.subText, ";&:hover,&:focus{color:", p => p.theme.textColor, ";}>*:first-child{display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(0.5), ";grid-template-columns:repeat(2, max-content);align-items:center;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/components/dataScrubbing/modals/form/selectField.tsx":
/*!*********************************************************************************!*\
  !*** ./app/views/settings/components/dataScrubbing/modals/form/selectField.tsx ***!
  \*********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






class SelectField extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "selectRef", /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_2__.createRef)());
  }

  componentDidMount() {
    var _this$selectRef$curre, _this$selectRef$curre2;

    if (!this.selectRef.current) {
      return;
    }

    if ((_this$selectRef$curre = this.selectRef.current) !== null && _this$selectRef$curre !== void 0 && (_this$selectRef$curre2 = _this$selectRef$curre.select) !== null && _this$selectRef$curre2 !== void 0 && _this$selectRef$curre2.inputRef) {
      this.selectRef.current.select.inputRef.autocomplete = 'off';
    }
  } // TODO(ts) The generics in react-select make getting a good type here hard.


  render() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_3__["default"], { ...this.props,
      isSearchable: false,
      options: this.props.options.map(opt => ({ ...opt,
        details: opt.description ? `(${opt.description})` : undefined
      })),
      styles: {
        control: provided => ({ ...provided,
          minHeight: '41px',
          height: '41px'
        })
      },
      ref: this.selectRef,
      openOnFocus: true
    });
  }

}

SelectField.displayName = "SelectField";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SelectField);

/***/ }),

/***/ "./app/views/settings/components/dataScrubbing/modals/form/sourceField.tsx":
/*!*********************************************************************************!*\
  !*** ./app/views/settings/components/dataScrubbing/modals/form/sourceField.tsx ***!
  \*********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_forms_inputField__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/inputField */ "./app/components/forms/inputField.tsx");
/* harmony import */ var sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/textOverflow */ "./app/components/textOverflow.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ../../types */ "./app/views/settings/components/dataScrubbing/types.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ../../utils */ "./app/views/settings/components/dataScrubbing/utils.tsx");
/* harmony import */ var _sourceSuggestionExamples__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./sourceSuggestionExamples */ "./app/views/settings/components/dataScrubbing/modals/form/sourceSuggestionExamples.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }












const defaultHelp = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Where to look. In the simplest case this can be an attribute name.');

class SourceField extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      suggestions: [],
      fieldValues: [],
      activeSuggestion: 0,
      showSuggestions: false,
      hideCaret: false,
      help: defaultHelp
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "selectorField", /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_4__.createRef)());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "suggestionList", /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_4__.createRef)());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChange", value => {
      this.loadFieldValues(value);
      this.props.onChange(value);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleClickOutside", () => {
      this.setState({
        showSuggestions: false,
        hideCaret: false
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleClickSuggestionItem", suggestion => {
      const fieldValues = this.getNewFieldValues(suggestion);
      this.setState({
        fieldValues,
        activeSuggestion: 0,
        showSuggestions: false,
        hideCaret: false
      }, this.changeParentValue);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleKeyDown", (_value, event) => {
      event.persist();
      const {
        keyCode
      } = event;
      const {
        activeSuggestion,
        suggestions
      } = this.state;

      if (keyCode === 8 || keyCode === 32) {
        this.toggleSuggestions(true);
        return;
      }

      if (keyCode === 13) {
        this.handleClickSuggestionItem(suggestions[activeSuggestion]);
        return;
      }

      if (keyCode === 38) {
        if (activeSuggestion === 0) {
          return;
        }

        this.setState({
          activeSuggestion: activeSuggestion - 1
        }, () => {
          this.scrollToSuggestion();
        });
        return;
      }

      if (keyCode === 40) {
        if (activeSuggestion === suggestions.length - 1) {
          return;
        }

        this.setState({
          activeSuggestion: activeSuggestion + 1
        }, () => {
          this.scrollToSuggestion();
        });
        return;
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleFocus", () => {
      this.toggleSuggestions(true);
    });
  }

  componentDidMount() {
    this.loadFieldValues(this.props.value);
    this.toggleSuggestions(false);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.suggestions !== this.props.suggestions) {
      this.loadFieldValues(this.props.value);
      this.toggleSuggestions(false);
    }

    if (prevProps.isRegExMatchesSelected !== this.props.isRegExMatchesSelected || prevProps.value !== this.props.value) {
      this.checkPossiblyRegExMatchExpression(this.props.value);
    }
  }

  getAllSuggestions() {
    return [...this.getValueSuggestions(), ..._utils__WEBPACK_IMPORTED_MODULE_11__.unarySuggestions, ..._utils__WEBPACK_IMPORTED_MODULE_11__.binarySuggestions];
  }

  getValueSuggestions() {
    return this.props.suggestions || [];
  }

  getFilteredSuggestions(value, type) {
    let valuesToBeFiltered = [];

    switch (type) {
      case _types__WEBPACK_IMPORTED_MODULE_10__.SourceSuggestionType.BINARY:
        {
          valuesToBeFiltered = _utils__WEBPACK_IMPORTED_MODULE_11__.binarySuggestions;
          break;
        }

      case _types__WEBPACK_IMPORTED_MODULE_10__.SourceSuggestionType.VALUE:
        {
          valuesToBeFiltered = this.getValueSuggestions();
          break;
        }

      case _types__WEBPACK_IMPORTED_MODULE_10__.SourceSuggestionType.UNARY:
        {
          valuesToBeFiltered = _utils__WEBPACK_IMPORTED_MODULE_11__.unarySuggestions;
          break;
        }

      default:
        {
          valuesToBeFiltered = [...this.getValueSuggestions(), ..._utils__WEBPACK_IMPORTED_MODULE_11__.unarySuggestions];
        }
    }

    const filteredSuggestions = valuesToBeFiltered.filter(s => s.value.toLowerCase().indexOf(value.toLowerCase()) > -1);
    return filteredSuggestions;
  }

  getNewSuggestions(fieldValues) {
    const lastFieldValue = fieldValues[fieldValues.length - 1];
    const penultimateFieldValue = fieldValues[fieldValues.length - 2];

    if (Array.isArray(lastFieldValue)) {
      // recursion
      return this.getNewSuggestions(lastFieldValue);
    }

    if (Array.isArray(penultimateFieldValue)) {
      if ((lastFieldValue === null || lastFieldValue === void 0 ? void 0 : lastFieldValue.type) === 'binary') {
        // returns filtered values
        return this.getFilteredSuggestions(lastFieldValue === null || lastFieldValue === void 0 ? void 0 : lastFieldValue.value, _types__WEBPACK_IMPORTED_MODULE_10__.SourceSuggestionType.VALUE);
      } // returns all binaries without any filter


      return this.getFilteredSuggestions('', _types__WEBPACK_IMPORTED_MODULE_10__.SourceSuggestionType.BINARY);
    }

    if ((lastFieldValue === null || lastFieldValue === void 0 ? void 0 : lastFieldValue.type) === 'value' && (penultimateFieldValue === null || penultimateFieldValue === void 0 ? void 0 : penultimateFieldValue.type) === 'unary') {
      // returns filtered values
      return this.getFilteredSuggestions(lastFieldValue === null || lastFieldValue === void 0 ? void 0 : lastFieldValue.value, _types__WEBPACK_IMPORTED_MODULE_10__.SourceSuggestionType.VALUE);
    }

    if ((lastFieldValue === null || lastFieldValue === void 0 ? void 0 : lastFieldValue.type) === 'unary') {
      // returns all values without any filter
      return this.getFilteredSuggestions('', _types__WEBPACK_IMPORTED_MODULE_10__.SourceSuggestionType.VALUE);
    }

    if ((lastFieldValue === null || lastFieldValue === void 0 ? void 0 : lastFieldValue.type) === 'string' && (penultimateFieldValue === null || penultimateFieldValue === void 0 ? void 0 : penultimateFieldValue.type) === 'value') {
      // returns all binaries without any filter
      return this.getFilteredSuggestions('', _types__WEBPACK_IMPORTED_MODULE_10__.SourceSuggestionType.BINARY);
    }

    if ((lastFieldValue === null || lastFieldValue === void 0 ? void 0 : lastFieldValue.type) === 'string' && (penultimateFieldValue === null || penultimateFieldValue === void 0 ? void 0 : penultimateFieldValue.type) === 'string' && !(penultimateFieldValue !== null && penultimateFieldValue !== void 0 && penultimateFieldValue.value)) {
      // returns all values without any filter
      return this.getFilteredSuggestions('', _types__WEBPACK_IMPORTED_MODULE_10__.SourceSuggestionType.STRING);
    }

    if ((penultimateFieldValue === null || penultimateFieldValue === void 0 ? void 0 : penultimateFieldValue.type) === 'string' && !(lastFieldValue !== null && lastFieldValue !== void 0 && lastFieldValue.value) || (penultimateFieldValue === null || penultimateFieldValue === void 0 ? void 0 : penultimateFieldValue.type) === 'value' && !(lastFieldValue !== null && lastFieldValue !== void 0 && lastFieldValue.value) || (lastFieldValue === null || lastFieldValue === void 0 ? void 0 : lastFieldValue.type) === 'binary') {
      // returns filtered binaries
      return this.getFilteredSuggestions(lastFieldValue === null || lastFieldValue === void 0 ? void 0 : lastFieldValue.value, _types__WEBPACK_IMPORTED_MODULE_10__.SourceSuggestionType.BINARY);
    }

    return this.getFilteredSuggestions(lastFieldValue === null || lastFieldValue === void 0 ? void 0 : lastFieldValue.value, lastFieldValue === null || lastFieldValue === void 0 ? void 0 : lastFieldValue.type);
  }

  loadFieldValues(newValue) {
    const fieldValues = [];
    const splittedValue = newValue.split(' ');

    for (const splittedValueIndex in splittedValue) {
      const value = splittedValue[splittedValueIndex];
      const lastFieldValue = fieldValues[fieldValues.length - 1];

      if (lastFieldValue && !Array.isArray(lastFieldValue) && !lastFieldValue.value && !value) {
        continue;
      }

      if (value.includes('!') && !!value.split('!')[1]) {
        const valueAfterUnaryOperator = value.split('!')[1];
        const selector = this.getAllSuggestions().find(s => s.value === valueAfterUnaryOperator);

        if (!selector) {
          fieldValues.push([_utils__WEBPACK_IMPORTED_MODULE_11__.unarySuggestions[0], {
            type: _types__WEBPACK_IMPORTED_MODULE_10__.SourceSuggestionType.STRING,
            value: valueAfterUnaryOperator
          }]);
          continue;
        }

        fieldValues.push([_utils__WEBPACK_IMPORTED_MODULE_11__.unarySuggestions[0], selector]);
        continue;
      }

      const selector = this.getAllSuggestions().find(s => s.value === value);

      if (selector) {
        fieldValues.push(selector);
        continue;
      }

      fieldValues.push({
        type: _types__WEBPACK_IMPORTED_MODULE_10__.SourceSuggestionType.STRING,
        value
      });
    }

    const filteredSuggestions = this.getNewSuggestions(fieldValues);
    this.setState({
      fieldValues,
      activeSuggestion: 0,
      suggestions: filteredSuggestions
    });
  }

  scrollToSuggestion() {
    var _this$suggestionList, _this$suggestionList$;

    const {
      activeSuggestion,
      hideCaret
    } = this.state;
    (_this$suggestionList = this.suggestionList) === null || _this$suggestionList === void 0 ? void 0 : (_this$suggestionList$ = _this$suggestionList.current) === null || _this$suggestionList$ === void 0 ? void 0 : _this$suggestionList$.children[activeSuggestion].scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'start'
    });

    if (!hideCaret) {
      this.setState({
        hideCaret: true
      });
    }
  }

  changeParentValue() {
    const {
      onChange
    } = this.props;
    const {
      fieldValues
    } = this.state;
    const newValue = [];

    for (const index in fieldValues) {
      const fieldValue = fieldValues[index];

      if (Array.isArray(fieldValue)) {
        var _fieldValue$, _fieldValue$2;

        if ((_fieldValue$ = fieldValue[0]) !== null && _fieldValue$ !== void 0 && _fieldValue$.value || (_fieldValue$2 = fieldValue[1]) !== null && _fieldValue$2 !== void 0 && _fieldValue$2.value) {
          var _fieldValue$0$value, _fieldValue$3, _fieldValue$1$value, _fieldValue$4;

          newValue.push(`${(_fieldValue$0$value = (_fieldValue$3 = fieldValue[0]) === null || _fieldValue$3 === void 0 ? void 0 : _fieldValue$3.value) !== null && _fieldValue$0$value !== void 0 ? _fieldValue$0$value : ''}${(_fieldValue$1$value = (_fieldValue$4 = fieldValue[1]) === null || _fieldValue$4 === void 0 ? void 0 : _fieldValue$4.value) !== null && _fieldValue$1$value !== void 0 ? _fieldValue$1$value : ''}`);
        }

        continue;
      }

      newValue.push(fieldValue.value);
    }

    onChange(newValue.join(' '));
  }

  getNewFieldValues(suggestion) {
    const fieldValues = [...this.state.fieldValues];
    const lastFieldValue = fieldValues[fieldValues.length - 1];

    if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_9__.defined)(lastFieldValue)) {
      return [suggestion];
    }

    if (Array.isArray(lastFieldValue)) {
      fieldValues[fieldValues.length - 1] = [lastFieldValue[0], suggestion];
      return fieldValues;
    }

    if ((lastFieldValue === null || lastFieldValue === void 0 ? void 0 : lastFieldValue.type) === 'unary') {
      fieldValues[fieldValues.length - 1] = [lastFieldValue, suggestion];
    }

    if ((lastFieldValue === null || lastFieldValue === void 0 ? void 0 : lastFieldValue.type) === 'string' && !(lastFieldValue !== null && lastFieldValue !== void 0 && lastFieldValue.value)) {
      fieldValues[fieldValues.length - 1] = suggestion;
      return fieldValues;
    }

    if (suggestion.type === 'value' && (lastFieldValue === null || lastFieldValue === void 0 ? void 0 : lastFieldValue.value) !== suggestion.value) {
      return [suggestion];
    }

    return fieldValues;
  }

  checkPossiblyRegExMatchExpression(value) {
    const {
      isRegExMatchesSelected
    } = this.props;
    const {
      help
    } = this.state;

    if (isRegExMatchesSelected) {
      if (help) {
        this.setState({
          help: ''
        });
      }

      return;
    }

    const isMaybeRegExp = RegExp('^/.*/g?$').test(value);

    if (help) {
      if (!isMaybeRegExp) {
        this.setState({
          help: defaultHelp
        });
      }

      return;
    }

    if (isMaybeRegExp) {
      this.setState({
        help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)("You might want to change Data Type's value to 'Regex matches'")
      });
    }
  }

  toggleSuggestions(showSuggestions) {
    this.setState({
      showSuggestions
    });
  }

  render() {
    const {
      error,
      value,
      onBlur
    } = this.props;
    const {
      showSuggestions,
      suggestions,
      activeSuggestion,
      hideCaret,
      help
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(Wrapper, {
      ref: this.selectorField,
      hideCaret: hideCaret,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(StyledInput, {
        "data-test-id": "source-field",
        type: "text",
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Source'),
        name: "source",
        placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Enter a custom attribute, variable or header name'),
        onChange: this.handleChange,
        autoComplete: "off",
        value: value,
        error: error,
        help: help,
        onKeyDown: this.handleKeyDown,
        onBlur: onBlur,
        onFocus: this.handleFocus,
        inline: false,
        flexibleControlStateSize: true,
        stacked: true,
        required: true,
        showHelpInTooltip: true
      }), showSuggestions && suggestions.length > 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(Suggestions, {
          ref: this.suggestionList,
          error: error,
          "data-test-id": "source-suggestions",
          children: suggestions.slice(0, 50).map((suggestion, index) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(Suggestion, {
            onClick: event => {
              event.preventDefault();
              this.handleClickSuggestionItem(suggestion);
            },
            active: index === activeSuggestion,
            tabIndex: -1,
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_6__["default"], {
              children: suggestion.value
            }), suggestion.description && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(SuggestionDescription, {
              children: ["(", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_6__["default"], {
                children: suggestion.description
              }), ")"]
            }), suggestion.examples && suggestion.examples.length > 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(_sourceSuggestionExamples__WEBPACK_IMPORTED_MODULE_12__["default"], {
              examples: suggestion.examples,
              sourceName: suggestion.value
            })]
          }, suggestion.value))
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(SuggestionsOverlay, {
          onClick: this.handleClickOutside
        })]
      })]
    });
  }

}

SourceField.displayName = "SourceField";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SourceField);

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1lnf3935"
} : 0)("position:relative;width:100%;", p => p.hideCaret && `caret-color: transparent;`, ";" + ( true ? "" : 0));

const StyledInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_forms_inputField__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e1lnf3934"
} : 0)( true ? {
  name: "1wsr984",
  styles: "z-index:1002;:focus{outline:none;}"
} : 0);

const Suggestions = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('ul',  true ? {
  target: "e1lnf3933"
} : 0)("position:absolute;width:", p => p.error ? 'calc(100% - 34px)' : '100%', ";padding-left:0;list-style:none;margin-bottom:0;box-shadow:0 2px 0 rgba(37, 11, 54, 0.04);border:1px solid ", p => p.theme.border, ";border-radius:0 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(0.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(0.5), ";background:", p => p.theme.background, ";top:63px;left:0;z-index:1002;overflow:hidden;max-height:200px;overflow-y:auto;" + ( true ? "" : 0));

const Suggestion = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('li',  true ? {
  target: "e1lnf3932"
} : 0)("display:grid;grid-template-columns:auto 1fr max-content;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";border-bottom:1px solid ", p => p.theme.border, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(2), ";font-size:", p => p.theme.fontSizeMedium, ";cursor:pointer;background:", p => p.active ? p.theme.backgroundSecondary : p.theme.background, ";:hover{background:", p => p.active ? p.theme.backgroundSecondary : p.theme.backgroundSecondary, ";}" + ( true ? "" : 0));

const SuggestionDescription = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1lnf3931"
} : 0)("display:flex;overflow:hidden;color:", p => p.theme.gray300, ";line-height:1.2;" + ( true ? "" : 0));

const SuggestionsOverlay = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1lnf3930"
} : 0)( true ? {
  name: "1ljbwes",
  styles: "position:fixed;top:0;left:0;right:0;bottom:0;z-index:1001"
} : 0);

/***/ }),

/***/ "./app/views/settings/components/dataScrubbing/modals/form/sourceSuggestionExamples.tsx":
/*!**********************************************************************************************!*\
  !*** ./app/views/settings/components/dataScrubbing/modals/form/sourceSuggestionExamples.tsx ***!
  \**********************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/hovercard */ "./app/components/hovercard.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }








const SourceSuggestionExamples = _ref => {
  let {
    examples,
    sourceName
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Wrapper, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(ExampleCard, {
      position: "right",
      header: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Examples for %s in current event', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("code", {
        children: sourceName
      })),
      body: examples.map(example => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("pre", {
        children: example
      }, example)),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(Content, {
        children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('See Example'), " ", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_2__.IconQuestion, {
          size: "xs"
        })]
      })
    })
  });
};

SourceSuggestionExamples.displayName = "SourceSuggestionExamples";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SourceSuggestionExamples);

const ExampleCard = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_1__.Hovercard,  true ? {
  target: "evt2a1f2"
} : 0)( true ? {
  name: "75ukw4",
  styles: "width:400px;pre:last-child{margin:0;}"
} : 0);

const Content = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "evt2a1f1"
} : 0)("display:inline-grid;grid-template-columns:repeat(2, max-content);align-items:center;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(0.5), ";color:", p => p.theme.gray400, ";font-size:", p => p.theme.fontSizeSmall, ";text-decoration:underline;text-decoration-style:dotted;" + ( true ? "" : 0));

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "evt2a1f0"
} : 0)( true ? {
  name: "nxv87c",
  styles: "grid-column:3/3"
} : 0);

/***/ }),

/***/ "./app/views/settings/components/dataScrubbing/modals/handleError.tsx":
/*!****************************************************************************!*\
  !*** ./app/views/settings/components/dataScrubbing/modals/handleError.tsx ***!
  \****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ErrorType": () => (/* binding */ ErrorType),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");



let ErrorType;

(function (ErrorType) {
  ErrorType["Unknown"] = "unknown";
  ErrorType["InvalidSelector"] = "invalid-selector";
  ErrorType["RegexParse"] = "regex-parse";
})(ErrorType || (ErrorType = {}));

function handleError(error) {
  var _error$responseJSON;

  const errorMessage = (_error$responseJSON = error.responseJSON) === null || _error$responseJSON === void 0 ? void 0 : _error$responseJSON.relayPiiConfig[0];

  if (!errorMessage) {
    return {
      type: ErrorType.Unknown,
      message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Unknown error occurred while saving data scrubbing rule')
    };
  }

  if (errorMessage.startsWith('invalid selector: ')) {
    for (const line of errorMessage.split('\n')) {
      if (line.startsWith('1 | ')) {
        const selector = line.slice(3);
        return {
          type: ErrorType.InvalidSelector,
          message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Invalid source value: %s', selector)
        };
      }
    }
  }

  if (errorMessage.startsWith('regex parse error:')) {
    for (const line of errorMessage.split('\n')) {
      if (line.startsWith('error:')) {
        const regex = line.slice(6).replace(/at line \d+ column \d+/, '');
        return {
          type: ErrorType.RegexParse,
          message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Invalid regex: %s', regex)
        };
      }
    }
  }

  return {
    type: ErrorType.Unknown,
    message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('An unknown error occurred while saving data scrubbing rule')
  };
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (handleError);

/***/ }),

/***/ "./app/views/settings/components/dataScrubbing/modals/localStorage.tsx":
/*!*****************************************************************************!*\
  !*** ./app/views/settings/components/dataScrubbing/modals/localStorage.tsx ***!
  \*****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "fetchFromStorage": () => (/* binding */ fetchFromStorage),
/* harmony export */   "saveToStorage": () => (/* binding */ saveToStorage)
/* harmony export */ });
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/localStorage */ "./app/utils/localStorage.tsx");


const ADVANCED_DATA_SCRUBBING_LOCALSTORAGE_KEY = 'advanced-data-scrubbing';

// TODO(Priscila): add the method below in app/utils
function fetchFromStorage() {
  const storage = sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_0__["default"].getItem(ADVANCED_DATA_SCRUBBING_LOCALSTORAGE_KEY);

  if (!storage) {
    return undefined;
  }

  try {
    return JSON.parse(storage);
  } catch (err) {
    _sentry_react__WEBPACK_IMPORTED_MODULE_1__.withScope(scope => {
      scope.setExtra('storage', storage);
      _sentry_react__WEBPACK_IMPORTED_MODULE_1__.captureException(err);
    });
    return undefined;
  }
}

function saveToStorage(obj) {
  try {
    sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_0__["default"].setItem(ADVANCED_DATA_SCRUBBING_LOCALSTORAGE_KEY, JSON.stringify(obj));
  } catch (err) {
    _sentry_react__WEBPACK_IMPORTED_MODULE_1__.captureException(err);
    _sentry_react__WEBPACK_IMPORTED_MODULE_1__.withScope(scope => {
      scope.setExtra('storage', obj);
      _sentry_react__WEBPACK_IMPORTED_MODULE_1__.captureException(err);
    });
  }
}



/***/ }),

/***/ "./app/views/settings/components/dataScrubbing/modals/modal.tsx":
/*!**********************************************************************!*\
  !*** ./app/views/settings/components/dataScrubbing/modals/modal.tsx ***!
  \**********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







const Modal = _ref => {
  let {
    title,
    onSave,
    content,
    disabled,
    Header,
    Body,
    Footer,
    closeModal
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(Header, {
      closeButton: true,
      children: title
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(Body, {
      children: content
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(Footer, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_2__["default"], {
        gap: 1.5,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"], {
          onClick: closeModal,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Cancel')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"], {
          onClick: onSave,
          disabled: disabled,
          priority: "primary",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Save Rule')
        })]
      })
    })]
  });
};

Modal.displayName = "Modal";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Modal);

/***/ }),

/***/ "./app/views/settings/components/dataScrubbing/modals/modalManager.tsx":
/*!*****************************************************************************!*\
  !*** ./app/views/settings/components/dataScrubbing/modals/modalManager.tsx ***!
  \*****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _submitRules__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../submitRules */ "./app/views/settings/components/dataScrubbing/submitRules.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../types */ "./app/views/settings/components/dataScrubbing/types.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../utils */ "./app/views/settings/components/dataScrubbing/utils.tsx");
/* harmony import */ var _form__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./form */ "./app/views/settings/components/dataScrubbing/modals/form/index.tsx");
/* harmony import */ var _handleError__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./handleError */ "./app/views/settings/components/dataScrubbing/modals/handleError.tsx");
/* harmony import */ var _modal__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./modal */ "./app/views/settings/components/dataScrubbing/modals/modal.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./utils */ "./app/views/settings/components/dataScrubbing/modals/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
















class ModalManager extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", this.getDefaultState());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChange", (field, value) => {
      const values = { ...this.state.values,
        [field]: value
      };

      if (values.type !== _types__WEBPACK_IMPORTED_MODULE_8__.RuleType.PATTERN && values.pattern) {
        values.pattern = '';
      }

      if (values.method !== _types__WEBPACK_IMPORTED_MODULE_8__.MethodType.REPLACE && values.placeholder) {
        values.placeholder = '';
      }

      this.setState(prevState => ({
        values,
        requiredValues: this.getRequiredValues(values),
        errors: lodash_omit__WEBPACK_IMPORTED_MODULE_4___default()(prevState.errors, field)
      }));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSave", async () => {
      const {
        endpoint,
        api,
        onSubmitSuccess,
        closeModal,
        onGetNewRules
      } = this.props;
      const newRules = onGetNewRules(this.state.values);

      try {
        const data = await (0,_submitRules__WEBPACK_IMPORTED_MODULE_7__["default"])(api, endpoint, newRules);
        onSubmitSuccess(data);
        closeModal();
      } catch (error) {
        this.convertRequestError((0,_handleError__WEBPACK_IMPORTED_MODULE_11__["default"])(error));
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleValidate", field => () => {
      const isFieldValueEmpty = !this.state.values[field].trim();
      const fieldErrorAlreadyExist = this.state.errors[field];

      if (isFieldValueEmpty && fieldErrorAlreadyExist) {
        return;
      }

      if (isFieldValueEmpty && !fieldErrorAlreadyExist) {
        this.setState(prevState => ({
          errors: { ...prevState.errors,
            [field]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Field Required')
          }
        }));
        return;
      }

      if (!isFieldValueEmpty && fieldErrorAlreadyExist) {
        this.clearError(field);
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleUpdateEventId", eventId => {
      if (eventId === this.state.eventId.value) {
        return;
      }

      this.setState({
        eventId: {
          value: eventId,
          status: _types__WEBPACK_IMPORTED_MODULE_8__.EventIdStatus.UNDEFINED
        }
      });
    });
  }

  componentDidMount() {
    this.handleValidateForm();
  }

  componentDidUpdate(_prevProps, prevState) {
    if (!lodash_isEqual__WEBPACK_IMPORTED_MODULE_3___default()(prevState.values, this.state.values)) {
      this.handleValidateForm();
    }

    if (prevState.eventId.value !== this.state.eventId.value) {
      this.loadSourceSuggestions();
    }

    if (prevState.eventId.status !== this.state.eventId.status) {
      (0,_utils__WEBPACK_IMPORTED_MODULE_13__.saveToSourceGroupData)(this.state.eventId, this.state.sourceSuggestions);
    }
  }

  getDefaultState() {
    const {
      eventId,
      sourceSuggestions
    } = (0,_utils__WEBPACK_IMPORTED_MODULE_13__.fetchSourceGroupData)();
    const values = this.getInitialValues();
    return {
      values,
      requiredValues: this.getRequiredValues(values),
      errors: {},
      isFormValid: false,
      eventId: {
        value: eventId,
        status: !eventId ? _types__WEBPACK_IMPORTED_MODULE_8__.EventIdStatus.UNDEFINED : _types__WEBPACK_IMPORTED_MODULE_8__.EventIdStatus.LOADED
      },
      sourceSuggestions
    };
  }

  getInitialValues() {
    var _initialState$type, _initialState$method, _initialState$source, _initialState$placeho, _initialState$pattern;

    const {
      initialState
    } = this.props;
    return {
      type: (_initialState$type = initialState === null || initialState === void 0 ? void 0 : initialState.type) !== null && _initialState$type !== void 0 ? _initialState$type : _types__WEBPACK_IMPORTED_MODULE_8__.RuleType.CREDITCARD,
      method: (_initialState$method = initialState === null || initialState === void 0 ? void 0 : initialState.method) !== null && _initialState$method !== void 0 ? _initialState$method : _types__WEBPACK_IMPORTED_MODULE_8__.MethodType.MASK,
      source: (_initialState$source = initialState === null || initialState === void 0 ? void 0 : initialState.source) !== null && _initialState$source !== void 0 ? _initialState$source : '',
      placeholder: (_initialState$placeho = initialState === null || initialState === void 0 ? void 0 : initialState.placeholder) !== null && _initialState$placeho !== void 0 ? _initialState$placeho : '',
      pattern: (_initialState$pattern = initialState === null || initialState === void 0 ? void 0 : initialState.pattern) !== null && _initialState$pattern !== void 0 ? _initialState$pattern : ''
    };
  }

  getRequiredValues(values) {
    const {
      type
    } = values;
    const requiredValues = ['type', 'method', 'source'];

    if (type === _types__WEBPACK_IMPORTED_MODULE_8__.RuleType.PATTERN) {
      requiredValues.push('pattern');
    }

    return requiredValues;
  }

  clearError(field) {
    this.setState(prevState => ({
      errors: lodash_omit__WEBPACK_IMPORTED_MODULE_4___default()(prevState.errors, field)
    }));
  }

  async loadSourceSuggestions() {
    const {
      orgSlug,
      projectId,
      api
    } = this.props;
    const {
      eventId
    } = this.state;

    if (!eventId.value) {
      this.setState(prevState => ({
        sourceSuggestions: _utils__WEBPACK_IMPORTED_MODULE_9__.valueSuggestions,
        eventId: { ...prevState.eventId,
          status: _types__WEBPACK_IMPORTED_MODULE_8__.EventIdStatus.UNDEFINED
        }
      }));
      return;
    }

    this.setState(prevState => ({
      sourceSuggestions: _utils__WEBPACK_IMPORTED_MODULE_9__.valueSuggestions,
      eventId: { ...prevState.eventId,
        status: _types__WEBPACK_IMPORTED_MODULE_8__.EventIdStatus.LOADING
      }
    }));

    try {
      const query = {
        eventId: eventId.value
      };

      if (projectId) {
        query.projectId = projectId;
      }

      const rawSuggestions = await api.requestPromise(`/organizations/${orgSlug}/data-scrubbing-selector-suggestions/`, {
        query
      });
      const sourceSuggestions = rawSuggestions.suggestions;

      if (sourceSuggestions && sourceSuggestions.length > 0) {
        this.setState(prevState => ({
          sourceSuggestions,
          eventId: { ...prevState.eventId,
            status: _types__WEBPACK_IMPORTED_MODULE_8__.EventIdStatus.LOADED
          }
        }));
        return;
      }

      this.setState(prevState => ({
        sourceSuggestions: _utils__WEBPACK_IMPORTED_MODULE_9__.valueSuggestions,
        eventId: { ...prevState.eventId,
          status: _types__WEBPACK_IMPORTED_MODULE_8__.EventIdStatus.NOT_FOUND
        }
      }));
    } catch {
      this.setState(prevState => ({
        eventId: { ...prevState.eventId,
          status: _types__WEBPACK_IMPORTED_MODULE_8__.EventIdStatus.ERROR
        }
      }));
    }
  }

  convertRequestError(error) {
    switch (error.type) {
      case _handleError__WEBPACK_IMPORTED_MODULE_11__.ErrorType.InvalidSelector:
        this.setState(prevState => ({
          errors: { ...prevState.errors,
            source: error.message
          }
        }));
        break;

      case _handleError__WEBPACK_IMPORTED_MODULE_11__.ErrorType.RegexParse:
        this.setState(prevState => ({
          errors: { ...prevState.errors,
            pattern: error.message
          }
        }));
        break;

      default:
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)(error.message);
    }
  }

  handleValidateForm() {
    const {
      values,
      requiredValues
    } = this.state;
    const isFormValid = requiredValues.every(requiredValue => !!values[requiredValue]);
    this.setState({
      isFormValid
    });
  }

  render() {
    const {
      values,
      errors,
      isFormValid,
      eventId,
      sourceSuggestions
    } = this.state;
    const {
      title
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(_modal__WEBPACK_IMPORTED_MODULE_12__["default"], { ...this.props,
      title: title,
      onSave: this.handleSave,
      disabled: !isFormValid,
      content: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(_form__WEBPACK_IMPORTED_MODULE_10__["default"], {
        onChange: this.handleChange,
        onValidate: this.handleValidate,
        onUpdateEventId: this.handleUpdateEventId,
        eventId: eventId,
        errors: errors,
        values: values,
        sourceSuggestions: sourceSuggestions
      })
    });
  }

}

ModalManager.displayName = "ModalManager";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ModalManager);

/***/ }),

/***/ "./app/views/settings/components/dataScrubbing/modals/utils.tsx":
/*!**********************************************************************!*\
  !*** ./app/views/settings/components/dataScrubbing/modals/utils.tsx ***!
  \**********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "fetchSourceGroupData": () => (/* binding */ fetchSourceGroupData),
/* harmony export */   "saveToSourceGroupData": () => (/* binding */ saveToSourceGroupData)
/* harmony export */ });
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../types */ "./app/views/settings/components/dataScrubbing/types.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../utils */ "./app/views/settings/components/dataScrubbing/utils.tsx");
/* harmony import */ var _localStorage__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./localStorage */ "./app/views/settings/components/dataScrubbing/modals/localStorage.tsx");




function fetchSourceGroupData() {
  const fetchedSourceGroupData = (0,_localStorage__WEBPACK_IMPORTED_MODULE_2__.fetchFromStorage)();

  if (!fetchedSourceGroupData) {
    const sourceGroupData = {
      eventId: '',
      sourceSuggestions: _utils__WEBPACK_IMPORTED_MODULE_1__.valueSuggestions
    };
    (0,_localStorage__WEBPACK_IMPORTED_MODULE_2__.saveToStorage)(sourceGroupData);
    return sourceGroupData;
  }

  return fetchedSourceGroupData;
}

function saveToSourceGroupData(eventId) {
  let sourceSuggestions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : _utils__WEBPACK_IMPORTED_MODULE_1__.valueSuggestions;

  switch (eventId.status) {
    case _types__WEBPACK_IMPORTED_MODULE_0__.EventIdStatus.LOADING:
      break;

    case _types__WEBPACK_IMPORTED_MODULE_0__.EventIdStatus.LOADED:
      (0,_localStorage__WEBPACK_IMPORTED_MODULE_2__.saveToStorage)({
        eventId: eventId.value,
        sourceSuggestions
      });
      break;

    default:
      (0,_localStorage__WEBPACK_IMPORTED_MODULE_2__.saveToStorage)({
        eventId: '',
        sourceSuggestions
      });
  }
}



/***/ }),

/***/ "./app/views/settings/components/dataScrubbing/organizationRules.tsx":
/*!***************************************************************************!*\
  !*** ./app/views/settings/components/dataScrubbing/organizationRules.tsx ***!
  \***************************************************************************/
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
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _rules__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./rules */ "./app/views/settings/components/dataScrubbing/rules.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }










class OrganizationRules extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      isCollapsed: true
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "rulesRef", /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_3__.createRef)());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleToggleCollapsed", () => {
      this.setState(prevState => ({
        isCollapsed: !prevState.isCollapsed
      }));
    });
  }

  componentDidUpdate() {
    this.loadContentHeight();
  }

  loadContentHeight() {
    if (!this.state.contentHeight) {
      var _this$rulesRef$curren;

      const contentHeight = (_this$rulesRef$curren = this.rulesRef.current) === null || _this$rulesRef$curren === void 0 ? void 0 : _this$rulesRef$curren.offsetHeight;

      if (contentHeight) {
        this.setState({
          contentHeight: `${contentHeight}px`
        });
      }
    }
  }

  render() {
    const {
      rules
    } = this.props;
    const {
      isCollapsed,
      contentHeight
    } = this.state;

    if (rules.length === 0) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(Wrapper, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('There are no data scrubbing rules at the organization level')
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(Wrapper, {
      isCollapsed: isCollapsed,
      contentHeight: contentHeight,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(Header, {
        onClick: this.handleToggleCollapsed,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("div", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Organization Rules')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
          title: isCollapsed ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Expand Organization Rules') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Collapse Organization Rules'),
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconChevron, {
            size: "xs",
            direction: isCollapsed ? 'down' : 'up'
          }),
          size: "xs",
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Toggle Organization Rules')
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(Content, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_rules__WEBPACK_IMPORTED_MODULE_8__["default"], {
          rules: rules,
          ref: this.rulesRef,
          disabled: true
        })
      })]
    });
  }

}

OrganizationRules.displayName = "OrganizationRules";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OrganizationRules);

const Content = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "epx0t0h2"
} : 0)( true ? {
  name: "ns4bq7",
  styles: "transition:height 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;height:0;overflow:hidden"
} : 0);

const Header = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "epx0t0h1"
} : 0)("cursor:pointer;display:grid;grid-template-columns:1fr auto;align-items:center;border-bottom:1px solid ", p => p.theme.border, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(2), ";" + ( true ? "" : 0));

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "epx0t0h0"
} : 0)("color:", p => p.theme.gray200, ";background:", p => p.theme.backgroundSecondary, ";", p => !p.contentHeight && `padding: ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1)} ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(2)}`, ";", p => !p.isCollapsed && ` border-bottom: 1px solid ${p.theme.border}`, ";", p => !p.isCollapsed && p.contentHeight && `
      ${Content} {
        height: ${p.contentHeight};
      }
    `, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/components/dataScrubbing/rules.tsx":
/*!***************************************************************!*\
  !*** ./app/views/settings/components/dataScrubbing/rules.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_confirmDelete__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/confirmDelete */ "./app/components/confirmDelete.tsx");
/* harmony import */ var sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/textOverflow */ "./app/components/textOverflow.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./types */ "./app/views/settings/components/dataScrubbing/types.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./utils */ "./app/views/settings/components/dataScrubbing/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













const getListItemDescription = rule => {
  const {
    method,
    type,
    source
  } = rule;
  const methodLabel = (0,_utils__WEBPACK_IMPORTED_MODULE_9__.getMethodLabel)(method);
  const typeLabel = (0,_utils__WEBPACK_IMPORTED_MODULE_9__.getRuleLabel)(type);
  const descriptionDetails = [];
  descriptionDetails.push(`[${methodLabel.label}]`);
  descriptionDetails.push(rule.type === _types__WEBPACK_IMPORTED_MODULE_8__.RuleType.PATTERN ? `[${rule.pattern}]` : `[${typeLabel}]`);

  if (rule.method === _types__WEBPACK_IMPORTED_MODULE_8__.MethodType.REPLACE && rule.placeholder) {
    descriptionDetails.push(` with [${rule.placeholder}]`);
  }

  return `${descriptionDetails.join(' ')} ${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('from')} [${source}]`;
};

const Rules = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.forwardRef)(function RulesList(_ref, ref) {
  let {
    rules,
    onEditRule,
    onDeleteRule,
    disabled
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(List, {
    ref: ref,
    isDisabled: disabled,
    "data-test-id": "advanced-data-scrubbing-rules",
    children: rules.map(rule => {
      const {
        id
      } = rule;
      const ruleDescription = getListItemDescription(rule);
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(ListItem, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_4__["default"], {
          children: ruleDescription
        }), onEditRule && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Edit Rule'),
          size: "sm",
          onClick: onEditRule(id),
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconEdit, {}),
          disabled: disabled,
          title: disabled ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('You do not have permission to edit rules') : undefined
        }), onDeleteRule && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_confirmDelete__WEBPACK_IMPORTED_MODULE_3__["default"], {
          message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Are you sure you wish to delete this rule?'),
          priority: "danger",
          onConfirm: () => {
            onDeleteRule(id)();
          },
          confirmInput: ruleDescription,
          disabled: disabled,
          stopPropagation: true,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
            "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Delete Rule'),
            size: "sm",
            icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconDelete, {}),
            disabled: disabled,
            title: disabled ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('You do not have permission to delete rules') : undefined
          })
        })]
      }, id);
    })
  });
});
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Rules);

const List = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('ul',  true ? {
  target: "e5ykfeb1"
} : 0)("list-style:none;margin:0;padding:0;margin-bottom:0!important;", p => p.isDisabled && `
      color: ${p.theme.gray200};
      background: ${p.theme.backgroundSecondary};
  `, ";" + ( true ? "" : 0));

const ListItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('li',  true ? {
  target: "e5ykfeb0"
} : 0)("display:grid;grid-template-columns:auto max-content max-content;grid-column-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";align-items:center;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(2), ";border-bottom:1px solid ", p => p.theme.border, ";&:hover{background-color:", p => p.theme.backgroundSecondary, ";}&:last-child{border-bottom:0;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/components/dataScrubbing/submitRules.tsx":
/*!*********************************************************************!*\
  !*** ./app/views/settings/components/dataScrubbing/submitRules.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./types */ "./app/views/settings/components/dataScrubbing/types.tsx");



function getSubmitFormatRule(rule) {
  if (rule.type === _types__WEBPACK_IMPORTED_MODULE_1__.RuleType.PATTERN && rule.method === _types__WEBPACK_IMPORTED_MODULE_1__.MethodType.REPLACE) {
    return {
      type: rule.type,
      pattern: rule.pattern,
      redaction: {
        method: rule.method,
        text: rule === null || rule === void 0 ? void 0 : rule.placeholder
      }
    };
  }

  if (rule.type === _types__WEBPACK_IMPORTED_MODULE_1__.RuleType.PATTERN) {
    return {
      type: rule.type,
      pattern: rule.pattern,
      redaction: {
        method: rule.method
      }
    };
  }

  if (rule.method === _types__WEBPACK_IMPORTED_MODULE_1__.MethodType.REPLACE) {
    return {
      type: rule.type,
      redaction: {
        method: rule.method,
        text: rule === null || rule === void 0 ? void 0 : rule.placeholder
      }
    };
  }

  return {
    type: rule.type,
    redaction: {
      method: rule.method
    }
  };
}

function submitRules(api, endpoint, rules) {
  const applications = {};
  const submitFormatRules = {};

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    const ruleId = String(i);
    submitFormatRules[ruleId] = getSubmitFormatRule(rule);

    if (!applications[rule.source]) {
      applications[rule.source] = [];
    }

    if (!applications[rule.source].includes(ruleId)) {
      applications[rule.source].push(ruleId);
    }
  }

  const piiConfig = {
    rules: submitFormatRules,
    applications
  };
  return api.requestPromise(endpoint, {
    method: 'PUT',
    data: {
      relayPiiConfig: JSON.stringify(piiConfig)
    }
  });
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (submitRules);

/***/ }),

/***/ "./app/views/settings/components/dataScrubbing/types.tsx":
/*!***************************************************************!*\
  !*** ./app/views/settings/components/dataScrubbing/types.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "EventIdStatus": () => (/* binding */ EventIdStatus),
/* harmony export */   "MethodType": () => (/* binding */ MethodType),
/* harmony export */   "RuleType": () => (/* binding */ RuleType),
/* harmony export */   "SourceSuggestionType": () => (/* binding */ SourceSuggestionType)
/* harmony export */ });
let RuleType;

(function (RuleType) {
  RuleType["PATTERN"] = "pattern";
  RuleType["CREDITCARD"] = "creditcard";
  RuleType["PASSWORD"] = "password";
  RuleType["IP"] = "ip";
  RuleType["IMEI"] = "imei";
  RuleType["EMAIL"] = "email";
  RuleType["UUID"] = "uuid";
  RuleType["PEMKEY"] = "pemkey";
  RuleType["URLAUTH"] = "url_auth";
  RuleType["USSSN"] = "us_ssn";
  RuleType["USER_PATH"] = "userpath";
  RuleType["MAC"] = "mac";
  RuleType["ANYTHING"] = "anything";
})(RuleType || (RuleType = {}));

let MethodType;

(function (MethodType) {
  MethodType["MASK"] = "mask";
  MethodType["REMOVE"] = "remove";
  MethodType["HASH"] = "hash";
  MethodType["REPLACE"] = "replace";
})(MethodType || (MethodType = {}));

let EventIdStatus;

(function (EventIdStatus) {
  EventIdStatus["UNDEFINED"] = "undefined";
  EventIdStatus["LOADING"] = "loading";
  EventIdStatus["INVALID"] = "invalid";
  EventIdStatus["NOT_FOUND"] = "not_found";
  EventIdStatus["LOADED"] = "loaded";
  EventIdStatus["ERROR"] = "error";
})(EventIdStatus || (EventIdStatus = {}));

let SourceSuggestionType;

(function (SourceSuggestionType) {
  SourceSuggestionType["VALUE"] = "value";
  SourceSuggestionType["UNARY"] = "unary";
  SourceSuggestionType["BINARY"] = "binary";
  SourceSuggestionType["STRING"] = "string";
})(SourceSuggestionType || (SourceSuggestionType = {}));

/***/ }),

/***/ "./app/views/settings/components/dataScrubbing/utils.tsx":
/*!***************************************************************!*\
  !*** ./app/views/settings/components/dataScrubbing/utils.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "binarySuggestions": () => (/* binding */ binarySuggestions),
/* harmony export */   "getMethodLabel": () => (/* binding */ getMethodLabel),
/* harmony export */   "getRuleLabel": () => (/* binding */ getRuleLabel),
/* harmony export */   "unarySuggestions": () => (/* binding */ unarySuggestions),
/* harmony export */   "valueSuggestions": () => (/* binding */ valueSuggestions)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./types */ "./app/views/settings/components/dataScrubbing/types.tsx");



function getRuleLabel(type) {
  switch (type) {
    case _types__WEBPACK_IMPORTED_MODULE_1__.RuleType.ANYTHING:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Anything');

    case _types__WEBPACK_IMPORTED_MODULE_1__.RuleType.IMEI:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('IMEI numbers');

    case _types__WEBPACK_IMPORTED_MODULE_1__.RuleType.MAC:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('MAC addresses');

    case _types__WEBPACK_IMPORTED_MODULE_1__.RuleType.EMAIL:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Email addresses');

    case _types__WEBPACK_IMPORTED_MODULE_1__.RuleType.PEMKEY:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('PEM keys');

    case _types__WEBPACK_IMPORTED_MODULE_1__.RuleType.URLAUTH:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Auth in URLs');

    case _types__WEBPACK_IMPORTED_MODULE_1__.RuleType.USSSN:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('US social security numbers');

    case _types__WEBPACK_IMPORTED_MODULE_1__.RuleType.USER_PATH:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Usernames in filepaths');

    case _types__WEBPACK_IMPORTED_MODULE_1__.RuleType.UUID:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('UUIDs');

    case _types__WEBPACK_IMPORTED_MODULE_1__.RuleType.CREDITCARD:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Credit card numbers');

    case _types__WEBPACK_IMPORTED_MODULE_1__.RuleType.PASSWORD:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Password fields');

    case _types__WEBPACK_IMPORTED_MODULE_1__.RuleType.IP:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('IP addresses');

    case _types__WEBPACK_IMPORTED_MODULE_1__.RuleType.PATTERN:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Regex matches');

    default:
      return '';
  }
}

function getMethodLabel(type) {
  switch (type) {
    case _types__WEBPACK_IMPORTED_MODULE_1__.MethodType.MASK:
      return {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Mask'),
        description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Replace with ****')
      };

    case _types__WEBPACK_IMPORTED_MODULE_1__.MethodType.HASH:
      return {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Hash'),
        description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Replace with DEADBEEF')
      };

    case _types__WEBPACK_IMPORTED_MODULE_1__.MethodType.REMOVE:
      return {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Remove'),
        description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Replace with null')
      };

    case _types__WEBPACK_IMPORTED_MODULE_1__.MethodType.REPLACE:
      return {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Replace'),
        description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Replace with Placeholder')
      };

    default:
      return {
        label: ''
      };
  }
}

const binarySuggestions = [{
  type: _types__WEBPACK_IMPORTED_MODULE_1__.SourceSuggestionType.BINARY,
  value: '&&'
}, {
  type: _types__WEBPACK_IMPORTED_MODULE_1__.SourceSuggestionType.BINARY,
  value: '||'
}];
const unarySuggestions = [{
  type: _types__WEBPACK_IMPORTED_MODULE_1__.SourceSuggestionType.UNARY,
  value: '!'
}];
const valueSuggestions = [{
  type: _types__WEBPACK_IMPORTED_MODULE_1__.SourceSuggestionType.VALUE,
  value: '**',
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('everywhere')
}, {
  type: _types__WEBPACK_IMPORTED_MODULE_1__.SourceSuggestionType.VALUE,
  value: 'password',
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('attributes named "password"')
}, {
  type: _types__WEBPACK_IMPORTED_MODULE_1__.SourceSuggestionType.VALUE,
  value: '$error.value',
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('the exception value')
}, {
  type: _types__WEBPACK_IMPORTED_MODULE_1__.SourceSuggestionType.VALUE,
  value: '$message',
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('the log message')
}, {
  type: _types__WEBPACK_IMPORTED_MODULE_1__.SourceSuggestionType.VALUE,
  value: 'extra.MyValue',
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('the key "MyValue" in "Additional Data"')
}, {
  type: _types__WEBPACK_IMPORTED_MODULE_1__.SourceSuggestionType.VALUE,
  value: 'extra.**',
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('everything in "Additional Data"')
}, {
  type: _types__WEBPACK_IMPORTED_MODULE_1__.SourceSuggestionType.VALUE,
  value: '$http.headers.x-custom-token',
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('the X-Custom-Token HTTP header')
}, {
  type: _types__WEBPACK_IMPORTED_MODULE_1__.SourceSuggestionType.VALUE,
  value: '$user.ip_address',
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('the user IP address')
}, {
  type: _types__WEBPACK_IMPORTED_MODULE_1__.SourceSuggestionType.VALUE,
  value: '$frame.vars.foo',
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('the local variable "foo"')
}, {
  type: _types__WEBPACK_IMPORTED_MODULE_1__.SourceSuggestionType.VALUE,
  value: 'contexts.device.timezone',
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('the timezone in the device context')
}, {
  type: _types__WEBPACK_IMPORTED_MODULE_1__.SourceSuggestionType.VALUE,
  value: 'tags.server_name',
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('the tag "server_name"')
}, {
  type: _types__WEBPACK_IMPORTED_MODULE_1__.SourceSuggestionType.VALUE,
  value: '$attachments.**',
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('all attachments')
}, {
  type: _types__WEBPACK_IMPORTED_MODULE_1__.SourceSuggestionType.VALUE,
  value: "$attachments.'logfile.txt'",
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('all attachments named "logfile.txt"')
}, {
  type: _types__WEBPACK_IMPORTED_MODULE_1__.SourceSuggestionType.VALUE,
  value: '$minidump',
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('the entire minidump of a native crash report')
}, {
  type: _types__WEBPACK_IMPORTED_MODULE_1__.SourceSuggestionType.VALUE,
  value: '$minidump.heap_memory',
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('the heap memory region in a native crash report')
}, {
  type: _types__WEBPACK_IMPORTED_MODULE_1__.SourceSuggestionType.VALUE,
  value: 'code_file',
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('the pathname of a code module in a native crash report')
}, {
  type: _types__WEBPACK_IMPORTED_MODULE_1__.SourceSuggestionType.VALUE,
  value: 'debug_file',
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('the pathname of a debug module in a native crash report')
}];


/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_utils_crashReports_tsx-app_views_settings_components_dataScrubbing_index_tsx.a60d72c95f87ea39498665e4e6748681.js.map