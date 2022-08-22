"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_organizationIntegrations_configureIntegration_tsx"],{

/***/ "./app/actions/repositoryActions.tsx":
/*!*******************************************!*\
  !*** ./app/actions/repositoryActions.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);

const RepositoryActions = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createActions)(['resetRepositories', 'loadRepositories', 'loadRepositoriesError', 'loadRepositoriesSuccess']);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (RepositoryActions);

/***/ }),

/***/ "./app/components/actions/menuItemActionLink.tsx":
/*!*******************************************************!*\
  !*** ./app/components/actions/menuItemActionLink.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_actions_actionLink__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/actions/actionLink */ "./app/components/actions/actionLink.tsx");
/* harmony import */ var sentry_components_menuItem__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/menuItem */ "./app/components/menuItem.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function MenuItemActionLink(_ref) {
  let {
    className,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_menuItem__WEBPACK_IMPORTED_MODULE_2__["default"], {
    noAnchor: true,
    withBorder: true,
    disabled: props.disabled,
    className: className,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(InnerActionLink, { ...props
    })
  });
}

MenuItemActionLink.displayName = "MenuItemActionLink";

const InnerActionLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_actions_actionLink__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "e18s0uh10"
} : 0)("color:", p => p.theme.textColor, ";", p => p.theme.overflowEllipsis, " &:hover{color:", p => p.theme.textColor, ";}.dropdown-menu>li>&,.dropdown-menu>span>li>&{&.disabled:hover{background:", p => p.theme.background, ";}}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MenuItemActionLink);

/***/ }),

/***/ "./app/components/integrationExternalMappingForm.tsx":
/*!***********************************************************!*\
  !*** ./app/components/integrationExternalMappingForm.tsx ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ IntegrationExternalMappingForm)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_capitalize__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/capitalize */ "../node_modules/lodash/capitalize.js");
/* harmony import */ var lodash_capitalize__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_capitalize__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_forms__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms */ "./app/components/forms/index.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_model__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/forms/model */ "./app/components/forms/model.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









class IntegrationExternalMappingForm extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "model", new sentry_components_forms_model__WEBPACK_IMPORTED_MODULE_7__["default"]());
  }

  get initialData() {
    const {
      integration,
      mapping
    } = this.props;
    return {
      provider: integration.provider.key,
      integrationId: integration.id,
      ...mapping
    };
  }

  getDefaultOptions(mapping) {
    const {
      defaultOptions,
      type
    } = this.props;

    if (typeof defaultOptions !== 'object') {
      return defaultOptions;
    }

    const options = [...(defaultOptions !== null && defaultOptions !== void 0 ? defaultOptions : [])];

    if (!mapping || !(0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_9__.isExternalActorMapping)(mapping) || !mapping.sentryName) {
      return options;
    } // For organizations with >100 entries, we want to make sure their
    // saved mapping gets populated in the results if it wouldn't have
    // been in the initial 100 API results, which is why we add it here


    const mappingId = mapping[`${type}Id`];
    const isMappingInOptionsAlready = options.some(_ref => {
      let {
        value
      } = _ref;
      return mappingId && value === mappingId;
    });
    return isMappingInOptionsAlready ? options : [{
      value: mappingId,
      label: mapping.sentryName
    }, ...options];
  }

  get formFields() {
    const {
      dataEndpoint,
      isInline,
      mapping,
      mappingKey,
      onResults,
      sentryNamesMapper,
      type
    } = this.props;
    const fields = [{
      name: `${type}Id`,
      type: 'select_async',
      required: true,
      label: isInline ? undefined : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('Sentry [type]', {
        type: lodash_capitalize__WEBPACK_IMPORTED_MODULE_4___default()(type)
      }),
      placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)(`Select Sentry ${lodash_capitalize__WEBPACK_IMPORTED_MODULE_4___default()(type)}`),
      url: dataEndpoint,
      defaultOptions: this.getDefaultOptions(mapping),
      onResults: result => {
        onResults === null || onResults === void 0 ? void 0 : onResults(result, isInline ? mapping === null || mapping === void 0 ? void 0 : mapping.externalName : mappingKey);
        return sentryNamesMapper(result).map(sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_9__.sentryNameToOption);
      }
    }]; // We only add the field for externalName if it's the full (not inline) form

    if (!isInline) {
      fields.unshift({
        name: 'externalName',
        type: 'string',
        required: true,
        label: isInline ? undefined : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('External [type]', {
          type: lodash_capitalize__WEBPACK_IMPORTED_MODULE_4___default()(type)
        }),
        placeholder: type === 'user' ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('@username') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('@org/teamname')
      });
    }

    return fields;
  }

  get extraFormFieldProps() {
    const {
      isInline
    } = this.props;
    return isInline ? {
      // We need to submit the entire model since it could be a new one or an update
      getData: () => this.model.getData(),
      // We need to update the model onBlur for inline forms since the model's 'onPreSubmit' hook
      // does NOT run when using `saveOnBlur`.
      onBlur: () => this.updateModel()
    } : {
      flexibleControlStateSize: true
    };
  } // This function is necessary since the endpoint we submit to changes depending on the value selected


  updateModel() {
    const {
      getBaseFormEndpoint,
      mapping
    } = this.props;
    const updatedMapping = { ...mapping,
      ...this.model.getData()
    };

    if (updatedMapping) {
      const endpointDetails = (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_9__.getExternalActorEndpointDetails)(getBaseFormEndpoint(updatedMapping), updatedMapping);
      this.model.setFormOptions({ ...this.model.options,
        ...endpointDetails
      });
    }
  }

  render() {
    const {
      isInline,
      onCancel,
      onSubmitError,
      onSubmitSuccess
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(FormWrapper, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_6__["default"], {
        requireChanges: true,
        model: this.model,
        initialData: this.initialData,
        onCancel: onCancel,
        onSubmitSuccess: onSubmitSuccess,
        onSubmitError: onSubmitError,
        saveOnBlur: isInline,
        allowUndo: isInline,
        onPreSubmit: () => this.updateModel(),
        children: this.formFields.map(field => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_forms__WEBPACK_IMPORTED_MODULE_5__.FieldFromConfig, {
          field: field,
          inline: false,
          stacked: true,
          ...this.extraFormFieldProps
        }, field.name))
      })
    });
  }

}
IntegrationExternalMappingForm.displayName = "IntegrationExternalMappingForm";

// Prevents errors from appearing off the modal
const FormWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e184qk3m0"
} : 0)( true ? {
  name: "bjn8wh",
  styles: "position:relative"
} : 0);

/***/ }),

/***/ "./app/components/integrationExternalMappings.tsx":
/*!********************************************************!*\
  !*** ./app/components/integrationExternalMappings.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_capitalize__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/capitalize */ "../node_modules/lodash/capitalize.js");
/* harmony import */ var lodash_capitalize__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_capitalize__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_actions_menuItemActionLink__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/actions/menuItemActionLink */ "./app/components/actions/menuItemActionLink.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_dropdownLink__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/dropdownLink */ "./app/components/dropdownLink.tsx");
/* harmony import */ var sentry_components_integrationExternalMappingForm__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/integrationExternalMappingForm */ "./app/components/integrationExternalMappingForm.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_plugins_components_pluginIcon__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/plugins/components/pluginIcon */ "./app/plugins/components/pluginIcon.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

 // eslint-disable-next-line no-restricted-imports





















class IntegrationExternalMappings extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_7__["default"] {
  getDefaultState() {
    return { ...super.getDefaultState(),
      associationMappings: {},
      newlyAssociatedMappings: []
    };
  }

  getEndpoints() {
    const {
      organization,
      integration
    } = this.props;
    return [['associationMappings', `/organizations/${organization.slug}/codeowners-associations/`, {
      query: {
        provider: integration.provider.key
      }
    }]];
  }

  get isFirstPage() {
    const {
      cursor
    } = this.props.location.query;
    return cursor ? (cursor === null || cursor === void 0 ? void 0 : cursor.split(':')[1]) === '0' : true;
  }

  get unassociatedMappings() {
    const {
      type
    } = this.props;
    const {
      associationMappings
    } = this.state;
    const errorKey = `missing_external_${type}s`;
    const unassociatedMappings = Object.values(associationMappings).reduce((map, _ref) => {
      let {
        errors
      } = _ref;
      return new Set([...map, ...errors[errorKey]]);
    }, new Set());
    return Array.from(unassociatedMappings).map(externalName => ({
      externalName
    }));
  }

  get allMappings() {
    const {
      mappings
    } = this.props;

    if (!this.isFirstPage) {
      return mappings;
    }

    const {
      newlyAssociatedMappings
    } = this.state;
    const inlineMappings = this.unassociatedMappings.map(mapping => {
      // If this mapping has been changed, replace it with the new version from its change's response
      // The new version will be used in IntegrationExternalMappingForm to update the apiMethod and apiEndpoint
      const newlyAssociatedMapping = newlyAssociatedMappings.find(_ref2 => {
        let {
          externalName
        } = _ref2;
        return externalName === mapping.externalName;
      });
      return newlyAssociatedMapping !== null && newlyAssociatedMapping !== void 0 ? newlyAssociatedMapping : mapping;
    });
    return [...inlineMappings, ...mappings];
  }

  renderMappingName(mapping, hasAccess) {
    const {
      type,
      getBaseFormEndpoint,
      integration,
      dataEndpoint,
      sentryNamesMapper,
      onResults,
      defaultOptions
    } = this.props;
    const mappingName = (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_18__.isExternalActorMapping)(mapping) ? mapping.sentryName : '';
    return hasAccess ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_integrationExternalMappingForm__WEBPACK_IMPORTED_MODULE_10__["default"], {
      type: type,
      integration: integration,
      dataEndpoint: dataEndpoint,
      getBaseFormEndpoint: getBaseFormEndpoint,
      mapping: mapping,
      sentryNamesMapper: sentryNamesMapper,
      onResults: onResults,
      onSubmitSuccess: newMapping => {
        this.setState({
          newlyAssociatedMappings: [...this.state.newlyAssociatedMappings.filter(map => map.externalName !== newMapping.externalName), newMapping]
        });
      },
      isInline: true,
      defaultOptions: defaultOptions
    }) : mappingName;
  }

  renderMappingOptions(mapping, hasAccess) {
    const {
      type,
      onDelete
    } = this.props;
    return (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_18__.isExternalActorMapping)(mapping) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_13__["default"], {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('You must be an organization owner, manager or admin to make changes to an external user mapping.'),
      disabled: hasAccess,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_dropdownLink__WEBPACK_IMPORTED_MODULE_9__["default"], {
        anchorRight: true,
        customTitle: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"], {
          borderless: true,
          size: "sm",
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(IconEllipsisVertical, {
            size: "sm"
          }),
          disabled: !hasAccess,
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Actions'),
          "data-test-id": "mapping-option"
        }),
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_actions_menuItemActionLink__WEBPACK_IMPORTED_MODULE_6__["default"], {
          shouldConfirm: true,
          message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)(`Are you sure you want to remove this external ${type} mapping?`),
          disabled: !hasAccess,
          onAction: () => onDelete(mapping),
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)(`Delete External ${lodash_capitalize__WEBPACK_IMPORTED_MODULE_4___default()(type)}`),
          "data-test-id": "delete-mapping-button",
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(RedText, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Delete')
          })
        })
      })
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_13__["default"], {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)(`This ${type} mapping suggestion was generated from a CODEOWNERS file`),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"], {
        disabled: true,
        borderless: true,
        size: "sm",
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconQuestion, {
          size: "sm"
        }),
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)(`This ${type} mapping suggestion was generated from a CODEOWNERS file`),
        "data-test-id": "suggestion-option"
      })
    });
  }

  renderBody() {
    const {
      integration,
      type,
      onCreate,
      pageLinks
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelHeader, {
          disablePadding: true,
          hasButtons: true,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(HeaderLayout, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(ExternalNameColumn, {
              header: true,
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('External [type]', {
                type
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(ArrowColumn, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconArrow, {
                direction: "right",
                size: "md"
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(SentryNameColumn, {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('Sentry [type]', {
                type
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_5__["default"], {
              access: ['org:integrations'],
              children: _ref3 => {
                let {
                  hasAccess
                } = _ref3;
                return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(ButtonColumn, {
                  children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_13__["default"], {
                    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('You must be an organization owner, manager or admin to edit or remove a [type] mapping.', {
                      type
                    }),
                    disabled: hasAccess,
                    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(AddButton, {
                      "data-test-id": "add-mapping-button",
                      onClick: () => onCreate(),
                      size: "xs",
                      icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconAdd, {
                        size: "xs",
                        isCircled: true
                      }),
                      disabled: !hasAccess,
                      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(ButtonText, {
                        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('Add [type] Mapping', {
                          type
                        })
                      })
                    })
                  })
                });
              }
            })]
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelBody, {
          "data-test-id": "mapping-table",
          children: [!this.allMappings.length && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_19__["default"], {
            icon: (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_18__.getIntegrationIcon)(integration.provider.key, 'lg'),
            "data-test-id": "empty-message",
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('Set up External [type] Mappings.', {
              type: lodash_capitalize__WEBPACK_IMPORTED_MODULE_4___default()(type)
            })
          }), this.allMappings.map((mapping, index) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_5__["default"], {
            access: ['org:integrations'],
            children: _ref4 => {
              let {
                hasAccess
              } = _ref4;
              return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(ConfigPanelItem, {
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(Layout, {
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(ExternalNameColumn, {
                    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(StyledPluginIcon, {
                      pluginId: integration.provider.key,
                      size: 19
                    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("span", {
                      children: mapping.externalName
                    })]
                  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(ArrowColumn, {
                    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconArrow, {
                      direction: "right",
                      size: "md"
                    })
                  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(SentryNameColumn, {
                    children: this.renderMappingName(mapping, hasAccess)
                  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(ButtonColumn, {
                    children: this.renderMappingOptions(mapping, hasAccess)
                  })]
                })
              });
            }
          }, index))]
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_11__["default"], {
        pageLinks: pageLinks
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_3__.withRouter)(IntegrationExternalMappings));

const AddButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "e1hxzko412"
} : 0)( true ? {
  name: "1ilatzt",
  styles: "text-transform:capitalize;height:inherit"
} : 0);

const ButtonText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1hxzko411"
} : 0)( true ? {
  name: "2attqf",
  styles: "white-space:break-spaces"
} : 0);

const Layout = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1hxzko410"
} : 0)("display:grid;grid-column-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(1), ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(1), ";width:100%;align-items:center;grid-template-columns:2.25fr 50px 2.75fr 100px;grid-template-areas:'external-name arrow sentry-name button';" + ( true ? "" : 0));

const HeaderLayout = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Layout,  true ? {
  target: "e1hxzko49"
} : 0)("align-items:center;padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(1), " 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(2), ";text-transform:uppercase;" + ( true ? "" : 0));

const ConfigPanelItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelItem,  true ? {
  target: "e1hxzko48"
} : 0)("padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(1), ";" + ( true ? "" : 0));

const IconEllipsisVertical = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconEllipsis,  true ? {
  target: "e1hxzko47"
} : 0)( true ? {
  name: "jbgpyq",
  styles: "transform:rotate(90deg)"
} : 0);

const StyledPluginIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_plugins_components_pluginIcon__WEBPACK_IMPORTED_MODULE_16__["default"],  true ? {
  target: "e1hxzko46"
} : 0)("min-width:", p => p.size, "px;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(2), ";" + ( true ? "" : 0)); // Columns below


const Column = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1hxzko45"
} : 0)( true ? {
  name: "8w0o20",
  styles: "overflow:hidden;overflow-wrap:break-word"
} : 0);

const ExternalNameColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Column,  true ? {
  target: "e1hxzko44"
} : 0)("grid-area:external-name;display:flex;align-items:center;font-family:", p => p.header ? 'inherit' : p.theme.text.familyMono, ";" + ( true ? "" : 0));

const ArrowColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Column,  true ? {
  target: "e1hxzko43"
} : 0)( true ? {
  name: "1xav0ll",
  styles: "grid-area:arrow"
} : 0);

const SentryNameColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Column,  true ? {
  target: "e1hxzko42"
} : 0)( true ? {
  name: "16e1jaw",
  styles: "grid-area:sentry-name;overflow:visible"
} : 0);

const ButtonColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Column,  true ? {
  target: "e1hxzko41"
} : 0)( true ? {
  name: "ouy2zp",
  styles: "grid-area:button;text-align:right;overflow:visible"
} : 0);

const RedText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1hxzko40"
} : 0)("color:", p => p.theme.red300, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/repositoryProjectPathConfigForm.tsx":
/*!************************************************************!*\
  !*** ./app/components/repositoryProjectPathConfigForm.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ RepositoryProjectPathConfigForm)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_forms__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/forms */ "./app/components/forms/index.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







class RepositoryProjectPathConfigForm extends react__WEBPACK_IMPORTED_MODULE_0__.Component {
  get initialData() {
    const {
      existingConfig,
      integration
    } = this.props;
    return {
      defaultBranch: 'master',
      stackRoot: '',
      sourceRoot: '',
      repositoryId: existingConfig === null || existingConfig === void 0 ? void 0 : existingConfig.repoId,
      integrationId: integration.id,
      ...lodash_pick__WEBPACK_IMPORTED_MODULE_1___default()(existingConfig, ['projectId', 'defaultBranch', 'stackRoot', 'sourceRoot'])
    };
  }

  get formFields() {
    const {
      projects,
      repos,
      organization
    } = this.props;
    const orgSlug = organization.slug;
    const repoChoices = repos.map(_ref => {
      let {
        name,
        id
      } = _ref;
      return {
        value: id,
        label: name
      };
    });
    return [{
      name: 'projectId',
      type: 'sentry_project_selector',
      required: true,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Project'),
      projects
    }, {
      name: 'repositoryId',
      type: 'select_async',
      required: true,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Repo'),
      placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Choose repo'),
      url: `/organizations/${orgSlug}/repos/`,
      defaultOptions: repoChoices,
      onResults: results => results.map(sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_5__.sentryNameToOption)
    }, {
      name: 'defaultBranch',
      type: 'string',
      required: true,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Branch'),
      placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Type your branch'),
      showHelpInTooltip: true,
      help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('If an event does not have a release tied to a commit, we will use this branch when linking to your source code.')
    }, {
      name: 'stackRoot',
      type: 'string',
      required: false,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Stack Trace Root'),
      placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Type root path of your stack traces'),
      showHelpInTooltip: true,
      help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Any stack trace starting with this path will be mapped with this rule. An empty string will match all paths.')
    }, {
      name: 'sourceRoot',
      type: 'string',
      required: false,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Source Code Root'),
      placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Type root path of your source code, e.g. `src/`.'),
      showHelpInTooltip: true,
      help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('When a rule matches, the stack trace root is replaced with this path to get the path in your repository. Leaving this empty means replacing the stack trace root with an empty string.')
    }];
  }

  handlePreSubmit() {
    (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_5__.trackIntegrationAnalytics)('integrations.stacktrace_submit_config', {
      setup_type: 'manual',
      view: 'integration_configuration_detail',
      provider: this.props.integration.provider.key,
      organization: this.props.organization
    });
  }

  render() {
    const {
      organization,
      onSubmitSuccess,
      onCancel,
      existingConfig
    } = this.props; // endpoint changes if we are making a new row or updating an existing one

    const baseEndpoint = `/organizations/${organization.slug}/code-mappings/`;
    const endpoint = existingConfig ? `${baseEndpoint}${existingConfig.id}/` : baseEndpoint;
    const apiMethod = existingConfig ? 'PUT' : 'POST';
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_3__["default"], {
      onSubmitSuccess: onSubmitSuccess,
      onPreSubmit: () => this.handlePreSubmit(),
      initialData: this.initialData,
      apiEndpoint: endpoint,
      apiMethod: apiMethod,
      onCancel: onCancel,
      children: this.formFields.map(field => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_forms__WEBPACK_IMPORTED_MODULE_2__.FieldFromConfig, {
        field: field,
        inline: false,
        stacked: true,
        flexibleControlStateSize: true
      }, field.name))
    });
  }

}
RepositoryProjectPathConfigForm.displayName = "RepositoryProjectPathConfigForm";

/***/ }),

/***/ "./app/components/repositoryProjectPathConfigRow.tsx":
/*!***********************************************************!*\
  !*** ./app/components/repositoryProjectPathConfigRow.tsx ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ButtonColumn": () => (/* binding */ ButtonColumn),
/* harmony export */   "InputPathColumn": () => (/* binding */ InputPathColumn),
/* harmony export */   "NameRepoColumn": () => (/* binding */ NameRepoColumn),
/* harmony export */   "OutputPathColumn": () => (/* binding */ OutputPathColumn),
/* harmony export */   "default": () => (/* binding */ RepositoryProjectPathConfigRow)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/idBadge */ "./app/components/idBadge/index.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }












class RepositoryProjectPathConfigRow extends react__WEBPACK_IMPORTED_MODULE_1__.Component {
  render() {
    const {
      pathConfig,
      project,
      onEdit,
      onDelete
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_2__["default"], {
      access: ['org:integrations'],
      children: _ref => {
        let {
          hasAccess
        } = _ref;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(NameRepoColumn, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(ProjectRepoHolder, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(RepoName, {
                children: pathConfig.repoName
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(ProjectAndBranch, {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_5__["default"], {
                  project: project,
                  avatarSize: 14,
                  displayName: project.slug,
                  avatarProps: {
                    consistentWidth: true
                  }
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(BranchWrapper, {
                  children: ["\xA0|\xA0", pathConfig.defaultBranch]
                })]
              })]
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(OutputPathColumn, {
            children: pathConfig.sourceRoot
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(InputPathColumn, {
            children: pathConfig.stackRoot
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(ButtonColumn, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_6__["default"], {
              title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('You must be an organization owner, manager or admin to edit or remove a code mapping.'),
              disabled: hasAccess,
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(StyledButton, {
                size: "sm",
                icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconEdit, {
                  size: "sm"
                }),
                "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('edit'),
                disabled: !hasAccess,
                onClick: () => onEdit(pathConfig)
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_4__["default"], {
                disabled: !hasAccess,
                onConfirm: () => onDelete(pathConfig),
                message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Are you sure you want to remove this code mapping?'),
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(StyledButton, {
                  size: "sm",
                  icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconDelete, {
                    size: "sm"
                  }),
                  "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('delete'),
                  disabled: !hasAccess
                })
              })]
            })
          })]
        });
      }
    });
  }

}
RepositoryProjectPathConfigRow.displayName = "RepositoryProjectPathConfigRow";

const ProjectRepoHolder = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1b0hdd39"
} : 0)( true ? {
  name: "1fttcpj",
  styles: "display:flex;flex-direction:column"
} : 0);

const RepoName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(`span`,  true ? {
  target: "e1b0hdd38"
} : 0)("padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";" + ( true ? "" : 0));

const StyledButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e1b0hdd37"
} : 0)("margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(0.5), ";" + ( true ? "" : 0));

const ProjectAndBranch = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1b0hdd36"
} : 0)("display:flex;flex-direction:row;color:", p => p.theme.gray300, ";" + ( true ? "" : 0)); // match the line height of the badge


const BranchWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1b0hdd35"
} : 0)( true ? {
  name: "oid971",
  styles: "line-height:1.2"
} : 0); // Columns below


const Column = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1b0hdd34"
} : 0)( true ? {
  name: "8w0o20",
  styles: "overflow:hidden;overflow-wrap:break-word"
} : 0);

const NameRepoColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Column,  true ? {
  target: "e1b0hdd33"
} : 0)( true ? {
  name: "75sbk5",
  styles: "grid-area:name-repo"
} : 0);
const OutputPathColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Column,  true ? {
  target: "e1b0hdd32"
} : 0)( true ? {
  name: "13u5yj5",
  styles: "grid-area:output-path"
} : 0);
const InputPathColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Column,  true ? {
  target: "e1b0hdd31"
} : 0)( true ? {
  name: "ewbb63",
  styles: "grid-area:input-path"
} : 0);
const ButtonColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Column,  true ? {
  target: "e1b0hdd30"
} : 0)( true ? {
  name: "1dm7zwj",
  styles: "grid-area:button;text-align:right"
} : 0);

/***/ }),

/***/ "./app/views/organizationIntegrations/addIntegration.tsx":
/*!***************************************************************!*\
  !*** ./app/views/organizationIntegrations/addIntegration.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AddIntegration)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");







class AddIntegration extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "dialog", null);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "openDialog", urlParams => {
      const {
        account,
        analyticsParams,
        modalParams,
        organization,
        provider
      } = this.props;
      (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_6__.trackIntegrationAnalytics)('integrations.installation_start', {
        integration: provider.key,
        integration_type: 'first_party',
        organization,
        ...analyticsParams
      });
      const name = 'sentryAddIntegration';
      const {
        url,
        width,
        height
      } = provider.setupDialog;
      const {
        left,
        top
      } = this.computeCenteredWindow(width, height);
      let query = { ...urlParams
      };

      if (account) {
        query.account = account;
      }

      if (modalParams) {
        query = { ...query,
          ...modalParams
        };
      }

      const installUrl = `${url}?${query_string__WEBPACK_IMPORTED_MODULE_3__.stringify(query)}`;
      const opts = `scrollbars=yes,width=${width},height=${height},top=${top},left=${left}`;
      this.dialog = window.open(installUrl, name, opts);
      this.dialog && this.dialog.focus();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "didReceiveMessage", message => {
      const {
        analyticsParams,
        onInstall,
        organization,
        provider
      } = this.props;

      if (message.origin !== document.location.origin) {
        return;
      }

      if (message.source !== this.dialog) {
        return;
      }

      const {
        success,
        data
      } = message.data;
      this.dialog = null;

      if (!success) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)(data.error);
        return;
      }

      if (!data) {
        return;
      }

      (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_6__.trackIntegrationAnalytics)('integrations.installation_complete', {
        integration: provider.key,
        integration_type: 'first_party',
        organization,
        ...analyticsParams
      });
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('%s added', provider.name));
      onInstall(data);
    });
  }

  componentDidMount() {
    window.addEventListener('message', this.didReceiveMessage);
  }

  componentWillUnmount() {
    window.removeEventListener('message', this.didReceiveMessage);
    this.dialog && this.dialog.close();
  }

  computeCenteredWindow(width, height) {
    // Taken from: https://stackoverflow.com/questions/4068373/center-a-popup-window-on-screen
    const screenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
    const screenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;
    const innerWidth = window.innerWidth ? window.innerWidth : document.documentElement.clientWidth ? document.documentElement.clientWidth : screen.width;
    const innerHeight = window.innerHeight ? window.innerHeight : document.documentElement.clientHeight ? document.documentElement.clientHeight : screen.height;
    const left = innerWidth / 2 - width / 2 + screenLeft;
    const top = innerHeight / 2 - height / 2 + screenTop;
    return {
      left,
      top
    };
  }

  render() {
    const {
      children
    } = this.props;
    return children(this.openDialog);
  }

}
AddIntegration.displayName = "AddIntegration";

/***/ }),

/***/ "./app/views/organizationIntegrations/integrationAlertRules.tsx":
/*!**********************************************************************!*\
  !*** ./app/views/organizationIntegrations/integrationAlertRules.tsx ***!
  \**********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/idBadge/projectBadge */ "./app/components/idBadge/projectBadge.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }











const IntegrationAlertRules = _ref => {
  let {
    projects,
    organization
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.Panel, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.PanelHeader, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Project Configuration')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.PanelBody, {
      children: [projects.length === 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_7__["default"], {
        size: "large",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('You have no projects to add Alert Rules to')
      }), projects.map(project => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(ProjectItem, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_2__["default"], {
          project: project,
          avatarSize: 16
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"], {
          to: `/organizations/${organization.slug}/alerts/${project.slug}/wizard/`,
          size: "xs",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Add Alert Rule')
        })]
      }, project.slug))]
    })]
  });
};

IntegrationAlertRules.displayName = "IntegrationAlertRules";

const ProjectItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.PanelItem,  true ? {
  target: "ewafxrk0"
} : 0)( true ? {
  name: "1tz8p38",
  styles: "align-items:center;justify-content:space-between"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_5__["default"])((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_6__["default"])(IntegrationAlertRules)));

/***/ }),

/***/ "./app/views/organizationIntegrations/integrationCodeMappings.tsx":
/*!************************************************************************!*\
  !*** ./app/views/organizationIntegrations/integrationCodeMappings.tsx ***!
  \************************************************************************/
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
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_repositoryProjectPathConfigForm__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/repositoryProjectPathConfigForm */ "./app/components/repositoryProjectPathConfigForm.tsx");
/* harmony import */ var sentry_components_repositoryProjectPathConfigRow__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/repositoryProjectPathConfigRow */ "./app/components/repositoryProjectPathConfigRow.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




























class IntegrationCodeMappings extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_9__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDelete", async pathConfig => {
      const {
        organization
      } = this.props;
      const endpoint = `/organizations/${organization.slug}/code-mappings/${pathConfig.id}/`;

      try {
        await this.api.requestPromise(endpoint, {
          method: 'DELETE'
        }); // remove config and update state

        let {
          pathConfigs
        } = this.state;
        pathConfigs = pathConfigs.filter(config => config.id !== pathConfig.id);
        this.setState({
          pathConfigs
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Deletion successful'));
      } catch (err) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.tct)('[status]: [text]', {
          status: err.statusText,
          text: err.responseText
        }));
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmitSuccess", pathConfig => {
      (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_20__.trackIntegrationAnalytics)('integrations.stacktrace_complete_setup', {
        setup_type: 'manual',
        view: 'integration_configuration_detail',
        provider: this.props.integration.provider.key,
        organization: this.props.organization
      });
      let {
        pathConfigs
      } = this.state;
      pathConfigs = pathConfigs.filter(config => config.id !== pathConfig.id); // our getter handles the order of the configs

      pathConfigs = pathConfigs.concat([pathConfig]);
      this.setState({
        pathConfigs
      });
      this.setState({
        pathConfig: undefined
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "openModal", pathConfig => {
      const {
        organization,
        projects,
        integration
      } = this.props;
      (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_20__.trackIntegrationAnalytics)('integrations.stacktrace_start_setup', {
        setup_type: 'manual',
        view: 'integration_configuration_detail',
        provider: this.props.integration.provider.key,
        organization: this.props.organization
      });
      (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_7__.openModal)(_ref => {
        let {
          Body,
          Header,
          closeModal
        } = _ref;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(Header, {
            closeButton: true,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Configure code path mapping')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(Body, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_repositoryProjectPathConfigForm__WEBPACK_IMPORTED_MODULE_14__["default"], {
              organization: organization,
              integration: integration,
              projects: projects,
              repos: this.repos,
              onSubmitSuccess: config => {
                this.handleSubmitSuccess(config);
                closeModal();
              },
              existingConfig: pathConfig,
              onCancel: closeModal
            })
          })]
        });
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleCursor", async (cursor, _path, query, _direction) => {
      const orgSlug = this.props.organization.slug;
      const [pathConfigs, _, responseMeta] = await this.api.requestPromise(`/organizations/${orgSlug}/code-mappings/`, {
        includeAllArgs: true,
        query: { ...query,
          cursor
        }
      });
      this.setState({
        pathConfigs,
        pathConfigsPageLinks: responseMeta === null || responseMeta === void 0 ? void 0 : responseMeta.getResponseHeader('link')
      });
    });
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      pathConfigs: [],
      repos: []
    };
  }

  get integrationId() {
    return this.props.integration.id;
  }

  get pathConfigs() {
    // we want to sort by the project slug and the
    // id of the config
    return lodash_sortBy__WEBPACK_IMPORTED_MODULE_4___default()(this.state.pathConfigs, [_ref2 => {
      let {
        projectSlug
      } = _ref2;
      return projectSlug;
    }, _ref3 => {
      let {
        id
      } = _ref3;
      return parseInt(id, 10);
    }]);
  }

  get repos() {
    // endpoint doesn't support loading only the repos for this integration
    // but most people only have one source code repo so this should be fine
    return this.state.repos.filter(repo => repo.integrationId === this.integrationId);
  }

  getEndpoints() {
    const orgSlug = this.props.organization.slug;
    return [['pathConfigs', `/organizations/${orgSlug}/code-mappings/`, {
      query: {
        integrationId: this.integrationId
      }
    }], ['repos', `/organizations/${orgSlug}/repos/`, {
      query: {
        status: 'active'
      }
    }]];
  }

  getMatchingProject(pathConfig) {
    return this.props.projects.find(project => project.id === pathConfig.projectId);
  }

  componentDidMount() {
    const {
      referrer
    } = query_string__WEBPACK_IMPORTED_MODULE_5__.parse(window.location.search) || {}; // We don't start new session if the user was coming from choosing
    // the manual setup option flow from the issue details page

    const startSession = referrer === 'stacktrace-issue-details' ? false : true;
    (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_20__.trackIntegrationAnalytics)('integrations.code_mappings_viewed', {
      integration: this.props.integration.provider.key,
      integration_type: 'first_party',
      organization: this.props.organization
    }, {
      startSession
    });
  }

  renderBody() {
    const pathConfigs = this.pathConfigs;
    const {
      integration
    } = this.props;
    const {
      pathConfigsPageLinks
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_24__["default"], {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.tct)(`Code Mappings are used to map stack trace file paths to source code file paths. These mappings are the basis for features like Stack Trace Linking. To learn more, [link: read the docs].`, {
          link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_11__["default"], {
            href: "https://docs.sentry.io/product/integrations/source-code-mgmt/gitlab/#stack-trace-linking"
          })
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__.PanelHeader, {
          disablePadding: true,
          hasButtons: true,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(HeaderLayout, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_repositoryProjectPathConfigRow__WEBPACK_IMPORTED_MODULE_15__.NameRepoColumn, {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Code Mappings')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_repositoryProjectPathConfigRow__WEBPACK_IMPORTED_MODULE_15__.InputPathColumn, {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Stack Trace Root')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_repositoryProjectPathConfigRow__WEBPACK_IMPORTED_MODULE_15__.OutputPathColumn, {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Source Code Root')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_8__["default"], {
              access: ['org:integrations'],
              children: _ref4 => {
                let {
                  hasAccess
                } = _ref4;
                return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_repositoryProjectPathConfigRow__WEBPACK_IMPORTED_MODULE_15__.ButtonColumn, {
                  children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_16__["default"], {
                    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('You must be an organization owner, manager or admin to edit or remove a code mapping.'),
                    disabled: hasAccess,
                    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_10__["default"], {
                      "data-test-id": "add-mapping-button",
                      onClick: () => this.openModal(),
                      size: "xs",
                      icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_17__.IconAdd, {
                        size: "xs",
                        isCircled: true
                      }),
                      disabled: !hasAccess,
                      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Add Code Mapping')
                    })
                  })
                });
              }
            })]
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__.PanelBody, {
          children: [pathConfigs.length === 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_23__["default"], {
            icon: (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_20__.getIntegrationIcon)(integration.provider.key, 'lg'),
            action: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_10__["default"], {
              href: `https://docs.sentry.io/product/integrations/${integration.provider.key}/#stack-trace-linking`,
              size: "sm",
              onClick: () => {
                (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_20__.trackIntegrationAnalytics)('integrations.stacktrace_docs_clicked', {
                  view: 'integration_configuration_detail',
                  provider: this.props.integration.provider.key,
                  organization: this.props.organization
                });
              },
              children: "View Documentation"
            }),
            children: "Set up stack trace linking by adding a code mapping."
          }), pathConfigs.map(pathConfig => {
            const project = this.getMatchingProject(pathConfig); // this should never happen since our pathConfig would be deleted
            // if project was deleted

            if (!project) {
              return null;
            }

            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(ConfigPanelItem, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(Layout, {
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_repositoryProjectPathConfigRow__WEBPACK_IMPORTED_MODULE_15__["default"], {
                  pathConfig: pathConfig,
                  project: project,
                  onEdit: this.openModal,
                  onDelete: this.handleDelete
                })
              })
            }, pathConfig.id);
          }).filter(item => !!item)]
        })]
      }), pathConfigsPageLinks && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_12__["default"], {
        pageLinks: pathConfigsPageLinks,
        onCursor: this.handleCursor
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_22__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_21__["default"])(IntegrationCodeMappings)));

const Layout = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "el6tkql2"
} : 0)("display:grid;grid-column-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_19__["default"])(1), ";width:100%;align-items:center;grid-template-columns:4.5fr 2.5fr 2.5fr max-content;grid-template-areas:'name-repo input-path output-path button';" + ( true ? "" : 0));

const HeaderLayout = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(Layout,  true ? {
  target: "el6tkql1"
} : 0)("align-items:center;margin:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_19__["default"])(1), " 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_19__["default"])(2), ";" + ( true ? "" : 0));

const ConfigPanelItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__.PanelItem,  true ? {
  target: "el6tkql0"
} : 0)( true ? "" : 0);

/***/ }),

/***/ "./app/views/organizationIntegrations/integrationExternalTeamMappings.tsx":
/*!********************************************************************************!*\
  !*** ./app/views/organizationIntegrations/integrationExternalTeamMappings.tsx ***!
  \********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_uniqBy__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/uniqBy */ "../node_modules/lodash/uniqBy.js");
/* harmony import */ var lodash_uniqBy__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_uniqBy__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_integrationExternalMappingForm__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/integrationExternalMappingForm */ "./app/components/integrationExternalMappingForm.tsx");
/* harmony import */ var sentry_components_integrationExternalMappings__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/integrationExternalMappings */ "./app/components/integrationExternalMappings.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



 // eslint-disable-next-line no-restricted-imports














class IntegrationExternalTeamMappings extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_8__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDelete", async mapping => {
      try {
        const {
          organization
        } = this.props;
        const {
          teams
        } = this.state;
        const team = teams.find(item => item.id === mapping.teamId);

        if (!team) {
          throw new Error('Cannot find correct team slug.');
        }

        const endpoint = `/teams/${organization.slug}/${team.slug}/external-teams/${mapping.id}/`;
        await this.api.requestPromise(endpoint, {
          method: 'DELETE'
        }); // remove config and update state

        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Deletion successful'));
        this.fetchData();
      } catch {
        // no 4xx errors should happen on delete
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('An error occurred'));
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmitSuccess", () => {
      this.fetchData();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "modalMappingKey", '__MODAL_RESULTS__');

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "combineResultsById", (resultList1, resultList2) => {
      return lodash_uniqBy__WEBPACK_IMPORTED_MODULE_5___default()([...resultList1, ...resultList2], 'id');
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleResults", (results, mappingKey) => {
      if (mappingKey) {
        var _queryResults$mapping;

        const {
          queryResults
        } = this.state;
        this.setState({
          queryResults: { ...queryResults,
            // Ensure we always have a team to pull the slug from
            [mappingKey]: this.combineResultsById(results, (_queryResults$mapping = queryResults[mappingKey]) !== null && _queryResults$mapping !== void 0 ? _queryResults$mapping : [])
          }
        });
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "openModal", mapping => {
      const {
        integration
      } = this.props;
      (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_7__.openModal)(_ref => {
        let {
          Body,
          Header,
          closeModal
        } = _ref;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(Header, {
            closeButton: true,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Configure External Team Mapping')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(Body, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_integrationExternalMappingForm__WEBPACK_IMPORTED_MODULE_9__["default"], {
              type: "team",
              integration: integration,
              dataEndpoint: this.dataEndpoint,
              getBaseFormEndpoint: map => this.getBaseFormEndpoint(map),
              defaultOptions: this.defaultTeamOptions,
              mapping: mapping,
              mappingKey: this.modalMappingKey,
              sentryNamesMapper: this.sentryNamesMapper,
              onCancel: closeModal,
              onResults: this.handleResults,
              onSubmitSuccess: () => {
                this.handleSubmitSuccess();
                closeModal();
              }
            })
          })]
        });
      });
    });
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      teams: [],
      initialResults: [],
      queryResults: {}
    };
  }

  getEndpoints() {
    const {
      organization,
      location
    } = this.props;
    return [// We paginate on this query, since we're filtering by hasExternalTeams:true
    ['teams', `/organizations/${organization.slug}/teams/`, {
      query: { ...(location === null || location === void 0 ? void 0 : location.query),
        query: 'hasExternalTeams:true'
      }
    }], // We use this query as defaultOptions to reduce identical API calls
    ['initialResults', `/organizations/${organization.slug}/teams/`]];
  }

  get mappings() {
    const {
      integration
    } = this.props;
    const {
      teams
    } = this.state;
    const externalTeamMappings = teams.reduce((acc, team) => {
      const {
        externalTeams
      } = team;
      acc.push(...externalTeams.filter(externalTeam => externalTeam.provider === integration.provider.key).map(externalTeam => ({ ...externalTeam,
        sentryName: team.slug
      })));
      return acc;
    }, []);
    return externalTeamMappings.sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));
  }

  get dataEndpoint() {
    const {
      organization
    } = this.props;
    return `/organizations/${organization.slug}/teams/`;
  }

  get defaultTeamOptions() {
    const {
      initialResults
    } = this.state;
    return this.sentryNamesMapper(initialResults).map(sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_12__.sentryNameToOption);
  }

  getBaseFormEndpoint(mapping) {
    var _queryResults$mapping2, _fieldResults$find, _team$slug;

    if (!mapping) {
      return '';
    }

    const {
      organization
    } = this.props;
    const {
      queryResults,
      initialResults
    } = this.state;
    const fieldResults = (_queryResults$mapping2 = queryResults[mapping.externalName]) !== null && _queryResults$mapping2 !== void 0 ? _queryResults$mapping2 : queryResults[this.modalMappingKey];
    const team = // First, search for the team in the query results...
    (_fieldResults$find = fieldResults === null || fieldResults === void 0 ? void 0 : fieldResults.find(item => item.id === mapping.teamId)) !== null && _fieldResults$find !== void 0 ? _fieldResults$find : // Then in the initial results, if nothing was found.
    initialResults === null || initialResults === void 0 ? void 0 : initialResults.find(item => item.id === mapping.teamId);
    return `/teams/${organization.slug}/${(_team$slug = team === null || team === void 0 ? void 0 : team.slug) !== null && _team$slug !== void 0 ? _team$slug : ''}/external-teams/`;
  }

  sentryNamesMapper(teams) {
    return teams.map(_ref2 => {
      let {
        id,
        slug
      } = _ref2;
      return {
        id,
        name: slug
      };
    });
  }
  /**
   * This method combines the results from searches made on a form dropping repeated entries
   * that have identical 'id's. This is because we need the result of the the search query when
   * the user submits to get the team slug, but it won't always be the last query they've made.
   *
   * If they search (but not select) after making a selection, and we didn't keep a running collection of results,
   * we wouldn't have the team to generate the endpoint from.
   */


  renderBody() {
    const {
      integration,
      organization
    } = this.props;
    const {
      teamsPageLinks
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_integrationExternalMappings__WEBPACK_IMPORTED_MODULE_10__["default"], {
      type: "team",
      integration: integration,
      organization: organization,
      mappings: this.mappings,
      dataEndpoint: this.dataEndpoint,
      getBaseFormEndpoint: mapping => this.getBaseFormEndpoint(mapping),
      defaultOptions: this.defaultTeamOptions,
      sentryNamesMapper: this.sentryNamesMapper,
      onCreate: this.openModal,
      onDelete: this.handleDelete,
      pageLinks: teamsPageLinks,
      onResults: this.handleResults
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_4__.withRouter)((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_13__["default"])(IntegrationExternalTeamMappings)));

/***/ }),

/***/ "./app/views/organizationIntegrations/integrationExternalUserMappings.tsx":
/*!********************************************************************************!*\
  !*** ./app/views/organizationIntegrations/integrationExternalUserMappings.tsx ***!
  \********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_integrationExternalMappingForm__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/integrationExternalMappingForm */ "./app/components/integrationExternalMappingForm.tsx");
/* harmony import */ var sentry_components_integrationExternalMappings__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/integrationExternalMappings */ "./app/components/integrationExternalMappings.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


 // eslint-disable-next-line no-restricted-imports













class IntegrationExternalUserMappings extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_6__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDelete", async mapping => {
      const {
        organization
      } = this.props;

      try {
        await this.api.requestPromise(`/organizations/${organization.slug}/external-users/${mapping.id}/`, {
          method: 'DELETE'
        }); // remove config and update state

        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Deletion successful'));
        this.fetchData();
      } catch {
        // no 4xx errors should happen on delete
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('An error occurred'));
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmitSuccess", () => {
      // Don't bother updating state. The info is in array of objects for each object in another array of objects.
      // Easier and less error-prone to re-fetch the data and re-calculate state.
      this.fetchData();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "openModal", mapping => {
      const {
        integration
      } = this.props;
      (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_5__.openModal)(_ref => {
        let {
          Body,
          Header,
          closeModal
        } = _ref;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(Header, {
            closeButton: true,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Configure External User Mapping')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(Body, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_integrationExternalMappingForm__WEBPACK_IMPORTED_MODULE_7__["default"], {
              type: "user",
              integration: integration,
              dataEndpoint: this.dataEndpoint,
              getBaseFormEndpoint: () => this.baseFormEndpoint,
              defaultOptions: this.defaultUserOptions,
              mapping: mapping,
              sentryNamesMapper: this.sentryNamesMapper,
              onCancel: closeModal,
              onSubmitSuccess: () => {
                this.handleSubmitSuccess();
                closeModal();
              }
            })
          })]
        });
      });
    });
  }

  getEndpoints() {
    const {
      organization
    } = this.props;
    return [// We paginate on this query, since we're filtering by hasExternalUsers:true
    ['members', `/organizations/${organization.slug}/members/`, {
      query: {
        query: 'hasExternalUsers:true',
        expand: 'externalUsers'
      }
    }], // We use this query as defaultOptions to reduce identical API calls
    ['initialResults', `/organizations/${organization.slug}/members/`]];
  }

  get mappings() {
    const {
      integration
    } = this.props;
    const {
      members
    } = this.state;
    const externalUserMappings = members.reduce((acc, member) => {
      const {
        externalUsers,
        user
      } = member;
      acc.push(...externalUsers.filter(externalUser => externalUser.provider === integration.provider.key).map(externalUser => ({ ...externalUser,
        sentryName: user.name
      })));
      return acc;
    }, []);
    return externalUserMappings.sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));
  }

  get dataEndpoint() {
    const {
      organization
    } = this.props;
    return `/organizations/${organization.slug}/members/`;
  }

  get baseFormEndpoint() {
    const {
      organization
    } = this.props;
    return `/organizations/${organization.slug}/external-users/`;
  }

  get defaultUserOptions() {
    const {
      initialResults
    } = this.state;
    return this.sentryNamesMapper(initialResults).map(sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_10__.sentryNameToOption);
  }

  sentryNamesMapper(members) {
    return members.filter(member => member.user).map(_ref2 => {
      let {
        user: {
          id
        },
        email,
        name
      } = _ref2;
      const label = email !== name ? `${name} - ${email}` : `${email}`;
      return {
        id,
        name: label
      };
    });
  }

  renderBody() {
    const {
      integration,
      organization
    } = this.props;
    const {
      membersPageLinks
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_integrationExternalMappings__WEBPACK_IMPORTED_MODULE_8__["default"], {
        type: "user",
        integration: integration,
        organization: organization,
        mappings: this.mappings,
        dataEndpoint: this.dataEndpoint,
        getBaseFormEndpoint: () => this.baseFormEndpoint,
        defaultOptions: this.defaultUserOptions,
        sentryNamesMapper: this.sentryNamesMapper,
        onCreate: this.openModal,
        onDelete: this.handleDelete,
        pageLinks: membersPageLinks
      })
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_3__.withRouter)((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_11__["default"])(IntegrationExternalUserMappings)));

/***/ }),

/***/ "./app/views/organizationIntegrations/integrationMainSettings.tsx":
/*!************************************************************************!*\
  !*** ./app/views/organizationIntegrations/integrationMainSettings.tsx ***!
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
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/jsonForm */ "./app/components/forms/jsonForm.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









class IntegrationMainSettings extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      integration: this.props.integration
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmitSuccess", data => {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Integration updated.'));
      this.props.onUpdate();
      this.setState({
        integration: data
      });
    });
  }

  get initialData() {
    const {
      integration
    } = this.props;
    return {
      name: integration.name,
      domain: integration.domainName || ''
    };
  }

  get formFields() {
    const fields = [{
      name: 'name',
      type: 'string',
      required: false,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Integration Name')
    }, {
      name: 'domain',
      type: 'string',
      required: false,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Full URL')
    }];
    return fields;
  }

  render() {
    const {
      integration
    } = this.state;
    const {
      organization
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_4__["default"], {
      initialData: this.initialData,
      apiMethod: "PUT",
      apiEndpoint: `/organizations/${organization.slug}/integrations/${integration.id}/`,
      onSubmitSuccess: this.handleSubmitSuccess,
      submitLabel: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Save Settings'),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_5__["default"], {
        fields: this.formFields
      })
    });
  }

}

IntegrationMainSettings.displayName = "IntegrationMainSettings";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (IntegrationMainSettings);

/***/ }),

/***/ "./app/views/organizationIntegrations/integrationRepos.tsx":
/*!*****************************************************************!*\
  !*** ./app/views/organizationIntegrations/integrationRepos.tsx ***!
  \*****************************************************************/
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
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_actionCreators_integrations__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/integrations */ "./app/actionCreators/integrations.tsx");
/* harmony import */ var sentry_actions_repositoryActions__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actions/repositoryActions */ "./app/actions/repositoryActions.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_dropdownAutoComplete__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/dropdownAutoComplete */ "./app/components/dropdownAutoComplete/index.tsx");
/* harmony import */ var sentry_components_dropdownButton__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/dropdownButton */ "./app/components/dropdownButton.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_repositoryRow__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/repositoryRow */ "./app/components/repositoryRow.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");























class IntegrationRepos extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_8__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onRepositoryChange", data => {
      const itemList = this.state.itemList;
      itemList.forEach(item => {
        if (item.id === data.id) {
          item.status = data.status; // allow for custom scm repositories to be updated, and
          // url is optional and therefore can be an empty string

          item.url = data.url === undefined ? item.url : data.url;
          item.name = data.name || item.name;
        }
      });
      this.setState({
        itemList
      });
      sentry_actions_repositoryActions__WEBPACK_IMPORTED_MODULE_6__["default"].resetRepositories();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "debouncedSearchRepositoriesRequest", lodash_debounce__WEBPACK_IMPORTED_MODULE_4___default()(query => this.searchRepositoriesRequest(query), 200));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "searchRepositoriesRequest", searchQuery => {
      const orgId = this.props.organization.slug;
      const query = {
        search: searchQuery
      };
      const endpoint = `/organizations/${orgId}/integrations/${this.props.integration.id}/repos/`;
      return this.api.request(endpoint, {
        method: 'GET',
        query,
        success: data => {
          this.setState({
            integrationRepos: data,
            dropdownBusy: false
          });
        },
        error: () => {
          this.setState({
            dropdownBusy: false
          });
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSearchRepositories", e => {
      this.setState({
        dropdownBusy: true
      });
      this.debouncedSearchRepositoriesRequest(e.target.value);
    });
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      adding: false,
      itemList: [],
      integrationRepos: {
        repos: [],
        searchable: false
      },
      dropdownBusy: false
    };
  }

  getEndpoints() {
    const orgId = this.props.organization.slug;
    return [['itemList', `/organizations/${orgId}/repos/`, {
      query: {
        status: ''
      }
    }], ['integrationRepos', `/organizations/${orgId}/integrations/${this.props.integration.id}/repos/`]];
  }

  getIntegrationRepos() {
    const integrationId = this.props.integration.id;
    return this.state.itemList.filter(repo => repo.integrationId === integrationId);
  } // Called by row to signal repository change.


  addRepo(selection) {
    const {
      integration
    } = this.props;
    const {
      itemList
    } = this.state;
    const orgId = this.props.organization.slug;
    this.setState({
      adding: true
    });
    const migratableRepo = itemList.filter(item => {
      if (!(selection.value && item.externalSlug)) {
        return false;
      }

      return selection.value === item.externalSlug;
    })[0];
    let promise;

    if (migratableRepo) {
      promise = (0,sentry_actionCreators_integrations__WEBPACK_IMPORTED_MODULE_5__.migrateRepository)(this.api, orgId, migratableRepo.id, integration);
    } else {
      promise = (0,sentry_actionCreators_integrations__WEBPACK_IMPORTED_MODULE_5__.addRepository)(this.api, orgId, selection.value, integration);
    }

    promise.then(repo => {
      this.setState({
        adding: false,
        itemList: itemList.concat(repo)
      });
      sentry_actions_repositoryActions__WEBPACK_IMPORTED_MODULE_6__["default"].resetRepositories();
    }, () => this.setState({
      adding: false
    }));
  }

  renderDropdown() {
    const access = new Set(this.props.organization.access);

    if (!access.has('org:integrations')) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_dropdownButton__WEBPACK_IMPORTED_MODULE_11__["default"], {
        disabled: true,
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('You must be an organization owner, manager or admin to add repositories'),
        isOpen: false,
        size: "xs",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Add Repository')
      });
    }

    const repositories = new Set(this.state.itemList.filter(item => item.integrationId).map(i => i.externalSlug));
    const repositoryOptions = (this.state.integrationRepos.repos || []).filter(repo => !repositories.has(repo.identifier));
    const items = repositoryOptions.map(repo => ({
      searchKey: repo.name,
      value: repo.identifier,
      label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(StyledListElement, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(StyledName, {
          children: repo.name
        })
      })
    }));

    const menuHeader = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(StyledReposLabel, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Repositories')
    });

    const onChange = this.state.integrationRepos.searchable ? this.handleSearchRepositories : undefined;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_dropdownAutoComplete__WEBPACK_IMPORTED_MODULE_10__["default"], {
      items: items,
      onSelect: this.addRepo.bind(this),
      onChange: onChange,
      menuHeader: menuHeader,
      emptyMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('No repositories available'),
      noResultsMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('No repositories found'),
      busy: this.state.dropdownBusy,
      alignMenu: "right",
      children: _ref => {
        let {
          isOpen
        } = _ref;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_dropdownButton__WEBPACK_IMPORTED_MODULE_11__["default"], {
          isOpen: isOpen,
          size: "xs",
          busy: this.state.adding,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Add Repository')
        });
      }
    });
  }

  renderError(error) {
    const badRequest = Object.values(this.state.errors).find(resp => resp && resp.status === 400);

    if (badRequest) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_7__["default"], {
        type: "error",
        showIcon: true,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('We were unable to fetch repositories for this integration. Try again later. If this error continues, please reconnect this integration by uninstalling and then reinstalling.')
      });
    }

    return super.renderError(error);
  }

  renderBody() {
    const {
      itemListPageLinks
    } = this.state;
    const orgId = this.props.organization.slug;
    const itemList = this.getIntegrationRepos() || [];

    const header = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__.PanelHeader, {
      disablePadding: true,
      hasButtons: true,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(HeaderText, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Repositories')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(DropdownWrapper, {
        children: this.renderDropdown()
      })]
    });

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__.Panel, {
        children: [header, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__.PanelBody, {
          children: [itemList.length === 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_19__["default"], {
            icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_15__.IconCommit, {}),
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Sentry is better with commit data'),
            description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Add a repository to begin tracking its commit data. Then, set up release tracking to unlock features like suspect commits, suggested issue owners, and deploy emails.'),
            action: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_9__["default"], {
              href: "https://docs.sentry.io/product/releases/",
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Learn More')
            })
          }), itemList.map(repo => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_repositoryRow__WEBPACK_IMPORTED_MODULE_14__["default"], {
            api: this.api,
            repository: repo,
            orgId: orgId,
            onRepositoryChange: this.onRepositoryChange
          }, repo.id))]
        })]
      }), itemListPageLinks && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_12__["default"], {
        pageLinks: itemListPageLinks,
        ...this.props
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_18__["default"])(IntegrationRepos));

const HeaderText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e14eb1ye4"
} : 0)("padding-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(2), ";flex:1;" + ( true ? "" : 0));

const DropdownWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e14eb1ye3"
} : 0)("padding-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(1), ";text-transform:none;" + ( true ? "" : 0));

const StyledReposLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e14eb1ye2"
} : 0)("width:250px;font-size:0.875em;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(1), " 0;text-transform:uppercase;" + ( true ? "" : 0));

const StyledListElement = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e14eb1ye1"
} : 0)("display:flex;align-items:center;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(0.5), ";" + ( true ? "" : 0));

const StyledName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e14eb1ye0"
} : 0)("flex-shrink:1;min-width:0;", p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/organizationIntegrations/integrationServerlessFunctions.tsx":
/*!*******************************************************************************!*\
  !*** ./app/views/organizationIntegrations/integrationServerlessFunctions.tsx ***!
  \*******************************************************************************/
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
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var _integrationServerlessRow__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./integrationServerlessRow */ "./app/views/organizationIntegrations/integrationServerlessRow.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

// eslint-disable-next-line simple-import-sort/imports












class IntegrationServerlessFunctions extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_4__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleFunctionUpdate", (serverlessFunctionUpdate, index) => {
      const serverlessFunctions = [...this.serverlessFunctions];
      const serverlessFunction = { ...serverlessFunctions[index],
        ...serverlessFunctionUpdate
      };
      serverlessFunctions[index] = serverlessFunction;
      this.setState({
        serverlessFunctions
      });
    });
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      serverlessFunctions: []
    };
  }

  getEndpoints() {
    const orgSlug = this.props.organization.slug;
    return [['serverlessFunctions', `/organizations/${orgSlug}/integrations/${this.props.integration.id}/serverless-functions/`]];
  }

  get serverlessFunctions() {
    return this.state.serverlessFunctions;
  }

  onLoadAllEndpointsSuccess() {
    (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_10__.trackIntegrationAnalytics)('integrations.serverless_functions_viewed', {
      integration: this.props.integration.provider.key,
      integration_type: 'first_party',
      num_functions: this.serverlessFunctions.length,
      organization: this.props.organization
    });
  }

  renderBody() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_7__["default"], {
        type: "info",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Manage your AWS Lambda functions below. Only Node and Python runtimes are currently supported.')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(StyledPanelHeader, {
          disablePadding: true,
          hasButtons: true,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(NameHeader, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Name')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(LayerStatusWrapper, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Layer Status')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(EnableHeader, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Enabled')
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(StyledPanelBody, {
          children: this.serverlessFunctions.map((serverlessFunction, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(_integrationServerlessRow__WEBPACK_IMPORTED_MODULE_11__["default"], {
            serverlessFunction: serverlessFunction,
            onUpdateFunction: update => this.handleFunctionUpdate(update, i),
            ...this.props
          }, serverlessFunction.name))
        })]
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_8__["default"])(IntegrationServerlessFunctions));

const StyledPanelHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__.PanelHeader,  true ? {
  target: "e92pouk5"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(2), ";display:grid;grid-column-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1), ";align-items:center;grid-template-columns:2fr 1fr 0.5fr;grid-template-areas:'function-name layer-status enable-switch';" + ( true ? "" : 0));

const HeaderText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e92pouk4"
} : 0)( true ? {
  name: "82a6rk",
  styles: "flex:1"
} : 0);

const StyledPanelBody = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__.PanelBody,  true ? {
  target: "e92pouk3"
} : 0)( true ? "" : 0);

const NameHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(HeaderText,  true ? {
  target: "e92pouk2"
} : 0)( true ? {
  name: "gs1e4l",
  styles: "grid-area:function-name"
} : 0);

const LayerStatusWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(HeaderText,  true ? {
  target: "e92pouk1"
} : 0)( true ? {
  name: "12cfrml",
  styles: "grid-area:layer-status"
} : 0);

const EnableHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(HeaderText,  true ? {
  target: "e92pouk0"
} : 0)( true ? {
  name: "uxilq9",
  styles: "grid-area:enable-switch"
} : 0);

/***/ }),

/***/ "./app/views/organizationIntegrations/integrationServerlessRow.tsx":
/*!*************************************************************************!*\
  !*** ./app/views/organizationIntegrations/integrationServerlessRow.tsx ***!
  \*************************************************************************/
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
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_switchButton__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/switchButton */ "./app/components/switchButton.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }












class IntegrationServerlessRow extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      submitting: false
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "recordAction", action => {
      (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_9__.trackIntegrationAnalytics)('integrations.serverless_function_action', {
        integration: this.props.integration.provider.key,
        integration_type: 'first_party',
        action,
        organization: this.props.organization
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "toggleEnable", async () => {
      const {
        serverlessFunction
      } = this.props;
      const action = this.enabled ? 'disable' : 'enable';
      const data = {
        action,
        target: serverlessFunction.name
      };

      try {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addLoadingMessage)();
        this.setState({
          submitting: true
        }); // optimistically update enable state

        this.props.onUpdateFunction({
          enabled: !this.enabled
        });
        this.recordAction(action);
        const resp = await this.props.api.requestPromise(this.endpoint, {
          method: 'POST',
          data
        }); // update remaining after response

        this.props.onUpdateFunction(resp);
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Success'));
      } catch (err) {
        var _err$responseJSON$det, _err$responseJSON;

        // restore original on failure
        this.props.onUpdateFunction(serverlessFunction);
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((_err$responseJSON$det = (_err$responseJSON = err.responseJSON) === null || _err$responseJSON === void 0 ? void 0 : _err$responseJSON.detail) !== null && _err$responseJSON$det !== void 0 ? _err$responseJSON$det : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Error occurred'));
      }

      this.setState({
        submitting: false
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "updateVersion", async () => {
      const {
        serverlessFunction
      } = this.props;
      const data = {
        action: 'updateVersion',
        target: serverlessFunction.name
      };

      try {
        this.setState({
          submitting: true
        }); // don't know the latest version but at least optimistically remove the update button

        this.props.onUpdateFunction({
          outOfDate: false
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addLoadingMessage)();
        this.recordAction('updateVersion');
        const resp = await this.props.api.requestPromise(this.endpoint, {
          method: 'POST',
          data
        }); // update remaining after response

        this.props.onUpdateFunction(resp);
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Success'));
      } catch (err) {
        var _err$responseJSON$det2, _err$responseJSON2;

        // restore original on failure
        this.props.onUpdateFunction(serverlessFunction);
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((_err$responseJSON$det2 = (_err$responseJSON2 = err.responseJSON) === null || _err$responseJSON2 === void 0 ? void 0 : _err$responseJSON2.detail) !== null && _err$responseJSON$det2 !== void 0 ? _err$responseJSON$det2 : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Error occurred'));
      }

      this.setState({
        submitting: false
      });
    });
  }

  get enabled() {
    return this.props.serverlessFunction.enabled;
  }

  get endpoint() {
    const orgSlug = this.props.organization.slug;
    return `/organizations/${orgSlug}/integrations/${this.props.integration.id}/serverless-functions/`;
  }

  renderLayerStatus() {
    const {
      serverlessFunction
    } = this.props;

    if (!serverlessFunction.outOfDate) {
      return this.enabled ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Latest') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Disabled');
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(UpdateButton, {
      size: "sm",
      priority: "primary",
      onClick: this.updateVersion,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Update')
    });
  }

  render() {
    const {
      serverlessFunction
    } = this.props;
    const {
      version
    } = serverlessFunction; // during optimistic update, we might be enabled without a version

    const versionText = this.enabled && version > 0 ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: ["\xA0|\xA0v", version]
    }) : null;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(Item, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(NameWrapper, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(NameRuntimeVersionWrapper, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Name, {
            children: serverlessFunction.name
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(RuntimeAndVersion, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(DetailWrapper, {
              children: serverlessFunction.runtime
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(DetailWrapper, {
              children: versionText
            })]
          })]
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(LayerStatusWrapper, {
        children: this.renderLayerStatus()
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(StyledSwitch, {
        isActive: this.enabled,
        isDisabled: this.state.submitting,
        size: "sm",
        toggle: this.toggleEnable
      })]
    });
  }

}

IntegrationServerlessRow.displayName = "IntegrationServerlessRow";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_10__["default"])(IntegrationServerlessRow));

const Item = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ey3r97y9"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(2), ";&:not(:last-child){border-bottom:1px solid ", p => p.theme.innerBorder, ";}display:grid;grid-column-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";align-items:center;grid-template-columns:2fr 1fr 0.5fr;grid-template-areas:'function-name layer-status enable-switch';" + ( true ? "" : 0));

const ItemWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "ey3r97y8"
} : 0)( true ? {
  name: "5l2w6y",
  styles: "height:32px;vertical-align:middle;display:flex;align-items:center"
} : 0);

const NameWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(ItemWrapper,  true ? {
  target: "ey3r97y7"
} : 0)( true ? {
  name: "gs1e4l",
  styles: "grid-area:function-name"
} : 0);

const LayerStatusWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(ItemWrapper,  true ? {
  target: "ey3r97y6"
} : 0)( true ? {
  name: "12cfrml",
  styles: "grid-area:layer-status"
} : 0);

const StyledSwitch = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_switchButton__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "ey3r97y5"
} : 0)( true ? {
  name: "uxilq9",
  styles: "grid-area:enable-switch"
} : 0);

const UpdateButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "ey3r97y4"
} : 0)( true ? "" : 0);

const NameRuntimeVersionWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ey3r97y3"
} : 0)( true ? {
  name: "1fttcpj",
  styles: "display:flex;flex-direction:column"
} : 0);

const Name = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(`span`,  true ? {
  target: "ey3r97y2"
} : 0)("padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";" + ( true ? "" : 0));

const RuntimeAndVersion = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ey3r97y1"
} : 0)("display:flex;flex-direction:row;color:", p => p.theme.gray300, ";" + ( true ? "" : 0));

const DetailWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ey3r97y0"
} : 0)( true ? {
  name: "oid971",
  styles: "line-height:1.2"
} : 0);

/***/ }),

/***/ "./app/views/settings/components/settingsBreadcrumb/breadcrumbTitle.tsx":
/*!******************************************************************************!*\
  !*** ./app/views/settings/components/settingsBreadcrumb/breadcrumbTitle.tsx ***!
  \******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _context__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./context */ "./app/views/settings/components/settingsBreadcrumb/context.tsx");


/**
 * Breadcrumb title sets the breadcrumb label for the provided route match
 */
function BreadcrumbTitle(props) {
  (0,_context__WEBPACK_IMPORTED_MODULE_0__.useBreadcrumbTitleEffect)(props);
  return null;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (BreadcrumbTitle);

/***/ }),

/***/ "./app/views/settings/organizationIntegrations/configureIntegration.tsx":
/*!******************************************************************************!*\
  !*** ./app/views/settings/organizationIntegrations/configureIntegration.tsx ***!
  \******************************************************************************/
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
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/forms/jsonForm */ "./app/components/forms/jsonForm.tsx");
/* harmony import */ var sentry_components_list__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/list */ "./app/components/list/index.tsx");
/* harmony import */ var sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/list/listItem */ "./app/components/list/listItem.tsx");
/* harmony import */ var sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/navTabs */ "./app/components/navTabs.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var sentry_utils_marked__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/marked */ "./app/utils/marked.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_organizationIntegrations_addIntegration__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/views/organizationIntegrations/addIntegration */ "./app/views/organizationIntegrations/addIntegration.tsx");
/* harmony import */ var sentry_views_organizationIntegrations_integrationAlertRules__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/views/organizationIntegrations/integrationAlertRules */ "./app/views/organizationIntegrations/integrationAlertRules.tsx");
/* harmony import */ var sentry_views_organizationIntegrations_integrationCodeMappings__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/views/organizationIntegrations/integrationCodeMappings */ "./app/views/organizationIntegrations/integrationCodeMappings.tsx");
/* harmony import */ var sentry_views_organizationIntegrations_integrationExternalTeamMappings__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/views/organizationIntegrations/integrationExternalTeamMappings */ "./app/views/organizationIntegrations/integrationExternalTeamMappings.tsx");
/* harmony import */ var sentry_views_organizationIntegrations_integrationExternalUserMappings__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/views/organizationIntegrations/integrationExternalUserMappings */ "./app/views/organizationIntegrations/integrationExternalUserMappings.tsx");
/* harmony import */ var sentry_views_organizationIntegrations_integrationItem__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! sentry/views/organizationIntegrations/integrationItem */ "./app/views/organizationIntegrations/integrationItem.tsx");
/* harmony import */ var sentry_views_organizationIntegrations_integrationMainSettings__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! sentry/views/organizationIntegrations/integrationMainSettings */ "./app/views/organizationIntegrations/integrationMainSettings.tsx");
/* harmony import */ var sentry_views_organizationIntegrations_integrationRepos__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! sentry/views/organizationIntegrations/integrationRepos */ "./app/views/organizationIntegrations/integrationRepos.tsx");
/* harmony import */ var sentry_views_organizationIntegrations_integrationServerlessFunctions__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! sentry/views/organizationIntegrations/integrationServerlessFunctions */ "./app/views/organizationIntegrations/integrationServerlessFunctions.tsx");
/* harmony import */ var sentry_views_settings_components_settingsBreadcrumb_breadcrumbTitle__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! sentry/views/settings/components/settingsBreadcrumb/breadcrumbTitle */ "./app/views/settings/components/settingsBreadcrumb/breadcrumbTitle.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_32__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

































class ConfigureIntegration extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_21__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onTabChange", value => {
      this.setState({
        tab: value
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onUpdateIntegration", () => {
      this.setState(this.getDefaultState(), this.fetchData);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleJiraMigration", async () => {
      try {
        const {
          params: {
            orgId,
            integrationId
          }
        } = this.props;
        await this.api.requestPromise(`/organizations/${orgId}/integrations/${integrationId}/issues/`, {
          method: 'PUT',
          data: {}
        });
        this.setState({
          plugins: (this.state.plugins || []).filter(_ref => {
            let {
              id
            } = _ref;
            return id === 'jira';
          })
        }, () => (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Migration in progress.')));
      } catch (error) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Something went wrong! Please try again.'));
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getAction", provider => {
      const {
        integration,
        plugins
      } = this.state;
      const shouldMigrateJiraPlugin = provider && ['jira', 'jira_server'].includes(provider.key) && (plugins || []).find(_ref2 => {
        let {
          id
        } = _ref2;
        return id === 'jira';
      });
      const action = provider && provider.key === 'pagerduty' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_views_organizationIntegrations_addIntegration__WEBPACK_IMPORTED_MODULE_22__["default"], {
        provider: provider,
        onInstall: this.onUpdateIntegration,
        account: integration.domainName,
        organization: this.props.organization,
        children: onClick => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"], {
          priority: "primary",
          size: "sm",
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_15__.IconAdd, {
            size: "xs",
            isCircled: true
          }),
          onClick: () => onClick(),
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Add Services')
        })
      }) : shouldMigrateJiraPlugin ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_6__["default"], {
        access: ['org:integrations'],
        children: _ref3 => {
          let {
            hasAccess
          } = _ref3;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_9__["default"], {
            disabled: !hasAccess,
            header: "Migrate Linked Issues from Jira Plugins",
            renderMessage: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)("p", {
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('This will automatically associate all the Linked Issues of your Jira Plugins to this integration.')
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)("p", {
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('If the Jira Plugins had the option checked to automatically create a Jira ticket for every new Sentry issue checked, you will need to create alert rules to recreate this behavior. Jira Server does not have this feature.')
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)("p", {
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Once the migration is complete, your Jira Plugins will be disabled.')
              })]
            }),
            onConfirm: () => {
              this.handleJiraMigration();
            },
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"], {
              priority: "primary",
              size: "md",
              disabled: !hasAccess,
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Migrate Plugin')
            })
          });
        }
      }) : null;
      return action;
    });
  }

  getEndpoints() {
    const {
      orgId,
      integrationId
    } = this.props.params;
    return [['config', `/organizations/${orgId}/config/integrations/`], ['integration', `/organizations/${orgId}/integrations/${integrationId}/`], ['plugins', `/organizations/${orgId}/plugins/configs/`]];
  }

  componentDidMount() {
    const {
      location,
      router,
      organization,
      params: {
        orgId,
        providerKey
      }
    } = this.props; // This page should not be accessible by members

    if (!organization.access.includes('org:integrations')) {
      router.push({
        pathname: `/settings/${orgId}/integrations/${providerKey}/`
      });
    }

    const value = ['codeMappings', 'userMappings', 'teamMappings'].find(tab => tab === location.query.tab) || 'repos'; // eslint-disable-next-line react/no-did-mount-set-state

    this.setState({
      tab: value
    });
  }

  onRequestSuccess(_ref4) {
    let {
      stateKey,
      data
    } = _ref4;

    if (stateKey !== 'integration') {
      return;
    }

    (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_17__.trackIntegrationAnalytics)('integrations.details_viewed', {
      integration: data.provider.key,
      integration_type: 'first_party',
      organization: this.props.organization
    });
  }

  getTitle() {
    return this.state.integration ? this.state.integration.provider.name : 'Configure Integration';
  }

  hasStacktraceLinking(provider) {
    // CodeOwners will only work if the provider has StackTrace Linking
    return provider.features.includes('stacktrace-link') && this.props.organization.features.includes('integrations-stacktrace-link');
  }

  hasCodeOwners() {
    return this.props.organization.features.includes('integrations-codeowners');
  }

  isCustomIntegration() {
    const {
      integration
    } = this.state;
    const {
      organization
    } = this.props;
    return organization.features.includes('integrations-custom-scm') && integration.provider.key === 'custom_scm';
  }

  get tab() {
    return this.state.tab || 'repos';
  }

  // TODO(Steve): Refactor components into separate tabs and use more generic tab logic
  renderMainTab(provider) {
    var _integration$dynamicD, _integration$dynamicD2, _integration$provider, _instructions$map;

    const {
      orgId
    } = this.props.params;
    const {
      integration
    } = this.state;
    const instructions = (_integration$dynamicD = integration.dynamicDisplayInformation) === null || _integration$dynamicD === void 0 ? void 0 : (_integration$dynamicD2 = _integration$dynamicD.configure_integration) === null || _integration$dynamicD2 === void 0 ? void 0 : _integration$dynamicD2.instructions;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [integration.configOrganization.length > 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_10__["default"], {
        hideFooter: true,
        saveOnBlur: true,
        allowUndo: true,
        apiMethod: "POST",
        initialData: integration.configData || {},
        apiEndpoint: `/organizations/${orgId}/integrations/${integration.id}/`,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_11__["default"], {
          fields: integration.configOrganization,
          title: ((_integration$provider = integration.provider.aspects.configure_integration) === null || _integration$provider === void 0 ? void 0 : _integration$provider.title) || (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Organization Integration Settings')
        })
      }), instructions && instructions.length > 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_7__["default"], {
        type: "info",
        children: (instructions === null || instructions === void 0 ? void 0 : instructions.length) === 1 ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)("span", {
          dangerouslySetInnerHTML: {
            __html: (0,sentry_utils_marked__WEBPACK_IMPORTED_MODULE_18__.singleLineRenderer)(instructions[0])
          }
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_list__WEBPACK_IMPORTED_MODULE_12__["default"], {
          symbol: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_15__.IconArrow, {
            size: "xs",
            direction: "right"
          }),
          children: (_instructions$map = instructions === null || instructions === void 0 ? void 0 : instructions.map((instruction, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_13__["default"], {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)("span", {
              dangerouslySetInnerHTML: {
                __html: (0,sentry_utils_marked__WEBPACK_IMPORTED_MODULE_18__.singleLineRenderer)(instruction)
              }
            })
          }, i))) !== null && _instructions$map !== void 0 ? _instructions$map : []
        })
      }), provider.features.includes('alert-rule') && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_views_organizationIntegrations_integrationAlertRules__WEBPACK_IMPORTED_MODULE_23__["default"], {}), provider.features.includes('commits') && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_views_organizationIntegrations_integrationRepos__WEBPACK_IMPORTED_MODULE_29__["default"], { ...this.props,
        integration: integration
      }), provider.features.includes('serverless') && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_views_organizationIntegrations_integrationServerlessFunctions__WEBPACK_IMPORTED_MODULE_30__["default"], {
        integration: integration
      })]
    });
  }

  renderBody() {
    const {
      integration
    } = this.state;
    const provider = this.state.config.providers.find(p => p.key === integration.provider.key);

    if (!provider) {
      return null;
    }

    const title = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_views_organizationIntegrations_integrationItem__WEBPACK_IMPORTED_MODULE_27__["default"], {
      integration: integration
    });

    const header = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_32__["default"], {
      noTitleStyles: true,
      title: title,
      action: this.getAction(provider)
    });

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [header, this.renderMainContent(provider), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_views_settings_components_settingsBreadcrumb_breadcrumbTitle__WEBPACK_IMPORTED_MODULE_31__["default"], {
        routes: this.props.routes,
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Configure %s', integration.provider.name)
      })]
    });
  } // renders everything below header


  renderMainContent(provider) {
    // if no code mappings, render the single tab
    if (!this.hasStacktraceLinking(provider)) {
      return this.renderMainTab(provider);
    } // otherwise render the tab view


    const tabs = [['repos', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Repositories')], ['codeMappings', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Code Mappings')], ...(this.hasCodeOwners() ? [['userMappings', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('User Mappings')]] : []), ...(this.hasCodeOwners() ? [['teamMappings', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Team Mappings')]] : [])];

    if (this.isCustomIntegration()) {
      tabs.unshift(['settings', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Settings')]);
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_14__["default"], {
        underlined: true,
        children: tabs.map(tabTuple => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)("li", {
          className: this.tab === tabTuple[0] ? 'active' : '',
          onClick: () => this.onTabChange(tabTuple[0]),
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(CapitalizedLink, {
            children: tabTuple[1]
          })
        }, tabTuple[0]))
      }), this.renderTabContent(this.tab, provider)]
    });
  }

  renderTabContent(tab, provider) {
    const {
      integration
    } = this.state;
    const {
      organization
    } = this.props;

    switch (tab) {
      case 'codeMappings':
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_views_organizationIntegrations_integrationCodeMappings__WEBPACK_IMPORTED_MODULE_24__["default"], {
          integration: integration
        });

      case 'repos':
        return this.renderMainTab(provider);

      case 'userMappings':
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_views_organizationIntegrations_integrationExternalUserMappings__WEBPACK_IMPORTED_MODULE_26__["default"], {
          integration: integration
        });

      case 'teamMappings':
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_views_organizationIntegrations_integrationExternalTeamMappings__WEBPACK_IMPORTED_MODULE_25__["default"], {
          integration: integration
        });

      case 'settings':
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_views_organizationIntegrations_integrationMainSettings__WEBPACK_IMPORTED_MODULE_28__["default"], {
          onUpdate: this.onUpdateIntegration,
          organization: organization,
          integration: integration
        });

      default:
        return this.renderMainTab(provider);
    }
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_20__["default"])((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_19__["default"])(ConfigureIntegration)));

const CapitalizedLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('a',  true ? {
  target: "e16tqr840"
} : 0)( true ? {
  name: "kff9ir",
  styles: "text-transform:capitalize"
} : 0);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_organizationIntegrations_configureIntegration_tsx.6cdd54db54448902ffc75e36b49de6f7.js.map