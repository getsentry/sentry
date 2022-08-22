"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_project_projectKeys_details_index_tsx"],{

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

/***/ "./app/views/settings/project/projectKeys/details/index.tsx":
/*!******************************************************************!*\
  !*** ./app/views/settings/project/projectKeys/details/index.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ ProjectKeyDetails)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_project_permissionAlert__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/views/settings/project/permissionAlert */ "./app/views/settings/project/permissionAlert.tsx");
/* harmony import */ var sentry_views_settings_project_projectKeys_details_keySettings__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/views/settings/project/projectKeys/details/keySettings */ "./app/views/settings/project/projectKeys/details/keySettings.tsx");
/* harmony import */ var sentry_views_settings_project_projectKeys_details_keyStats__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/views/settings/project/projectKeys/details/keyStats */ "./app/views/settings/project/projectKeys/details/keyStats.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











class ProjectKeyDetails extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_4__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleRemove", () => {
      const {
        orgId,
        projectId
      } = this.props.params;
      react_router__WEBPACK_IMPORTED_MODULE_2__.browserHistory.push(`/${orgId}/${projectId}/settings/keys/`);
    });
  }

  getTitle() {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Key Details');
  }

  getEndpoints() {
    const {
      keyId,
      orgId,
      projectId
    } = this.props.params;
    return [['data', `/projects/${orgId}/${projectId}/keys/${keyId}/`]];
  }

  renderBody() {
    const {
      data
    } = this.state;
    const {
      params
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)("div", {
      "data-test-id": "key-details",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_5__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Key Details')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_views_settings_project_permissionAlert__WEBPACK_IMPORTED_MODULE_6__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_views_settings_project_projectKeys_details_keyStats__WEBPACK_IMPORTED_MODULE_8__["default"], {
        api: this.api,
        params: params
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_views_settings_project_projectKeys_details_keySettings__WEBPACK_IMPORTED_MODULE_7__["default"], {
        api: this.api,
        params: params,
        data: data,
        onRemove: this.handleRemove
      })]
    });
  }

}

/***/ }),

/***/ "./app/views/settings/project/projectKeys/details/keyRateLimitsForm.tsx":
/*!******************************************************************************!*\
  !*** ./app/views/settings/project/projectKeys/details/keyRateLimitsForm.tsx ***!
  \******************************************************************************/
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
/* harmony import */ var lodash_sortBy__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/sortBy */ "../node_modules/lodash/sortBy.js");
/* harmony import */ var lodash_sortBy__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_sortBy__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/acl/featureDisabled */ "./app/components/acl/featureDisabled.tsx");
/* harmony import */ var sentry_components_forms_controls_rangeSlider__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/controls/rangeSlider */ "./app/components/forms/controls/rangeSlider/index.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/forms/formField */ "./app/components/forms/formField/index.tsx");
/* harmony import */ var sentry_components_input__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/input */ "./app/components/input.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");

















const PREDEFINED_RATE_LIMIT_VALUES = [0, 60, 300, 900, 3600, 7200, 14400, 21600, 43200, 86400];

function KeyRateLimitsForm(_ref) {
  let {
    data,
    disabled,
    params
  } = _ref;

  function handleChangeWindow(onChange, onBlur, currentValueObj, value, event) {
    const valueObj = { ...currentValueObj,
      window: value
    };
    onChange(valueObj, event);
    onBlur(valueObj, event);
  }

  function handleChangeCount(callback, value, event) {
    const valueObj = { ...value,
      count: Number(event.target.value)
    };
    callback(valueObj, event);
  }

  function getAllowedRateLimitValues(currentRateLimit) {
    const {
      rateLimit
    } = data;
    const {
      window
    } = rateLimit !== null && rateLimit !== void 0 ? rateLimit : {}; // The slider should display other values if they are set via the API, but still offer to select only the predefined values

    if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_13__.defined)(window)) {
      // If the API returns a value not found in the predefined values and the user selects another value through the UI,
      // he will no longer be able to reselect the "custom" value in the slider
      if (currentRateLimit !== window) {
        return PREDEFINED_RATE_LIMIT_VALUES;
      } // If the API returns a value not found in the predefined values, that value will be added to the slider


      if (!PREDEFINED_RATE_LIMIT_VALUES.includes(window)) {
        return lodash_sortBy__WEBPACK_IMPORTED_MODULE_3___default()([...PREDEFINED_RATE_LIMIT_VALUES, window]);
      }
    }

    return PREDEFINED_RATE_LIMIT_VALUES;
  }

  const {
    keyId,
    orgId,
    projectId
  } = params;
  const apiEndpoint = `/projects/${orgId}/${projectId}/keys/${keyId}/`;

  const disabledAlert = _ref2 => {
    let {
      features
    } = _ref2;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_5__["default"], {
      alert: sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.PanelAlert,
      features: features,
      featureName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Key Rate Limits')
    });
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_7__["default"], {
    saveOnBlur: true,
    apiEndpoint: apiEndpoint,
    apiMethod: "PUT",
    initialData: data,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_4__["default"], {
      features: ['projects:rate-limits'],
      hookName: "feature-disabled:rate-limits",
      renderDisabled: _ref3 => {
        let {
          children,
          ...props
        } = _ref3;
        return typeof children === 'function' && children({ ...props,
          renderDisabled: disabledAlert
        });
      },
      children: _ref4 => {
        let {
          hasFeature,
          features,
          organization,
          project,
          renderDisabled
        } = _ref4;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.Panel, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.PanelHeader, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Rate Limits')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.PanelBody, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.PanelAlert, {
              type: "info",
              showIcon: true,
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)(`Rate limits provide a flexible way to manage your error
                    volume. If you have a noisy project or environment you
                    can configure a rate limit for this key to reduce the
                    number of errors processed. To manage your transaction
                    volume, we recommend adjusting your sample rate in your
                    SDK configuration.`)
            }), !hasFeature && typeof renderDisabled === 'function' && renderDisabled({
              organization,
              project,
              features,
              hasFeature,
              children: null
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_8__["default"], {
              name: "rateLimit",
              label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Rate Limit'),
              disabled: disabled || !hasFeature,
              validate: _ref5 => {
                let {
                  form
                } = _ref5;
                // TODO(TS): is validate actually doing anything because it's an unexpected prop
                const isValid = form && form.rateLimit && typeof form.rateLimit.count !== 'undefined' && typeof form.rateLimit.window !== 'undefined';

                if (isValid) {
                  return [];
                }

                return [['rateLimit', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Fill in both fields first')]];
              },
              formatMessageValue: _ref6 => {
                let {
                  count,
                  window
                } = _ref6;
                return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.tct)('[errors] in [timeWindow]', {
                  errors: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.tn)('%s error ', '%s errors ', count),
                  timeWindow: window === 0 ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('no time window') : (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_14__.getExactDuration)(window)
                });
              },
              help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Apply a rate limit to this credential to cap the amount of errors accepted during a time window.'),
              inline: false,
              children: _ref7 => {
                let {
                  onChange,
                  onBlur,
                  value
                } = _ref7;
                const window = typeof value === 'object' ? value.window : undefined;
                return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(RateLimitRow, {
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_input__WEBPACK_IMPORTED_MODULE_9__["default"], {
                    type: "number",
                    name: "rateLimit.count",
                    min: 0,
                    value: typeof value === 'object' ? value.count : undefined,
                    placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Count'),
                    disabled: disabled || !hasFeature,
                    onChange: event => handleChangeCount(onChange, value, event),
                    onBlur: event => handleChangeCount(onBlur, value, event)
                  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(EventsIn, {
                    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('event(s) in')
                  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_forms_controls_rangeSlider__WEBPACK_IMPORTED_MODULE_6__["default"], {
                    name: "rateLimit.window",
                    allowedValues: getAllowedRateLimitValues(window),
                    value: window,
                    placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Window'),
                    formatLabel: rangeValue => {
                      if (typeof rangeValue === 'number') {
                        if (rangeValue === 0) {
                          return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('None');
                        }

                        return (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_14__.getExactDuration)(rangeValue);
                      }

                      return undefined;
                    },
                    disabled: disabled || !hasFeature,
                    onChange: (rangeValue, event) => handleChangeWindow(onChange, onBlur, value, Number(rangeValue), event)
                  })]
                });
              }
            })]
          })]
        });
      }
    })
  });
}

KeyRateLimitsForm.displayName = "KeyRateLimitsForm";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (KeyRateLimitsForm);

const RateLimitRow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e7j3zl21"
} : 0)("display:grid;grid-template-columns:2fr 1fr 2fr;align-items:center;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";" + ( true ? "" : 0));

const EventsIn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('small',  true ? {
  target: "e7j3zl20"
} : 0)("font-size:", p => p.theme.fontSizeRelativeSmall, ";text-align:center;white-space:nowrap;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/project/projectKeys/details/keySettings.tsx":
/*!************************************************************************!*\
  !*** ./app/views/settings/project/projectKeys/details/keySettings.tsx ***!
  \************************************************************************/
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
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_forms_booleanField__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/forms/booleanField */ "./app/components/forms/booleanField.tsx");
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/forms/selectField */ "./app/components/forms/selectField.tsx");
/* harmony import */ var sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/forms/textCopyInput */ "./app/components/forms/textCopyInput.tsx");
/* harmony import */ var sentry_components_forms_textField__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/forms/textField */ "./app/components/forms/textField.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_views_settings_project_projectKeys_details_keyRateLimitsForm__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/views/settings/project/projectKeys/details/keyRateLimitsForm */ "./app/views/settings/project/projectKeys/details/keyRateLimitsForm.tsx");
/* harmony import */ var sentry_views_settings_project_projectKeys_projectKeyCredentials__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/views/settings/project/projectKeys/projectKeyCredentials */ "./app/views/settings/project/projectKeys/projectKeyCredentials.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");























class KeySettings extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      loading: false,
      error: false
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleRemove", async () => {
      if (this.state.loading) {
        return;
      }

      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Revoking key\u2026'));
      const {
        api,
        onRemove,
        params
      } = this.props;
      const {
        keyId,
        orgId,
        projectId
      } = params;

      try {
        await api.requestPromise(`/projects/${orgId}/${projectId}/keys/${keyId}/`, {
          method: 'DELETE'
        });
        onRemove();
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Revoked key'));
      } catch (_err) {
        this.setState({
          error: true,
          loading: false
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Unable to revoke key'));
      }
    });
  }

  render() {
    const {
      keyId,
      orgId,
      projectId
    } = this.props.params;
    const {
      data
    } = this.props;
    const apiEndpoint = `/projects/${orgId}/${projectId}/keys/${keyId}/`;
    const loaderLink = (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_17__["default"])({
      value: data.dsn.cdn,
      fixed: '__JS_SDK_LOADER_URL__'
    });
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_4__["default"], {
      access: ['project:write'],
      children: _ref => {
        let {
          hasAccess
        } = _ref;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_10__["default"], {
            saveOnBlur: true,
            allowUndo: true,
            apiEndpoint: apiEndpoint,
            apiMethod: "PUT",
            initialData: data,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_15__.Panel, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_15__.PanelHeader, {
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Details')
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_15__.PanelBody, {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_forms_textField__WEBPACK_IMPORTED_MODULE_13__["default"], {
                  name: "name",
                  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Name'),
                  disabled: !hasAccess,
                  required: false,
                  maxLength: 64
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_forms_booleanField__WEBPACK_IMPORTED_MODULE_8__["default"], {
                  name: "isActive",
                  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Enabled'),
                  required: false,
                  disabled: !hasAccess,
                  help: "Accept events from this key? This may be used to temporarily suspend a key."
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_9__["default"], {
                  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Created'),
                  children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("div", {
                    className: "controls",
                    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_7__["default"], {
                      date: data.dateCreated
                    })
                  })
                })]
              })]
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_settings_project_projectKeys_details_keyRateLimitsForm__WEBPACK_IMPORTED_MODULE_18__["default"], {
            params: this.props.params,
            data: data,
            disabled: !hasAccess
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_10__["default"], {
            saveOnBlur: true,
            apiEndpoint: apiEndpoint,
            apiMethod: "PUT",
            initialData: data,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_15__.Panel, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_15__.PanelHeader, {
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('JavaScript Loader')
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_15__.PanelBody, {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_9__["default"], {
                  help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.tct)('Copy this script into your website to setup your JavaScript SDK without any additional configuration. [link]', {
                    link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_14__["default"], {
                      href: "https://docs.sentry.io/platforms/javascript/install/lazy-load-sentry/",
                      children: "What does the script provide?"
                    })
                  }),
                  inline: false,
                  flexibleControlStateSize: true,
                  children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_12__["default"], {
                    children: `<script src='${loaderLink}' crossorigin="anonymous"></script>`
                  })
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_11__["default"], {
                  name: "browserSdkVersion",
                  options: data.browserSdk ? data.browserSdk.choices.map(_ref2 => {
                    let [value, label] = _ref2;
                    return {
                      value,
                      label
                    };
                  }) : [],
                  placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('4.x'),
                  allowClear: false,
                  disabled: !hasAccess,
                  help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Select the version of the SDK that should be loaded. Note that it can take a few minutes until this change is live.')
                })]
              })]
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_15__.Panel, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_15__.PanelHeader, {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Credentials')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_15__.PanelBody, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_15__.PanelAlert, {
                type: "info",
                showIcon: true,
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Your credentials are coupled to a public and secret key. Different clients will require different credentials, so make sure you check the documentation before plugging things in.')
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_settings_project_projectKeys_projectKeyCredentials__WEBPACK_IMPORTED_MODULE_19__["default"], {
                projectId: `${data.projectId}`,
                data: data,
                showPublicKey: true,
                showSecretKey: true,
                showProjectId: true
              })]
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_4__["default"], {
            access: ['project:admin'],
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_15__.Panel, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_15__.PanelHeader, {
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Revoke Key')
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_15__.PanelBody, {
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_9__["default"], {
                  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Revoke Key'),
                  help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Revoking this key will immediately remove and suspend the credentials. This action is irreversible.'),
                  children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("div", {
                    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_6__["default"], {
                      priority: "danger",
                      message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Are you sure you want to revoke this key? This will immediately remove and suspend the credentials.'),
                      onConfirm: this.handleRemove,
                      confirmText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Revoke Key'),
                      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
                        priority: "danger",
                        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Revoke Key')
                      })
                    })
                  })
                })
              })]
            })
          })]
        });
      }
    });
  }

}

KeySettings.displayName = "KeySettings";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (KeySettings);

/***/ }),

/***/ "./app/views/settings/project/projectKeys/details/keyStats.tsx":
/*!*********************************************************************!*\
  !*** ./app/views/settings/project/projectKeys/details/keyStats.tsx ***!
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
/* harmony import */ var sentry_components_charts_miniBarChart__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/miniBarChart */ "./app/components/charts/miniBarChart.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













const getInitialState = () => {
  const until = Math.floor(new Date().getTime() / 1000);
  return {
    since: until - 3600 * 24 * 30,
    until,
    loading: true,
    error: false,
    series: [],
    emptyStats: false
  };
};

class KeyStats extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", getInitialState());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchData", () => {
      const {
        keyId,
        orgId,
        projectId
      } = this.props.params;
      this.props.api.request(`/projects/${orgId}/${projectId}/keys/${keyId}/stats/`, {
        query: {
          since: this.state.since,
          until: this.state.until,
          resolution: '1d'
        },
        success: data => {
          let emptyStats = true;
          const dropped = [];
          const accepted = [];
          data.forEach(p => {
            if (p.total) {
              emptyStats = false;
            }

            dropped.push({
              name: p.ts * 1000,
              value: p.dropped
            });
            accepted.push({
              name: p.ts * 1000,
              value: p.accepted
            });
          });
          const series = [{
            seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Accepted'),
            data: accepted
          }, {
            seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Rate Limited'),
            data: dropped
          }];
          this.setState({
            series,
            emptyStats,
            error: false,
            loading: false
          });
        },
        error: () => {
          this.setState({
            error: true,
            loading: false
          });
        }
      });
    });
  }

  componentDidMount() {
    this.fetchData();
  }

  render() {
    if (this.state.error) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_4__["default"], {
        onRetry: this.fetchData
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__.Panel, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__.PanelHeader, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Key usage in the last 30 days (by day)')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__.PanelBody, {
        withPadding: true,
        children: this.state.loading ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_6__["default"], {
          height: "150px"
        }) : !this.state.emptyStats ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_charts_miniBarChart__WEBPACK_IMPORTED_MODULE_3__["default"], {
          isGroupedByDate: true,
          series: this.state.series,
          height: 150,
          colors: [sentry_utils_theme__WEBPACK_IMPORTED_MODULE_8__["default"].gray200, sentry_utils_theme__WEBPACK_IMPORTED_MODULE_8__["default"].red300],
          stacked: true,
          labelYAxisExtents: true
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_9__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Nothing recorded in the last 30 days.'),
          description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Total events captured using these credentials.')
        })
      })]
    });
  }

}

KeyStats.displayName = "KeyStats";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (KeyStats);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_project_projectKeys_details_index_tsx.424be4598595e77bb92a3b636250b4a9.js.map