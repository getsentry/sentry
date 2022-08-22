"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_organizationDeveloperSettings_sentryFunctionDetails_tsx"],{

/***/ "./app/views/settings/organizationDeveloperSettings/sentryFunctionDetails.tsx":
/*!************************************************************************************!*\
  !*** ./app/views/settings/organizationDeveloperSettings/sentryFunctionDetails.tsx ***!
  \************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _monaco_editor_react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @monaco-editor/react */ "../node_modules/@monaco-editor/react/lib/es/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/forms/jsonForm */ "./app/components/forms/jsonForm.tsx");
/* harmony import */ var sentry_components_forms_model__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/forms/model */ "./app/components/forms/model.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _sentryFunctionsEnvironmentVariables__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./sentryFunctionsEnvironmentVariables */ "./app/views/settings/organizationDeveloperSettings/sentryFunctionsEnvironmentVariables.tsx");
/* harmony import */ var _sentryFunctionSubscriptions__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./sentryFunctionSubscriptions */ "./app/views/settings/organizationDeveloperSettings/sentryFunctionSubscriptions.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


















class SentryFunctionFormModel extends sentry_components_forms_model__WEBPACK_IMPORTED_MODULE_10__["default"] {
  getTransformedData() {
    const data = super.getTransformedData();
    const events = [];

    if (data.onIssue) {
      events.push('issue');
    }

    if (data.onError) {
      events.push('error');
    }

    if (data.onComment) {
      events.push('comment');
    }

    delete data.onIssue;
    delete data.onError;
    delete data.onComment;
    data.events = events;
    const envVariables = [];
    let i = 0;

    while (data[`env-variable-name-${i}`]) {
      if (data[`env-variable-value-${i}`]) {
        envVariables.push({
          name: data[`env-variable-name-${i}`],
          value: data[`env-variable-value-${i}`]
        });
      }

      delete data[`env-variable-name-${i}`];
      delete data[`env-variable-value-${i}`];
      i++;
    }

    data.envVariables = envVariables;
    const { ...output
    } = data;
    return output;
  }

}

const formFields = [{
  name: 'name',
  type: 'string',
  required: true,
  placeholder: 'e.g. My Sentry Function',
  label: 'Name',
  help: 'Human readable name of your Sentry Function'
}, {
  name: 'author',
  type: 'string',
  placeholder: 'e.g. Acme Software',
  label: 'Author',
  help: 'The company or person who built and maintains this Sentry Function.'
}, {
  name: 'overview',
  type: 'string',
  placeholder: 'e.g. This Sentry Function does something useful',
  label: 'Overview',
  help: 'A short description of your Sentry Function.'
}];

function SentryFunctionDetails(props) {
  const form = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(new SentryFunctionFormModel());
  const {
    orgId,
    functionSlug
  } = props.params;
  const {
    sentryFunction
  } = props;
  const method = functionSlug ? 'PUT' : 'POST';
  let endpoint = `/organizations/${orgId}/functions/`;

  if (functionSlug) {
    endpoint += `${functionSlug}/`;
  }

  const defaultCode = sentryFunction ? sentryFunction.code : `exports.yourFunction = (req, res) => {
    let message = req.query.message || req.body.message || 'Hello World!';
    console.log('Query: ' + req.query);
    console.log('Body: ' + req.body);
    res.status(200).send(message);
  };`;
  const [events, setEvents] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)((sentryFunction === null || sentryFunction === void 0 ? void 0 : sentryFunction.events) || []);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    form.current.setValue('onIssue', events.includes('issue'));
    form.current.setValue('onError', events.includes('error'));
    form.current.setValue('onComment', events.includes('comment'));
  }, [events]);
  const [envVariables, setEnvVariables] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)((sentryFunction === null || sentryFunction === void 0 ? void 0 : sentryFunction.env_variables) || [{
    name: '',
    value: ''
  }]);

  const handleSubmitError = err => {
    let errorMessage = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Unknown Error');

    if (err.status >= 400 && err.status < 500) {
      var _err$responseJSON$det;

      errorMessage = (_err$responseJSON$det = err === null || err === void 0 ? void 0 : err.responseJSON.detail) !== null && _err$responseJSON$det !== void 0 ? _err$responseJSON$det : errorMessage;
    }

    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)(errorMessage);
  };

  const handleSubmitSuccess = data => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Sentry Function successfully saved.', data.name));
    const baseUrl = `/settings/${orgId}/developer-settings/sentry-functions/`;
    const url = `${baseUrl}${data.slug}/`;

    if (sentryFunction) {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('%s successfully saved.', data.name));
    } else {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('%s successfully created.', data.name));
    }

    react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.push(url);
  };

  function handleEditorChange(value, _event) {
    form.current.setValue('code', value);
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("div", {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_6__["default"], {
      features: ['organizations:sentry-functions'],
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("h2", {
        children: sentryFunction ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Editing Sentry Function') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Create Sentry Function')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_8__["default"], {
        apiMethod: method,
        apiEndpoint: endpoint,
        model: form.current,
        onPreSubmit: () => {
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Saving changes..'));
        },
        initialData: {
          code: defaultCode,
          events,
          envVariables,
          ...props.sentryFunction
        },
        onSubmitError: handleSubmitError,
        onSubmitSuccess: handleSubmitSuccess,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_9__["default"], {
          forms: [{
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Sentry Function Details'),
            fields: formFields
          }]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__.Panel, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__.PanelHeader, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Webhooks')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__.PanelBody, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_sentryFunctionSubscriptions__WEBPACK_IMPORTED_MODULE_14__["default"], {
              events: events,
              setEvents: setEvents
            })
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__.Panel, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_sentryFunctionsEnvironmentVariables__WEBPACK_IMPORTED_MODULE_13__["default"], {
            envVariables: envVariables,
            setEnvVariables: setEnvVariables
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__.Panel, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__.PanelHeader, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Write your Code Below')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__.PanelBody, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_monaco_editor_react__WEBPACK_IMPORTED_MODULE_4__["default"], {
              height: "40vh",
              theme: "light",
              defaultLanguage: "javascript",
              defaultValue: defaultCode,
              onChange: handleEditorChange,
              options: {
                minimap: {
                  enabled: false
                },
                scrollBeyondLastLine: false
              }
            })
          })]
        })]
      })]
    })
  });
}

SentryFunctionDetails.displayName = "SentryFunctionDetails";

class SentryFunctionsWrapper extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_7__["default"] {
  getEndpoints() {
    const {
      functionSlug,
      orgId
    } = this.props.params;

    if (functionSlug) {
      return [['sentryFunction', `/organizations/${orgId}/functions/${functionSlug}/`]];
    }

    return [];
  }

  renderBody() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(SentryFunctionDetails, {
      sentryFunction: this.state.sentryFunction,
      ...this.props
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SentryFunctionsWrapper);

/***/ }),

/***/ "./app/views/settings/organizationDeveloperSettings/sentryFunctionSubscriptions.tsx":
/*!******************************************************************************************!*\
  !*** ./app/views/settings/organizationDeveloperSettings/sentryFunctionSubscriptions.tsx ***!
  \******************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./constants */ "./app/views/settings/organizationDeveloperSettings/constants.tsx");
/* harmony import */ var _subscriptionBox__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./subscriptionBox */ "./app/views/settings/organizationDeveloperSettings/subscriptionBox.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function SentryFunctionSubscriptions(props) {
  const {
    events,
    setEvents
  } = props;

  function onChange(resource, checked) {
    if (checked && !events.includes(resource)) {
      setEvents(events.concat(resource));
    } else if (!checked && events.includes(resource)) {
      setEvents(events.filter(e => e !== resource));
    }
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(SentryFunctionsSubscriptionGrid, {
    children: _constants__WEBPACK_IMPORTED_MODULE_2__.EVENT_CHOICES.map(resource => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_subscriptionBox__WEBPACK_IMPORTED_MODULE_3__["default"], {
      disabledFromPermissions: false,
      webhookDisabled: false,
      checked: props.events.includes(resource),
      resource: resource,
      onChange: onChange,
      isNew: resource === 'comment'
    }, resource))
  });
}

SentryFunctionSubscriptions.displayName = "SentryFunctionSubscriptions";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SentryFunctionSubscriptions);

const SentryFunctionsSubscriptionGrid = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e6znvl90"
} : 0)("display:grid;grid-template:auto/1fr 1fr 1fr;@media (max-width: ", props => props.theme.breakpoints.large, "){grid-template:1fr 1fr 1fr/auto;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/organizationDeveloperSettings/sentryFunctionsEnvironmentVariables.tsx":
/*!**************************************************************************************************!*\
  !*** ./app/views/settings/organizationDeveloperSettings/sentryFunctionsEnvironmentVariables.tsx ***!
  \**************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_forms__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/forms */ "./app/components/forms/index.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }










function SentryFunctionEnvironmentVariables(props) {
  const {
    envVariables,
    setEnvVariables
  } = props;

  const addEnvVar = () => {
    setEnvVariables([...envVariables, {
      name: '',
      value: ''
    }]);
  };

  const handleNameChange = (value, pos) => {
    const newEnvVariables = [...envVariables];

    while (newEnvVariables.length <= pos) {
      newEnvVariables.push({
        name: '',
        value: ''
      });
    }

    newEnvVariables[pos] = { ...newEnvVariables[pos],
      name: value
    };
    setEnvVariables(newEnvVariables);
  };

  const handleValueChange = (value, pos) => {
    const newEnvVariables = [...envVariables];

    while (newEnvVariables.length <= pos) {
      newEnvVariables.push({
        name: '',
        value: ''
      });
    }

    newEnvVariables[pos] = { ...newEnvVariables[pos],
      value
    };
    setEnvVariables(newEnvVariables);
  };

  const removeEnvVar = pos => {
    const newEnvVariables = [...envVariables];
    newEnvVariables.splice(pos, 1);
    setEnvVariables(newEnvVariables);
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)("div", {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__.PanelHeader, {
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Environment Variables'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(StyledAddButton, {
        size: "sm",
        type: "button",
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconAdd, {
          isCircled: true
        }),
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Add Environment Variable'),
        onClick: addEnvVar
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(StyledPanelBody, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(EnvironmentVariableWrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(EnvHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Name')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(EnvHeaderRight, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Value')
        })]
      }), envVariables.map((envVariable, i) => {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(EnvironmentVariableWrapper, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_forms__WEBPACK_IMPORTED_MODULE_3__.InputField, {
            name: `env-variable-name-${i}`,
            type: "text",
            required: false,
            inline: false,
            defaultValue: envVariable.name,
            value: envVariable.name,
            stacked: true,
            onChange: e => handleNameChange(e, i)
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_forms__WEBPACK_IMPORTED_MODULE_3__.InputField, {
            name: `env-variable-value-${i}`,
            type: "text",
            required: false,
            inline: false,
            defaultValue: envVariable.value,
            value: envVariable.value,
            stacked: true,
            onChange: e => handleValueChange(e, i)
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(ButtonHolder, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(StyledAddButton, {
              size: "sm",
              icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconDelete, {}),
              type: "button",
              "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)('Remove Environment Variable [i]', {
                i
              }),
              onClick: () => removeEnvVar(i)
            })
          })]
        }, i);
      })]
    })]
  });
}

SentryFunctionEnvironmentVariables.displayName = "SentryFunctionEnvironmentVariables";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SentryFunctionEnvironmentVariables);

const EnvironmentVariableWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "etwnfrb5"
} : 0)( true ? {
  name: "1dre63g",
  styles: "display:grid;grid-template-columns:1fr 1.5fr min-content"
} : 0);

const StyledAddButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"],  true ? {
  target: "etwnfrb4"
} : 0)( true ? {
  name: "tjo4qw",
  styles: "float:right"
} : 0);

const EnvHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "etwnfrb3"
} : 0)("text-align:left;margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(2), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";color:", p => p.theme.gray400, ";" + ( true ? "" : 0));

const EnvHeaderRight = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(EnvHeader,  true ? {
  target: "etwnfrb2"
} : 0)("margin-left:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(2), ";" + ( true ? "" : 0));

const ButtonHolder = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "etwnfrb1"
} : 0)("align-items:center;display:flex;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(2), ";" + ( true ? "" : 0));

const StyledPanelBody = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__.PanelBody,  true ? {
  target: "etwnfrb0"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(2), ";" + ( true ? "" : 0));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_organizationDeveloperSettings_sentryFunctionDetails_tsx.37db6b9e09e65491a22e23553e15927d.js.map