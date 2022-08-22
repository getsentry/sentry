"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_clipboard_tsx-app_components_modals_debugFileCustomRepository_index_tsx-app_ut-906119"],{

/***/ "./app/components/acl/comingSoon.tsx":
/*!*******************************************!*\
  !*** ./app/components/acl/comingSoon.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




const ComingSoon = () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_0__["default"], {
  type: "info",
  showIcon: true,
  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('This feature is coming soon!')
});

ComingSoon.displayName = "ComingSoon";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ComingSoon);

/***/ }),

/***/ "./app/components/acl/feature.tsx":
/*!****************************************!*\
  !*** ./app/components/acl/feature.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_stores_hookStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/hookStore */ "./app/stores/hookStore.tsx");
/* harmony import */ var sentry_utils_isRenderFunc__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/isRenderFunc */ "./app/utils/isRenderFunc.tsx");
/* harmony import */ var sentry_utils_withConfig__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/withConfig */ "./app/utils/withConfig.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_utils_withProject__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/withProject */ "./app/utils/withProject.tsx");
/* harmony import */ var _comingSoon__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./comingSoon */ "./app/components/acl/comingSoon.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











/**
 * Component to handle feature flags.
 */
class Feature extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  getAllFeatures() {
    const {
      organization,
      project,
      config
    } = this.props;
    return {
      configFeatures: config.features ? Array.from(config.features) : [],
      organization: organization && organization.features || [],
      project: project && project.features || []
    };
  }

  hasFeature(feature, features) {
    const shouldMatchOnlyProject = feature.match(/^projects:(.+)/);
    const shouldMatchOnlyOrg = feature.match(/^organizations:(.+)/); // Array of feature strings

    const {
      configFeatures,
      organization,
      project
    } = features; // Check config store first as this overrides features scoped to org or
    // project contexts.

    if (configFeatures.includes(feature)) {
      return true;
    }

    if (shouldMatchOnlyProject) {
      return project.includes(shouldMatchOnlyProject[1]);
    }

    if (shouldMatchOnlyOrg) {
      return organization.includes(shouldMatchOnlyOrg[1]);
    } // default, check all feature arrays


    return organization.includes(feature) || project.includes(feature);
  }

  render() {
    const {
      children,
      features,
      renderDisabled,
      hookName,
      organization,
      project,
      requireAll
    } = this.props;
    const allFeatures = this.getAllFeatures();
    const method = requireAll ? 'every' : 'some';
    const hasFeature = !features || features[method](feat => this.hasFeature(feat, allFeatures)); // Default renderDisabled to the ComingSoon component

    let customDisabledRender = renderDisabled === false ? false : typeof renderDisabled === 'function' ? renderDisabled : () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_comingSoon__WEBPACK_IMPORTED_MODULE_8__["default"], {}); // Override the renderDisabled function with a hook store function if there
    // is one registered for the feature.

    if (hookName) {
      const hooks = sentry_stores_hookStore__WEBPACK_IMPORTED_MODULE_3__["default"].get(hookName);

      if (hooks.length > 0) {
        customDisabledRender = hooks[0];
      }
    }

    const renderProps = {
      organization,
      project,
      features,
      hasFeature
    };

    if (!hasFeature && customDisabledRender !== false) {
      return customDisabledRender({
        children,
        ...renderProps
      });
    }

    if ((0,sentry_utils_isRenderFunc__WEBPACK_IMPORTED_MODULE_4__.isRenderFunc)(children)) {
      return children({
        renderDisabled,
        ...renderProps
      });
    }

    return hasFeature && children ? children : null;
  }

}

Feature.displayName = "Feature";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(Feature, "defaultProps", {
  renderDisabled: false,
  requireAll: true
});

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_6__["default"])((0,sentry_utils_withProject__WEBPACK_IMPORTED_MODULE_7__["default"])((0,sentry_utils_withConfig__WEBPACK_IMPORTED_MODULE_5__["default"])(Feature))));

/***/ }),

/***/ "./app/components/clipboard.tsx":
/*!**************************************!*\
  !*** ./app/components/clipboard.tsx ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_dom__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-dom */ "../node_modules/react-dom/profiling.js");
/* harmony import */ var copy_text_to_clipboard__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! copy-text-to-clipboard */ "../node_modules/copy-text-to-clipboard/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");







/**
 * copy-text-to-clipboard relies on `document.execCommand('copy')`
 */
function isSupported() {
  var _document$queryComman, _document;

  return !!((_document$queryComman = (_document = document).queryCommandSupported) !== null && _document$queryComman !== void 0 && _document$queryComman.call(_document, 'copy'));
}

function Clipboard(_ref) {
  let {
    hideMessages = false,
    successMessage = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Copied to clipboard'),
    errorMessage = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Error copying to clipboard'),
    value,
    onSuccess,
    onError,
    hideUnsupported,
    children
  } = _ref;
  const [element, setElement] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)();
  const handleClick = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
    const copyWasSuccessful = (0,copy_text_to_clipboard__WEBPACK_IMPORTED_MODULE_3__["default"])(value);

    if (!copyWasSuccessful) {
      if (!hideMessages) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)(errorMessage);
      }

      onError === null || onError === void 0 ? void 0 : onError();
      return;
    }

    if (!hideMessages) {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)(successMessage);
    }

    onSuccess === null || onSuccess === void 0 ? void 0 : onSuccess();
  }, [value, onError, onSuccess, errorMessage, successMessage, hideMessages]);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    element === null || element === void 0 ? void 0 : element.addEventListener('click', handleClick);
    return () => element === null || element === void 0 ? void 0 : element.removeEventListener('click', handleClick);
  }, [handleClick, element]); // XXX: Instead of assigning the `onClick` to the cloned child element, we
  // attach a event listener, otherwise we would wipeout whatever click handler
  // may be assigned on the child.

  const handleMount = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(ref => {
    // eslint-disable-next-line react/no-find-dom-node
    setElement((0,react_dom__WEBPACK_IMPORTED_MODULE_2__.findDOMNode)(ref));
  }, []); // Browser doesn't support `execCommand`

  if (hideUnsupported && !isSupported()) {
    return null;
  }

  if (! /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.isValidElement)(children)) {
    return null;
  }

  return /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.cloneElement)(children, {
    ref: handleMount
  });
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Clipboard);

/***/ }),

/***/ "./app/components/modals/debugFileCustomRepository/appStoreConnect/index.tsx":
/*!***********************************************************************************!*\
  !*** ./app/components/modals/debugFileCustomRepository/appStoreConnect/index.tsx ***!
  \***********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_appStoreValidationErrorMessage__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/appStoreValidationErrorMessage */ "./app/utils/appStoreValidationErrorMessage.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _stepOne__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./stepOne */ "./app/components/modals/debugFileCustomRepository/appStoreConnect/stepOne.tsx");
/* harmony import */ var _stepTwo__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./stepTwo */ "./app/components/modals/debugFileCustomRepository/appStoreConnect/stepTwo.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./utils */ "./app/components/modals/debugFileCustomRepository/appStoreConnect/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

















const steps = [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('App Store Connect credentials'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Choose an application')];

function AppStoreConnect(_ref) {
  let {
    Header,
    Body,
    Footer,
    api,
    initialData,
    orgSlug,
    projectSlug,
    onSubmit,
    appStoreConnectStatusData
  } = _ref;
  const {
    credentials
  } = appStoreConnectStatusData !== null && appStoreConnectStatusData !== void 0 ? appStoreConnectStatusData : {};
  const [isLoading, setIsLoading] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(false);
  const [activeStep, setActiveStep] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(0);
  const [appStoreApps, setAppStoreApps] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)([]);
  const [stepOneData, setStepOneData] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)({
    issuer: initialData === null || initialData === void 0 ? void 0 : initialData.appconnectIssuer,
    keyId: initialData === null || initialData === void 0 ? void 0 : initialData.appconnectKey,
    privateKey: typeof (initialData === null || initialData === void 0 ? void 0 : initialData.appconnectPrivateKey) === 'object' ? undefined : '',
    errors: undefined
  });
  const [stepTwoData, setStepTwoData] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)({
    app: undefined
  });

  async function checkCredentials() {
    setIsLoading(true);

    try {
      var _stepTwoData$app;

      const response = await api.requestPromise(`/projects/${orgSlug}/${projectSlug}/appstoreconnect/apps/`, {
        method: 'POST',
        data: {
          id: stepOneData.privateKey !== undefined ? undefined : initialData === null || initialData === void 0 ? void 0 : initialData.id,
          appconnectIssuer: stepOneData.issuer,
          appconnectKey: stepOneData.keyId,
          appconnectPrivateKey: stepOneData.privateKey
        }
      });
      const storeApps = response.apps;

      if (!!initialData && !storeApps.find(app => app.appId === initialData.appId)) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Credentials not authorized for this application'));
        setIsLoading(false);
        return;
      }

      setAppStoreApps(storeApps);

      if ((_stepTwoData$app = stepTwoData.app) !== null && _stepTwoData$app !== void 0 && _stepTwoData$app.appId && !storeApps.find(app => {
        var _stepTwoData$app2;

        return app.appId === ((_stepTwoData$app2 = stepTwoData.app) === null || _stepTwoData$app2 === void 0 ? void 0 : _stepTwoData$app2.appId);
      })) {
        setStepTwoData({
          app: storeApps[0]
        });
      }

      if (!!initialData) {
        updateCredentials();
        return;
      }

      setIsLoading(false);
      goNext();
    } catch (error) {
      setIsLoading(false);
      const appStoreConnnectError = (0,_utils__WEBPACK_IMPORTED_MODULE_15__.getAppStoreErrorMessage)(error);

      if (typeof appStoreConnnectError === 'string') {
        // app-connect-authentication-error
        // app-connect-forbidden-error
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)(appStoreConnnectError);
        return;
      }

      setStepOneData({ ...stepOneData,
        errors: appStoreConnnectError
      });
    }
  }

  function closeModal() {
    setTimeout(() => onSubmit(), sentry_constants__WEBPACK_IMPORTED_MODULE_8__.DEFAULT_TOAST_DURATION);
  }

  async function updateCredentials() {
    if (!initialData) {
      return;
    }

    try {
      await api.requestPromise(`/projects/${orgSlug}/${projectSlug}/appstoreconnect/${initialData.id}/`, {
        method: 'POST',
        data: {
          appconnectIssuer: stepOneData.issuer,
          appconnectKey: stepOneData.keyId,
          appconnectPrivateKey: stepOneData.privateKey,
          appName: initialData.appName,
          appId: initialData.appId,
          bundleId: initialData.bundleId
        }
      });
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Successfully updated custom repository'));
      closeModal();
    } catch (error) {
      setIsLoading(false);
      const appStoreConnnectError = (0,_utils__WEBPACK_IMPORTED_MODULE_15__.getAppStoreErrorMessage)(error);

      if (typeof appStoreConnnectError === 'string') {
        if (appStoreConnnectError === sentry_utils_appStoreValidationErrorMessage__WEBPACK_IMPORTED_MODULE_11__.unexpectedErrorMessage) {
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('An error occurred while updating the custom repository'));
          return;
        }

        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)(appStoreConnnectError);
      }
    }
  }

  async function persistData() {
    if (!stepTwoData.app) {
      return;
    }

    setIsLoading(true);

    try {
      await api.requestPromise(`/projects/${orgSlug}/${projectSlug}/appstoreconnect/`, {
        method: 'POST',
        data: {
          appconnectIssuer: stepOneData.issuer,
          appconnectKey: stepOneData.keyId,
          appconnectPrivateKey: stepOneData.privateKey,
          appName: stepTwoData.app.name,
          appId: stepTwoData.app.appId,
          bundleId: stepTwoData.app.bundleId
        }
      });
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Successfully added custom repository'));
      closeModal();
    } catch (error) {
      setIsLoading(false);
      const appStoreConnnectError = (0,_utils__WEBPACK_IMPORTED_MODULE_15__.getAppStoreErrorMessage)(error);

      if (typeof appStoreConnnectError === 'string') {
        if (appStoreConnnectError === sentry_utils_appStoreValidationErrorMessage__WEBPACK_IMPORTED_MODULE_11__.unexpectedErrorMessage) {
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('An error occurred while adding the custom repository'));
          return;
        }

        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)(appStoreConnnectError);
      }
    }
  }

  function isFormInvalid() {
    switch (activeStep) {
      case 0:
        return Object.keys(stepOneData).some(key => {
          if (key === 'errors') {
            var _stepOneData$key;

            const errors = (_stepOneData$key = stepOneData[key]) !== null && _stepOneData$key !== void 0 ? _stepOneData$key : {};
            return Object.keys(errors).some(error => !!errors[error]);
          }

          if (key === 'privateKey' && stepOneData[key] === undefined) {
            return false;
          }

          return !stepOneData[key];
        });

      case 1:
        return Object.keys(stepTwoData).some(key => !stepTwoData[key]);

      default:
        return false;
    }
  }

  function goNext() {
    setActiveStep(activeStep + 1);
  }

  function handleGoBack() {
    const newActiveStep = activeStep - 1;
    setActiveStep(newActiveStep);
  }

  function handleGoNext() {
    switch (activeStep) {
      case 0:
        checkCredentials();
        break;

      case 1:
        persistData();
        break;

      default:
        break;
    }
  }

  function renderCurrentStep() {
    switch (activeStep) {
      case 0:
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_stepOne__WEBPACK_IMPORTED_MODULE_13__["default"], {
          stepOneData: stepOneData,
          onSetStepOneData: setStepOneData
        });

      case 1:
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_stepTwo__WEBPACK_IMPORTED_MODULE_14__["default"], {
          appStoreApps: appStoreApps,
          stepTwoData: stepTwoData,
          onSetStepTwoData: setStepTwoData
        });

      default:
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_4__["default"], {
          type: "error",
          showIcon: true,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('This step could not be found.')
        });
    }
  }

  function getAlerts() {
    const alerts = [];

    if (activeStep !== 0) {
      return alerts;
    }

    if ((credentials === null || credentials === void 0 ? void 0 : credentials.status) === 'invalid') {
      alerts.push((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledAlert, {
        type: "warning",
        showIcon: true,
        children: credentials.code === 'app-connect-forbidden-error' ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Your App Store Connect credentials have insufficient permissions. To reconnect, update your credentials.') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Your App Store Connect credentials are invalid. To reconnect, update your credentials.')
      }));
    }

    return alerts;
  }

  function renderBodyContent() {
    const alerts = getAlerts();
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [!!alerts.length && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Alerts, {
        children: alerts.map((alert, index) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
          children: alert
        }, index))
      }), renderCurrentStep()]
    });
  }

  if (initialData && !appStoreConnectStatusData) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_7__["default"], {});
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Header, {
      closeButton: true,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(HeaderContent, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(NumericSymbol, {
          children: activeStep + 1
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(HeaderContentTitle, {
          children: steps[activeStep]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StepsOverview, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)('[currentStep] of [totalSteps]', {
            currentStep: activeStep + 1,
            totalSteps: !!initialData ? 1 : steps.length
          })
        })]
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Body, {
      children: renderBodyContent()
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Footer, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_6__["default"], {
        gap: 1,
        children: [activeStep !== 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
          onClick: handleGoBack,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Back')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(StyledButton, {
          priority: "primary",
          onClick: handleGoNext,
          disabled: isLoading || isFormInvalid(),
          children: [isLoading && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(LoadingIndicatorWrapper, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_7__["default"], {
              mini: true
            })
          }), !!initialData ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Update') : activeStep + 1 === steps.length ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Save') : steps[activeStep + 1]]
        })]
      })
    })]
  });
}

AppStoreConnect.displayName = "AppStoreConnect";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_12__["default"])(AppStoreConnect));

const HeaderContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1sz93bw7"
} : 0)("display:grid;grid-template-columns:max-content max-content 1fr;align-items:center;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";" + ( true ? "" : 0));

const NumericSymbol = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1sz93bw6"
} : 0)("border-radius:50%;display:flex;align-items:center;justify-content:center;width:24px;height:24px;font-weight:700;font-size:", p => p.theme.fontSizeMedium, ";background-color:", p => p.theme.yellow300, ";" + ( true ? "" : 0));

const HeaderContentTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1sz93bw5"
} : 0)("font-weight:700;font-size:", p => p.theme.fontSizeExtraLarge, ";" + ( true ? "" : 0));

const StepsOverview = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1sz93bw4"
} : 0)("color:", p => p.theme.gray300, ";display:flex;justify-content:flex-end;" + ( true ? "" : 0));

const LoadingIndicatorWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1sz93bw3"
} : 0)( true ? {
  name: "34k26a",
  styles: "height:100%;position:absolute;width:100%;top:0;left:0;display:flex;align-items:center;justify-content:center"
} : 0);

const StyledButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e1sz93bw2"
} : 0)( true ? {
  name: "bjn8wh",
  styles: "position:relative"
} : 0);

const Alerts = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1sz93bw1"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1.5), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(3), ";" + ( true ? "" : 0));

const StyledAlert = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_alert__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "e1sz93bw0"
} : 0)( true ? {
  name: "ti75j2",
  styles: "margin:0"
} : 0);

/***/ }),

/***/ "./app/components/modals/debugFileCustomRepository/appStoreConnect/stepOne.tsx":
/*!*************************************************************************************!*\
  !*** ./app/components/modals/debugFileCustomRepository/appStoreConnect/stepOne.tsx ***!
  \*************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_forms_controls_textarea__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/forms/controls/textarea */ "./app/components/forms/controls/textarea.tsx");
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_components_input__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/input */ "./app/components/input.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










function StepOne(_ref) {
  var _stepOneData$errors, _stepOneData$errors2;

  let {
    stepOneData,
    onSetStepOneData
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__["default"], {
      type: "info",
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)('Please enter the [docLink:App Store Connect API Key] details. The key needs to have the "Developer" role for Sentry to discover the app builds.', {
        docLink: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_5__["default"], {
          href: "https://developer.apple.com/documentation/appstoreconnectapi/creating_api_keys_for_app_store_connect_api"
        })
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_3__["default"], {
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Issuer'),
      inline: false,
      error: (_stepOneData$errors = stepOneData.errors) === null || _stepOneData$errors === void 0 ? void 0 : _stepOneData$errors.issuer,
      flexibleControlStateSize: true,
      stacked: true,
      required: true,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_input__WEBPACK_IMPORTED_MODULE_4__["default"], {
        type: "text",
        name: "issuer",
        placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Issuer'),
        value: stepOneData.issuer,
        onChange: e => onSetStepOneData({ ...stepOneData,
          issuer: e.target.value,
          errors: !!stepOneData.errors ? { ...stepOneData.errors,
            issuer: undefined
          } : undefined
        })
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_3__["default"], {
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Key ID'),
      inline: false,
      error: (_stepOneData$errors2 = stepOneData.errors) === null || _stepOneData$errors2 === void 0 ? void 0 : _stepOneData$errors2.keyId,
      flexibleControlStateSize: true,
      stacked: true,
      required: true,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_input__WEBPACK_IMPORTED_MODULE_4__["default"], {
        type: "text",
        name: "keyId",
        placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Key Id'),
        value: stepOneData.keyId,
        onChange: e => onSetStepOneData({ ...stepOneData,
          keyId: e.target.value,
          errors: !!stepOneData.errors ? { ...stepOneData.errors,
            keyId: undefined
          } : undefined
        })
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_3__["default"], {
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Private Key'),
      inline: false,
      flexibleControlStateSize: true,
      stacked: true,
      required: true,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_forms_controls_textarea__WEBPACK_IMPORTED_MODULE_2__["default"], {
        name: "privateKey",
        value: stepOneData.privateKey,
        rows: 5,
        autosize: true,
        placeholder: stepOneData.privateKey === undefined ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('(Private Key unchanged)') : '-----BEGIN PRIVATE KEY-----\n[PRIVATE-KEY]\n-----END PRIVATE KEY-----',
        onChange: e => onSetStepOneData({ ...stepOneData,
          privateKey: e.target.value
        })
      })
    })]
  });
}

StepOne.displayName = "StepOne";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (StepOne);

/***/ }),

/***/ "./app/components/modals/debugFileCustomRepository/appStoreConnect/stepTwo.tsx":
/*!*************************************************************************************!*\
  !*** ./app/components/modals/debugFileCustomRepository/appStoreConnect/stepTwo.tsx ***!
  \*************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/forms/selectField */ "./app/components/forms/selectField.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }





function StepTwo(_ref) {
  var _stepTwoData$app$appI, _stepTwoData$app;

  let {
    stepTwoData,
    onSetStepTwoData,
    appStoreApps
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(StyledSelectField, {
    name: "application",
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('App Store Connect application'),
    options: appStoreApps.map(appStoreApp => ({
      value: appStoreApp.appId,
      label: appStoreApp.name
    })),
    placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Select application'),
    onChange: appId => {
      const selectedAppStoreApp = appStoreApps.find(appStoreApp => appStoreApp.appId === appId);
      onSetStepTwoData({
        app: selectedAppStoreApp
      });
    },
    value: (_stepTwoData$app$appI = (_stepTwoData$app = stepTwoData.app) === null || _stepTwoData$app === void 0 ? void 0 : _stepTwoData$app.appId) !== null && _stepTwoData$app$appI !== void 0 ? _stepTwoData$app$appI : '',
    inline: false,
    flexibleControlStateSize: true,
    stacked: true,
    required: true
  });
}

StepTwo.displayName = "StepTwo";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (StepTwo);

const StyledSelectField = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "e18v4sr80"
} : 0)( true ? {
  name: "jjyo93",
  styles: "padding-right:0"
} : 0);

/***/ }),

/***/ "./app/components/modals/debugFileCustomRepository/appStoreConnect/utils.tsx":
/*!***********************************************************************************!*\
  !*** ./app/components/modals/debugFileCustomRepository/appStoreConnect/utils.tsx ***!
  \***********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getAppStoreErrorMessage": () => (/* binding */ getAppStoreErrorMessage)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_appStoreValidationErrorMessage__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/appStoreValidationErrorMessage */ "./app/utils/appStoreValidationErrorMessage.tsx");




// since translations are done on the front-end we need to map  back-end error messages to front-end messages
const fieldErrorMessageMapping = {
  appconnectIssuer: {
    issuer: {
      'Ensure this field has at least 36 characters.': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('This field should be exactly 36 characters.'),
      'Ensure this field has no more than 36 characters.': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('This field should be exactly 36 characters.')
    }
  },
  appconnectKey: {
    keyId: {
      'Ensure this field has at least 2 characters.': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('This field should be between 2 and 20 characters.'),
      'Ensure this field has no more than 20 characters.': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('This field should be between 2 and 20 characters.')
    }
  }
};
function getAppStoreErrorMessage(error) {
  var _error$responseJSON;

  if (typeof error === 'string') {
    return error;
  }

  const detailedErrorResponse = (_error$responseJSON = error.responseJSON) === null || _error$responseJSON === void 0 ? void 0 : _error$responseJSON.detail;

  if (detailedErrorResponse) {
    return (0,sentry_utils_appStoreValidationErrorMessage__WEBPACK_IMPORTED_MODULE_2__.getAppStoreValidationErrorMessage)(detailedErrorResponse);
  }

  const errorResponse = error.responseJSON;

  if (!errorResponse) {
    return sentry_utils_appStoreValidationErrorMessage__WEBPACK_IMPORTED_MODULE_2__.unexpectedErrorMessage;
  }

  return Object.keys(errorResponse).reduce((acc, serverSideField) => {
    var _fieldErrorMessageMap;

    const fieldErrorMessage = (_fieldErrorMessageMap = fieldErrorMessageMapping[serverSideField]) !== null && _fieldErrorMessageMap !== void 0 ? _fieldErrorMessageMap : {};
    const field = Object.keys(fieldErrorMessage)[0];
    const errorMessages = errorResponse[serverSideField].map(errorMessage => {
      if (fieldErrorMessage[field][errorMessage]) {
        return fieldErrorMessage[field][errorMessage];
      } // This will be difficult to happen,
      // but if it happens we will be able to see which message is not being mapped on the fron-tend


      _sentry_react__WEBPACK_IMPORTED_MODULE_3__.withScope(scope => {
        scope.setExtra('serverSideField', serverSideField);
        scope.setExtra('message', errorMessage);
        _sentry_react__WEBPACK_IMPORTED_MODULE_3__.captureException(new Error('App Store Connect - Untranslated error message'));
      });
      return errorMessage;
    }); // the UI only displays one error message at a time

    return { ...acc,
      [field]: errorMessages[0]
    };
  }, {});
}

/***/ }),

/***/ "./app/components/modals/debugFileCustomRepository/http.tsx":
/*!******************************************************************!*\
  !*** ./app/components/modals/debugFileCustomRepository/http.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_actions_button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/actions/button */ "./app/components/actions/button.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/selectField */ "./app/components/forms/selectField.tsx");
/* harmony import */ var sentry_components_input__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/input */ "./app/components/input.tsx");
/* harmony import */ var sentry_data_debugFileSources__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/data/debugFileSources */ "./app/data/debugFileSources.tsx");
/* harmony import */ var sentry_icons_iconClose__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/icons/iconClose */ "./app/icons/iconClose.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_input__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/styles/input */ "./app/styles/input.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_guid__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/guid */ "./app/utils/guid.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }















const CLEAR_PASSWORD_BUTTON_SIZE = 22;
const PASSWORD_INPUT_PADDING_RIGHT = sentry_styles_input__WEBPACK_IMPORTED_MODULE_11__.INPUT_PADDING + CLEAR_PASSWORD_BUTTON_SIZE;

function Http(_ref) {
  var _props$initialData$id, _props$initialData, _props$initialData2, _props$initialData3, _props$initialData4, _props$initialData5, _props$initialData$la, _props$initialData6, _props$initialData$la2, _props$initialData7;

  let {
    Header,
    Body,
    Footer,
    onSubmit,
    ...props
  } = _ref;
  const initialData = {
    id: (_props$initialData$id = (_props$initialData = props.initialData) === null || _props$initialData === void 0 ? void 0 : _props$initialData.id) !== null && _props$initialData$id !== void 0 ? _props$initialData$id : (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_13__.uniqueId)(),
    name: (_props$initialData2 = props.initialData) === null || _props$initialData2 === void 0 ? void 0 : _props$initialData2.name,
    url: (_props$initialData3 = props.initialData) === null || _props$initialData3 === void 0 ? void 0 : _props$initialData3.url,
    username: (_props$initialData4 = props.initialData) === null || _props$initialData4 === void 0 ? void 0 : _props$initialData4.username,
    password: typeof ((_props$initialData5 = props.initialData) === null || _props$initialData5 === void 0 ? void 0 : _props$initialData5.password) === 'object' ? undefined : '',
    'layout.type': (_props$initialData$la = (_props$initialData6 = props.initialData) === null || _props$initialData6 === void 0 ? void 0 : _props$initialData6.layout.type) !== null && _props$initialData$la !== void 0 ? _props$initialData$la : 'native',
    'layout.casing': (_props$initialData$la2 = (_props$initialData7 = props.initialData) === null || _props$initialData7 === void 0 ? void 0 : _props$initialData7.layout.casing) !== null && _props$initialData$la2 !== void 0 ? _props$initialData$la2 : 'default'
  };
  const [data, setData] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(initialData);

  function isFormInvalid() {
    return !data.name || !data.url;
  }

  function formUnchanged() {
    return data === initialData;
  }

  function handleSubmit() {
    const validData = data;
    onSubmit({
      id: validData.id,
      name: validData.name,
      url: validData.url,
      'layout.type': validData['layout.type'],
      'layout.casing': validData['layout.casing'],
      username: validData.username,
      password: validData.password === undefined ? {
        'hidden-secret': true
      } : !validData.password ? undefined : validData.password
    });
  }

  function handleClearPassword() {
    setData({ ...data,
      password: ''
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(Header, {
      closeButton: true,
      children: initialData ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.tct)('Update [name] Repository', {
        name: sentry_data_debugFileSources__WEBPACK_IMPORTED_MODULE_8__.DEBUG_SOURCE_TYPES.http
      }) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.tct)('Add [name] Repository', {
        name: sentry_data_debugFileSources__WEBPACK_IMPORTED_MODULE_8__.DEBUG_SOURCE_TYPES.http
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(Body, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_5__["default"], {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Name'),
        inline: false,
        help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('A display name for this repository'),
        flexibleControlStateSize: true,
        stacked: true,
        required: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_input__WEBPACK_IMPORTED_MODULE_7__["default"], {
          type: "text",
          name: "name",
          placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('New Repository'),
          value: data.name,
          onChange: e => setData({ ...data,
            name: e.target.value
          })
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("hr", {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_5__["default"], {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Download Url'),
        inline: false,
        help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Full URL to the symbol server'),
        flexibleControlStateSize: true,
        stacked: true,
        required: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_input__WEBPACK_IMPORTED_MODULE_7__["default"], {
          type: "text",
          name: "url",
          placeholder: "https://msdl.microsoft.com/download/symbols/",
          value: data.url,
          onChange: e => setData({ ...data,
            url: e.target.value
          })
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_5__["default"], {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('User'),
        inline: false,
        help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('User for HTTP basic auth'),
        flexibleControlStateSize: true,
        stacked: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_input__WEBPACK_IMPORTED_MODULE_7__["default"], {
          type: "text",
          name: "username",
          placeholder: "admin",
          value: data.username,
          onChange: e => setData({ ...data,
            username: e.target.value
          })
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_5__["default"], {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Password'),
        inline: false,
        help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Password for HTTP basic auth'),
        flexibleControlStateSize: true,
        stacked: true,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(PasswordInput, {
          type: data.password === undefined ? 'text' : 'password',
          name: "url",
          placeholder: data.password === undefined ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('(Password unchanged)') : 'open-sesame',
          value: data.password,
          onChange: e => setData({ ...data,
            password: e.target.value
          })
        }), (data.password === undefined || typeof data.password === 'string' && !!data.password) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(ClearPasswordButton, {
          onClick: handleClearPassword,
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_icons_iconClose__WEBPACK_IMPORTED_MODULE_9__.IconClose, {
            size: "14px"
          }),
          size: "xs",
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Clear password'),
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Clear password'),
          borderless: true
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("hr", {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StyledSelectField, {
        name: "layout.type",
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Directory Layout'),
        help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('The layout of the folder structure.'),
        options: Object.keys(sentry_data_debugFileSources__WEBPACK_IMPORTED_MODULE_8__.DEBUG_SOURCE_LAYOUTS).map(key => ({
          value: key,
          label: sentry_data_debugFileSources__WEBPACK_IMPORTED_MODULE_8__.DEBUG_SOURCE_LAYOUTS[key]
        })),
        value: data['layout.type'],
        onChange: value => setData({ ...data,
          ['layout.type']: value
        }),
        inline: false,
        flexibleControlStateSize: true,
        stacked: true
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StyledSelectField, {
        name: "layout.casing",
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Path Casing'),
        help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('The case of files and folders.'),
        options: Object.keys(sentry_data_debugFileSources__WEBPACK_IMPORTED_MODULE_8__.DEBUG_SOURCE_CASINGS).map(key => ({
          value: key,
          label: sentry_data_debugFileSources__WEBPACK_IMPORTED_MODULE_8__.DEBUG_SOURCE_CASINGS[key]
        })),
        value: data['layout.casing'],
        onChange: value => setData({ ...data,
          ['layout.casing']: value
        }),
        inline: false,
        flexibleControlStateSize: true,
        stacked: true
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(Footer, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
        onClick: handleSubmit,
        priority: "primary",
        disabled: isFormInvalid() || formUnchanged(),
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Save changes')
      })
    })]
  });
}

Http.displayName = "Http";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Http);

const StyledSelectField = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e1hkzht82"
} : 0)( true ? {
  name: "jjyo93",
  styles: "padding-right:0"
} : 0);

const PasswordInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_input__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "e1hkzht81"
} : 0)("padding-right:", PASSWORD_INPUT_PADDING_RIGHT, "px;" + ( true ? "" : 0));

const ClearPasswordButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_actions_button__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e1hkzht80"
} : 0)("background:transparent;height:", CLEAR_PASSWORD_BUTTON_SIZE, "px;width:", CLEAR_PASSWORD_BUTTON_SIZE, "px;padding:0;position:absolute;top:50%;right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(0.75), ";transform:translateY(-50%);svg{color:", p => p.theme.gray400, ";:hover{color:hsl(0, 0%, 60%);}}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/modals/debugFileCustomRepository/index.tsx":
/*!*******************************************************************!*\
  !*** ./app/components/modals/debugFileCustomRepository/index.tsx ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "modalCss": () => (/* binding */ modalCss)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/acl/featureDisabled */ "./app/components/acl/featureDisabled.tsx");
/* harmony import */ var sentry_components_forms_fieldFromConfig__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/forms/fieldFromConfig */ "./app/components/forms/fieldFromConfig.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_hookOrDefault__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/hookOrDefault */ "./app/components/hookOrDefault.tsx");
/* harmony import */ var sentry_data_debugFileSources__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/data/debugFileSources */ "./app/data/debugFileSources.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/types/debugFiles */ "./app/types/debugFiles.tsx");
/* harmony import */ var _appStoreConnect__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./appStoreConnect */ "./app/components/modals/debugFileCustomRepository/appStoreConnect/index.tsx");
/* harmony import */ var _http__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./http */ "./app/components/modals/debugFileCustomRepository/http.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./utils */ "./app/components/modals/debugFileCustomRepository/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

 // eslint-disable-next-line no-restricted-imports
















const HookedAppStoreConnectMultiple = (0,sentry_components_hookOrDefault__WEBPACK_IMPORTED_MODULE_6__["default"])({
  hookName: 'component:disabled-app-store-connect-multiple',
  defaultComponent: _ref => {
    let {
      children
    } = _ref;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
      children: children
    });
  }
});
const HookedCustomSymbolSources = (0,sentry_components_hookOrDefault__WEBPACK_IMPORTED_MODULE_6__["default"])({
  hookName: 'component:disabled-custom-symbol-sources',
  defaultComponent: _ref2 => {
    let {
      children
    } = _ref2;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
      children: children
    });
  }
});

function DebugFileCustomRepository(_ref3) {
  let {
    Header,
    Body,
    Footer,
    CloseButton,
    onSave,
    sourceConfig,
    sourceType,
    params: {
      orgId,
      projectId: projectSlug
    },
    appStoreConnectStatusData,
    closeModal,
    organization,
    appStoreConnectSourcesQuantity
  } = _ref3;

  function handleSave(data) {
    if (!data) {
      closeModal();
      window.location.reload();
      return;
    }

    onSave({ ...(0,_utils__WEBPACK_IMPORTED_MODULE_12__.getFinalData)(sourceType, data),
      type: sourceType
    }).then(() => {
      closeModal();
    });
  }

  if (sourceType === sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_9__.CustomRepoType.APP_STORE_CONNECT) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_2__["default"], {
      organization: organization,
      features: ['app-store-connect-multiple'],
      children: _ref4 => {
        let {
          hasFeature,
          features
        } = _ref4;

        if (hasFeature || appStoreConnectSourcesQuantity === 1 && sourceConfig || appStoreConnectSourcesQuantity === 0) {
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(_appStoreConnect__WEBPACK_IMPORTED_MODULE_10__["default"], {
            Header: Header,
            Body: Body,
            Footer: Footer,
            orgSlug: orgId,
            projectSlug: projectSlug,
            onSubmit: handleSave,
            initialData: sourceConfig,
            appStoreConnectStatusData: appStoreConnectStatusData
          });
        }

        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(CloseButton, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(HookedAppStoreConnectMultiple, {
            organization: organization,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_3__["default"], {
              features: features,
              featureName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('App Store Connect Multiple'),
              hideHelpToggle: true
            })
          })]
        });
      }
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_2__["default"], {
    organization: organization,
    features: ['custom-symbol-sources'],
    children: _ref5 => {
      let {
        hasFeature,
        features
      } = _ref5;

      if (hasFeature) {
        if (sourceType === sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_9__.CustomRepoType.HTTP) {
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(_http__WEBPACK_IMPORTED_MODULE_11__["default"], {
            Header: Header,
            Body: Body,
            Footer: Footer,
            onSubmit: handleSave,
            initialData: sourceConfig
          });
        }

        const {
          initialData,
          fields
        } = (0,_utils__WEBPACK_IMPORTED_MODULE_12__.getFormFieldsAndInitialData)(sourceType, sourceConfig);
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(Header, {
            closeButton: true,
            children: sourceConfig ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('Update [name] Repository', {
              name: (0,sentry_data_debugFileSources__WEBPACK_IMPORTED_MODULE_7__.getDebugSourceName)(sourceType)
            }) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('Add [name] Repository', {
              name: (0,sentry_data_debugFileSources__WEBPACK_IMPORTED_MODULE_7__.getDebugSourceName)(sourceType)
            })
          }), fields && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_5__["default"], {
            allowUndo: true,
            requireChanges: true,
            initialData: initialData,
            onSubmit: handleSave,
            footerClass: "modal-footer",
            children: fields.map((field, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_forms_fieldFromConfig__WEBPACK_IMPORTED_MODULE_4__["default"], {
              field: field,
              inline: false,
              stacked: true
            }, field.name || i))
          })]
        });
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(CloseButton, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(HookedCustomSymbolSources, {
          organization: organization,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_3__["default"], {
            features: features,
            featureName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Custom Symbol Sources'),
            hideHelpToggle: true
          })
        })]
      });
    }
  });
}

DebugFileCustomRepository.displayName = "DebugFileCustomRepository";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_1__.withRouter)(DebugFileCustomRepository));
const modalCss =  true ? {
  name: "16o92yp",
  styles: "width:100%;max-width:680px"
} : 0;

/***/ }),

/***/ "./app/components/modals/debugFileCustomRepository/utils.tsx":
/*!*******************************************************************!*\
  !*** ./app/components/modals/debugFileCustomRepository/utils.tsx ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getFinalData": () => (/* binding */ getFinalData),
/* harmony export */   "getFormFieldsAndInitialData": () => (/* binding */ getFormFieldsAndInitialData)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_data_debugFileSources__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/data/debugFileSources */ "./app/data/debugFileSources.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/types/debugFiles */ "./app/types/debugFiles.tsx");
/* harmony import */ var sentry_utils_guid__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/guid */ "./app/utils/guid.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











function objectToChoices(obj) {
  return Object.entries(obj).map(_ref => {
    let [key, value] = _ref;
    return [key, (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)(value)];
  });
}

const commonFields = {
  id: {
    name: 'id',
    type: 'hidden',
    required: true,
    defaultValue: sentry_utils_guid__WEBPACK_IMPORTED_MODULE_6__.uniqueId
  },
  name: {
    name: 'name',
    type: 'string',
    required: true,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Name'),
    placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('New Repository'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('A display name for this repository')
  },
  // filters are explicitly not exposed to the UI
  layoutType: {
    name: 'layout.type',
    type: 'select',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Directory Layout'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('The layout of the folder structure.'),
    defaultValue: 'native',
    choices: objectToChoices(sentry_data_debugFileSources__WEBPACK_IMPORTED_MODULE_3__.DEBUG_SOURCE_LAYOUTS)
  },
  layoutCasing: {
    name: 'layout.casing',
    type: 'select',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Path Casing'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('The case of files and folders.'),
    defaultValue: 'default',
    choices: objectToChoices(sentry_data_debugFileSources__WEBPACK_IMPORTED_MODULE_3__.DEBUG_SOURCE_CASINGS)
  },
  prefix: {
    name: 'prefix',
    type: 'string',
    label: 'Root Path',
    placeholder: '/',
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('The path at which files are located within this repository.')
  },
  separator: {
    name: '',
    type: 'separator'
  }
};
function getFormFieldsAndInitialData(type, sourceConfig) {
  if (type === sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_5__.CustomRepoType.HTTP || type === sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_5__.CustomRepoType.APP_STORE_CONNECT) {
    return {};
  }

  const {
    secret_key,
    layout,
    private_key,
    ...config
  } = sourceConfig !== null && sourceConfig !== void 0 ? sourceConfig : {};
  const initialData = layout ? { ...config,
    'layout.casing': layout.casing,
    'layout.type': layout.type
  } : config;

  switch (type) {
    case 's3':
      return {
        fields: [commonFields.id, commonFields.name, commonFields.separator, {
          name: 'bucket',
          type: 'string',
          required: true,
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Bucket'),
          placeholder: 's3-bucket-name',
          help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Name of the S3 bucket. Read permissions are required to download symbols.')
        }, {
          name: 'region',
          type: 'select',
          required: true,
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Region'),
          help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('The AWS region and availability zone of the bucket.'),
          choices: sentry_data_debugFileSources__WEBPACK_IMPORTED_MODULE_3__.AWS_REGIONS.map(_ref2 => {
            let [k, v] = _ref2;
            return [k, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)("span", {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("code", {
                children: k
              }), " ", v]
            }, k)];
          })
        }, {
          name: 'access_key',
          type: 'string',
          required: true,
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Access Key ID'),
          placeholder: 'AKIAIOSFODNN7EXAMPLE',
          help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)('Access key to the AWS account. Credentials can be managed in the [link].', {
            link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_2__["default"], {
              href: "https://console.aws.amazon.com/iam/",
              children: "IAM console"
            })
          })
        }, {
          name: 'secret_key',
          type: 'string',
          required: true,
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Secret Access Key'),
          placeholder: typeof secret_key === 'object' ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('(Secret Access Key unchanged)') : 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
        }, commonFields.separator, commonFields.prefix, commonFields.layoutType, commonFields.layoutCasing],
        initialData: !initialData ? undefined : { ...initialData,
          secret_key: undefined
        }
      };

    case 'gcs':
      return {
        fields: [commonFields.id, commonFields.name, commonFields.separator, {
          name: 'bucket',
          type: 'string',
          required: true,
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Bucket'),
          placeholder: 'gcs-bucket-name',
          help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Name of the GCS bucket. Read permissions are required to download symbols.')
        }, {
          name: 'client_email',
          type: 'email',
          required: true,
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Client Email'),
          placeholder: 'user@project.iam.gserviceaccount.com',
          help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Email address of the GCS service account.')
        }, {
          name: 'private_key',
          type: 'string',
          required: true,
          multiline: true,
          autosize: true,
          maxRows: 5,
          rows: 3,
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Private Key'),
          placeholder: typeof private_key === 'object' ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('(Private Key unchanged)') : '-----BEGIN PRIVATE KEY-----\n[PRIVATE-KEY]\n-----END PRIVATE KEY-----',
          help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)('The service account key. Credentials can be managed on the [link].', {
            link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_2__["default"], {
              href: "https://console.cloud.google.com/project/_/iam-admin",
              children: "IAM & Admin Page"
            })
          })
        }, commonFields.separator, commonFields.prefix, commonFields.layoutType, commonFields.layoutCasing],
        initialData: !initialData ? undefined : { ...initialData,
          private_key: undefined
        }
      };

    default:
      {
        _sentry_react__WEBPACK_IMPORTED_MODULE_8__.captureException(new Error('Unknown custom repository type'));
        return {}; // this shall never happen
      }
  }
}
function getFinalData(type, data) {
  var _data$secret_key, _data$private_key;

  if (type === sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_5__.CustomRepoType.HTTP || type === sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_5__.CustomRepoType.APP_STORE_CONNECT) {
    return data;
  }

  switch (type) {
    case 's3':
      return { ...data,
        secret_key: (_data$secret_key = data.secret_key) !== null && _data$secret_key !== void 0 ? _data$secret_key : {
          'hidden-secret': true
        }
      };

    case 'gcs':
      return { ...data,
        private_key: (_data$private_key = data.private_key) !== null && _data$private_key !== void 0 ? _data$private_key : {
          'hidden-secret': true
        }
      };

    default:
      {
        _sentry_react__WEBPACK_IMPORTED_MODULE_8__.captureException(new Error('Unknown custom repository type'));
        return {}; // this shall never happen
      }
  }
}

/***/ }),

/***/ "./app/data/debugFileSources.tsx":
/*!***************************************!*\
  !*** ./app/data/debugFileSources.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AWS_REGIONS": () => (/* binding */ AWS_REGIONS),
/* harmony export */   "DEBUG_SOURCE_CASINGS": () => (/* binding */ DEBUG_SOURCE_CASINGS),
/* harmony export */   "DEBUG_SOURCE_LAYOUTS": () => (/* binding */ DEBUG_SOURCE_LAYOUTS),
/* harmony export */   "DEBUG_SOURCE_TYPES": () => (/* binding */ DEBUG_SOURCE_TYPES),
/* harmony export */   "getDebugSourceName": () => (/* binding */ getDebugSourceName)
/* harmony export */ });
const DEBUG_SOURCE_LAYOUTS = {
  native: 'Platform-Specific (SymStore / GDB / LLVM)',
  symstore: 'Microsoft SymStore',
  symstore_index2: 'Microsoft SymStore (with index2.txt)',
  ssqp: 'Microsoft SSQP',
  unified: 'Unified Symbol Server Layout',
  debuginfod: 'debuginfod'
};
const DEBUG_SOURCE_CASINGS = {
  default: 'Default (mixed case)',
  uppercase: 'Uppercase',
  lowercase: 'Lowercase'
};
const AWS_REGIONS = [['us-east-2', 'US East (Ohio)'], ['us-east-1', 'US East (N. Virginia)'], ['us-west-1', 'US West (N. California)'], ['us-west-2', 'US West (Oregon)'], ['ap-east-1', 'Asia Pacific (Hong Kong)'], ['ap-south-1', 'Asia Pacific (Mumbai)'], // ['ap-northeast-3', 'Asia Pacific (Osaka-Local)'],
['ap-northeast-2', 'Asia Pacific (Seoul)'], ['ap-southeast-1', 'Asia Pacific (Singapore)'], ['ap-southeast-2', 'Asia Pacific (Sydney)'], ['ap-northeast-1', 'Asia Pacific (Tokyo)'], ['ca-central-1', 'Canada (Central)'], ['cn-north-1', 'China (Beijing)'], ['cn-northwest-1', 'China (Ningxia)'], ['eu-central-1', 'EU (Frankfurt)'], ['eu-west-1', 'EU (Ireland)'], ['eu-west-2', 'EU (London)'], ['eu-west-3', 'EU (Paris)'], ['eu-north-1', 'EU (Stockholm)'], ['sa-east-1', 'South America (São Paulo)'], ['us-gov-east-1', 'AWS GovCloud (US-East)'], ['us-gov-west-1', 'AWS GovCloud (US)']];
const DEBUG_SOURCE_TYPES = {
  gcs: 'Google Cloud Storage',
  http: 'SymbolServer (HTTP)',
  s3: 'Amazon S3',
  appStoreConnect: 'App Store Connect'
};
function getDebugSourceName(type) {
  var _DEBUG_SOURCE_TYPES$t;

  return (_DEBUG_SOURCE_TYPES$t = DEBUG_SOURCE_TYPES[type]) !== null && _DEBUG_SOURCE_TYPES$t !== void 0 ? _DEBUG_SOURCE_TYPES$t : 'Unknown';
}

/***/ }),

/***/ "./app/types/debugFiles.tsx":
/*!**********************************!*\
  !*** ./app/types/debugFiles.tsx ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CustomRepoType": () => (/* binding */ CustomRepoType),
/* harmony export */   "DebugFileFeature": () => (/* binding */ DebugFileFeature),
/* harmony export */   "DebugFileType": () => (/* binding */ DebugFileType)
/* harmony export */ });
let DebugFileType;

(function (DebugFileType) {
  DebugFileType["EXE"] = "exe";
  DebugFileType["DBG"] = "dbg";
  DebugFileType["LIB"] = "lib";
})(DebugFileType || (DebugFileType = {}));

let DebugFileFeature;

(function (DebugFileFeature) {
  DebugFileFeature["SYMTAB"] = "symtab";
  DebugFileFeature["DEBUG"] = "debug";
  DebugFileFeature["UNWIND"] = "unwind";
  DebugFileFeature["SOURCES"] = "sources";
})(DebugFileFeature || (DebugFileFeature = {}));

// Custom Repository
let CustomRepoType;

(function (CustomRepoType) {
  CustomRepoType["HTTP"] = "http";
  CustomRepoType["S3"] = "s3";
  CustomRepoType["GCS"] = "gcs";
  CustomRepoType["APP_STORE_CONNECT"] = "appStoreConnect";
})(CustomRepoType || (CustomRepoType = {}));

/***/ }),

/***/ "./app/utils/appStoreValidationErrorMessage.tsx":
/*!******************************************************!*\
  !*** ./app/utils/appStoreValidationErrorMessage.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getAppStoreValidationErrorMessage": () => (/* binding */ getAppStoreValidationErrorMessage),
/* harmony export */   "unexpectedErrorMessage": () => (/* binding */ unexpectedErrorMessage)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





const unexpectedErrorMessage = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('An unexpected error occurred while configuring the App Store Connect integration');
function getAppStoreValidationErrorMessage(error, repo) {
  switch (error.code) {
    case 'app-connect-authentication-error':
      return repo ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.tct)('App Store Connect credentials are invalid or missing. [linkToCustomRepository]', {
        linkToCustomRepository: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_1__["default"], {
          to: repo.link,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.tct)("Make sure the credentials of the '[customRepositoryName]' repository are correct and exist.", {
            customRepositoryName: repo.name
          })
        })
      }) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('The supplied App Store Connect credentials are invalid or missing.');

    case 'app-connect-forbidden-error':
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('The supplied API key does not have sufficient permissions.');

    case 'app-connect-multiple-sources-error':
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Only one App Store Connect application is allowed in this project.');

    default:
      {
        // this shall not happen
        _sentry_react__WEBPACK_IMPORTED_MODULE_4__.captureException(new Error('Unknown app store connect error.'));
        return unexpectedErrorMessage;
      }
  }
}

/***/ }),

/***/ "./app/utils/selectText.tsx":
/*!**********************************!*\
  !*** ./app/utils/selectText.tsx ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "selectText": () => (/* binding */ selectText)
/* harmony export */ });
function selectText(node) {
  if (node instanceof HTMLInputElement && node.type === 'text') {
    node.select();
  } else if (node instanceof Node && window.getSelection) {
    const range = document.createRange();
    range.selectNode(node);
    const selection = window.getSelection();

    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
}

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

/***/ }),

/***/ "./app/utils/withApi.tsx":
/*!*******************************!*\
  !*** ./app/utils/withApi.tsx ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/getDisplayName */ "./app/utils/getDisplayName.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




/**
 * XXX: Prefer useApi if you are wrapping a Function Component!
 *
 * React Higher-Order Component (HoC) that provides "api" client when mounted,
 * and clears API requests when component is unmounted.
 *
 * If an `api` prop is provided when the component is invoked it will be passed
 * through.
 */
const withApi = function (WrappedComponent) {
  let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  const WithApi = _ref => {
    let {
      api: propsApi,
      ...props
    } = _ref;
    const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_1__["default"])({
      api: propsApi,
      ...options
    });
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(WrappedComponent, { ...props,
      api: api
    });
  };

  WithApi.displayName = `withApi(${(0,sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_0__["default"])(WrappedComponent)})`;
  return WithApi;
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (withApi);

/***/ }),

/***/ "./app/utils/withConfig.tsx":
/*!**********************************!*\
  !*** ./app/utils/withConfig.tsx ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/stores/useLegacyStore */ "./app/stores/useLegacyStore.tsx");
/* harmony import */ var sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/getDisplayName */ "./app/utils/getDisplayName.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





/**
 * Higher order component that passes the config object to the wrapped
 * component
 */
function withConfig(WrappedComponent) {
  const Wrapper = props => {
    const config = (0,sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_1__.useLegacyStore)(sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_0__["default"]);
    const allProps = {
      config,
      ...props
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(WrappedComponent, { ...allProps
    });
  };

  Wrapper.displayName = `withConfig(${(0,sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_2__["default"])(WrappedComponent)})`;
  return Wrapper;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (withConfig);

/***/ }),

/***/ "./app/utils/withProject.tsx":
/*!***********************************!*\
  !*** ./app/utils/withProject.tsx ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_sentryTypes__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/sentryTypes */ "./app/sentryTypes.tsx");
/* harmony import */ var sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/getDisplayName */ "./app/utils/getDisplayName.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






/**
 * Currently wraps component with project from context
 */
const withProject = WrappedComponent => {
  var _class;

  return _class = class extends react__WEBPACK_IMPORTED_MODULE_1__.Component {
    render() {
      const {
        project,
        ...props
      } = this.props;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(WrappedComponent, {
        project: project !== null && project !== void 0 ? project : this.context.project,
        ...props
      });
    }

  }, (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(_class, "displayName", `withProject(${(0,sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_3__["default"])(WrappedComponent)})`), (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(_class, "contextTypes", {
    project: sentry_sentryTypes__WEBPACK_IMPORTED_MODULE_2__["default"].Project
  }), _class;
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (withProject);

/***/ }),

/***/ "../node_modules/copy-text-to-clipboard/index.js":
/*!*******************************************************!*\
  !*** ../node_modules/copy-text-to-clipboard/index.js ***!
  \*******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ copyTextToClipboard)
/* harmony export */ });
function copyTextToClipboard(input, {target = document.body} = {}) {
	const element = document.createElement('textarea');
	const previouslyFocusedElement = document.activeElement;

	element.value = input;

	// Prevent keyboard from showing on mobile
	element.setAttribute('readonly', '');

	element.style.contain = 'strict';
	element.style.position = 'absolute';
	element.style.left = '-9999px';
	element.style.fontSize = '12pt'; // Prevent zooming on iOS

	const selection = document.getSelection();
	let originalRange = false;
	if (selection.rangeCount > 0) {
		originalRange = selection.getRangeAt(0);
	}

	target.append(element);
	element.select();

	// Explicit selection workaround for iOS
	element.selectionStart = 0;
	element.selectionEnd = input.length;

	let isSuccess = false;
	try {
		isSuccess = document.execCommand('copy');
	} catch {}

	element.remove();

	if (originalRange) {
		selection.removeAllRanges();
		selection.addRange(originalRange);
	}

	// Get the focus back on the previously focused element, if any
	if (previouslyFocusedElement) {
		previouslyFocusedElement.focus();
	}

	return isSuccess;
}


/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_clipboard_tsx-app_components_modals_debugFileCustomRepository_index_tsx-app_ut-906119.177c58bb0e308934c88efa7af9be37d1.js.map