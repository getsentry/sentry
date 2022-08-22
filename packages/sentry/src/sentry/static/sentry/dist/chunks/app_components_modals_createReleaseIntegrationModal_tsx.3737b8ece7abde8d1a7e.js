"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_modals_createReleaseIntegrationModal_tsx"],{

/***/ "./app/components/modals/createReleaseIntegrationModal.tsx":
/*!*****************************************************************!*\
  !*** ./app/components/modals/createReleaseIntegrationModal.tsx ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_forms_fieldFromConfig__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/forms/fieldFromConfig */ "./app/components/forms/fieldFromConfig.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









function CreateReleaseIntegrationModal(_ref) {
  let {
    Body,
    Header,
    closeModal,
    project,
    organization,
    onCreateSuccess,
    onCancel
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_5__["default"])();
  const fields = [{
    name: 'name',
    type: 'string',
    placeholder: `${project.name} Release Integration`,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Name'),
    help: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Name of new integration.')
    }),
    defaultValue: `${project.name} Release Integration`,
    required: true
  }];
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Header, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("h3", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Create a Release Integration')
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Body, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_3__["default"], {
        onCancel: () => {
          onCancel();
          closeModal();
        },
        onSubmit: async (data, onSubmitSuccess, onSubmitError) => {
          try {
            const integration = await api.requestPromise('/sentry-apps/', {
              method: 'POST',
              data: { ...data,
                organization: organization.slug,
                isAlertable: false,
                isInternal: true,
                scopes: ['project:read', 'project:write', 'team:read', 'team:write', 'project:releases', 'event:read', 'event:write', 'org:read', 'org:write', 'member:read', 'member:write'],
                verifyInstall: false,
                overview: `This internal integration was auto-generated to setup Releases for the ${project.name} project. It is needed to provide the token used to create a release. If this integration is deleted, your Releases workflow will stop working!`
              }
            });
            onSubmitSuccess(integration);
          } catch (error) {
            onSubmitError(error);
          }
        },
        onSubmitSuccess: data => {
          onCreateSuccess(data);
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Created Release Integration'));
          closeModal();
        },
        onSubmitError: error => {
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)('Something went wrong! [error]', {
            error
          }));
        },
        children: fields.map(field => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_forms_fieldFromConfig__WEBPACK_IMPORTED_MODULE_2__["default"], {
          field: field
        }, field.name))
      })
    })]
  });
}

CreateReleaseIntegrationModal.displayName = "CreateReleaseIntegrationModal";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (CreateReleaseIntegrationModal);

/***/ }),

/***/ "./app/utils/useApi.tsx":
/*!******************************!*\
  !*** ./app/utils/useApi.tsx ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_api__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/api */ "./app/api.tsx");



/**
 * Returns an API client that will have it's requests canceled when the owning
 * React component is unmounted (may be disabled via options).
 */
function useApi() {
  let {
    persistInFlight,
    api: providedApi
  } = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  const localApi = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(); // Lazily construct the client if we weren't provided with one

  if (localApi.current === undefined && providedApi === undefined) {
    localApi.current = new sentry_api__WEBPACK_IMPORTED_MODULE_1__.Client();
  } // Use the provided client if available


  const api = providedApi !== null && providedApi !== void 0 ? providedApi : localApi.current; // Clear API calls on unmount (if persistInFlight is disabled

  const clearOnUnmount = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(() => {
    if (!persistInFlight) {
      api.clear();
    }
  }, [api, persistInFlight]);
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => clearOnUnmount, [clearOnUnmount]);
  return api;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (useApi);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_modals_createReleaseIntegrationModal_tsx.77b2e877ac2c60d5aa9cb53305492256.js.map