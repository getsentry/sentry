"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_project_projectOwnership_index_tsx"],{

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

/***/ "./app/views/settings/project/projectOwnership/addCodeOwnerModal.tsx":
/*!***************************************************************************!*\
  !*** ./app/views/settings/project/projectOwnership/addCodeOwnerModal.tsx ***!
  \***************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AddCodeOwnerModal": () => (/* binding */ AddCodeOwnerModal),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/forms/selectField */ "./app/components/forms/selectField.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


















class AddCodeOwnerModal extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_6__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchFile", async codeMappingId => {
      const {
        organization
      } = this.props;
      this.setState({
        codeMappingId,
        codeownersFile: null,
        error: false,
        errorJSON: null,
        isLoading: true
      });

      try {
        const data = await this.api.requestPromise(`/organizations/${organization.slug}/code-mappings/${codeMappingId}/codeowners/`, {
          method: 'GET'
        });
        this.setState({
          codeownersFile: data,
          isLoading: false
        });
      } catch (_err) {
        this.setState({
          isLoading: false
        });
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "addFile", async () => {
      const {
        organization,
        project
      } = this.props;
      const {
        codeownersFile,
        codeMappingId,
        codeMappings
      } = this.state;

      if (codeownersFile) {
        const postData = {
          codeMappingId,
          raw: codeownersFile.raw
        };

        try {
          const data = await this.api.requestPromise(`/projects/${organization.slug}/${project.slug}/codeowners/`, {
            method: 'POST',
            data: postData
          });
          const codeMapping = codeMappings.find(mapping => mapping.id === (codeMappingId === null || codeMappingId === void 0 ? void 0 : codeMappingId.toString()));
          this.handleAddedFile({ ...data,
            codeMapping
          });
        } catch (err) {
          if (err.responseJSON.raw) {
            this.setState({
              error: true,
              errorJSON: err.responseJSON,
              isLoading: false
            });
          } else {
            (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)(Object.values(err.responseJSON).flat().join(' ')));
          }
        }
      }
    });
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      codeownersFile: null,
      codeMappingId: null,
      isLoading: false,
      error: false,
      errorJSON: null
    };
  }

  getEndpoints() {
    const {
      organization,
      project
    } = this.props;
    const endpoints = [['codeMappings', `/organizations/${organization.slug}/code-mappings/`, {
      query: {
        project: project.id
      }
    }], ['integrations', `/organizations/${organization.slug}/integrations/`, {
      query: {
        features: ['codeowners']
      }
    }]];
    return endpoints;
  }

  handleAddedFile(data) {
    this.props.onSave && this.props.onSave(data);
    this.props.closeModal();
  }

  sourceFile(codeownersFile) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.Panel, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(SourceFileBody, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_13__.IconCheckmark, {
          size: "md",
          isCircled: true,
          color: "green200"
        }), codeownersFile.filepath, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
          size: "sm",
          href: codeownersFile.html_url,
          external: true,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Preview File')
        })]
      })
    });
  }

  errorMessage(baseUrl) {
    var _errorJSON$raw;

    const {
      errorJSON,
      codeMappingId,
      codeMappings
    } = this.state;
    const codeMapping = codeMappings.find(mapping => mapping.id === codeMappingId);
    const {
      integrationId,
      provider
    } = codeMapping;
    const errActors = errorJSON === null || errorJSON === void 0 ? void 0 : (_errorJSON$raw = errorJSON.raw) === null || _errorJSON$raw === void 0 ? void 0 : _errorJSON$raw[0].split('\n').map((el, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("p", {
      children: el
    }, i));
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_5__["default"], {
      type: "error",
      showIcon: true,
      children: [errActors, codeMapping && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.tct)('Configure [userMappingsLink:User Mappings] or [teamMappingsLink:Team Mappings] for any missing associations.', {
          userMappingsLink: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_10__["default"], {
            to: `${baseUrl}/${provider === null || provider === void 0 ? void 0 : provider.key}/${integrationId}/?tab=userMappings&referrer=add-codeowners`
          }),
          teamMappingsLink: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_10__["default"], {
            to: `${baseUrl}/${provider === null || provider === void 0 ? void 0 : provider.key}/${integrationId}/?tab=teamMappings&referrer=add-codeowners`
          })
        })
      }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.tct)('[addAndSkip:Add and Skip Missing Associations] will add your codeowner file and skip any rules that having missing associations. You can add associations later for any skipped rules.', {
        addAndSkip: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("strong", {
          children: "Add and Skip Missing Associations"
        })
      })]
    });
  }

  noSourceFile() {
    const {
      codeMappingId,
      isLoading
    } = this.state;

    if (isLoading) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(Container, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_11__["default"], {
          mini: true
        })
      });
    }

    if (!codeMappingId) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.Panel, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(NoSourceFileBody, {
        children: codeMappingId ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_13__.IconNot, {
            size: "md",
            color: "red200"
          }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('No codeowner file found.')]
        }) : null
      })
    });
  }

  renderBody() {
    const {
      Header,
      Body,
      Footer
    } = this.props;
    const {
      codeownersFile,
      error,
      errorJSON,
      codeMappings,
      integrations
    } = this.state;
    const {
      organization
    } = this.props;
    const baseUrl = `/settings/${organization.slug}/integrations`;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(Header, {
        closeButton: true,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Add Code Owner File')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(Body, {
        children: [!codeMappings.length ? !integrations.length ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("div", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Install a GitHub or GitLab integration to use this feature.')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(Container, {
            style: {
              paddingTop: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(2)
            },
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
              type: "button",
              priority: "primary",
              size: "sm",
              to: baseUrl,
              children: "Setup Integration"
            })
          })]
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("div", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)("Configure code mapping to add your CODEOWNERS file. Select the integration you'd like to use for mapping:")
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(IntegrationsList, {
            children: integrations.map(integration => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
              type: "button",
              to: `${baseUrl}/${integration.provider.key}/${integration.id}/?tab=codeMappings&referrer=add-codeowners`,
              children: [(0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_16__.getIntegrationIcon)(integration.provider.key), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(IntegrationName, {
                children: integration.name
              })]
            }, integration.id))
          })]
        }) : null, codeMappings.length > 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_8__["default"], {
          apiMethod: "POST",
          apiEndpoint: "/code-mappings/",
          hideFooter: true,
          initialData: {},
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(StyledSelectField, {
            name: "codeMappingId",
            label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Apply an existing code mapping'),
            options: codeMappings.map(cm => ({
              value: cm.id,
              label: cm.repoName
            })),
            onChange: this.fetchFile,
            required: true,
            inline: false,
            flexibleControlStateSize: true,
            stacked: true
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(FileResult, {
            children: [codeownersFile ? this.sourceFile(codeownersFile) : this.noSourceFile(), error && errorJSON && this.errorMessage(baseUrl)]
          })]
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(Footer, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
          disabled: codeownersFile ? false : true,
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Add File'),
          priority: "primary",
          onClick: this.addFile,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Add File')
        })
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AddCodeOwnerModal);


const StyledSelectField = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "egm2gq46"
} : 0)( true ? {
  name: "1apembo",
  styles: "border-bottom:None;padding-right:16px"
} : 0);

const FileResult = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "egm2gq45"
} : 0)( true ? {
  name: "6n1ert",
  styles: "width:inherit"
} : 0);

const NoSourceFileBody = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelBody,  true ? {
  target: "egm2gq44"
} : 0)( true ? {
  name: "1ox1hih",
  styles: "display:grid;padding:12px;grid-template-columns:30px 1fr;align-items:center"
} : 0);

const SourceFileBody = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelBody,  true ? {
  target: "egm2gq43"
} : 0)( true ? {
  name: "b4tnab",
  styles: "display:grid;padding:12px;grid-template-columns:30px 1fr 100px;align-items:center"
} : 0);

const IntegrationsList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "egm2gq42"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1), ";justify-items:center;margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(2), ";" + ( true ? "" : 0));

const IntegrationName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('p',  true ? {
  target: "egm2gq41"
} : 0)( true ? {
  name: "vnst0l",
  styles: "padding-left:10px"
} : 0);

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "egm2gq40"
} : 0)( true ? {
  name: "zl1inp",
  styles: "display:flex;justify-content:center"
} : 0);

/***/ }),

/***/ "./app/views/settings/project/projectOwnership/codeowners.tsx":
/*!********************************************************************!*\
  !*** ./app/views/settings/project/projectOwnership/codeowners.tsx ***!
  \********************************************************************/
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
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_views_settings_project_projectOwnership_rulesPanel__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/views/settings/project/projectOwnership/rulesPanel */ "./app/views/settings/project/projectOwnership/rulesPanel.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












class CodeOwnersPanel extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDelete", async codeowner => {
      const {
        api,
        organization,
        project,
        onDelete
      } = this.props;
      const endpoint = `/api/0/projects/${organization.slug}/${project.slug}/codeowners/${codeowner.id}/`;

      try {
        await api.requestPromise(endpoint, {
          method: 'DELETE'
        });
        onDelete(codeowner);
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Deletion successful'));
      } catch {
        // no 4xx errors should happen on delete
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('An error occurred'));
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSync", async codeowner => {
      const {
        api,
        organization,
        project,
        onUpdate
      } = this.props;

      try {
        const codeownerFile = await api.requestPromise(`/organizations/${organization.slug}/code-mappings/${codeowner.codeMappingId}/codeowners/`, {
          method: 'GET'
        });
        const data = await api.requestPromise(`/projects/${organization.slug}/${project.slug}/codeowners/${codeowner.id}/`, {
          method: 'PUT',
          data: {
            raw: codeownerFile.raw
          }
        });
        onUpdate({ ...codeowner,
          ...data
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('CODEOWNERS file sync successful.'));
      } catch (_err) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('An error occurred trying to sync CODEOWNERS file.'));
      }
    });
  }

  render() {
    const {
      codeowners,
      disabled
    } = this.props;
    return codeowners.map(codeowner => {
      const {
        dateUpdated,
        provider,
        codeMapping,
        ownershipSyntax
      } = codeowner;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_views_settings_project_projectOwnership_rulesPanel__WEBPACK_IMPORTED_MODULE_9__["default"], {
          "data-test-id": "codeowners-panel",
          type: "codeowners",
          raw: ownershipSyntax || '',
          dateUpdated: dateUpdated,
          provider: provider,
          repoName: codeMapping === null || codeMapping === void 0 ? void 0 : codeMapping.repoName,
          controls: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
            icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_6__.IconSync, {
              size: "xs"
            }),
            size: "xs",
            onClick: () => this.handleSync(codeowner),
            disabled: disabled,
            "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Sync')
          }, "sync"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_5__["default"], {
            onConfirm: () => this.handleDelete(codeowner),
            message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Are you sure you want to remove this CODEOWNERS file?'),
            disabled: disabled,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
              icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_6__.IconDelete, {
                size: "xs"
              }),
              "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Delete'),
              size: "xs"
            }, "delete")
          }, "confirm-delete")]
        })
      }, codeowner.id);
    });
  }

}

CodeOwnersPanel.displayName = "CodeOwnersPanel";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_8__["default"])(CodeOwnersPanel));

/***/ }),

/***/ "./app/views/settings/project/projectOwnership/index.tsx":
/*!***************************************************************!*\
  !*** ./app/views/settings/project/projectOwnership/index.tsx ***!
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
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/featureBadge */ "./app/components/featureBadge.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/forms/jsonForm */ "./app/components/forms/jsonForm.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/routeTitle */ "./app/utils/routeTitle.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_account_notifications_feedbackAlert__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/views/settings/account/notifications/feedbackAlert */ "./app/views/settings/account/notifications/feedbackAlert.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_project_permissionAlert__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/views/settings/project/permissionAlert */ "./app/views/settings/project/permissionAlert.tsx");
/* harmony import */ var sentry_views_settings_project_projectOwnership_addCodeOwnerModal__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/views/settings/project/projectOwnership/addCodeOwnerModal */ "./app/views/settings/project/projectOwnership/addCodeOwnerModal.tsx");
/* harmony import */ var sentry_views_settings_project_projectOwnership_codeowners__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/views/settings/project/projectOwnership/codeowners */ "./app/views/settings/project/projectOwnership/codeowners.tsx");
/* harmony import */ var sentry_views_settings_project_projectOwnership_rulesPanel__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/views/settings/project/projectOwnership/rulesPanel */ "./app/views/settings/project/projectOwnership/rulesPanel.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


























class ProjectOwnership extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_18__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleAddCodeOwner", () => {
      (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_6__.openModal)(modalProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_views_settings_project_projectOwnership_addCodeOwnerModal__WEBPACK_IMPORTED_MODULE_22__["default"], { ...modalProps,
        organization: this.props.organization,
        project: this.props.project,
        onSave: this.handleCodeOwnerAdded
      }));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleOwnershipSave", text => {
      this.setState(prevState => ({ ...(prevState.ownership ? {
          ownership: { ...prevState.ownership,
            raw: text || ''
          }
        } : {})
      }));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleCodeOwnerAdded", data => {
      const {
        codeowners
      } = this.state;
      const newCodeowners = [data, ...(codeowners || [])];
      this.setState({
        codeowners: newCodeowners
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleCodeOwnerDeleted", data => {
      const {
        codeowners
      } = this.state;
      const newCodeowners = (codeowners || []).filter(codeowner => codeowner.id !== data.id);
      this.setState({
        codeowners: newCodeowners
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleCodeOwnerUpdated", data => {
      const codeowners = this.state.codeowners || [];
      const index = codeowners.findIndex(item => item.id === data.id);
      this.setState({
        codeowners: [...codeowners.slice(0, index), data, ...codeowners.slice(index + 1)]
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleAddCodeOwnerRequest", async () => {
      const {
        organization,
        project
      } = this.props;

      try {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Requesting\u2026'));
        await this.api.requestPromise(`/projects/${organization.slug}/${project.slug}/codeowners-request/`, {
          method: 'POST',
          data: {}
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Request Sent'));
      } catch (err) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Unable to send request'));
        _sentry_react__WEBPACK_IMPORTED_MODULE_26__.captureException(err);
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderCodeOwnerErrors", () => {
      const {
        project,
        organization
      } = this.props;
      const {
        codeowners
      } = this.state;

      const errMessageComponent = (message, values, link, linkValue) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(ErrorMessageContainer, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)("span", {
            children: message
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)("b", {
            children: values.join(', ')
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(ErrorCtaContainer, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_14__["default"], {
            href: link,
            children: linkValue
          })
        })]
      });

      const errMessageListComponent = (message, values, linkFunction, linkValueFunction) => {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(ErrorMessageContainer, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)("span", {
              children: message
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(ErrorMessageListContainer, {
            children: values.map((value, index) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(ErrorInlineContainer, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)("b", {
                children: value
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(ErrorCtaContainer, {
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_14__["default"], {
                  href: linkFunction(value),
                  children: linkValueFunction(value)
                }, index)
              })]
            }, index))
          })]
        });
      };

      return (codeowners || []).filter(_ref => {
        let {
          errors
        } = _ref;
        return Object.values(errors).flat().length;
      }).map(_ref2 => {
        let {
          id,
          codeMapping,
          errors
        } = _ref2;

        const errMessage = (type, values) => {
          var _codeMapping$provider, _codeMapping$provider2;

          switch (type) {
            case 'missing_external_teams':
              return errMessageComponent(`The following teams do not have an association in the organization: ${organization.slug}`, values, `/settings/${organization.slug}/integrations/${codeMapping === null || codeMapping === void 0 ? void 0 : (_codeMapping$provider = codeMapping.provider) === null || _codeMapping$provider === void 0 ? void 0 : _codeMapping$provider.slug}/${codeMapping === null || codeMapping === void 0 ? void 0 : codeMapping.integrationId}/?tab=teamMappings`, 'Configure Team Mappings');

            case 'missing_external_users':
              return errMessageComponent(`The following usernames do not have an association in the organization: ${organization.slug}`, values, `/settings/${organization.slug}/integrations/${codeMapping === null || codeMapping === void 0 ? void 0 : (_codeMapping$provider2 = codeMapping.provider) === null || _codeMapping$provider2 === void 0 ? void 0 : _codeMapping$provider2.slug}/${codeMapping === null || codeMapping === void 0 ? void 0 : codeMapping.integrationId}/?tab=userMappings`, 'Configure User Mappings');

            case 'missing_user_emails':
              return errMessageComponent(`The following emails do not have an Sentry user in the organization: ${organization.slug}`, values, `/settings/${organization.slug}/members/`, 'Invite Users');

            case 'teams_without_access':
              return errMessageListComponent(`The following team do not have access to the project: ${project.slug}`, values, value => `/settings/${organization.slug}/teams/${value.slice(1)}/projects/`, value => `Configure ${value} Permissions`);

            case 'users_without_access':
              return errMessageListComponent(`The following users are not on a team that has access to the project: ${project.slug}`, values, email => `/settings/${organization.slug}/members/?query=${email}`, _ => `Configure Member Settings`);

            default:
              return null;
          }
        };

        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_9__["default"], {
          type: "error",
          showIcon: true,
          expand: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(AlertContentContainer, {
            children: Object.entries(errors).filter(_ref3 => {
              let [_, values] = _ref3;
              return values.length;
            }).map(_ref4 => {
              let [type, values] = _ref4;
              return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(ErrorContainer, {
                children: errMessage(type, values)
              }, `${id}-${type}`);
            })
          }, "container")],
          children: `There were ${Object.values(errors).flat().length} ownership issues within Sentry on the latest sync with the CODEOWNERS file`
        }, id);
      });
    });
  }

  getTitle() {
    const {
      project
    } = this.props;
    return (0,sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_17__["default"])((0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Issue Owners'), project.slug, false);
  }

  getEndpoints() {
    const {
      organization,
      project
    } = this.props;
    const endpoints = [['ownership', `/projects/${organization.slug}/${project.slug}/ownership/`]];

    if (organization.features.includes('integrations-codeowners')) {
      endpoints.push(['codeowners', `/projects/${organization.slug}/${project.slug}/codeowners/`, {
        query: {
          expand: ['codeMapping', 'ownershipSyntax']
        }
      }]);
    }

    return endpoints;
  }

  getPlaceholder() {
    return `#example usage
path:src/example/pipeline/* person@sentry.io #infra
module:com.module.name.example #sdks
url:http://example.com/settings/* #product
tags.sku_class:enterprise #enterprise`;
  }

  getDetail() {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)(`Automatically assign issues and send alerts to the right people based on issue properties. [link:Learn more].`, {
      link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_14__["default"], {
        href: "https://docs.sentry.io/product/error-monitoring/issue-owners/"
      })
    });
  }

  renderBody() {
    const {
      project,
      organization
    } = this.props;
    const {
      ownership,
      codeowners
    } = this.state;
    const disabled = !organization.access.includes('project:write');
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_20__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Issue Owners'),
        action: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_10__["default"], {
            to: {
              pathname: `/organizations/${organization.slug}/issues/`,
              query: {
                project: project.id
              }
            },
            size: "sm",
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('View Issues')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_8__["default"], {
            features: ['integrations-codeowners'],
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_7__["default"], {
              access: ['org:integrations'],
              children: _ref5 => {
                let {
                  hasAccess
                } = _ref5;
                return hasAccess ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(CodeOwnerButton, {
                  onClick: this.handleAddCodeOwner,
                  size: "sm",
                  priority: "primary",
                  "data-test-id": "add-codeowner-button",
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Add CODEOWNERS File')
                }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(CodeOwnerButton, {
                  onClick: this.handleAddCodeOwnerRequest,
                  size: "sm",
                  priority: "primary",
                  "data-test-id": "add-codeowner-request-button",
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Request to Add CODEOWNERS File')
                });
              }
            })
          })]
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(IssueOwnerDetails, {
        children: this.getDetail()
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_views_settings_project_permissionAlert__WEBPACK_IMPORTED_MODULE_21__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_views_settings_account_notifications_feedbackAlert__WEBPACK_IMPORTED_MODULE_19__["default"], {}), this.renderCodeOwnerErrors(), ownership && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_views_settings_project_projectOwnership_rulesPanel__WEBPACK_IMPORTED_MODULE_24__["default"], {
        "data-test-id": "issueowners-panel",
        type: "issueowners",
        raw: ownership.raw || '',
        dateUpdated: ownership.lastUpdated,
        placeholder: this.getPlaceholder(),
        controls: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_10__["default"], {
          size: "xs",
          onClick: () => (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_6__.openEditOwnershipRules)({
            organization,
            project,
            ownership,
            onSave: this.handleOwnershipSave
          }),
          disabled: disabled,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Edit')
        }, "edit")]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_8__["default"], {
        features: ['integrations-codeowners'],
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_views_settings_project_projectOwnership_codeowners__WEBPACK_IMPORTED_MODULE_23__["default"], {
          codeowners: codeowners || [],
          onDelete: this.handleCodeOwnerDeleted,
          onUpdate: this.handleCodeOwnerUpdated,
          disabled: disabled,
          ...this.props
        })
      }), ownership && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_12__["default"], {
        apiEndpoint: `/projects/${organization.slug}/${project.slug}/ownership/`,
        apiMethod: "PUT",
        saveOnBlur: true,
        initialData: {
          fallthrough: ownership.fallthrough,
          autoAssignment: ownership.autoAssignment,
          codeownersAutoSync: ownership.codeownersAutoSync
        },
        hideFooter: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_13__["default"], {
          forms: [{
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Issue Owners'),
            fields: [{
              name: 'autoAssignment',
              type: 'boolean',
              label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Automatically assign issues'),
              help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Assign issues when a new event matches the rules above.'),
              disabled
            }, {
              name: 'fallthrough',
              type: 'boolean',
              label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Send alert to project members if there’s no assigned owner'),
              help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Alerts will be sent to all users who have access to this project.'),
              disabled
            }, {
              name: 'codeownersAutoSync',
              type: 'boolean',
              label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)(`Automatically sync changes from CODEOWNERS file to Code Owners [badge]`, {
                badge: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_11__["default"], {
                  type: "new",
                  title: !(this.state.codeowners || []).length ? 'Setup Code Owners to use this feature.' : undefined
                })
              }),
              help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Sentry will watch for CODEOWNERS file changes during a Release and then update Code Owners.'),
              disabled: disabled || !(this.state.codeowners || []).length
            }]
          }]
        })
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectOwnership);

const CodeOwnerButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "eln4bag7"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1), ";" + ( true ? "" : 0));

const AlertContentContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eln4bag6"
} : 0)( true ? {
  name: "cp75et",
  styles: "overflow-y:auto;max-height:350px"
} : 0);

const ErrorContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eln4bag5"
} : 0)("display:grid;grid-template-areas:'message cta';grid-template-columns:2fr 1fr;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(2), ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1.5), " 0;" + ( true ? "" : 0));

const ErrorInlineContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(ErrorContainer,  true ? {
  target: "eln4bag4"
} : 0)("gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1.5), ";grid-template-columns:1fr 2fr;align-items:center;padding:0;" + ( true ? "" : 0));

const ErrorMessageContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eln4bag3"
} : 0)("grid-area:message;display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1.5), ";" + ( true ? "" : 0));

const ErrorMessageListContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eln4bag2"
} : 0)("grid-column:message/cta-end;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1.5), ";" + ( true ? "" : 0));

const ErrorCtaContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eln4bag1"
} : 0)( true ? {
  name: "1avrv9n",
  styles: "grid-area:cta;justify-self:flex-end;text-align:right;line-height:1.5"
} : 0);

const IssueOwnerDetails = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eln4bag0"
} : 0)("padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(3), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/project/projectOwnership/rulesPanel.tsx":
/*!********************************************************************!*\
  !*** ./app/views/settings/project/projectOwnership/rulesPanel.tsx ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react_autosize_textarea__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-autosize-textarea */ "../node_modules/react-autosize-textarea/lib/index.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_styles_input__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/input */ "./app/styles/input.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }










function RulesPanel(_ref) {
  let {
    raw,
    dateUpdated,
    provider,
    repoName,
    type,
    placeholder,
    controls,
    ['data-test-id']: dataTestId
  } = _ref;

  function renderIcon() {
    switch (provider !== null && provider !== void 0 ? provider : '') {
      case 'github':
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_4__.IconGithub, {
          size: "md"
        });

      case 'gitlab':
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_4__.IconGitlab, {
          size: "md"
        });

      default:
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_4__.IconSentry, {
          size: "md"
        });
    }
  }

  function renderTitle() {
    switch (type) {
      case 'codeowners':
        return 'CODEOWNERS';

      case 'issueowners':
        return 'Ownership Rules';

      default:
        return null;
    }
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.Panel, {
    "data-test-id": dataTestId,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.PanelHeader, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(Container, {
        children: [renderIcon(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Title, {
          children: renderTitle()
        }), repoName && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Repository, {
          children: `- ${repoName}`
        })]
      }, "title"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(Container, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(SyncDate, {
          children: dateUpdated && `Last synced ${moment__WEBPACK_IMPORTED_MODULE_2___default()(dateUpdated).fromNow()}`
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Controls, {
          children: (controls || []).map((c, n) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)("span", {
            children: [" ", c]
          }, n))
        })]
      }, "control")]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.PanelBody, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(InnerPanelBody, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(StyledTextArea, {
          value: raw,
          spellCheck: "false",
          autoComplete: "off",
          autoCorrect: "off",
          autoCapitalize: "off",
          placeholder: placeholder
        })
      })
    })]
  });
}

RulesPanel.displayName = "RulesPanel";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (RulesPanel);

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "earny2k6"
} : 0)( true ? {
  name: "1dtdda3",
  styles: "display:flex;align-items:center;text-transform:none"
} : 0);

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "earny2k5"
} : 0)("padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(0.5), " 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1), ";font-size:initial;" + ( true ? "" : 0));

const Repository = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "earny2k4"
} : 0)( true ? "" : 0);

const InnerPanelBody = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.PanelBody,  true ? {
  target: "earny2k3"
} : 0)( true ? {
  name: "pit38s",
  styles: "height:auto"
} : 0);

const StyledTextArea = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(react_autosize_textarea__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "earny2k2"
} : 0)(p => (0,sentry_styles_input__WEBPACK_IMPORTED_MODULE_5__.inputStyles)(p), ";height:350px!important;overflow:auto;outline:0;width:100%;resize:none;margin:0;font-family:", p => p.theme.text.familyMono, ";word-break:break-all;white-space:pre-wrap;line-height:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(3), ";border:none;box-shadow:none;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(2), ";color:transparent;text-shadow:0 0 0 #9386a0;&:hover,&:focus,&:active{border:none;box-shadow:none;}" + ( true ? "" : 0));

const SyncDate = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "earny2k1"
} : 0)("padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1), ";font-weight:normal;" + ( true ? "" : 0));

const Controls = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "earny2k0"
} : 0)("display:grid;align-items:center;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1), ";grid-auto-flow:column;justify-content:flex-end;" + ( true ? "" : 0));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_project_projectOwnership_index_tsx.aa4a0c5d8773cb08808eccbc68d04da4.js.map