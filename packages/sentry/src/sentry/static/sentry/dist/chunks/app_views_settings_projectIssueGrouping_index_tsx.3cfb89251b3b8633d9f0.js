"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_projectIssueGrouping_index_tsx"],{

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

/***/ "./app/views/settings/projectIssueGrouping/index.tsx":
/*!***********************************************************!*\
  !*** ./app/views/settings/projectIssueGrouping/index.tsx ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actions/projectActions */ "./app/actions/projectActions.tsx");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/jsonForm */ "./app/components/forms/jsonForm.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_data_forms_projectIssueGrouping__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/data/forms/projectIssueGrouping */ "./app/data/forms/projectIssueGrouping.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/routeTitle */ "./app/utils/routeTitle.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var _upgradeGrouping__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./upgradeGrouping */ "./app/views/settings/projectIssueGrouping/upgradeGrouping.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


















class ProjectIssueGrouping extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_11__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmit", response => {
      // This will update our project context
      sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_3__["default"].updateSuccess(response);
    });
  }

  getTitle() {
    const {
      projectId
    } = this.props.params;
    return (0,sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_10__["default"])((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Issue Grouping'), projectId, false);
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      groupingConfigs: []
    };
  }

  getEndpoints() {
    const {
      projectId,
      orgId
    } = this.props.params;
    return [['groupingConfigs', `/projects/${orgId}/${projectId}/grouping-configs/`]];
  }

  renderBody() {
    const {
      groupingConfigs
    } = this.state;
    const {
      organization,
      project,
      params,
      location
    } = this.props;
    const {
      orgId,
      projectId
    } = params;
    const endpoint = `/projects/${orgId}/${projectId}/`;
    const access = new Set(organization.access);
    const jsonFormProps = {
      additionalFieldProps: {
        organization,
        groupingConfigs
      },
      features: new Set(organization.features),
      access,
      disabled: !access.has('project:write')
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_12__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Issue Grouping')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_13__["default"], {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)(`All events have a fingerprint. Events with the same fingerprint are grouped together into an issue. To learn more about issue grouping, [link: read the docs].`, {
          link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_7__["default"], {
            href: "https://docs.sentry.io/product/data-management-settings/event-grouping/"
          })
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_5__["default"], {
        saveOnBlur: true,
        allowUndo: true,
        initialData: project,
        apiMethod: "PUT",
        apiEndpoint: endpoint,
        onSubmitSuccess: this.handleSubmit,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_6__["default"], { ...jsonFormProps,
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Fingerprint Rules'),
          fields: [sentry_data_forms_projectIssueGrouping__WEBPACK_IMPORTED_MODULE_8__.fields.fingerprintingRules]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_6__["default"], { ...jsonFormProps,
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Stack Trace Rules'),
          fields: [sentry_data_forms_projectIssueGrouping__WEBPACK_IMPORTED_MODULE_8__.fields.groupingEnhancements]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_4__["default"], {
          features: ['set-grouping-config'],
          organization: organization,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_6__["default"], { ...jsonFormProps,
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Change defaults'),
            fields: [sentry_data_forms_projectIssueGrouping__WEBPACK_IMPORTED_MODULE_8__.fields.groupingConfig, sentry_data_forms_projectIssueGrouping__WEBPACK_IMPORTED_MODULE_8__.fields.secondaryGroupingConfig, sentry_data_forms_projectIssueGrouping__WEBPACK_IMPORTED_MODULE_8__.fields.secondaryGroupingExpiry]
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_6__["default"], { ...jsonFormProps,
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Automatic Grouping Updates'),
          fields: [sentry_data_forms_projectIssueGrouping__WEBPACK_IMPORTED_MODULE_8__.fields.groupingAutoUpdate]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_upgradeGrouping__WEBPACK_IMPORTED_MODULE_14__["default"], {
          groupingConfigs: groupingConfigs !== null && groupingConfigs !== void 0 ? groupingConfigs : [],
          organization: organization,
          projectId: params.projectId,
          project: project,
          api: this.api,
          onUpgrade: this.fetchData,
          location: location
        })]
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectIssueGrouping);

/***/ }),

/***/ "./app/views/settings/projectIssueGrouping/upgradeGrouping.tsx":
/*!*********************************************************************!*\
  !*** ./app/views/settings/projectIssueGrouping/upgradeGrouping.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actions/projectActions */ "./app/actions/projectActions.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_handleXhrErrorResponse__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/handleXhrErrorResponse */ "./app/utils/handleXhrErrorResponse.tsx");
/* harmony import */ var sentry_utils_marked__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/marked */ "./app/utils/marked.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./utils */ "./app/views/settings/projectIssueGrouping/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
















const upgradeGroupingId = 'upgrade-grouping';

function UpgradeGrouping(_ref) {
  let {
    groupingConfigs,
    organization,
    projectId,
    project,
    onUpgrade,
    api,
    location
  } = _ref;
  const hasProjectWriteAccess = organization.access.includes('project:write');
  const {
    updateNotes,
    riskLevel,
    latestGroupingConfig
  } = (0,_utils__WEBPACK_IMPORTED_MODULE_13__.getGroupingChanges)(project, groupingConfigs);
  const {
    riskNote,
    alertType
  } = (0,_utils__WEBPACK_IMPORTED_MODULE_13__.getGroupingRisk)(riskLevel);
  const noUpdates = project.groupingAutoUpdate || !latestGroupingConfig;
  const priority = riskLevel >= 2 ? 'danger' : 'primary';
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    if (location.hash !== `#${upgradeGroupingId}` || noUpdates || !groupingConfigs || !hasProjectWriteAccess) {
      return;
    }

    handleOpenConfirmModal(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.hash]);

  if (!groupingConfigs) {
    return null;
  }

  async function handleConfirmUpgrade() {
    const newData = {};

    if (latestGroupingConfig) {
      const now = Math.floor(new Date().getTime() / 1000);
      const ninety_days = 3600 * 24 * 90;
      newData.groupingConfig = latestGroupingConfig.id;
      newData.secondaryGroupingConfig = project.groupingConfig;
      newData.secondaryGroupingExpiry = now + ninety_days;
    }

    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Changing grouping\u2026'));

    try {
      const response = await api.requestPromise(`/projects/${organization.slug}/${projectId}/`, {
        method: 'PUT',
        data: newData
      });
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__.clearIndicators)();
      sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_3__["default"].updateSuccess(response);
      onUpgrade();
    } catch {
      (0,sentry_utils_handleXhrErrorResponse__WEBPACK_IMPORTED_MODULE_10__["default"])((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Unable to upgrade config'));
    }
  }

  function handleOpenConfirmModal() {
    (0,sentry_components_confirm__WEBPACK_IMPORTED_MODULE_6__.openConfirmModal)({
      confirmText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Upgrade'),
      priority,
      onConfirm: handleConfirmUpgrade,
      message: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_12__["default"], {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("strong", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Upgrade Grouping Strategy')
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_12__["default"], {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('You can upgrade the grouping strategy to the latest but this is an irreversible operation.')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_12__["default"], {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("strong", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('New Behavior')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("div", {
            dangerouslySetInnerHTML: {
              __html: (0,sentry_utils_marked__WEBPACK_IMPORTED_MODULE_11__["default"])(updateNotes)
            }
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_12__["default"], {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_4__["default"], {
            type: alertType,
            children: riskNote
          })
        })]
      })
    });
  }

  function getButtonTitle() {
    if (project.groupingAutoUpdate) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Disabled because automatic upgrading is enabled');
    }

    if (!hasProjectWriteAccess) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('You do not have sufficient permissions to do this');
    }

    if (noUpdates) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('You are already on the latest version');
    }

    return undefined;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.Panel, {
    id: upgradeGroupingId,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.PanelHeader, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Upgrade Grouping')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.PanelBody, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_7__["default"], {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Upgrade Grouping Strategy'),
        help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)('If the project uses an old grouping strategy an update is possible.[linebreak]Doing so will cause new events to group differently.', {
          linebreak: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("br", {})
        }),
        disabled: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("div", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
            onClick: handleOpenConfirmModal,
            disabled: !hasProjectWriteAccess || noUpdates,
            title: getButtonTitle(),
            type: "button",
            priority: priority,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Upgrade Grouping Strategy')
          })
        })
      })
    })]
  });
}

UpgradeGrouping.displayName = "UpgradeGrouping";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (UpgradeGrouping);

/***/ }),

/***/ "./app/views/settings/projectIssueGrouping/utils.tsx":
/*!***********************************************************!*\
  !*** ./app/views/settings/projectIssueGrouping/utils.tsx ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getGroupingChanges": () => (/* binding */ getGroupingChanges),
/* harmony export */   "getGroupingRisk": () => (/* binding */ getGroupingRisk)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function getGroupingChanges(project, groupingConfigs) {
  const byId = {};
  let updateNotes = '';
  let riskLevel = 0;
  let latestGroupingConfig = null;
  groupingConfigs.forEach(cfg => {
    byId[cfg.id] = cfg;

    if (cfg.latest && project.groupingConfig !== cfg.id) {
      updateNotes = cfg.changelog;
      latestGroupingConfig = cfg;
      riskLevel = cfg.risk;
    }
  });

  if (latestGroupingConfig) {
    var _base;

    let next = (_base = latestGroupingConfig.base) !== null && _base !== void 0 ? _base : '';

    while (next !== project.groupingConfig) {
      var _cfg$base;

      const cfg = byId[next];

      if (!cfg) {
        break;
      }

      riskLevel = Math.max(riskLevel, cfg.risk);
      updateNotes = cfg.changelog + '\n' + updateNotes;
      next = (_cfg$base = cfg.base) !== null && _cfg$base !== void 0 ? _cfg$base : '';
    }
  }

  return {
    updateNotes,
    riskLevel,
    latestGroupingConfig
  };
}
function getGroupingRisk(riskLevel) {
  switch (riskLevel) {
    case 0:
      return {
        riskNote: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('This upgrade has the chance to create some new issues.'),
        alertType: 'info'
      };

    case 1:
      return {
        riskNote: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('This upgrade will create some new issues.'),
        alertType: 'warning'
      };

    case 2:
      return {
        riskNote: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)("strong", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('The new grouping strategy is incompatible with the current and will create entirely new issues.')
        }),
        alertType: 'error'
      };

    default:
      return {
        riskNote: undefined,
        alertType: undefined
      };
  }
}

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_projectIssueGrouping_index_tsx.b98658a0405c8e3ec70f9ba47f270f32.js.map