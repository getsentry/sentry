(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_integrationPipeline_init_tsx"],{

/***/ "./app/bootstrap/initializePipelineView.tsx":
/*!**************************************************!*\
  !*** ./app/bootstrap/initializePipelineView.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "initializePipelineView": () => (/* binding */ initializePipelineView)
/* harmony export */ });
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var _commonInitialization__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./commonInitialization */ "./app/bootstrap/commonInitialization.tsx");
/* harmony import */ var _initializeSdk__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./initializeSdk */ "./app/bootstrap/initializeSdk.tsx");
/* harmony import */ var _renderOnDomReady__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./renderOnDomReady */ "./app/bootstrap/renderOnDomReady.tsx");
/* harmony import */ var _renderPipelineView__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./renderPipelineView */ "./app/bootstrap/renderPipelineView.tsx");





function initializePipelineView(config) {
  (0,_commonInitialization__WEBPACK_IMPORTED_MODULE_1__.commonInitialization)(config);
  /**
   * XXX: Note we do not include routingInstrumentation because importing
   * `app/routes` significantly increases bundle size.
   *
   * A potential solution would be to use dynamic imports here to import
   * `app/routes` to pass to `initializeSdk()`
   */

  (0,_initializeSdk__WEBPACK_IMPORTED_MODULE_2__.initializeSdk)(config); // Used for operational metrics to determine that the application js
  // bundle was loaded by browser.

  sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_0__.metric.mark({
    name: 'sentry-pipeline-init'
  });
  (0,_renderOnDomReady__WEBPACK_IMPORTED_MODULE_3__.renderOnDomReady)(_renderPipelineView__WEBPACK_IMPORTED_MODULE_4__.renderPipelineView);
}

/***/ }),

/***/ "./app/bootstrap/renderPipelineView.tsx":
/*!**********************************************!*\
  !*** ./app/bootstrap/renderPipelineView.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "renderPipelineView": () => (/* binding */ renderPipelineView)
/* harmony export */ });
/* harmony import */ var react_dom__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react-dom */ "../node_modules/react-dom/profiling.js");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_views_integrationPipeline_pipelineView__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/views/integrationPipeline/pipelineView */ "./app/views/integrationPipeline/pipelineView.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function renderDom(pipelineName, props) {
  const rootEl = document.getElementById(sentry_constants__WEBPACK_IMPORTED_MODULE_1__.ROOT_ELEMENT);
  (0,react_dom__WEBPACK_IMPORTED_MODULE_0__.render)((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_views_integrationPipeline_pipelineView__WEBPACK_IMPORTED_MODULE_2__["default"], {
    pipelineName: pipelineName,
    ...props
  }), rootEl);
}

function renderPipelineView() {
  const {
    name,
    props
  } = window.__pipelineInitialData;
  renderDom(name, props);
}

/***/ }),

/***/ "./app/views/integrationPipeline/awsLambdaCloudformation.tsx":
/*!*******************************************************************!*\
  !*** ./app/views/integrationPipeline/awsLambdaCloudformation.tsx ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AwsLambdaCloudformation)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_actions_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/actions/button */ "./app/components/actions/button.tsx");
/* harmony import */ var sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/forms/selectField */ "./app/components/forms/selectField.tsx");
/* harmony import */ var sentry_components_forms_textField__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/forms/textField */ "./app/components/forms/textField.tsx");
/* harmony import */ var sentry_components_list__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/list */ "./app/components/list/index.tsx");
/* harmony import */ var sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/list/listItem */ "./app/components/list/listItem.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_guid__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/guid */ "./app/utils/guid.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var _components_footerWithButtons__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./components/footerWithButtons */ "./app/views/integrationPipeline/components/footerWithButtons.tsx");
/* harmony import */ var _components_headerWithHelp__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ./components/headerWithHelp */ "./app/views/integrationPipeline/components/headerWithHelp.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }














 // let the browser generate and store the external ID
// this way the same user always has the same external ID if they restart the pipeline



const ID_NAME = 'AWS_EXTERNAL_ID';

const getAwsExternalId = () => {
  let awsExternalId = window.localStorage.getItem(ID_NAME);

  if (!awsExternalId) {
    awsExternalId = (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_13__.uniqueId)();
    window.localStorage.setItem(ID_NAME, awsExternalId);
  }

  return awsExternalId;
};

const accountNumberRegex = /^\d{12}$/;

const testAccountNumber = arn => accountNumberRegex.test(arn);

class AwsLambdaCloudformation extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    var _this$props$awsExtern;

    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      accountNumber: this.props.accountNumber,
      region: this.props.region,
      awsExternalId: (_this$props$awsExtern = this.props.awsExternalId) !== null && _this$props$awsExtern !== void 0 ? _this$props$awsExtern : getAwsExternalId(),
      showInputs: !!this.props.awsExternalId
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmit", e => {
      this.setState({
        submitting: true
      });
      e.preventDefault(); // use the external ID from the form on on the submission

      const {
        accountNumber,
        region,
        awsExternalId
      } = this.state;
      const data = {
        accountNumber,
        region,
        awsExternalId
      };
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Submitting\u2026'));
      const {
        location: {
          origin
        }
      } = window; // redirect to the extensions endpoint with the form fields as query params
      // this is needed so we don't restart the pipeline loading from the original
      // OrganizationIntegrationSetupView route

      const newUrl = `${origin}/extensions/aws_lambda/setup/?${query_string__WEBPACK_IMPORTED_MODULE_5__.stringify(data)}`;
      window.location.assign(newUrl);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "validateAccountNumber", value => {
      // validate the account number
      let accountNumberError = '';

      if (!value) {
        accountNumberError = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Account number required');
      } else if (!testAccountNumber(value)) {
        accountNumberError = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Invalid account number');
      }

      this.setState({
        accountNumberError
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeArn", accountNumber => {
      this.debouncedTrackValueChanged('accountNumber'); // reset the error if we ever get a valid account number

      if (testAccountNumber(accountNumber)) {
        this.setState({
          accountNumberError: ''
        });
      }

      this.setState({
        accountNumber
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeRegion", region => {
      this.debouncedTrackValueChanged('region');
      this.setState({
        region
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeExternalId", awsExternalId => {
      this.debouncedTrackValueChanged('awsExternalId');
      awsExternalId = awsExternalId.trim();
      this.setState({
        awsExternalId
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeShowInputs", () => {
      this.setState({
        showInputs: true
      });
      (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_14__.trackIntegrationAnalytics)('integrations.installation_input_value_changed', {
        integration: 'aws_lambda',
        integration_type: 'first_party',
        field_name: 'showInputs',
        organization: this.props.organization
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "debouncedTrackValueChanged", lodash_debounce__WEBPACK_IMPORTED_MODULE_4___default()(fieldName => {
      (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_14__.trackIntegrationAnalytics)('integrations.installation_input_value_changed', {
        integration: 'aws_lambda',
        integration_type: 'first_party',
        field_name: fieldName,
        organization: this.props.organization
      });
    }, 200));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "trackOpenCloudFormation", () => {
      (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_14__.trackIntegrationAnalytics)('integrations.cloudformation_link_clicked', {
        integration: 'aws_lambda',
        integration_type: 'first_party',
        organization: this.props.organization
      });
    });
  }

  componentDidMount() {
    // show the error if we have it
    const {
      error
    } = this.props;

    if (error) {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addErrorMessage)(error, {
        duration: 10000
      });
    }
  }

  get initialData() {
    const {
      region,
      accountNumber
    } = this.props;
    const {
      awsExternalId
    } = this.state;
    return {
      awsExternalId,
      region,
      accountNumber
    };
  }

  get cloudformationUrl() {
    // generate the cloudformation URL using the params we get from the server
    // and the external id we generate
    const {
      baseCloudformationUrl,
      templateUrl,
      stackName
    } = this.props; // always us the generated AWS External ID in local storage

    const awsExternalId = getAwsExternalId();
    const query = query_string__WEBPACK_IMPORTED_MODULE_5__.stringify({
      templateURL: templateUrl,
      stackName,
      param_ExternalId: awsExternalId
    });
    return `${baseCloudformationUrl}?${query}`;
  }

  get regionOptions() {
    return this.props.regionList.map(region => ({
      value: region,
      label: region
    }));
  }

  get formValid() {
    const {
      accountNumber,
      region,
      awsExternalId
    } = this.state;
    return !!region && testAccountNumber(accountNumber || '') && !!awsExternalId;
  } // debounce so we don't send a request on every input change


  render() {
    const {
      initialStepNumber
    } = this.props;
    const {
      accountNumber,
      region,
      accountNumberError,
      submitting,
      awsExternalId,
      showInputs
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(_components_headerWithHelp__WEBPACK_IMPORTED_MODULE_16__["default"], {
        docsUrl: "https://docs.sentry.io/product/integrations/cloud-monitoring/aws-lambda/"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(StyledList, {
        symbol: "colored-numeric",
        initialCounterValue: initialStepNumber,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_11__["default"], {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("h3", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)("Add Sentry's CloudFormation")
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(StyledButton, {
            priority: "primary",
            onClick: this.trackOpenCloudFormation,
            external: true,
            href: this.cloudformationUrl,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Go to AWS')
          }), !showInputs && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("p", {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)("Once you've created Sentry's CloudFormation stack (or if you already have one) press the button below to continue.")
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_actions_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
              name: "showInputs",
              onClick: this.handleChangeShowInputs,
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)("I've created the stack")
            })]
          })]
        }), showInputs ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_11__["default"], {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("h3", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Add AWS Account Information')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_forms_textField__WEBPACK_IMPORTED_MODULE_9__["default"], {
            name: "accountNumber",
            value: accountNumber,
            onChange: this.handleChangeArn,
            onBlur: this.validateAccountNumber,
            error: accountNumberError,
            inline: false,
            stacked: true,
            label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('AWS Account Number'),
            showHelpInTooltip: true,
            help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Your account number can be found on the right side of the header in AWS')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_8__["default"], {
            name: "region",
            value: region,
            onChange: this.handleChangeRegion,
            options: this.regionOptions,
            allowClear: false,
            inline: false,
            stacked: true,
            label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('AWS Region'),
            showHelpInTooltip: true,
            help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Your current region can be found on the right side of the header in AWS')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_forms_textField__WEBPACK_IMPORTED_MODULE_9__["default"], {
            name: "awsExternalId",
            value: awsExternalId,
            onChange: this.handleChangeExternalId,
            inline: false,
            stacked: true,
            error: awsExternalId ? '' : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('External ID Required'),
            label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('External ID'),
            showHelpInTooltip: true,
            help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Do not edit unless you are copying from a previously created CloudFormation stack')
          })]
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {})]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(_components_footerWithButtons__WEBPACK_IMPORTED_MODULE_15__["default"], {
        buttonText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Next'),
        onClick: this.handleSubmit,
        disabled: submitting || !this.formValid
      })]
    });
  }

}
AwsLambdaCloudformation.displayName = "AwsLambdaCloudformation";

const StyledList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_list__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "e7umpth1"
} : 0)( true ? {
  name: "1c03puw",
  styles: "padding:100px 50px 50px 50px"
} : 0);

const StyledButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_actions_button__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "e7umpth0"
} : 0)( true ? {
  name: "1azpx8r",
  styles: "margin-bottom:20px"
} : 0);

/***/ }),

/***/ "./app/views/integrationPipeline/awsLambdaFailureDetails.tsx":
/*!*******************************************************************!*\
  !*** ./app/views/integrationPipeline/awsLambdaFailureDetails.tsx ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AwsLambdaFailureDetails)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _components_footerWithButtons__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./components/footerWithButtons */ "./app/views/integrationPipeline/components/footerWithButtons.tsx");
/* harmony import */ var _components_headerWithHelp__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./components/headerWithHelp */ "./app/views/integrationPipeline/components/headerWithHelp.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }










function AwsLambdaFailureDetails(_ref) {
  let {
    lambdaFunctionFailures,
    successCount
  } = _ref;
  const baseDocsUrl = 'https://docs.sentry.io/product/integrations/cloud-monitoring/aws-lambda/';
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_components_headerWithHelp__WEBPACK_IMPORTED_MODULE_7__["default"], {
      docsUrl: baseDocsUrl
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(Wrapper, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)("div", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(StyledCheckmark, {
          isCircled: true,
          color: "green300"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("h3", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.tn)('successfully updated %s function', 'successfully updated %s functions', successCount)
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)("div", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(StyledWarning, {
          color: "red300"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("h3", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.tn)('Failed to update %s function', 'Failed to update %s functions', lambdaFunctionFailures.length)
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(Troubleshooting, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.tct)('See [link:Troubleshooting Docs]', {
            link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_2__["default"], {
              href: baseDocsUrl + '#troubleshooting'
            })
          })
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(StyledPanel, {
        children: lambdaFunctionFailures.map(SingleFailure)
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_components_footerWithButtons__WEBPACK_IMPORTED_MODULE_6__["default"], {
      buttonText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Finish Setup'),
      href: "?finish_pipeline=1"
    })]
  });
}
AwsLambdaFailureDetails.displayName = "AwsLambdaFailureDetails";

function SingleFailure(errorDetail) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(StyledRow, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("span", {
      children: errorDetail.name
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(Error, {
      children: errorDetail.error
    })]
  }, errorDetail.name);
}

SingleFailure.displayName = "SingleFailure";

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eznnfu6"
} : 0)( true ? {
  name: "1c03puw",
  styles: "padding:100px 50px 50px 50px"
} : 0);

const StyledRow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.PanelItem,  true ? {
  target: "eznnfu5"
} : 0)( true ? {
  name: "1fttcpj",
  styles: "display:flex;flex-direction:column"
} : 0);

const Error = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "eznnfu4"
} : 0)("color:", p => p.theme.subText, ";" + ( true ? "" : 0));

const StyledPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.Panel,  true ? {
  target: "eznnfu3"
} : 0)( true ? {
  name: "9kyydt",
  styles: "overflow:hidden;margin-left:34px"
} : 0);

const Troubleshooting = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('p',  true ? {
  target: "eznnfu2"
} : 0)( true ? {
  name: "3t0r87",
  styles: "margin-left:34px"
} : 0);

const StyledCheckmark = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_4__.IconCheckmark,  true ? {
  target: "eznnfu1"
} : 0)( true ? {
  name: "1j8vesr",
  styles: "float:left;margin-right:10px;height:24px;width:24px"
} : 0);

const StyledWarning = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_4__.IconWarning,  true ? {
  target: "eznnfu0"
} : 0)( true ? {
  name: "1j8vesr",
  styles: "float:left;margin-right:10px;height:24px;width:24px"
} : 0);

/***/ }),

/***/ "./app/views/integrationPipeline/awsLambdaFunctionSelect.tsx":
/*!*******************************************************************!*\
  !*** ./app/views/integrationPipeline/awsLambdaFunctionSelect.tsx ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AwsLambdaFunctionSelect)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_reduce__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/reduce */ "../node_modules/lodash/reduce.js");
/* harmony import */ var lodash_reduce__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_reduce__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var mobx__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! mobx */ "../node_modules/mobx/dist/mobx.esm.js");
/* harmony import */ var mobx_react__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! mobx-react */ "../node_modules/mobx-react-lite/es/index.js");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/jsonForm */ "./app/components/forms/jsonForm.tsx");
/* harmony import */ var sentry_components_forms_model__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/forms/model */ "./app/components/forms/model.tsx");
/* harmony import */ var sentry_components_list__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/list */ "./app/components/list/index.tsx");
/* harmony import */ var sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/list/listItem */ "./app/components/list/listItem.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_switchButton__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/switchButton */ "./app/components/switchButton.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _components_footerWithButtons__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./components/footerWithButtons */ "./app/views/integrationPipeline/components/footerWithButtons.tsx");
/* harmony import */ var _components_headerWithHelp__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ./components/headerWithHelp */ "./app/views/integrationPipeline/components/headerWithHelp.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }



















const LAMBDA_COUNT_THRESHOLD = 10;

const getLabel = func => func.FunctionName;

class AwsLambdaFunctionSelect extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor(props) {
    super(props);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      submitting: false
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "model", new sentry_components_forms_model__WEBPACK_IMPORTED_MODULE_7__["default"]());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmit", () => {
      this.setState({
        submitting: true
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleToggle", () => {
      const newState = !this.allStatesToggled;
      this.lambdaFunctions.forEach(lambda => {
        this.model.setValue(lambda.FunctionName, newState, {
          quiet: true
        });
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderWhatWeFound", () => {
      const count = this.lambdaFunctions.length;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("h4", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.tn)('We found %s function with a Node or Python runtime', 'We found %s functions with Node or Python runtimes', count)
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderLoadingScreen", () => {
      const count = this.enabledCount;
      const text = count > LAMBDA_COUNT_THRESHOLD ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('This might take a while\u2026', count) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('This might take a sec\u2026');
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(LoadingWrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(StyledLoadingIndicator, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("h4", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Adding Sentry to %s functions', count)
        }), text]
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderCore", () => {
      const {
        initialStepNumber
      } = this.props;

      const FormHeader = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(StyledPanelHeader, {
        children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Lambda Functions'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(SwitchHolder, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(mobx_react__WEBPACK_IMPORTED_MODULE_18__.Observer, {
            children: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_13__["default"], {
              title: this.allStatesToggled ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Disable All') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Enable All'),
              position: "left",
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(StyledSwitch, {
                size: "lg",
                name: "toggleAll",
                toggle: this.handleToggle,
                isActive: this.allStatesToggled
              })
            })
          })
        })]
      });

      const formFields = {
        fields: this.lambdaFunctions.map(func => ({
          name: func.FunctionName,
          type: 'boolean',
          required: false,
          label: getLabel(func),
          alignRight: true
        }))
      };
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(sentry_components_list__WEBPACK_IMPORTED_MODULE_8__["default"], {
        symbol: "colored-numeric",
        initialCounterValue: initialStepNumber,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_9__["default"], {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(Header, {
            children: this.renderWhatWeFound()
          }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Decide which functions you would like to enable for Sentry monitoring'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(StyledForm, {
            initialData: this.initialData,
            model: this.model,
            apiEndpoint: "/extensions/aws_lambda/setup/",
            hideFooter: true,
            preventFormResetOnUnmount: true,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_6__["default"], {
              renderHeader: () => FormHeader,
              forms: [formFields]
            })
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {})]
      });
    });

    (0,mobx__WEBPACK_IMPORTED_MODULE_19__.makeObservable)(this, {
      allStatesToggled: mobx__WEBPACK_IMPORTED_MODULE_19__.computed
    });
  }

  get initialData() {
    const {
      lambdaFunctions
    } = this.props;
    const initialData = lambdaFunctions.reduce((accum, func) => {
      accum[func.FunctionName] = true;
      return accum;
    }, {});
    return initialData;
  }

  get lambdaFunctions() {
    return this.props.lambdaFunctions.sort((a, b) => getLabel(a).toLowerCase() < getLabel(b).toLowerCase() ? -1 : 1);
  }

  get enabledCount() {
    const data = this.model.getTransformedData();
    return lodash_reduce__WEBPACK_IMPORTED_MODULE_4___default()(data, (acc, val) => val ? acc + 1 : acc, 0);
  }

  get allStatesToggled() {
    // check if any of the lambda functions have a falsy value
    // no falsy values means everything is enabled
    return Object.values(this.model.getData()).every(val => val);
  }

  get formFields() {
    const data = this.model.getTransformedData();
    return Object.entries(data).map(_ref => {
      let [name, value] = _ref;
      return {
        name,
        value
      };
    });
  }

  render() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(_components_headerWithHelp__WEBPACK_IMPORTED_MODULE_16__["default"], {
        docsUrl: "https://docs.sentry.io/product/integrations/cloud-monitoring/aws-lambda/"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(Wrapper, {
        children: this.state.submitting ? this.renderLoadingScreen() : this.renderCore()
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(mobx_react__WEBPACK_IMPORTED_MODULE_18__.Observer, {
        children: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(_components_footerWithButtons__WEBPACK_IMPORTED_MODULE_15__["default"], {
          formProps: {
            action: '/extensions/aws_lambda/setup/',
            method: 'post',
            onSubmit: this.handleSubmit
          },
          formFields: this.formFields,
          buttonText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Finish Setup'),
          disabled: this.model.isError || this.model.isSaving || this.state.submitting
        })
      })]
    });
  }

}
AwsLambdaFunctionSelect.displayName = "AwsLambdaFunctionSelect";

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ev289l87"
} : 0)( true ? {
  name: "1c03puw",
  styles: "padding:100px 50px 50px 50px"
} : 0); // TODO(ts): Understand why styled is not correctly inheriting props here


const StyledForm = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "ev289l86"
} : 0)( true ? {
  name: "1r0yqr6",
  styles: "margin-top:10px"
} : 0);

const Header = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ev289l85"
} : 0)( true ? {
  name: "ksvlj4",
  styles: "text-align:left;margin-bottom:10px"
} : 0);

const LoadingWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ev289l84"
} : 0)( true ? {
  name: "c2fqel",
  styles: "padding:50px;text-align:center"
} : 0);

const StyledLoadingIndicator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "ev289l83"
} : 0)( true ? {
  name: "ti75j2",
  styles: "margin:0"
} : 0);

const SwitchHolder = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ev289l82"
} : 0)( true ? {
  name: "zjik7",
  styles: "display:flex"
} : 0);

const StyledSwitch = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_switchButton__WEBPACK_IMPORTED_MODULE_12__["default"],  true ? {
  target: "ev289l81"
} : 0)( true ? {
  name: "y1f223",
  styles: "margin:auto"
} : 0); // padding is based on fom control width


const StyledPanelHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__.PanelHeader,  true ? {
  target: "ev289l80"
} : 0)( true ? {
  name: "g73iny",
  styles: "padding-right:36px"
} : 0);

/***/ }),

/***/ "./app/views/integrationPipeline/awsLambdaProjectSelect.tsx":
/*!******************************************************************!*\
  !*** ./app/views/integrationPipeline/awsLambdaProjectSelect.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AwsLambdaProjectSelect)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var mobx_react__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! mobx-react */ "../node_modules/mobx-react-lite/es/index.js");
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_model__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/forms/model */ "./app/components/forms/model.tsx");
/* harmony import */ var sentry_components_forms_sentryProjectSelectorField__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/forms/sentryProjectSelectorField */ "./app/components/forms/sentryProjectSelectorField.tsx");
/* harmony import */ var sentry_components_list__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/list */ "./app/components/list/index.tsx");
/* harmony import */ var sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/list/listItem */ "./app/components/list/listItem.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _components_footerWithButtons__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./components/footerWithButtons */ "./app/views/integrationPipeline/components/footerWithButtons.tsx");
/* harmony import */ var _components_headerWithHelp__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./components/headerWithHelp */ "./app/views/integrationPipeline/components/headerWithHelp.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

















class AwsLambdaProjectSelect extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "model", new sentry_components_forms_model__WEBPACK_IMPORTED_MODULE_8__["default"]());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmit", e => {
      e.preventDefault();
      const data = this.model.getData();
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Submitting\u2026'));
      this.model.setFormSaving();
      const {
        location: {
          origin
        }
      } = window; // redirect to the extensions endpoint with the form fields as query params
      // this is needed so we don't restart the pipeline loading from the original
      // OrganizationIntegrationSetupView route

      const newUrl = `${origin}/extensions/aws_lambda/setup/?${query_string__WEBPACK_IMPORTED_MODULE_4__.stringify(data)}`;
      window.location.assign(newUrl);
    });
  }

  render() {
    const {
      projects
    } = this.props; // TODO: Add logic if no projects

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_components_headerWithHelp__WEBPACK_IMPORTED_MODULE_15__["default"], {
        docsUrl: "https://docs.sentry.io/product/integrations/cloud-monitoring/aws-lambda/"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(StyledList, {
        symbol: "colored-numeric",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_11__["default"], {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("h3", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Select a project for your AWS Lambdas')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_7__["default"], {
            model: this.model,
            hideFooter: true,
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledSentryProjectSelectorField, {
              placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Select a project'),
              name: "projectId",
              projects: projects,
              inline: false,
              hasControlState: true,
              flexibleControlStateSize: true,
              stacked: true
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_6__["default"], {
              type: "info",
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Currently only supports Node and Python Lambda functions')
            })]
          })]
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(mobx_react__WEBPACK_IMPORTED_MODULE_17__.Observer, {
        children: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_components_footerWithButtons__WEBPACK_IMPORTED_MODULE_14__["default"], {
          buttonText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Next'),
          onClick: this.handleSubmit,
          disabled: this.model.isSaving || !this.model.getValue('projectId')
        })
      })]
    });
  }

}
AwsLambdaProjectSelect.displayName = "AwsLambdaProjectSelect";

const StyledList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_list__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "e1096xdh1"
} : 0)( true ? {
  name: "1c03puw",
  styles: "padding:100px 50px 50px 50px"
} : 0);

const StyledSentryProjectSelectorField = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_forms_sentryProjectSelectorField__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "e1096xdh0"
} : 0)("padding:0 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(2), " 0;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/integrationPipeline/components/footerWithButtons.tsx":
/*!************************************************************************!*\
  !*** ./app/views/integrationPipeline/components/footerWithButtons.tsx ***!
  \************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ FooterWithButtons)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_actions_button__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/actions/button */ "./app/components/actions/button.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function FooterWithButtons(_ref) {
  let {
    buttonText,
    formFields,
    formProps,
    ...rest
  } = _ref;

  /**
   * We use a form post here to replicate what we do with standard HTML views for the integration pipeline.
   * Since this is a form post, we need to pass a hidden replica of the form inputs
   * so we can submit this form instead of the one collecting the user inputs.
   */
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(Footer, {
    "data-test-id": "aws-lambda-footer-form",
    ...formProps,
    children: [formFields === null || formFields === void 0 ? void 0 : formFields.map(field => {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("input", {
        type: "hidden",
        ...field
      }, field.name);
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_actions_button__WEBPACK_IMPORTED_MODULE_1__["default"], {
      priority: "primary",
      type: "submit",
      size: "xs",
      ...rest,
      children: buttonText
    })]
  });
}
FooterWithButtons.displayName = "FooterWithButtons";

// wrap in form so we can keep form submission behavior
const Footer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('form',  true ? {
  target: "etkjulb0"
} : 0)("width:100%;position:fixed;display:flex;justify-content:flex-end;bottom:0;z-index:100;background-color:", p => p.theme.bodyBackground, ";border-top:1px solid ", p => p.theme.innerBorder, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(2), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/integrationPipeline/components/headerWithHelp.tsx":
/*!*********************************************************************!*\
  !*** ./app/views/integrationPipeline/components/headerWithHelp.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ HeaderWithHelp)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_actions_button__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/actions/button */ "./app/components/actions/button.tsx");
/* harmony import */ var sentry_components_logoSentry__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/logoSentry */ "./app/components/logoSentry.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







function HeaderWithHelp(_ref) {
  let {
    docsUrl
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(Header, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(StyledLogoSentry, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_actions_button__WEBPACK_IMPORTED_MODULE_1__["default"], {
      external: true,
      href: docsUrl,
      size: "xs",
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Need Help?')
    })]
  });
}
HeaderWithHelp.displayName = "HeaderWithHelp";

const Header = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1fculpd1"
} : 0)("width:100%;position:fixed;display:flex;justify-content:space-between;top:0;z-index:100;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(2), ";background:", p => p.theme.background, ";border-bottom:1px solid ", p => p.theme.innerBorder, ";" + ( true ? "" : 0));

const StyledLogoSentry = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_logoSentry__WEBPACK_IMPORTED_MODULE_2__["default"],  true ? {
  target: "e1fculpd0"
} : 0)("width:130px;height:30px;color:", p => p.theme.textColor, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/integrationPipeline/init.tsx":
/*!************************************************!*\
  !*** ./app/views/integrationPipeline/init.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "init": () => (/* binding */ init)
/* harmony export */ });
/* harmony import */ var focus_visible__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! focus-visible */ "../node_modules/focus-visible/dist/focus-visible.js");
/* harmony import */ var focus_visible__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(focus_visible__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_bootstrap_initializePipelineView__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/bootstrap/initializePipelineView */ "./app/bootstrap/initializePipelineView.tsx");


function init() {
  (0,sentry_bootstrap_initializePipelineView__WEBPACK_IMPORTED_MODULE_1__.initializePipelineView)(window.__initialData);
}

/***/ }),

/***/ "./app/views/integrationPipeline/pipelineView.tsx":
/*!********************************************************!*\
  !*** ./app/views/integrationPipeline/pipelineView.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_indicators__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/indicators */ "./app/components/indicators.tsx");
/* harmony import */ var sentry_components_themeAndStyleProvider__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/themeAndStyleProvider */ "./app/components/themeAndStyleProvider.tsx");
/* harmony import */ var _awsLambdaCloudformation__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./awsLambdaCloudformation */ "./app/views/integrationPipeline/awsLambdaCloudformation.tsx");
/* harmony import */ var _awsLambdaFailureDetails__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./awsLambdaFailureDetails */ "./app/views/integrationPipeline/awsLambdaFailureDetails.tsx");
/* harmony import */ var _awsLambdaFunctionSelect__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./awsLambdaFunctionSelect */ "./app/views/integrationPipeline/awsLambdaFunctionSelect.tsx");
/* harmony import */ var _awsLambdaProjectSelect__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./awsLambdaProjectSelect */ "./app/views/integrationPipeline/awsLambdaProjectSelect.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











const pipelineMapper = {
  awsLambdaProjectSelect: [_awsLambdaProjectSelect__WEBPACK_IMPORTED_MODULE_8__["default"], 'AWS Lambda Select Project'],
  awsLambdaFunctionSelect: [_awsLambdaFunctionSelect__WEBPACK_IMPORTED_MODULE_7__["default"], 'AWS Lambda Select Lambdas'],
  awsLambdaCloudformation: [_awsLambdaCloudformation__WEBPACK_IMPORTED_MODULE_5__["default"], 'AWS Lambda Create Cloudformation'],
  awsLambdaFailureDetails: [_awsLambdaFailureDetails__WEBPACK_IMPORTED_MODULE_6__["default"], 'AWS Lambda View Failures']
};

/**
 * This component is a wrapper for specific pipeline views for integrations
 */
function PipelineView(_ref) {
  let {
    pipelineName,
    ...props
  } = _ref;
  const mapping = pipelineMapper[pipelineName];

  if (!mapping) {
    throw new Error(`Invalid pipeline name ${pipelineName}`);
  }

  const [Component, title] = mapping; // Set the page title

  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => void (document.title = title), [title]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(sentry_components_themeAndStyleProvider__WEBPACK_IMPORTED_MODULE_4__["default"], {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_indicators__WEBPACK_IMPORTED_MODULE_3__["default"], {
      className: "indicators-container"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(Component, { ...props
    })]
  });
}

PipelineView.displayName = "PipelineView";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PipelineView);

/***/ }),

/***/ "../node_modules/lodash/_baseReduce.js":
/*!*********************************************!*\
  !*** ../node_modules/lodash/_baseReduce.js ***!
  \*********************************************/
/***/ ((module) => {

/**
 * The base implementation of `_.reduce` and `_.reduceRight`, without support
 * for iteratee shorthands, which iterates over `collection` using `eachFunc`.
 *
 * @private
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @param {*} accumulator The initial value.
 * @param {boolean} initAccum Specify using the first or last element of
 *  `collection` as the initial value.
 * @param {Function} eachFunc The function to iterate over `collection`.
 * @returns {*} Returns the accumulated value.
 */
function baseReduce(collection, iteratee, accumulator, initAccum, eachFunc) {
  eachFunc(collection, function(value, index, collection) {
    accumulator = initAccum
      ? (initAccum = false, value)
      : iteratee(accumulator, value, index, collection);
  });
  return accumulator;
}

module.exports = baseReduce;


/***/ }),

/***/ "../node_modules/lodash/reduce.js":
/*!****************************************!*\
  !*** ../node_modules/lodash/reduce.js ***!
  \****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var arrayReduce = __webpack_require__(/*! ./_arrayReduce */ "../node_modules/lodash/_arrayReduce.js"),
    baseEach = __webpack_require__(/*! ./_baseEach */ "../node_modules/lodash/_baseEach.js"),
    baseIteratee = __webpack_require__(/*! ./_baseIteratee */ "../node_modules/lodash/_baseIteratee.js"),
    baseReduce = __webpack_require__(/*! ./_baseReduce */ "../node_modules/lodash/_baseReduce.js"),
    isArray = __webpack_require__(/*! ./isArray */ "../node_modules/lodash/isArray.js");

/**
 * Reduces `collection` to a value which is the accumulated result of running
 * each element in `collection` thru `iteratee`, where each successive
 * invocation is supplied the return value of the previous. If `accumulator`
 * is not given, the first element of `collection` is used as the initial
 * value. The iteratee is invoked with four arguments:
 * (accumulator, value, index|key, collection).
 *
 * Many lodash methods are guarded to work as iteratees for methods like
 * `_.reduce`, `_.reduceRight`, and `_.transform`.
 *
 * The guarded methods are:
 * `assign`, `defaults`, `defaultsDeep`, `includes`, `merge`, `orderBy`,
 * and `sortBy`
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Collection
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Function} [iteratee=_.identity] The function invoked per iteration.
 * @param {*} [accumulator] The initial value.
 * @returns {*} Returns the accumulated value.
 * @see _.reduceRight
 * @example
 *
 * _.reduce([1, 2], function(sum, n) {
 *   return sum + n;
 * }, 0);
 * // => 3
 *
 * _.reduce({ 'a': 1, 'b': 2, 'c': 1 }, function(result, value, key) {
 *   (result[value] || (result[value] = [])).push(key);
 *   return result;
 * }, {});
 * // => { '1': ['a', 'c'], '2': ['b'] } (iteration order is not guaranteed)
 */
function reduce(collection, iteratee, accumulator) {
  var func = isArray(collection) ? arrayReduce : baseReduce,
      initAccum = arguments.length < 3;

  return func(collection, baseIteratee(iteratee, 4), accumulator, initAccum, baseEach);
}

module.exports = reduce;


/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_integrationPipeline_init_tsx.e129071507614826cea08361fa9d7e39.js.map