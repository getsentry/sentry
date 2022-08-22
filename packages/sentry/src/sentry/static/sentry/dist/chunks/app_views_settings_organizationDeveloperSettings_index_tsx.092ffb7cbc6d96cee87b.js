(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_organizationDeveloperSettings_index_tsx"],{

/***/ "./app/actionCreators/sentryApps.tsx":
/*!*******************************************!*\
  !*** ./app/actionCreators/sentryApps.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "removeSentryApp": () => (/* binding */ removeSentryApp)
/* harmony export */ });
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");



/**
 * Remove a Sentry Application
 *
 * @param {Object} client ApiClient
 * @param {Object} app SentryApp
 */
function removeSentryApp(client, app) {
  (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addLoadingMessage)();
  const promise = client.requestPromise(`/sentry-apps/${app.slug}/`, {
    method: 'DELETE'
  });
  promise.then(() => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('%s successfully removed.', app.slug));
  }, () => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.clearIndicators)();
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Unable to remove %s integration', app.slug));
  });
  return promise;
}

/***/ }),

/***/ "./app/actionCreators/sentryFunctions.tsx":
/*!************************************************!*\
  !*** ./app/actionCreators/sentryFunctions.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "removeSentryFunction": () => (/* binding */ removeSentryFunction)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _indicator__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./indicator */ "./app/actionCreators/indicator.tsx");


async function removeSentryFunction(client, org, sentryFn) {
  (0,_indicator__WEBPACK_IMPORTED_MODULE_1__.addLoadingMessage)();

  try {
    await client.requestPromise(`/organizations/${org.slug}/functions/${sentryFn.slug}/`, {
      method: 'DELETE'
    });
    (0,_indicator__WEBPACK_IMPORTED_MODULE_1__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.tct)('[name] successfully deleted.', {
      name: sentryFn.name
    }));
    return true;
  } catch (err) {
    var _err$responseJSON;

    (0,_indicator__WEBPACK_IMPORTED_MODULE_1__.clearIndicators)();
    (0,_indicator__WEBPACK_IMPORTED_MODULE_1__.addErrorMessage)((err === null || err === void 0 ? void 0 : (_err$responseJSON = err.responseJSON) === null || _err$responseJSON === void 0 ? void 0 : _err$responseJSON.detail) || (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Unknown Error'));
    return false;
  }
}

/***/ }),

/***/ "./app/components/confirmDelete.tsx":
/*!******************************************!*\
  !*** ./app/components/confirmDelete.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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

/***/ "./app/components/modals/sentryAppPublishRequestModal.tsx":
/*!****************************************************************!*\
  !*** ./app/components/modals/sentryAppPublishRequestModal.tsx ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ SentryAppPublishRequestModal)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_intersection__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/intersection */ "../node_modules/lodash/intersection.js");
/* harmony import */ var lodash_intersection__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_intersection__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/forms/jsonForm */ "./app/components/forms/jsonForm.tsx");
/* harmony import */ var sentry_components_forms_model__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/forms/model */ "./app/components/forms/model.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }













/**
 * Given an array of scopes, return the choices the user has picked for each option
 * @param scopes {Array}
 */
const getPermissionSelectionsFromScopes = scopes => {
  const permissions = [];

  for (const permObj of sentry_constants__WEBPACK_IMPORTED_MODULE_10__.SENTRY_APP_PERMISSIONS) {
    let highestChoice;

    for (const perm in permObj.choices) {
      const choice = permObj.choices[perm];
      const scopesIntersection = lodash_intersection__WEBPACK_IMPORTED_MODULE_5___default()(choice.scopes, scopes);

      if (scopesIntersection.length > 0 && scopesIntersection.length === choice.scopes.length) {
        if (!highestChoice || scopesIntersection.length > highestChoice.scopes.length) {
          highestChoice = choice;
        }
      }
    }

    if (highestChoice) {
      // we can remove the read part of "Read & Write"
      const label = highestChoice.label.replace('Read & Write', 'Write');
      permissions.push(`${permObj.resource} ${label}`);
    }
  }

  return permissions;
};

class PublishRequestFormModel extends sentry_components_forms_model__WEBPACK_IMPORTED_MODULE_9__["default"] {
  getTransformedData() {
    const data = this.getData(); // map object to list of questions

    const questionnaire = Array.from(this.fieldDescriptor.values()).map(field => ( // we read the meta for the question that has a react node for the label
    {
      question: field.meta || field.label,
      answer: data[field.name]
    }));
    return {
      questionnaire
    };
  }

}

class SentryAppPublishRequestModal extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "form", new PublishRequestFormModel());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmitSuccess", () => {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Request to publish %s successful.', this.props.app.slug));
      this.props.closeModal();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmitError", err => {
      var _err$responseJSON;

      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.tct)('Request to publish [app] fails. [detail]', {
        app: this.props.app.slug,
        detail: err === null || err === void 0 ? void 0 : (_err$responseJSON = err.responseJSON) === null || _err$responseJSON === void 0 ? void 0 : _err$responseJSON.detail
      }));
    });
  }

  get formFields() {
    const {
      app
    } = this.props;
    const permissions = getPermissionSelectionsFromScopes(app.scopes);
    const permissionQuestionBaseText = 'Please justify why you are requesting each of the following permissions: ';
    const permissionQuestionPlainText = `${permissionQuestionBaseText}${permissions.join(', ')}.`;

    const permissionLabel = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(PermissionLabel, {
        children: permissionQuestionBaseText
      }), permissions.map((permission, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
        children: [i > 0 && ', ', " ", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(Permission, {
          children: permission
        })]
      }, permission)), "."]
    }); // No translations since we need to be able to read this email :)


    const baseFields = [{
      type: 'textarea',
      required: true,
      label: 'What does your integration do? Please be as detailed as possible.',
      autosize: true,
      rows: 1,
      inline: false,
      name: 'question0'
    }, {
      type: 'textarea',
      required: true,
      label: 'What value does it offer customers?',
      autosize: true,
      rows: 1,
      inline: false,
      name: 'question1'
    }, {
      type: 'textarea',
      required: true,
      label: 'Do you operate the web service your integration communicates with?',
      autosize: true,
      rows: 1,
      inline: false,
      name: 'question2'
    }]; // Only add the permissions question if there are perms to add

    if (permissions.length > 0) {
      baseFields.push({
        type: 'textarea',
        required: true,
        label: permissionLabel,
        autosize: true,
        rows: 1,
        inline: false,
        meta: permissionQuestionPlainText,
        name: 'question3'
      });
    }

    return baseFields;
  }

  render() {
    const {
      app,
      Header,
      Body
    } = this.props;
    const endpoint = `/sentry-apps/${app.slug}/publish-request/`;
    const forms = [{
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Questions to answer'),
      fields: this.formFields
    }];
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(Header, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Publish Request Questionnaire')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(Body, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(Explanation, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)(`Please fill out this questionnaire in order to get your integration evaluated for publication.
              Once your integration has been approved, users outside of your organization will be able to install it.`)
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_7__["default"], {
          allowUndo: true,
          apiMethod: "POST",
          apiEndpoint: endpoint,
          onSubmitSuccess: this.handleSubmitSuccess,
          onSubmitError: this.handleSubmitError,
          model: this.form,
          submitLabel: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Request Publication'),
          onCancel: () => this.props.closeModal(),
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_8__["default"], {
            forms: forms
          })
        })]
      })]
    });
  }

}
SentryAppPublishRequestModal.displayName = "SentryAppPublishRequestModal";

const Explanation = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e14x9wf02"
} : 0)("margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1.5), " 0px;font-size:18px;" + ( true ? "" : 0));

const PermissionLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e14x9wf01"
} : 0)( true ? {
  name: "1gt2cgk",
  styles: "line-height:24px"
} : 0);

const Permission = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('code',  true ? {
  target: "e14x9wf00"
} : 0)( true ? {
  name: "1gt2cgk",
  styles: "line-height:24px"
} : 0);

/***/ }),

/***/ "./app/components/sentryAppIcon.tsx":
/*!******************************************!*\
  !*** ./app/components/sentryAppIcon.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_avatar_sentryAppAvatar__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/avatar/sentryAppAvatar */ "./app/components/avatar/sentryAppAvatar.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



const SentryAppIcon = _ref => {
  let {
    sentryApp,
    size
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)(sentry_components_avatar_sentryAppAvatar__WEBPACK_IMPORTED_MODULE_0__["default"], {
    sentryApp: sentryApp,
    size: size,
    isColor: true
  });
};

SentryAppIcon.displayName = "SentryAppIcon";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SentryAppIcon);

/***/ }),

/***/ "./app/utils/routeTitle.tsx":
/*!**********************************!*\
  !*** ./app/utils/routeTitle.tsx ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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

/***/ "./app/views/organizationIntegrations/createIntegrationButton.tsx":
/*!************************************************************************!*\
  !*** ./app/views/organizationIntegrations/createIntegrationButton.tsx ***!
  \************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics_integrations_platformAnalyticsEvents__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/analytics/integrations/platformAnalyticsEvents */ "./app/utils/analytics/integrations/platformAnalyticsEvents.ts");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









/**
 * Button to open the modal to create a new public/internal integration (Sentry App)
 */
function CreateIntegrationButton(_ref) {
  let {
    organization,
    analyticsView
  } = _ref;
  const permissionTooltipText = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Manager or Owner permissions are required to create a new integration');
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_1__["default"], {
    organization: organization,
    access: ['org:write'],
    children: _ref2 => {
      let {
        hasAccess
      } = _ref2;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
        size: "sm",
        priority: "primary",
        disabled: !hasAccess,
        title: !hasAccess ? permissionTooltipText : undefined,
        onClick: () => {
          (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_0__.openCreateNewIntegrationModal)({
            organization
          });
          (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_5__.trackIntegrationAnalytics)(sentry_utils_analytics_integrations_platformAnalyticsEvents__WEBPACK_IMPORTED_MODULE_4__.PlatformEvents.OPEN_CREATE_MODAL, {
            organization,
            view: analyticsView
          });
        },
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Create New Integration')
      });
    }
  });
}

CreateIntegrationButton.displayName = "CreateIntegrationButton";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_6__["default"])(CreateIntegrationButton));

/***/ }),

/***/ "./app/views/organizationIntegrations/exampleIntegrationButton.tsx":
/*!*************************************************************************!*\
  !*** ./app/views/organizationIntegrations/exampleIntegrationButton.tsx ***!
  \*************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics_integrations_platformAnalyticsEvents__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/analytics/integrations/platformAnalyticsEvents */ "./app/utils/analytics/integrations/platformAnalyticsEvents.ts");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








/**
 * Button to direct users to the Example App repository
 */
function ExampleIntegrationButton(_ref) {
  let {
    organization,
    analyticsView,
    ...buttonProps
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_0__["default"], {
    size: "sm",
    external: true,
    href: sentry_utils_analytics_integrations_platformAnalyticsEvents__WEBPACK_IMPORTED_MODULE_3__.platformEventLinkMap[sentry_utils_analytics_integrations_platformAnalyticsEvents__WEBPACK_IMPORTED_MODULE_3__.PlatformEvents.EXAMPLE_SOURCE],
    onClick: () => {
      (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_4__.trackIntegrationAnalytics)(sentry_utils_analytics_integrations_platformAnalyticsEvents__WEBPACK_IMPORTED_MODULE_3__.PlatformEvents.EXAMPLE_SOURCE, {
        organization,
        view: analyticsView
      });
    },
    icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_1__.IconGithub, {}),
    ...buttonProps,
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('View Example App')
  });
}

ExampleIntegrationButton.displayName = "ExampleIntegrationButton";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_5__["default"])(ExampleIntegrationButton));

/***/ }),

/***/ "./app/views/settings/organizationDeveloperSettings/index.tsx":
/*!********************************************************************!*\
  !*** ./app/views/settings/organizationDeveloperSettings/index.tsx ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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
/* harmony import */ var sentry_actionCreators_sentryApps__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/sentryApps */ "./app/actionCreators/sentryApps.tsx");
/* harmony import */ var sentry_actionCreators_sentryFunctions__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/sentryFunctions */ "./app/actionCreators/sentryFunctions.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/navTabs */ "./app/components/navTabs.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_integrations_platformAnalyticsEvents__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/analytics/integrations/platformAnalyticsEvents */ "./app/utils/analytics/integrations/platformAnalyticsEvents.ts");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/routeTitle */ "./app/utils/routeTitle.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_organizationIntegrations_createIntegrationButton__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/views/organizationIntegrations/createIntegrationButton */ "./app/views/organizationIntegrations/createIntegrationButton.tsx");
/* harmony import */ var sentry_views_organizationIntegrations_exampleIntegrationButton__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/views/organizationIntegrations/exampleIntegrationButton */ "./app/views/organizationIntegrations/exampleIntegrationButton.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_organizationDeveloperSettings_sentryApplicationRow__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/views/settings/organizationDeveloperSettings/sentryApplicationRow */ "./app/views/settings/organizationDeveloperSettings/sentryApplicationRow/index.tsx");
/* harmony import */ var _sentryFunctionRow__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ./sentryFunctionRow */ "./app/views/settings/organizationDeveloperSettings/sentryFunctionRow/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }























class OrganizationDeveloperSettings extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_16__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "analyticsView", 'developer_settings');

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "removeApp", app => {
      const apps = this.state.applications.filter(a => a.slug !== app.slug);
      (0,sentry_actionCreators_sentryApps__WEBPACK_IMPORTED_MODULE_5__.removeSentryApp)(this.api, app).then(() => {
        this.setState({
          applications: apps
        });
      }, () => {});
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "removeFunction", (organization, sentryFunction) => {
      var _this$state$sentryFun;

      const functionsToKeep = (_this$state$sentryFun = this.state.sentryFunctions) === null || _this$state$sentryFun === void 0 ? void 0 : _this$state$sentryFun.filter(fn => fn.name !== sentryFunction.name);

      if (!functionsToKeep) {
        return;
      }

      (0,sentry_actionCreators_sentryFunctions__WEBPACK_IMPORTED_MODULE_6__.removeSentryFunction)(this.api, organization, sentryFunction).then(isSuccess => {
        if (isSuccess) {
          this.setState({
            sentryFunctions: functionsToKeep
          });
        }
      }, () => {});
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onTabChange", value => {
      this.setState({
        tab: value
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderSentryFunction", sentryFunction => {
      const {
        organization
      } = this.props;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(_sentryFunctionRow__WEBPACK_IMPORTED_MODULE_22__["default"], {
        organization: organization,
        sentryFunction: sentryFunction,
        onRemoveFunction: this.removeFunction
      }, organization.slug + sentryFunction.name);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderApplicationRow", app => {
      const {
        organization
      } = this.props;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_views_settings_organizationDeveloperSettings_sentryApplicationRow__WEBPACK_IMPORTED_MODULE_21__["default"], {
        app: app,
        organization: organization,
        onRemoveApp: this.removeApp
      }, app.uuid);
    });
  }

  getDefaultState() {
    const {
      location
    } = this.props;
    const value = ['public', 'internal', 'sentryfx'].find(tab => {
      var _location$query;

      return tab === (location === null || location === void 0 ? void 0 : (_location$query = location.query) === null || _location$query === void 0 ? void 0 : _location$query.type);
    }) || 'internal';
    return { ...super.getDefaultState(),
      applications: [],
      sentryFunctions: [],
      tab: value
    };
  }

  get tab() {
    return this.state.tab;
  }

  getTitle() {
    const {
      orgId
    } = this.props.params;
    return (0,sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_14__["default"])((0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Developer Settings'), orgId, false);
  }

  getEndpoints() {
    const {
      orgId
    } = this.props.params;
    const {
      organization
    } = this.props;
    const returnValue = [['applications', `/organizations/${orgId}/sentry-apps/`]];

    if (organization.features.includes('sentry-functions')) {
      returnValue.push(['sentryFunctions', `/organizations/${orgId}/functions/`]);
    }

    return returnValue;
  }

  renderSentryFunctions() {
    const {
      sentryFunctions
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.Panel, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.PanelHeader, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Sentry Functions')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.PanelBody, {
        children: sentryFunctions !== null && sentryFunctions !== void 0 && sentryFunctions.length ? sentryFunctions.map(this.renderSentryFunction) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_19__["default"], {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('No Sentry Functions have been created yet.')
        })
      })]
    });
  }

  renderInternalIntegrations() {
    const integrations = this.state.applications.filter(app => app.status === 'internal');
    const isEmpty = integrations.length === 0;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.Panel, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.PanelHeader, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Internal Integrations')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.PanelBody, {
        children: !isEmpty ? integrations.map(this.renderApplicationRow) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_19__["default"], {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('No internal integrations have been created yet.')
        })
      })]
    });
  }

  renderPublicIntegrations() {
    const integrations = this.state.applications.filter(app => app.status !== 'internal');
    const isEmpty = integrations.length === 0;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.Panel, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.PanelHeader, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Public Integrations')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.PanelBody, {
        children: !isEmpty ? integrations.map(this.renderApplicationRow) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_19__["default"], {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('No public integrations have been created yet.')
        })
      })]
    });
  }

  renderTabContent(tab) {
    switch (tab) {
      case 'sentryfx':
        return this.renderSentryFunctions();

      case 'internal':
        return this.renderInternalIntegrations();

      case 'public':
      default:
        return this.renderPublicIntegrations();
    }
  }

  renderBody() {
    const {
      organization
    } = this.props;
    const tabs = [['internal', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Internal Integration')], ['public', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Public Integration')]];

    if (organization.features.includes('sentry-functions')) {
      tabs.push(['sentryfx', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Sentry Function')]);
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_20__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Developer Settings'),
        body: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Create integrations that interact with Sentry using the REST API and webhooks. '), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)("br", {}), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.tct)('For more information [link: see our docs].', {
            link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_7__["default"], {
              href: sentry_utils_analytics_integrations_platformAnalyticsEvents__WEBPACK_IMPORTED_MODULE_12__.platformEventLinkMap[sentry_utils_analytics_integrations_platformAnalyticsEvents__WEBPACK_IMPORTED_MODULE_12__.PlatformEvents.DOCS],
              onClick: () => {
                (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_13__.trackIntegrationAnalytics)(sentry_utils_analytics_integrations_platformAnalyticsEvents__WEBPACK_IMPORTED_MODULE_12__.PlatformEvents.DOCS, {
                  organization,
                  view: this.analyticsView
                });
              }
            })
          })]
        }),
        action: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(ActionContainer, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_views_organizationIntegrations_exampleIntegrationButton__WEBPACK_IMPORTED_MODULE_18__["default"], {
            analyticsView: this.analyticsView,
            style: {
              marginRight: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(1)
            }
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_views_organizationIntegrations_createIntegrationButton__WEBPACK_IMPORTED_MODULE_17__["default"], {
            analyticsView: this.analyticsView
          })]
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_8__["default"], {
        underlined: true,
        children: tabs.map(_ref => {
          let [type, label] = _ref;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)("li", {
            className: this.tab === type ? 'active' : '',
            onClick: () => this.onTabChange(type),
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)("a", {
              children: label
            })
          }, type);
        })
      }), this.renderTabContent(this.tab)]
    });
  }

}

const ActionContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ekicjwg0"
} : 0)( true ? {
  name: "zjik7",
  styles: "display:flex"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_15__["default"])(OrganizationDeveloperSettings));

/***/ }),

/***/ "./app/views/settings/organizationDeveloperSettings/sentryApplicationRow/actionButtons.tsx":
/*!*************************************************************************************************!*\
  !*** ./app/views/settings/organizationDeveloperSettings/sentryApplicationRow/actionButtons.tsx ***!
  \*************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_confirmDelete__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/confirmDelete */ "./app/components/confirmDelete.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









const ActionButtons = _ref => {
  let {
    org,
    app,
    showPublish,
    showDelete,
    onPublish,
    onDelete,
    disablePublishReason,
    disableDeleteReason
  } = _ref;

  const appDashboardButton = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(StyledButton, {
    size: "xs",
    icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconStats, {}),
    to: `/settings/${org.slug}/developer-settings/${app.slug}/dashboard/`,
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Dashboard')
  });

  const publishRequestButton = showPublish ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(StyledButton, {
    disabled: !!disablePublishReason,
    title: disablePublishReason,
    icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconUpgrade, {}),
    size: "xs",
    onClick: onPublish,
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Publish')
  }) : null;
  const deleteConfirmMessage = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)(`Deleting ${app.slug} will also delete any and all of its installations. \
         This is a permanent action. Do you wish to continue?`);
  const deleteButton = showDelete ? disableDeleteReason ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(StyledButton, {
    disabled: true,
    title: disableDeleteReason,
    size: "xs",
    icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconDelete, {}),
    "aria-label": "Delete"
  }) : onDelete && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_confirmDelete__WEBPACK_IMPORTED_MODULE_2__["default"], {
    message: deleteConfirmMessage,
    confirmInput: app.slug,
    priority: "danger",
    onConfirm: () => onDelete(app),
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(StyledButton, {
      size: "xs",
      icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconDelete, {}),
      "aria-label": "Delete"
    })
  }) : null;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(ButtonHolder, {
    children: [appDashboardButton, publishRequestButton, deleteButton]
  });
};

ActionButtons.displayName = "ActionButtons";

const ButtonHolder = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eg64e9n1"
} : 0)("flex-direction:row;display:flex;&>*{margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(0.5), ";}" + ( true ? "" : 0));

const StyledButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "eg64e9n0"
} : 0)("color:", p => p.theme.subText, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ActionButtons);

/***/ }),

/***/ "./app/views/settings/organizationDeveloperSettings/sentryApplicationRow/index.tsx":
/*!*****************************************************************************************!*\
  !*** ./app/views/settings/organizationDeveloperSettings/sentryApplicationRow/index.tsx ***!
  \*****************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ SentryApplicationRow)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_modals_sentryAppPublishRequestModal__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/modals/sentryAppPublishRequestModal */ "./app/components/modals/sentryAppPublishRequestModal.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_sentryAppIcon__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/sentryAppIcon */ "./app/components/sentryAppIcon.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _sentryApplicationRowButtons__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./sentryApplicationRowButtons */ "./app/views/settings/organizationDeveloperSettings/sentryApplicationRow/sentryApplicationRowButtons.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }












class SentryApplicationRow extends react__WEBPACK_IMPORTED_MODULE_3__.PureComponent {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handlePublish", () => {
      const {
        app
      } = this.props;
      (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_4__.openModal)(deps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_modals_sentryAppPublishRequestModal__WEBPACK_IMPORTED_MODULE_6__["default"], {
        app: app,
        ...deps
      }));
    });
  }

  get isInternal() {
    return this.props.app.status === 'internal';
  }

  hideStatus() {
    // no publishing for internal apps so hide the status on the developer settings page
    return this.isInternal;
  }

  renderStatus() {
    const {
      app
    } = this.props;

    if (this.hideStatus()) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(PublishStatus, {
      status: app.status
    });
  }

  render() {
    const {
      app,
      organization,
      onRemoveApp
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(SentryAppItem, {
      "data-test-id": app.slug,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(StyledFlex, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_sentryAppIcon__WEBPACK_IMPORTED_MODULE_8__["default"], {
          sentryApp: app,
          size: 36
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(SentryAppBox, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(SentryAppName, {
            hideStatus: this.hideStatus(),
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__["default"], {
              to: `/settings/${organization.slug}/developer-settings/${app.slug}/`,
              children: app.name
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(SentryAppDetails, {
            children: this.renderStatus()
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(Box, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(_sentryApplicationRowButtons__WEBPACK_IMPORTED_MODULE_11__["default"], {
            organization: organization,
            app: app,
            onClickRemove: onRemoveApp,
            onClickPublish: this.handlePublish
          })
        })]
      })
    });
  }

}
SentryApplicationRow.displayName = "SentryApplicationRow";

const Flex = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1go2kpk8"
} : 0)( true ? {
  name: "zjik7",
  styles: "display:flex"
} : 0);

const Box = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1go2kpk7"
} : 0)( true ? "" : 0);

const SentryAppItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__.PanelItem,  true ? {
  target: "e1go2kpk6"
} : 0)( true ? {
  name: "ehbzc8",
  styles: "flex-direction:column;padding:5px"
} : 0);

const StyledFlex = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(Flex,  true ? {
  target: "e1go2kpk5"
} : 0)( true ? {
  name: "1yplio6",
  styles: "justify-content:center;padding:10px"
} : 0);

const SentryAppBox = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1go2kpk4"
} : 0)( true ? {
  name: "3mxc9l",
  styles: "padding-left:15px;padding-right:15px;flex:1"
} : 0);

const SentryAppDetails = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(Flex,  true ? {
  target: "e1go2kpk3"
} : 0)( true ? {
  name: "p4xtjg",
  styles: "align-items:center;margin-top:6px;font-size:0.8em"
} : 0);

const SentryAppName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1go2kpk2"
} : 0)("margin-top:", p => p.hideStatus ? '10px' : '0px', ";" + ( true ? "" : 0));

const CenterFlex = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(Flex,  true ? {
  target: "e1go2kpk1"
} : 0)( true ? {
  name: "1h3rtzg",
  styles: "align-items:center"
} : 0);

const PublishStatus = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(_ref => {
  let {
    status,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(CenterFlex, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("div", { ...props,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)(`${status}`)
    })
  });
},  true ? {
  target: "e1go2kpk0"
} : 0)("color:", props => props.status === 'published' ? props.theme.success : props.theme.gray300, ";font-weight:light;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(0.75), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/organizationDeveloperSettings/sentryApplicationRow/sentryApplicationRowButtons.tsx":
/*!***************************************************************************************************************!*\
  !*** ./app/views/settings/organizationDeveloperSettings/sentryApplicationRow/sentryApplicationRowButtons.tsx ***!
  \***************************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _actionButtons__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./actionButtons */ "./app/views/settings/organizationDeveloperSettings/sentryApplicationRow/actionButtons.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





const SentryApplicationRowButtons = _ref => {
  let {
    organization,
    app,
    onClickRemove,
    onClickPublish
  } = _ref;
  const isInternal = app.status === 'internal';
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_0__["default"], {
    access: ['org:admin'],
    organization: organization,
    children: _ref2 => {
      let {
        hasAccess
      } = _ref2;
      let disablePublishReason = '';
      let disableDeleteReason = ''; // Publish & Delete buttons will always be disabled if the app is published

      if (app.status === 'published') {
        disablePublishReason = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Published integrations cannot be re-published.');
        disableDeleteReason = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Published integrations cannot be removed.');
      } else if (!hasAccess) {
        disablePublishReason = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Organization owner permissions are required for this action.');
        disableDeleteReason = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Organization owner permissions are required for this action.');
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_actionButtons__WEBPACK_IMPORTED_MODULE_2__["default"], {
        org: organization,
        app: app,
        showPublish: !isInternal,
        showDelete: true,
        onPublish: onClickPublish,
        onDelete: onClickRemove,
        disablePublishReason: disablePublishReason,
        disableDeleteReason: disableDeleteReason
      });
    }
  });
};

SentryApplicationRowButtons.displayName = "SentryApplicationRowButtons";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SentryApplicationRowButtons);

/***/ }),

/***/ "./app/views/settings/organizationDeveloperSettings/sentryFunctionRow/actionButtons.tsx":
/*!**********************************************************************************************!*\
  !*** ./app/views/settings/organizationDeveloperSettings/sentryFunctionRow/actionButtons.tsx ***!
  \**********************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






const ActionButtons = _ref => {
  let {
    org,
    sentryFn,
    onDelete
  } = _ref;

  const deleteButton = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(StyledButton, {
    size: "sm",
    icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_2__.IconDelete, {}),
    "aria-label": "Delete",
    onClick: () => onDelete(org, sentryFn)
  });

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(ButtonHolder, {
    children: deleteButton
  });
};

ActionButtons.displayName = "ActionButtons";

const StyledButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "e100cruo1"
} : 0)("color:", p => p.theme.subText, ";" + ( true ? "" : 0));

const ButtonHolder = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e100cruo0"
} : 0)("flex-direction:row;display:flex;&>*{margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(0.5), ";}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ActionButtons);

/***/ }),

/***/ "./app/views/settings/organizationDeveloperSettings/sentryFunctionRow/index.tsx":
/*!**************************************************************************************!*\
  !*** ./app/views/settings/organizationDeveloperSettings/sentryFunctionRow/index.tsx ***!
  \**************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ SentryFunctionRow)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _sentryFunctionRow_actionButtons__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../sentryFunctionRow/actionButtons */ "./app/views/settings/organizationDeveloperSettings/sentryFunctionRow/actionButtons.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }








function SentryFunctionRow(props) {
  const {
    onRemoveFunction,
    organization,
    sentryFunction
  } = props;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(SentryFunctionHolder, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(StyledFlex, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconInput, {
        size: "xl"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(SentryFunctionBox, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(SentryFunctionName, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(react_router__WEBPACK_IMPORTED_MODULE_1__.Link, {
            to: `/settings/${organization.slug}/developer-settings/sentry-functions/${sentryFunction.slug}/`,
            children: sentryFunction.name
          })
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Box, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(_sentryFunctionRow_actionButtons__WEBPACK_IMPORTED_MODULE_5__["default"], {
          org: organization,
          sentryFn: sentryFunction,
          onDelete: onRemoveFunction
        })
      })]
    })
  });
}
SentryFunctionRow.displayName = "SentryFunctionRow";

const Flex = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1r8viz75"
} : 0)( true ? {
  name: "zjik7",
  styles: "display:flex"
} : 0);

const Box = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1r8viz74"
} : 0)( true ? "" : 0);

const SentryFunctionHolder = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.PanelItem,  true ? {
  target: "e1r8viz73"
} : 0)("flex-direction:column;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(0.5), ";" + ( true ? "" : 0));

const StyledFlex = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Flex,  true ? {
  target: "e1r8viz72"
} : 0)("justify-content:center;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1), ";" + ( true ? "" : 0));

const SentryFunctionBox = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1r8viz71"
} : 0)( true ? {
  name: "1qv7e0",
  styles: "padding:0 15px;flex:1"
} : 0);

const SentryFunctionName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1r8viz70"
} : 0)( true ? {
  name: "1r0yqr6",
  styles: "margin-top:10px"
} : 0);

/***/ }),

/***/ "../node_modules/lodash/_baseIntersection.js":
/*!***************************************************!*\
  !*** ../node_modules/lodash/_baseIntersection.js ***!
  \***************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var SetCache = __webpack_require__(/*! ./_SetCache */ "../node_modules/lodash/_SetCache.js"),
    arrayIncludes = __webpack_require__(/*! ./_arrayIncludes */ "../node_modules/lodash/_arrayIncludes.js"),
    arrayIncludesWith = __webpack_require__(/*! ./_arrayIncludesWith */ "../node_modules/lodash/_arrayIncludesWith.js"),
    arrayMap = __webpack_require__(/*! ./_arrayMap */ "../node_modules/lodash/_arrayMap.js"),
    baseUnary = __webpack_require__(/*! ./_baseUnary */ "../node_modules/lodash/_baseUnary.js"),
    cacheHas = __webpack_require__(/*! ./_cacheHas */ "../node_modules/lodash/_cacheHas.js");

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeMin = Math.min;

/**
 * The base implementation of methods like `_.intersection`, without support
 * for iteratee shorthands, that accepts an array of arrays to inspect.
 *
 * @private
 * @param {Array} arrays The arrays to inspect.
 * @param {Function} [iteratee] The iteratee invoked per element.
 * @param {Function} [comparator] The comparator invoked per element.
 * @returns {Array} Returns the new array of shared values.
 */
function baseIntersection(arrays, iteratee, comparator) {
  var includes = comparator ? arrayIncludesWith : arrayIncludes,
      length = arrays[0].length,
      othLength = arrays.length,
      othIndex = othLength,
      caches = Array(othLength),
      maxLength = Infinity,
      result = [];

  while (othIndex--) {
    var array = arrays[othIndex];
    if (othIndex && iteratee) {
      array = arrayMap(array, baseUnary(iteratee));
    }
    maxLength = nativeMin(array.length, maxLength);
    caches[othIndex] = !comparator && (iteratee || (length >= 120 && array.length >= 120))
      ? new SetCache(othIndex && array)
      : undefined;
  }
  array = arrays[0];

  var index = -1,
      seen = caches[0];

  outer:
  while (++index < length && result.length < maxLength) {
    var value = array[index],
        computed = iteratee ? iteratee(value) : value;

    value = (comparator || value !== 0) ? value : 0;
    if (!(seen
          ? cacheHas(seen, computed)
          : includes(result, computed, comparator)
        )) {
      othIndex = othLength;
      while (--othIndex) {
        var cache = caches[othIndex];
        if (!(cache
              ? cacheHas(cache, computed)
              : includes(arrays[othIndex], computed, comparator))
            ) {
          continue outer;
        }
      }
      if (seen) {
        seen.push(computed);
      }
      result.push(value);
    }
  }
  return result;
}

module.exports = baseIntersection;


/***/ }),

/***/ "../node_modules/lodash/_castArrayLikeObject.js":
/*!******************************************************!*\
  !*** ../node_modules/lodash/_castArrayLikeObject.js ***!
  \******************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var isArrayLikeObject = __webpack_require__(/*! ./isArrayLikeObject */ "../node_modules/lodash/isArrayLikeObject.js");

/**
 * Casts `value` to an empty array if it's not an array like object.
 *
 * @private
 * @param {*} value The value to inspect.
 * @returns {Array|Object} Returns the cast array-like object.
 */
function castArrayLikeObject(value) {
  return isArrayLikeObject(value) ? value : [];
}

module.exports = castArrayLikeObject;


/***/ }),

/***/ "../node_modules/lodash/intersection.js":
/*!**********************************************!*\
  !*** ../node_modules/lodash/intersection.js ***!
  \**********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var arrayMap = __webpack_require__(/*! ./_arrayMap */ "../node_modules/lodash/_arrayMap.js"),
    baseIntersection = __webpack_require__(/*! ./_baseIntersection */ "../node_modules/lodash/_baseIntersection.js"),
    baseRest = __webpack_require__(/*! ./_baseRest */ "../node_modules/lodash/_baseRest.js"),
    castArrayLikeObject = __webpack_require__(/*! ./_castArrayLikeObject */ "../node_modules/lodash/_castArrayLikeObject.js");

/**
 * Creates an array of unique values that are included in all given arrays
 * using [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * for equality comparisons. The order and references of result values are
 * determined by the first array.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Array
 * @param {...Array} [arrays] The arrays to inspect.
 * @returns {Array} Returns the new array of intersecting values.
 * @example
 *
 * _.intersection([2, 1], [2, 3]);
 * // => [2]
 */
var intersection = baseRest(function(arrays) {
  var mapped = arrayMap(arrays, castArrayLikeObject);
  return (mapped.length && mapped[0] === arrays[0])
    ? baseIntersection(mapped)
    : [];
});

module.exports = intersection;


/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_organizationDeveloperSettings_index_tsx.318f5bd42422eab5a852455b44f279e3.js.map