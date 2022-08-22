"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_alerts_filterBar_tsx-app_views_alerts_list_header_tsx"],{

/***/ "./app/components/createAlertButton.tsx":
/*!**********************************************!*\
  !*** ./app/components/createAlertButton.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CreateAlertFromViewButton": () => (/* binding */ CreateAlertFromViewButton),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_navigation__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/navigation */ "./app/actionCreators/navigation.tsx");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/assistant/guideAnchor */ "./app/components/assistant/guideAnchor.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/alerts/wizard/options */ "./app/views/alerts/wizard/options.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


// eslint-disable-next-line no-restricted-imports













/**
 * Provide a button that can create an alert from an event view.
 * Emits incompatible query issues on click
 */
function CreateAlertFromViewButton(_ref) {
  var _queryParams$query, _queryParams$yAxis;

  let {
    projects,
    eventView,
    organization,
    referrer,
    onClick,
    alertType,
    disableMetricDataset,
    ...buttonProps
  } = _ref;
  const project = projects.find(p => p.id === `${eventView.project[0]}`);
  const queryParams = eventView.generateQueryStringObject();

  if ((_queryParams$query = queryParams.query) !== null && _queryParams$query !== void 0 && _queryParams$query.includes(`project:${project === null || project === void 0 ? void 0 : project.slug}`)) {
    queryParams.query = queryParams.query.replace(`project:${project === null || project === void 0 ? void 0 : project.slug}`, '');
  }

  const alertTemplate = alertType ? sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_12__.AlertWizardRuleTemplates[alertType] : sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_12__.DEFAULT_WIZARD_TEMPLATE;
  const to = {
    pathname: `/organizations/${organization.slug}/alerts/new/metric/`,
    query: { ...queryParams,
      createFromDiscover: true,
      disableMetricDataset,
      referrer,
      ...alertTemplate,
      project: project === null || project === void 0 ? void 0 : project.slug,
      aggregate: (_queryParams$yAxis = queryParams.yAxis) !== null && _queryParams$yAxis !== void 0 ? _queryParams$yAxis : alertTemplate.aggregate
    }
  };

  const handleClick = () => {
    onClick === null || onClick === void 0 ? void 0 : onClick();
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(CreateAlertButton, {
    organization: organization,
    onClick: handleClick,
    to: to,
    "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Create Alert'),
    ...buttonProps
  });
}

CreateAlertFromViewButton.displayName = "CreateAlertFromViewButton";
const CreateAlertButton = (0,react_router__WEBPACK_IMPORTED_MODULE_2__.withRouter)(_ref2 => {
  let {
    organization,
    projectSlug,
    iconProps,
    referrer,
    router,
    hideIcon,
    showPermissionGuide,
    alertOption,
    onEnter,
    ...buttonProps
  } = _ref2;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_11__["default"])();

  const createAlertUrl = providedProj => {
    const alertsBaseUrl = `/organizations/${organization.slug}/alerts`;
    const alertsArgs = [`${referrer ? `referrer=${referrer}` : ''}`, `${providedProj && providedProj !== ':projectId' ? `project=${providedProj}` : ''}`, alertOption ? `alert_option=${alertOption}` : ''].filter(item => item !== '');
    return `${alertsBaseUrl}/wizard/${alertsArgs.length ? '?' : ''}${alertsArgs.join('&')}`;
  };

  function handleClickWithoutProject(event) {
    event.preventDefault();
    onEnter === null || onEnter === void 0 ? void 0 : onEnter();
    (0,sentry_actionCreators_navigation__WEBPACK_IMPORTED_MODULE_4__.navigateTo)(createAlertUrl(':projectId'), router);
  }

  async function enableAlertsMemberWrite() {
    const settingsEndpoint = `/organizations/${organization.slug}/`;
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addLoadingMessage)();

    try {
      await api.requestPromise(settingsEndpoint, {
        method: 'PUT',
        data: {
          alertsMemberWrite: true
        }
      });
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Successfully updated organization settings'));
    } catch (err) {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Unable to update organization settings'));
    }
  }

  const permissionTooltipText = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.tct)('Ask your organization owner or manager to [settingsLink:enable alerts access] for you.', {
    settingsLink: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__["default"], {
      to: `/settings/${organization.slug}`
    })
  });

  const renderButton = hasAccess => {
    var _buttonProps$children;

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
      disabled: !hasAccess,
      title: !hasAccess ? permissionTooltipText : undefined,
      icon: !hideIcon && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconSiren, { ...iconProps
      }),
      to: projectSlug ? createAlertUrl(projectSlug) : undefined,
      tooltipProps: {
        isHoverable: true,
        position: 'top',
        overlayStyle: {
          maxWidth: '270px'
        }
      },
      onClick: projectSlug ? onEnter : handleClickWithoutProject,
      ...buttonProps,
      children: (_buttonProps$children = buttonProps.children) !== null && _buttonProps$children !== void 0 ? _buttonProps$children : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Create Alert')
    });
  };

  const showGuide = !organization.alertsMemberWrite && !!showPermissionGuide;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_5__["default"], {
    organization: organization,
    access: ['alerts:write'],
    children: _ref3 => {
      let {
        hasAccess
      } = _ref3;
      return showGuide ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_5__["default"], {
        organization: organization,
        access: ['org:write'],
        children: _ref4 => {
          let {
            hasAccess: isOrgAdmin
          } = _ref4;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_6__["default"], {
            target: isOrgAdmin ? 'alerts_write_owner' : 'alerts_write_member',
            onFinish: isOrgAdmin ? enableAlertsMemberWrite : undefined,
            children: renderButton(hasAccess)
          });
        }
      }) : renderButton(hasAccess);
    }
  });
});

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (CreateAlertButton);

/***/ }),

/***/ "./app/views/alerts/filterBar.tsx":
/*!****************************************!*\
  !*** ./app/views/alerts/filterBar.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/forms/compactSelect */ "./app/components/forms/compactSelect.tsx");
/* harmony import */ var sentry_components_projectPageFilter__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/projectPageFilter */ "./app/components/projectPageFilter.tsx");
/* harmony import */ var sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/searchBar */ "./app/components/searchBar.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _list_rules_teamFilter__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./list/rules/teamFilter */ "./app/views/alerts/list/rules/teamFilter.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./utils */ "./app/views/alerts/utils/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












function FilterBar(_ref) {
  var _location$query;

  let {
    location,
    onChangeSearch,
    onChangeFilter,
    onChangeStatus,
    hasStatusFilters
  } = _ref;
  const selectedTeams = (0,_utils__WEBPACK_IMPORTED_MODULE_8__.getTeamParams)(location.query.team);
  const selectedStatus = (0,_utils__WEBPACK_IMPORTED_MODULE_8__.getQueryStatus)(location.query.status);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(Wrapper, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(FilterButtons, {
      gap: 1.5,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_list_rules_teamFilter__WEBPACK_IMPORTED_MODULE_7__["default"], {
        selectedTeams: selectedTeams,
        handleChangeFilter: onChangeFilter
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_projectPageFilter__WEBPACK_IMPORTED_MODULE_3__["default"], {}), hasStatusFilters && onChangeStatus && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_2__["default"], {
        triggerProps: {
          prefix: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Status')
        },
        options: [{
          value: 'all',
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('All')
        }, {
          value: 'open',
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Active')
        }, {
          value: 'closed',
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Inactive')
        }],
        value: selectedStatus,
        onChange: _ref2 => {
          let {
            value
          } = _ref2;
          return onChangeStatus(value);
        }
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_4__["default"], {
      placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Search by name'),
      query: (_location$query = location.query) === null || _location$query === void 0 ? void 0 : _location$query.name,
      onSearch: onChangeSearch
    })]
  });
}

FilterBar.displayName = "FilterBar";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (FilterBar);

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e8u29161"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1.5), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(2), ";@media (min-width: ", p => p.theme.breakpoints.small, "){grid-template-columns:min-content 1fr;}" + ( true ? "" : 0));

const FilterButtons = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "e8u29160"
} : 0)("@media (max-width: ", p => p.theme.breakpoints.small, "){display:flex;align-items:flex-start;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1.5), ";}@media (min-width: ", p => p.theme.breakpoints.small, "){display:grid;grid-auto-columns:minmax(auto, 300px);}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/alerts/list/header.tsx":
/*!******************************************!*\
  !*** ./app/views/alerts/list/header.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_actionCreators_navigation__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actionCreators/navigation */ "./app/actionCreators/navigation.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_createAlertButton__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/createAlertButton */ "./app/components/createAlertButton.tsx");
/* harmony import */ var sentry_components_globalSelectionLink__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/globalSelectionLink */ "./app/components/globalSelectionLink.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }













const AlertHeader = _ref => {
  let {
    router,
    organization,
    activeTab,
    projectSlugs
  } = _ref;

  /**
   * Incidents list is currently at the organization level, but the link needs to
   * go down to a specific project scope.
   */
  const handleNavigateToSettings = e => {
    e.preventDefault();
    (0,sentry_actionCreators_navigation__WEBPACK_IMPORTED_MODULE_1__.navigateTo)(`/settings/${organization.slug}/projects/:projectId/alerts/`, router);
  };

  const alertRulesLink = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("li", {
    className: activeTab === 'rules' ? 'active' : '',
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_globalSelectionLink__WEBPACK_IMPORTED_MODULE_5__["default"], {
      to: `/organizations/${organization.slug}/alerts/rules/`,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Alert Rules')
    })
  });

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_6__.Header, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_6__.HeaderContent, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(StyledLayoutTitle, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Alerts')
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_6__.HeaderActions, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(Actions, {
        gap: 1,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_createAlertButton__WEBPACK_IMPORTED_MODULE_4__["default"], {
          organization: organization,
          iconProps: {
            size: 'sm'
          },
          priority: "primary",
          referrer: "alert_stream",
          showPermissionGuide: true,
          projectSlug: projectSlugs.length === 1 ? projectSlugs[0] : undefined,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Create Alert')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
          onClick: handleNavigateToSettings,
          href: "#",
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconSettings, {
            size: "sm"
          }),
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Settings')
        })]
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_6__.HeaderNavTabs, {
      underlined: true,
      children: [alertRulesLink, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("li", {
        className: activeTab === 'stream' ? 'active' : '',
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_globalSelectionLink__WEBPACK_IMPORTED_MODULE_5__["default"], {
          to: `/organizations/${organization.slug}/alerts/`,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('History')
        })
      })]
    })]
  });
};

AlertHeader.displayName = "AlertHeader";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AlertHeader);

const StyledLayoutTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_6__.Title,  true ? {
  target: "e59niir1"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(0.5), ";" + ( true ? "" : 0));

const Actions = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e59niir0"
} : 0)( true ? {
  name: "s0vnfv",
  styles: "height:32px"
} : 0);

/***/ }),

/***/ "./app/views/alerts/wizard/options.tsx":
/*!*********************************************!*\
  !*** ./app/views/alerts/wizard/options.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AlertWizardAlertNames": () => (/* binding */ AlertWizardAlertNames),
/* harmony export */   "AlertWizardRuleTemplates": () => (/* binding */ AlertWizardRuleTemplates),
/* harmony export */   "DEFAULT_WIZARD_TEMPLATE": () => (/* binding */ DEFAULT_WIZARD_TEMPLATE),
/* harmony export */   "DatasetMEPAlertQueryTypes": () => (/* binding */ DatasetMEPAlertQueryTypes),
/* harmony export */   "MEPAlertsDataset": () => (/* binding */ MEPAlertsDataset),
/* harmony export */   "MEPAlertsQueryType": () => (/* binding */ MEPAlertsQueryType),
/* harmony export */   "getAlertWizardCategories": () => (/* binding */ getAlertWizardCategories),
/* harmony export */   "getMEPAlertsDataset": () => (/* binding */ getMEPAlertsDataset),
/* harmony export */   "hideParameterSelectorSet": () => (/* binding */ hideParameterSelectorSet),
/* harmony export */   "hidePrimarySelectorSet": () => (/* binding */ hidePrimarySelectorSet)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/types */ "./app/views/alerts/rules/metric/types.tsx");




let MEPAlertsQueryType;

(function (MEPAlertsQueryType) {
  MEPAlertsQueryType[MEPAlertsQueryType["ERROR"] = 0] = "ERROR";
  MEPAlertsQueryType[MEPAlertsQueryType["PERFORMANCE"] = 1] = "PERFORMANCE";
  MEPAlertsQueryType[MEPAlertsQueryType["CRASH_RATE"] = 2] = "CRASH_RATE";
})(MEPAlertsQueryType || (MEPAlertsQueryType = {}));

let MEPAlertsDataset;

(function (MEPAlertsDataset) {
  MEPAlertsDataset["DISCOVER"] = "discover";
  MEPAlertsDataset["METRICS"] = "metrics";
  MEPAlertsDataset["METRICS_ENHANCED"] = "metricsEnhanced";
})(MEPAlertsDataset || (MEPAlertsDataset = {}));

const DatasetMEPAlertQueryTypes = {
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.ERRORS]: MEPAlertsQueryType.ERROR,
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS]: MEPAlertsQueryType.PERFORMANCE,
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.GENERIC_METRICS]: MEPAlertsQueryType.PERFORMANCE,
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.METRICS]: MEPAlertsQueryType.CRASH_RATE,
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.SESSIONS]: MEPAlertsQueryType.CRASH_RATE
};
const AlertWizardAlertNames = {
  issues: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Issues'),
  num_errors: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Number of Errors'),
  users_experiencing_errors: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Users Experiencing Errors'),
  throughput: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Throughput'),
  trans_duration: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Transaction Duration'),
  apdex: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Apdex'),
  failure_rate: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Failure Rate'),
  lcp: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Largest Contentful Paint'),
  fid: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('First Input Delay'),
  cls: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Cumulative Layout Shift'),
  custom: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Custom Metric'),
  crash_free_sessions: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Crash Free Session Rate'),
  crash_free_users: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Crash Free User Rate')
};
const getAlertWizardCategories = org => [{
  categoryHeading: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Errors'),
  options: ['issues', 'num_errors', 'users_experiencing_errors']
}, ...(org.features.includes('crash-rate-alerts') ? [{
  categoryHeading: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Sessions'),
  options: ['crash_free_sessions', 'crash_free_users']
}] : []), {
  categoryHeading: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Performance'),
  options: ['throughput', 'trans_duration', 'apdex', 'failure_rate', 'lcp', 'fid', 'cls']
}, {
  categoryHeading: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Other'),
  options: ['custom']
}];
const AlertWizardRuleTemplates = {
  num_errors: {
    aggregate: 'count()',
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.ERRORS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.ERROR
  },
  users_experiencing_errors: {
    aggregate: 'count_unique(user)',
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.ERRORS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.ERROR
  },
  throughput: {
    aggregate: 'count()',
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.TRANSACTION
  },
  trans_duration: {
    aggregate: 'p95(transaction.duration)',
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.TRANSACTION
  },
  apdex: {
    aggregate: 'apdex(300)',
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.TRANSACTION
  },
  failure_rate: {
    aggregate: 'failure_rate()',
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.TRANSACTION
  },
  lcp: {
    aggregate: 'p95(measurements.lcp)',
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.TRANSACTION
  },
  fid: {
    aggregate: 'p95(measurements.fid)',
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.TRANSACTION
  },
  cls: {
    aggregate: 'p95(measurements.cls)',
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.TRANSACTION
  },
  custom: {
    aggregate: 'p95(measurements.fp)',
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.TRANSACTION
  },
  crash_free_sessions: {
    aggregate: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.SessionsAggregate.CRASH_FREE_SESSIONS,
    // TODO(scttcper): Use Dataset.Metric on GA of alert-crash-free-metrics
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.SESSIONS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.SESSION
  },
  crash_free_users: {
    aggregate: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.SessionsAggregate.CRASH_FREE_USERS,
    // TODO(scttcper): Use Dataset.Metric on GA of alert-crash-free-metrics
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.SESSIONS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.USER
  }
};
const DEFAULT_WIZARD_TEMPLATE = AlertWizardRuleTemplates.num_errors;
const hidePrimarySelectorSet = new Set(['num_errors', 'users_experiencing_errors', 'throughput', 'apdex', 'failure_rate', 'crash_free_sessions', 'crash_free_users']);
const hideParameterSelectorSet = new Set(['trans_duration', 'lcp', 'fid', 'cls']);
function getMEPAlertsDataset(dataset, newAlert) {
  // Dataset.ERRORS overrides all cases
  if (dataset === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.ERRORS) {
    return MEPAlertsDataset.DISCOVER;
  }

  if (newAlert) {
    return MEPAlertsDataset.METRICS_ENHANCED;
  }

  if (dataset === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.GENERIC_METRICS) {
    return MEPAlertsDataset.METRICS;
  }

  return MEPAlertsDataset.DISCOVER;
}

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_alerts_filterBar_tsx-app_views_alerts_list_header_tsx.2b6cc92763c407bdbb15f22569be62d3.js.map