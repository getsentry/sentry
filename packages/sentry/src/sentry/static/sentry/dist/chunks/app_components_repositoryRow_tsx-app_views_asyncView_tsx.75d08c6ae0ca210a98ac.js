"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_repositoryRow_tsx-app_views_asyncView_tsx"],{

/***/ "./app/actionCreators/integrations.tsx":
/*!*********************************************!*\
  !*** ./app/actionCreators/integrations.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "addIntegrationToProject": () => (/* binding */ addIntegrationToProject),
/* harmony export */   "addRepository": () => (/* binding */ addRepository),
/* harmony export */   "cancelDeleteRepository": () => (/* binding */ cancelDeleteRepository),
/* harmony export */   "deleteRepository": () => (/* binding */ deleteRepository),
/* harmony export */   "migrateRepository": () => (/* binding */ migrateRepository),
/* harmony export */   "removeIntegrationFromProject": () => (/* binding */ removeIntegrationFromProject)
/* harmony export */ });
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_api__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/api */ "./app/api.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");



const api = new sentry_api__WEBPACK_IMPORTED_MODULE_1__.Client();
/**
 * Removes an integration from a project.
 *
 * @param {String} orgId Organization Slug
 * @param {String} projectId Project Slug
 * @param {Object} integration The organization integration to remove
 */

function removeIntegrationFromProject(orgId, projectId, integration) {
  const endpoint = `/projects/${orgId}/${projectId}/integrations/${integration.id}/`;
  (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addLoadingMessage)();
  return api.requestPromise(endpoint, {
    method: 'DELETE'
  }).then(() => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Disabled %s for %s', integration.name, projectId));
  }, () => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Failed to disable %s for %s', integration.name, projectId));
  });
}
/**
 * Add an integration to a project
 *
 * @param {String} orgId Organization Slug
 * @param {String} projectId Project Slug
 * @param {Object} integration The organization integration to add
 */

function addIntegrationToProject(orgId, projectId, integration) {
  const endpoint = `/projects/${orgId}/${projectId}/integrations/${integration.id}/`;
  (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addLoadingMessage)();
  return api.requestPromise(endpoint, {
    method: 'PUT'
  }).then(() => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Enabled %s for %s', integration.name, projectId));
  }, () => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Failed to enabled %s for %s', integration.name, projectId));
  });
}
/**
 * Delete a respository
 *
 * @param {Object} client ApiClient
 * @param {String} orgId Organization Slug
 * @param {String} repositoryId Repository ID
 */

function deleteRepository(client, orgId, repositoryId) {
  (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addLoadingMessage)();
  const promise = client.requestPromise(`/organizations/${orgId}/repos/${repositoryId}/`, {
    method: 'DELETE'
  });
  promise.then(() => (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.clearIndicators)(), () => (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Unable to delete repository.')));
  return promise;
}
/**
 * Cancel the deletion of a respository
 *
 * @param {Object} client ApiClient
 * @param {String} orgId Organization Slug
 * @param {String} repositoryId Repository ID
 */

function cancelDeleteRepository(client, orgId, repositoryId) {
  (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addLoadingMessage)();
  const promise = client.requestPromise(`/organizations/${orgId}/repos/${repositoryId}/`, {
    method: 'PUT',
    data: {
      status: 'visible'
    }
  });
  promise.then(() => (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.clearIndicators)(), () => (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Unable to cancel deletion.')));
  return promise;
}

function applyRepositoryAddComplete(promise) {
  promise.then(repo => {
    const message = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.tct)('[repo] has been successfully added.', {
      repo: repo.name
    });
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addSuccessMessage)(message);
  }, errorData => {
    const text = errorData.responseJSON.errors ? errorData.responseJSON.errors.__all__ : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Unable to add repository.');
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addErrorMessage)(text);
  });
  return promise;
}
/**
 * Migrate a repository to a new integration.
 *
 * @param {Object} client ApiClient
 * @param {String} orgId Organization Slug
 * @param {String} repositoryId Repository ID
 * @param {Object} integration Integration provider data.
 */


function migrateRepository(client, orgId, repositoryId, integration) {
  const data = {
    integrationId: integration.id
  };
  (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addLoadingMessage)();
  const promise = client.requestPromise(`/organizations/${orgId}/repos/${repositoryId}/`, {
    data,
    method: 'PUT'
  });
  return applyRepositoryAddComplete(promise);
}
/**
 * Add a repository
 *
 * @param {Object} client ApiClient
 * @param {String} orgId Organization Slug
 * @param {String} name Repository identifier/name to add
 * @param {Object} integration Integration provider data.
 */

function addRepository(client, orgId, name, integration) {
  const data = {
    installation: integration.id,
    identifier: name,
    provider: `integrations:${integration.provider.key}`
  };
  (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addLoadingMessage)();
  const promise = client.requestPromise(`/organizations/${orgId}/repos/`, {
    method: 'POST',
    data
  });
  return applyRepositoryAddComplete(promise);
}

/***/ }),

/***/ "./app/components/repositoryEditForm.tsx":
/*!***********************************************!*\
  !*** ./app/components/repositoryEditForm.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ RepositoryEditForm)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_forms__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/forms */ "./app/components/forms/index.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _alert__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./alert */ "./app/components/alert.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








class RepositoryEditForm extends react__WEBPACK_IMPORTED_MODULE_0__.Component {
  get initialData() {
    const {
      repository
    } = this.props;
    return {
      name: repository.name,
      url: repository.url || ''
    };
  }

  get formFields() {
    const fields = [{
      name: 'name',
      type: 'string',
      required: true,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Name of your repository.')
    }, {
      name: 'url',
      type: 'string',
      required: false,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Full URL to your repository.'),
      placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('https://github.com/my-org/my-repo/')
    }];
    return fields;
  }

  render() {
    const {
      onCancel,
      orgSlug,
      repository
    } = this.props;
    const endpoint = `/organizations/${orgSlug}/repos/${repository.id}/`;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_2__["default"], {
      initialData: this.initialData,
      onSubmitSuccess: data => {
        this.props.onSubmitSuccess(data);
        this.props.closeModal();
      },
      apiEndpoint: endpoint,
      apiMethod: "PUT",
      onCancel: onCancel,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(_alert__WEBPACK_IMPORTED_MODULE_5__["default"], {
        type: "warning",
        showIcon: true,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)('Changing the [name:repo name] may have consequences if it no longer matches the repo name used when [link:sending commits with releases].', {
          link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_3__["default"], {
            href: "https://docs.sentry.io/product/cli/releases/#sentry-cli-commit-integration"
          }),
          name: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("strong", {
            children: "repo name"
          })
        })
      }), this.formFields.map(field => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_forms__WEBPACK_IMPORTED_MODULE_1__.FieldFromConfig, {
        field: field,
        inline: false,
        stacked: true,
        flexibleControlStateSize: true
      }, field.name))]
    });
  }

}
RepositoryEditForm.displayName = "RepositoryEditForm";

/***/ }),

/***/ "./app/components/repositoryRow.tsx":
/*!******************************************!*\
  !*** ./app/components/repositoryRow.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_integrations__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/integrations */ "./app/actionCreators/integrations.tsx");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_repositoryEditForm__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/repositoryEditForm */ "./app/components/repositoryEditForm.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }



















function getStatusLabel(repo) {
  switch (repo.status) {
    case sentry_types__WEBPACK_IMPORTED_MODULE_16__.RepositoryStatus.PENDING_DELETION:
      return 'Deletion Queued';

    case sentry_types__WEBPACK_IMPORTED_MODULE_16__.RepositoryStatus.DELETION_IN_PROGRESS:
      return 'Deletion in Progress';

    case sentry_types__WEBPACK_IMPORTED_MODULE_16__.RepositoryStatus.DISABLED:
      return 'Disabled';

    case sentry_types__WEBPACK_IMPORTED_MODULE_16__.RepositoryStatus.HIDDEN:
      return 'Disabled';

    default:
      return null;
  }
}

function RepositoryRow(_ref) {
  let {
    api,
    repository,
    onRepositoryChange,
    organization,
    orgId,
    showProvider = false
  } = _ref;
  const isCustomRepo = organization.features.includes('integrations-custom-scm') && repository.provider.id === 'integrations:custom_scm';
  const isActive = repository.status === sentry_types__WEBPACK_IMPORTED_MODULE_16__.RepositoryStatus.ACTIVE;

  const cancelDelete = () => (0,sentry_actionCreators_integrations__WEBPACK_IMPORTED_MODULE_4__.cancelDeleteRepository)(api, orgId, repository.id).then(data => {
    if (onRepositoryChange) {
      onRepositoryChange(data);
    }
  }, () => {});

  const deleteRepo = () => (0,sentry_actionCreators_integrations__WEBPACK_IMPORTED_MODULE_4__.deleteRepository)(api, orgId, repository.id).then(data => {
    if (onRepositoryChange) {
      onRepositoryChange(data);
    }
  }, () => {});

  const handleEditRepo = data => {
    onRepositoryChange === null || onRepositoryChange === void 0 ? void 0 : onRepositoryChange(data);
  };

  const renderDeleteButton = hasAccess => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_12__["default"], {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('You must be an organization owner, manager or admin to remove a repository.'),
    disabled: hasAccess,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_8__["default"], {
      disabled: !hasAccess || !isActive && repository.status !== sentry_types__WEBPACK_IMPORTED_MODULE_16__.RepositoryStatus.DISABLED,
      onConfirm: deleteRepo,
      message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Are you sure you want to remove this repository? All associated commit data will be removed in addition to the repository.'),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(StyledButton, {
        size: "xs",
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_13__.IconDelete, {
          size: "xs"
        }),
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('delete'),
        disabled: !hasAccess
      })
    })
  });

  const triggerModal = () => (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_5__.openModal)(_ref2 => {
    let {
      Body,
      Header,
      closeModal
    } = _ref2;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(Header, {
        closeButton: true,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Edit Repository')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(Body, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_repositoryEditForm__WEBPACK_IMPORTED_MODULE_11__["default"], {
          orgSlug: orgId,
          repository: repository,
          onSubmitSuccess: handleEditRepo,
          closeModal: closeModal,
          onCancel: closeModal
        })
      })]
    });
  });

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_6__["default"], {
    access: ['org:integrations'],
    children: _ref3 => {
      let {
        hasAccess
      } = _ref3;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(StyledPanelItem, {
        status: repository.status,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(RepositoryTitleAndUrl, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(RepositoryTitle, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("strong", {
              children: repository.name
            }), !isActive && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)("small", {
              children: [" \u2014 ", getStatusLabel(repository)]
            }), repository.status === sentry_types__WEBPACK_IMPORTED_MODULE_16__.RepositoryStatus.PENDING_DELETION && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(StyledButton, {
              size: "xs",
              onClick: cancelDelete,
              disabled: !hasAccess,
              "data-test-id": "repo-cancel",
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Cancel')
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)("div", {
            children: [showProvider && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("small", {
              children: repository.provider.name
            }), showProvider && repository.url && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("span", {
              children: "\xA0\u2014\xA0"
            }), repository.url && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("small", {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_9__["default"], {
                href: repository.url,
                children: repository.url.replace('https://', '')
              })
            })]
          })]
        }), isCustomRepo ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(EditAndDelete, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(StyledButton, {
            size: "xs",
            icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_13__.IconEdit, {
              size: "xs"
            }),
            "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('edit'),
            disabled: !hasAccess || !isActive && repository.status !== sentry_types__WEBPACK_IMPORTED_MODULE_16__.RepositoryStatus.DISABLED,
            onClick: triggerModal
          }), renderDeleteButton(hasAccess)]
        }) : renderDeleteButton(hasAccess)]
      });
    }
  });
}

RepositoryRow.displayName = "RepositoryRow";

const StyledPanelItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.PanelItem,  true ? {
  target: "e1nskpen4"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(2), ";justify-content:space-between;align-items:center;flex:1;", p => p.status === sentry_types__WEBPACK_IMPORTED_MODULE_16__.RepositoryStatus.DISABLED && `
    filter: grayscale(1);
    opacity: 0.4;
  `, ";&:last-child{border-bottom:none;}" + ( true ? "" : 0));

const StyledButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "e1nskpen3"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1), ";" + ( true ? "" : 0));

const RepositoryTitleAndUrl = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1nskpen2"
} : 0)( true ? {
  name: "1fttcpj",
  styles: "display:flex;flex-direction:column"
} : 0);

const EditAndDelete = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1nskpen1"
} : 0)("display:flex;margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1), ";" + ( true ? "" : 0));

const RepositoryTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1nskpen0"
} : 0)( true ? {
  name: "3gzcvg",
  styles: "line-height:26px"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_17__["default"])(RepositoryRow));

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

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_repositoryRow_tsx-app_views_asyncView_tsx.b65668f897a7759c3e0fc6d97971a8f8.js.map