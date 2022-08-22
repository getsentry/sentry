"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_links_listLink_tsx-app_views_performance_vitalDetail_index_tsx"],{

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

/***/ "./app/components/events/searchBar.tsx":
/*!*********************************************!*\
  !*** ./app/components/events/searchBar.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_assign__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/assign */ "../node_modules/lodash/assign.js");
/* harmony import */ var lodash_assign__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_assign__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var lodash_flatten__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/flatten */ "../node_modules/lodash/flatten.js");
/* harmony import */ var lodash_flatten__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_flatten__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var lodash_memoize__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/memoize */ "../node_modules/lodash/memoize.js");
/* harmony import */ var lodash_memoize__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_memoize__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var sentry_actionCreators_tags__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/actionCreators/tags */ "./app/actionCreators/tags.tsx");
/* harmony import */ var sentry_components_smartSearchBar__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/smartSearchBar */ "./app/components/smartSearchBar/index.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/fields */ "./app/utils/fields/index.ts");
/* harmony import */ var sentry_utils_measurements_measurements__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/measurements/measurements */ "./app/utils/measurements/measurements.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_withTags__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/withTags */ "./app/utils/withTags.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



















const SEARCH_SPECIAL_CHARS_REGEXP = new RegExp(`^${sentry_constants__WEBPACK_IMPORTED_MODULE_10__.NEGATION_OPERATOR}|\\${sentry_constants__WEBPACK_IMPORTED_MODULE_10__.SEARCH_WILDCARD}`, 'g');

const getFunctionTags = fields => Object.fromEntries(fields.filter(item => !Object.keys(sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.FIELD_TAGS).includes(item.field) && !(0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.isEquation)(item.field)).map(item => [item.field, {
  key: item.field,
  name: item.field,
  kind: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__.FieldKind.FUNCTION
}]));

const getFieldTags = () => Object.fromEntries(Object.keys(sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.FIELD_TAGS).map(key => [key, { ...sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.FIELD_TAGS[key],
  kind: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__.FieldKind.FIELD
}]));

const getMeasurementTags = measurements => Object.fromEntries(Object.keys(measurements).map(key => [key, { ...measurements[key],
  kind: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__.FieldKind.MEASUREMENT
}]));

const getSpanTags = () => {
  return Object.fromEntries(sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.SPAN_OP_BREAKDOWN_FIELDS.map(key => [key, {
    key,
    name: key,
    kind: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__.FieldKind.METRICS
  }]));
};

const getSemverTags = () => Object.fromEntries(Object.keys(sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.SEMVER_TAGS).map(key => [key, { ...sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.SEMVER_TAGS[key],
  kind: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__.FieldKind.FIELD
}]));

function SearchBar(props) {
  const {
    maxSearchItems,
    organization,
    tags,
    omitTags,
    fields,
    projectIds,
    includeSessionTagsValues,
    maxMenuHeight
  } = props;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_16__["default"])();
  (0,react__WEBPACK_IMPORTED_MODULE_3__.useEffect)(() => {
    var _getEventFieldValues$, _getEventFieldValues$2;

    // Clear memoized data on mount to make tests more consistent.
    (_getEventFieldValues$ = (_getEventFieldValues$2 = getEventFieldValues.cache).clear) === null || _getEventFieldValues$ === void 0 ? void 0 : _getEventFieldValues$.call(_getEventFieldValues$2); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectIds]); // Returns array of tag values that substring match `query`; invokes `callback`
  // with data when ready

  const getEventFieldValues = lodash_memoize__WEBPACK_IMPORTED_MODULE_6___default()((tag, query, endpointParams) => {
    const projectIdStrings = projectIds === null || projectIds === void 0 ? void 0 : projectIds.map(String);

    if ((0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.isAggregateField)(tag.key) || (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.isMeasurement)(tag.key)) {
      // We can't really auto suggest values for aggregate fields
      // or measurements, so we simply don't
      return Promise.resolve([]);
    }

    return (0,sentry_actionCreators_tags__WEBPACK_IMPORTED_MODULE_8__.fetchTagValues)(api, organization.slug, tag.key, query, projectIdStrings, endpointParams, // allows searching for tags on transactions as well
    true, // allows searching for tags on sessions as well
    includeSessionTagsValues).then(results => lodash_flatten__WEBPACK_IMPORTED_MODULE_5___default()(results.filter(_ref => {
      let {
        name
      } = _ref;
      return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_12__.defined)(name);
    }).map(_ref2 => {
      let {
        name
      } = _ref2;
      return name;
    })), () => {
      throw new Error('Unable to fetch event field values');
    });
  }, (_ref3, query) => {
    let {
      key
    } = _ref3;
    return `${key}-${query}`;
  });

  const getTagList = measurements => {
    const functionTags = getFunctionTags(fields !== null && fields !== void 0 ? fields : []);
    const fieldTags = getFieldTags();
    const measurementsWithKind = getMeasurementTags(measurements);
    const spanTags = getSpanTags();
    const semverTags = getSemverTags();
    const orgHasPerformanceView = organization.features.includes('performance-view');
    const combinedTags = orgHasPerformanceView ? Object.assign({}, measurementsWithKind, spanTags, fieldTags, functionTags) : lodash_omit__WEBPACK_IMPORTED_MODULE_7___default()(fieldTags, sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.TRACING_FIELDS);
    const tagsWithKind = Object.fromEntries(Object.keys(tags).map(key => [key, { ...tags[key],
      kind: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__.FieldKind.TAG
    }]));
    lodash_assign__WEBPACK_IMPORTED_MODULE_4___default()(combinedTags, tagsWithKind, fieldTags, semverTags);
    const sortedTagKeys = Object.keys(combinedTags);
    sortedTagKeys.sort((a, b) => {
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });
    combinedTags.has = {
      key: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__.FieldKey.HAS,
      name: 'Has property',
      values: sortedTagKeys,
      predefined: true,
      kind: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__.FieldKind.FIELD
    };
    return lodash_omit__WEBPACK_IMPORTED_MODULE_7___default()(combinedTags, omitTags !== null && omitTags !== void 0 ? omitTags : []);
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_utils_measurements_measurements__WEBPACK_IMPORTED_MODULE_15__["default"], {
    children: _ref4 => {
      let {
        measurements
      } = _ref4;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_smartSearchBar__WEBPACK_IMPORTED_MODULE_9__["default"], {
        hasRecentSearches: true,
        savedSearchType: sentry_types__WEBPACK_IMPORTED_MODULE_11__.SavedSearchType.EVENT,
        onGetTagValues: getEventFieldValues,
        supportedTags: getTagList(measurements),
        prepareQuery: query => {
          // Prepare query string (e.g. strip special characters like negation operator)
          return query.replace(SEARCH_SPECIAL_CHARS_REGEXP, '');
        },
        maxSearchItems: maxSearchItems,
        excludeEnvironment: true,
        maxMenuHeight: maxMenuHeight !== null && maxMenuHeight !== void 0 ? maxMenuHeight : 300,
        ...props
      });
    }
  });
}

SearchBar.displayName = "SearchBar";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withTags__WEBPACK_IMPORTED_MODULE_17__["default"])(SearchBar));

/***/ }),

/***/ "./app/components/links/listLink.tsx":
/*!*******************************************!*\
  !*** ./app/components/links/listLink.tsx ***!
  \*******************************************/
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
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! classnames */ "../node_modules/classnames/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(classnames__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



 // eslint-disable-next-line no-restricted-imports







class ListLink extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getClassName", () => {
      const _classNames = {};
      const {
        className,
        activeClassName
      } = this.props;

      if (className) {
        _classNames[className] = true;
      }

      if (this.isActive() && activeClassName) {
        _classNames[activeClassName] = true;
      }

      return classnames__WEBPACK_IMPORTED_MODULE_5___default()(_classNames);
    });
  }

  isActive() {
    const {
      isActive,
      to,
      query,
      index,
      router
    } = this.props;
    const queryData = query ? query_string__WEBPACK_IMPORTED_MODULE_7__.parse(query) : undefined;
    const target = typeof to === 'string' ? {
      pathname: to,
      query: queryData
    } : to;

    if (typeof isActive === 'function') {
      return isActive(target, index);
    }

    return router.isActive(target, index);
  }

  render() {
    const {
      index,
      children,
      to,
      disabled,
      ...props
    } = this.props;
    const carriedProps = lodash_omit__WEBPACK_IMPORTED_MODULE_6___default()(props, 'activeClassName', 'css', 'isActive', 'index', 'router', 'location');
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(StyledLi, {
      className: this.getClassName(),
      disabled: disabled,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(react_router__WEBPACK_IMPORTED_MODULE_4__.Link, { ...carriedProps,
        onlyActiveOnIndex: index,
        to: disabled ? '' : to,
        children: children
      })
    });
  }

}

ListLink.displayName = "ListLink";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(ListLink, "displayName", 'ListLink');

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(ListLink, "defaultProps", {
  activeClassName: 'active',
  index: false,
  disabled: false
});

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_4__.withRouter)(ListLink));

const StyledLi = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('li',  true ? {
  shouldForwardProp: prop => prop !== 'disabled',
  target: "er8tqc10"
} : 0)(p => p.disabled && `
   a {
    color:${p.theme.disabled} !important;
    pointer-events: none;
    :hover {
      color: ${p.theme.disabled}  !important;
    }
   }
`, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/performance/vitalsAlert/constants.tsx":
/*!**************************************************************!*\
  !*** ./app/components/performance/vitalsAlert/constants.tsx ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "INDUSTRY_STANDARDS": () => (/* binding */ INDUSTRY_STANDARDS),
/* harmony export */   "MIN_VITAL_COUNT_FOR_DISPLAY": () => (/* binding */ MIN_VITAL_COUNT_FOR_DISPLAY),
/* harmony export */   "SENTRY_CUSTOMERS": () => (/* binding */ SENTRY_CUSTOMERS),
/* harmony export */   "VITALS_TYPES": () => (/* binding */ VITALS_TYPES)
/* harmony export */ });
const VITALS_TYPES = ['FCP', 'LCP', 'appStartCold', 'appStartWarm']; // these are industry standards determined by Google (https://web.dev/defining-core-web-vitals-thresholds/)

const INDUSTRY_STANDARDS = {
  LCP: 2500,
  FCP: 1800,
  appStartCold: 5000,
  appStartWarm: 2000
}; // these were determined using a Looker query and might change over time

const SENTRY_CUSTOMERS = {
  LCP: 948,
  FCP: 760,
  appStartCold: 2260,
  appStartWarm: 1900
}; // an organization must have at least this many transactions
// of the vital we want to show

const MIN_VITAL_COUNT_FOR_DISPLAY = 100;

/***/ }),

/***/ "./app/utils/measurements/measurements.tsx":
/*!*************************************************!*\
  !*** ./app/utils/measurements/measurements.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "getMeasurements": () => (/* binding */ getMeasurements)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/performance/vitals/constants */ "./app/utils/performance/vitals/constants.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function measurementsFromDetails(details) {
  return Object.fromEntries(Object.entries(details).map(_ref => {
    let [key, value] = _ref;
    const newValue = {
      name: value.name,
      key
    };
    return [key, newValue];
  }));
}

const MOBILE_MEASUREMENTS = measurementsFromDetails(sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_2__.MOBILE_VITAL_DETAILS);
const WEB_MEASUREMENTS = measurementsFromDetails(sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_2__.WEB_VITAL_DETAILS);
function getMeasurements() {
  return { ...WEB_MEASUREMENTS,
    ...MOBILE_MEASUREMENTS
  };
}

function Measurements(_ref2) {
  let {
    children
  } = _ref2;
  const measurements = getMeasurements();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: children({
      measurements
    })
  });
}

Measurements.displayName = "Measurements";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Measurements);

/***/ }),

/***/ "./app/utils/performance/vitals/vitalsDetailsTableQuery.tsx":
/*!******************************************************************!*\
  !*** ./app/utils/performance/vitals/vitalsDetailsTableQuery.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/discover/genericDiscoverQuery */ "./app/utils/discover/genericDiscoverQuery.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function VitalsCardsDiscoverQuery(props) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_0__["default"], {
    route: "events",
    ...props
  });
}

VitalsCardsDiscoverQuery.displayName = "VitalsCardsDiscoverQuery";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_1__["default"])(VitalsCardsDiscoverQuery));

/***/ }),

/***/ "./app/utils/withTags.tsx":
/*!********************************!*\
  !*** ./app/utils/withTags.tsx ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_stores_tagStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/tagStore */ "./app/stores/tagStore.tsx");
/* harmony import */ var sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/getDisplayName */ "./app/utils/getDisplayName.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







/**
 * HOC for getting *only* tags from the TagStore.
 */
function withTags(WrappedComponent) {
  class WithTags extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
    constructor() {
      super(...arguments);

      (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
        tags: sentry_stores_tagStore__WEBPACK_IMPORTED_MODULE_3__["default"].getStateTags()
      });

      (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "unsubscribe", sentry_stores_tagStore__WEBPACK_IMPORTED_MODULE_3__["default"].listen(tags => this.setState({
        tags
      }), undefined));
    }

    componentWillUnmount() {
      this.unsubscribe();
    }

    render() {
      const {
        tags,
        ...props
      } = this.props;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(WrappedComponent, {
        tags: tags !== null && tags !== void 0 ? tags : this.state.tags,
        ...props
      });
    }

  }

  WithTags.displayName = "WithTags";

  (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(WithTags, "displayName", `withTags(${(0,sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_4__["default"])(WrappedComponent)})`);

  return WithTags;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (withTags);

/***/ }),

/***/ "./app/views/alerts/rules/metric/types.tsx":
/*!*************************************************!*\
  !*** ./app/views/alerts/rules/metric/types.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ActionLabel": () => (/* binding */ ActionLabel),
/* harmony export */   "ActionType": () => (/* binding */ ActionType),
/* harmony export */   "AlertRuleComparisonType": () => (/* binding */ AlertRuleComparisonType),
/* harmony export */   "AlertRuleThresholdType": () => (/* binding */ AlertRuleThresholdType),
/* harmony export */   "AlertRuleTriggerType": () => (/* binding */ AlertRuleTriggerType),
/* harmony export */   "Dataset": () => (/* binding */ Dataset),
/* harmony export */   "Datasource": () => (/* binding */ Datasource),
/* harmony export */   "EventTypes": () => (/* binding */ EventTypes),
/* harmony export */   "SessionsAggregate": () => (/* binding */ SessionsAggregate),
/* harmony export */   "TargetLabel": () => (/* binding */ TargetLabel),
/* harmony export */   "TargetType": () => (/* binding */ TargetType),
/* harmony export */   "TimePeriod": () => (/* binding */ TimePeriod),
/* harmony export */   "TimeWindow": () => (/* binding */ TimeWindow)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");

let AlertRuleThresholdType;

(function (AlertRuleThresholdType) {
  AlertRuleThresholdType[AlertRuleThresholdType["ABOVE"] = 0] = "ABOVE";
  AlertRuleThresholdType[AlertRuleThresholdType["BELOW"] = 1] = "BELOW";
})(AlertRuleThresholdType || (AlertRuleThresholdType = {}));

let AlertRuleTriggerType;

(function (AlertRuleTriggerType) {
  AlertRuleTriggerType["CRITICAL"] = "critical";
  AlertRuleTriggerType["WARNING"] = "warning";
  AlertRuleTriggerType["RESOLVE"] = "resolve";
})(AlertRuleTriggerType || (AlertRuleTriggerType = {}));

let AlertRuleComparisonType;

(function (AlertRuleComparisonType) {
  AlertRuleComparisonType["COUNT"] = "count";
  AlertRuleComparisonType["CHANGE"] = "change";
  AlertRuleComparisonType["PERCENT"] = "percent";
})(AlertRuleComparisonType || (AlertRuleComparisonType = {}));

let Dataset;

(function (Dataset) {
  Dataset["ERRORS"] = "events";
  Dataset["TRANSACTIONS"] = "transactions";
  Dataset["GENERIC_METRICS"] = "generic_metrics";
  Dataset["SESSIONS"] = "sessions";
  Dataset["METRICS"] = "metrics";
})(Dataset || (Dataset = {}));

let EventTypes;

(function (EventTypes) {
  EventTypes["DEFAULT"] = "default";
  EventTypes["ERROR"] = "error";
  EventTypes["TRANSACTION"] = "transaction";
  EventTypes["USER"] = "user";
  EventTypes["SESSION"] = "session";
})(EventTypes || (EventTypes = {}));

let Datasource;
/**
 * This is not a real aggregate as crash-free sessions/users can be only calculated on frontend by comparing the count of sessions broken down by status
 * It is here nevertheless to shoehorn sessions dataset into existing alerts codebase
 * This will most likely be revised as we introduce the metrics dataset
 */

(function (Datasource) {
  Datasource["ERROR_DEFAULT"] = "error_default";
  Datasource["DEFAULT"] = "default";
  Datasource["ERROR"] = "error";
  Datasource["TRANSACTION"] = "transaction";
})(Datasource || (Datasource = {}));

let SessionsAggregate;

(function (SessionsAggregate) {
  SessionsAggregate["CRASH_FREE_SESSIONS"] = "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate";
  SessionsAggregate["CRASH_FREE_USERS"] = "percentage(users_crashed, users) AS _crash_rate_alert_aggregate";
})(SessionsAggregate || (SessionsAggregate = {}));

let TimePeriod;

(function (TimePeriod) {
  TimePeriod["SIX_HOURS"] = "6h";
  TimePeriod["ONE_DAY"] = "1d";
  TimePeriod["THREE_DAYS"] = "3d";
  TimePeriod["SEVEN_DAYS"] = "10000m";
  TimePeriod["FOURTEEN_DAYS"] = "14d";
  TimePeriod["THIRTY_DAYS"] = "30d";
})(TimePeriod || (TimePeriod = {}));

let TimeWindow;

(function (TimeWindow) {
  TimeWindow[TimeWindow["ONE_MINUTE"] = 1] = "ONE_MINUTE";
  TimeWindow[TimeWindow["FIVE_MINUTES"] = 5] = "FIVE_MINUTES";
  TimeWindow[TimeWindow["TEN_MINUTES"] = 10] = "TEN_MINUTES";
  TimeWindow[TimeWindow["FIFTEEN_MINUTES"] = 15] = "FIFTEEN_MINUTES";
  TimeWindow[TimeWindow["THIRTY_MINUTES"] = 30] = "THIRTY_MINUTES";
  TimeWindow[TimeWindow["ONE_HOUR"] = 60] = "ONE_HOUR";
  TimeWindow[TimeWindow["TWO_HOURS"] = 120] = "TWO_HOURS";
  TimeWindow[TimeWindow["FOUR_HOURS"] = 240] = "FOUR_HOURS";
  TimeWindow[TimeWindow["ONE_DAY"] = 1440] = "ONE_DAY";
})(TimeWindow || (TimeWindow = {}));

let ActionType;

(function (ActionType) {
  ActionType["EMAIL"] = "email";
  ActionType["SLACK"] = "slack";
  ActionType["PAGERDUTY"] = "pagerduty";
  ActionType["MSTEAMS"] = "msteams";
  ActionType["SENTRY_APP"] = "sentry_app";
})(ActionType || (ActionType = {}));

const ActionLabel = {
  // \u200B is needed because Safari disregards autocomplete="off". It's seeing "Email" and
  // opening up the browser autocomplete for email. https://github.com/JedWatson/react-select/issues/3500
  [ActionType.EMAIL]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Emai\u200Bl'),
  [ActionType.SLACK]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Slack'),
  [ActionType.PAGERDUTY]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Pagerduty'),
  [ActionType.MSTEAMS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('MS Teams'),
  [ActionType.SENTRY_APP]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Notification')
};
let TargetType;

(function (TargetType) {
  TargetType["SPECIFIC"] = "specific";
  TargetType["USER"] = "user";
  TargetType["TEAM"] = "team";
  TargetType["SENTRY_APP"] = "sentry_app";
})(TargetType || (TargetType = {}));

const TargetLabel = {
  [TargetType.USER]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Member'),
  [TargetType.TEAM]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Team')
};
/**
 * This is an available action template that is associated to a Trigger in a
 * Metric Alert Rule. They are defined by the available-actions API.
 */

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

/***/ }),

/***/ "./app/views/performance/vitalDetail/index.tsx":
/*!*****************************************************!*\
  !*** ./app/views/performance/vitalDetail/index.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var sentry_actionCreators_tags__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/actionCreators/tags */ "./app/actionCreators/tags.tsx");
/* harmony import */ var sentry_components_noProjectMessage__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/noProjectMessage */ "./app/components/noProjectMessage.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/container */ "./app/components/organizations/pageFilters/container.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_organization__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/organization */ "./app/styles/organization.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/fields */ "./app/utils/fields/index.ts");
/* harmony import */ var sentry_utils_performance_contexts_performanceEventViewContext__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/performance/contexts/performanceEventViewContext */ "./app/utils/performance/contexts/performanceEventViewContext.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/withPageFilters */ "./app/utils/withPageFilters.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var _data__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ../data */ "./app/views/performance/data.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ../utils */ "./app/views/performance/utils.tsx");
/* harmony import */ var _vitalDetailContent__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ./vitalDetailContent */ "./app/views/performance/vitalDetail/vitalDetailContent.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }























class VitalDetail extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      eventView: (0,_data__WEBPACK_IMPORTED_MODULE_21__.generatePerformanceVitalDetailView)(this.props.location)
    });
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    return { ...prevState,
      eventView: (0,_data__WEBPACK_IMPORTED_MODULE_21__.generatePerformanceVitalDetailView)(nextProps.location)
    };
  }

  componentDidMount() {
    const {
      api,
      organization,
      selection,
      location,
      projects
    } = this.props;
    (0,sentry_actionCreators_tags__WEBPACK_IMPORTED_MODULE_7__.loadOrganizationTags)(api, organization.slug, selection);
    (0,_utils__WEBPACK_IMPORTED_MODULE_22__.addRoutePerformanceContext)(selection);
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_13__["default"])('performance_views.vital_detail.view', {
      organization,
      project_platforms: (0,_utils__WEBPACK_IMPORTED_MODULE_22__.getSelectedProjectPlatforms)(location, projects)
    });
  }

  componentDidUpdate(prevProps) {
    const {
      api,
      organization,
      selection
    } = this.props;

    if (!lodash_isEqual__WEBPACK_IMPORTED_MODULE_6___default()(prevProps.selection.projects, selection.projects) || !lodash_isEqual__WEBPACK_IMPORTED_MODULE_6___default()(prevProps.selection.datetime, selection.datetime)) {
      (0,sentry_actionCreators_tags__WEBPACK_IMPORTED_MODULE_7__.loadOrganizationTags)(api, organization.slug, selection);
      (0,_utils__WEBPACK_IMPORTED_MODULE_22__.addRoutePerformanceContext)(selection);
    }
  }

  getDocumentTitle() {
    const name = (0,_utils__WEBPACK_IMPORTED_MODULE_22__.getTransactionName)(this.props.location);
    const hasTransactionName = typeof name === 'string' && String(name).trim().length > 0;

    if (hasTransactionName) {
      return [String(name).trim(), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Performance')].join(' - ');
    }

    return [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Vital Detail'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Performance')].join(' - ');
  }

  render() {
    const {
      organization,
      location,
      router,
      api
    } = this.props;
    const {
      eventView
    } = this.state;

    if (!eventView) {
      react_router__WEBPACK_IMPORTED_MODULE_5__.browserHistory.replace({
        pathname: `/organizations/${organization.slug}/performance/`,
        query: { ...location.query
        }
      });
      return null;
    }

    const vitalNameQuery = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_16__.decodeScalar)(location.query.vitalName);
    const vitalName = Object.values(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__.WebVital).indexOf(vitalNameQuery) === -1 ? undefined : vitalNameQuery;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_10__["default"], {
      title: this.getDocumentTitle(),
      orgSlug: organization.slug,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_utils_performance_contexts_performanceEventViewContext__WEBPACK_IMPORTED_MODULE_15__.PerformanceEventViewProvider, {
        value: {
          eventView: this.state.eventView
        },
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_9__["default"], {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(StyledPageContent, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_noProjectMessage__WEBPACK_IMPORTED_MODULE_8__["default"], {
              organization: organization,
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(_vitalDetailContent__WEBPACK_IMPORTED_MODULE_23__["default"], {
                location: location,
                organization: organization,
                eventView: eventView,
                router: router,
                vitalName: vitalName || sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__.WebVital.LCP,
                api: api
              })
            })
          })
        })
      })
    });
  }

}

VitalDetail.displayName = "VitalDetail";

const StyledPageContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_12__.PageContent,  true ? {
  target: "ekkkevo0"
} : 0)( true ? {
  name: "1hcx8jb",
  styles: "padding:0"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_17__["default"])((0,sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_19__["default"])((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_20__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_18__["default"])(VitalDetail)))));

/***/ }),

/***/ "./app/views/performance/vitalDetail/table.tsx":
/*!*****************************************************!*\
  !*** ./app/views/performance/vitalDetail/table.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "getProjectID": () => (/* binding */ getProjectID)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/gridEditable */ "./app/components/gridEditable/index.tsx");
/* harmony import */ var sentry_components_gridEditable_sortLink__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/gridEditable/sortLink */ "./app/components/gridEditable/sortLink.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_tag__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/tag */ "./app/components/tag.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/discover/fieldRenderers */ "./app/utils/discover/fieldRenderers.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_performance_vitals_vitalsDetailsTableQuery__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/performance/vitals/vitalsDetailsTableQuery */ "./app/utils/performance/vitals/vitalsDetailsTableQuery.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/views/eventsV2/table/cellAction */ "./app/views/eventsV2/table/cellAction.tsx");
/* harmony import */ var _transactionSummary_transactionOverview_charts__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ../transactionSummary/transactionOverview/charts */ "./app/views/performance/transactionSummary/transactionOverview/charts.tsx");
/* harmony import */ var _transactionSummary_utils__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ../transactionSummary/utils */ "./app/views/performance/transactionSummary/utils.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ../utils */ "./app/views/performance/utils.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ./utils */ "./app/views/performance/vitalDetail/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }























const COLUMN_TITLES = ['Transaction', 'Project', 'Unique Users', 'Count'];

const getTableColumnTitle = (index, vitalName) => {
  const abbrev = _utils__WEBPACK_IMPORTED_MODULE_23__.vitalAbbreviations[vitalName];
  const titles = [...COLUMN_TITLES, `p50(${abbrev})`, `p75(${abbrev})`, `p95(${abbrev})`, `Status`];
  return titles[index];
};

function getProjectID(eventData, projects) {
  const projectSlug = (eventData === null || eventData === void 0 ? void 0 : eventData.project) || undefined;

  if (typeof projectSlug === undefined) {
    return undefined;
  }

  const project = projects.find(currentProject => currentProject.slug === projectSlug);

  if (!project) {
    return undefined;
  }

  return project.id;
}

class Table extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      widths: []
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleCellAction", column => {
      return (action, value) => {
        const {
          eventView,
          location,
          organization
        } = this.props;
        (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_13__.trackAnalyticsEvent)({
          eventKey: 'performance_views.overview.cellaction',
          eventName: 'Performance Views: Cell Action Clicked',
          organization_id: parseInt(organization.id, 10),
          action
        });
        const searchConditions = (0,_transactionSummary_utils__WEBPACK_IMPORTED_MODULE_21__.normalizeSearchConditionsWithTransactionName)(eventView.query);
        (0,sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_19__.updateQuery)(searchConditions, action, column, value);
        react_router__WEBPACK_IMPORTED_MODULE_5__.browserHistory.push({
          pathname: location.pathname,
          query: { ...location.query,
            cursor: undefined,
            query: searchConditions.formatString()
          }
        });
      };
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderBodyCellWithData", (tableData, vitalName) => {
      return (column, dataRow) => this.renderBodyCell(tableData, column, dataRow, vitalName);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderHeadCellWithMeta", (vitalName, tableMeta) => {
      return (column, index) => this.renderHeadCell(column, getTableColumnTitle(index, vitalName), tableMeta);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderPrependCellWithData", (tableData, vitalName) => {
      const {
        eventView
      } = this.props;
      const teamKeyTransactionColumn = eventView.getColumns().find(col => col.name === 'team_key_transaction');
      return (isHeader, dataRow) => {
        if (teamKeyTransactionColumn) {
          if (isHeader) {
            var _tableData$meta;

            const star = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconStar, {
              color: "yellow300",
              isSolid: true,
              "data-test-id": "key-transaction-header"
            }, "keyTransaction");

            return [this.renderHeadCell(teamKeyTransactionColumn, star, tableData === null || tableData === void 0 ? void 0 : (_tableData$meta = tableData.meta) === null || _tableData$meta === void 0 ? void 0 : _tableData$meta.fields)];
          }

          return [this.renderBodyCell(tableData, teamKeyTransactionColumn, dataRow, vitalName)];
        }

        return [];
      };
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSummaryClick", () => {
      const {
        organization,
        projects,
        location
      } = this.props;
      (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_13__.trackAnalyticsEvent)({
        eventKey: 'performance_views.overview.navigate.summary',
        eventName: 'Performance Views: Overview view summary',
        organization_id: parseInt(organization.id, 10),
        project_platforms: (0,_utils__WEBPACK_IMPORTED_MODULE_22__.getSelectedProjectPlatforms)(location, projects)
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleResizeColumn", (columnIndex, nextColumn) => {
      const widths = [...this.state.widths];
      widths[columnIndex] = nextColumn.width ? Number(nextColumn.width) : sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_6__.COL_WIDTH_UNDEFINED;
      this.setState({
        widths
      });
    });
  }

  renderBodyCell(tableData, column, dataRow, vitalName) {
    var _tableData$meta2, _tableData$meta3;

    const {
      eventView,
      organization,
      projects,
      location,
      summaryConditions
    } = this.props;

    if (!tableData || !((_tableData$meta2 = tableData.meta) !== null && _tableData$meta2 !== void 0 && _tableData$meta2.fields)) {
      return dataRow[column.key];
    }

    const tableMeta = (_tableData$meta3 = tableData.meta) === null || _tableData$meta3 === void 0 ? void 0 : _tableData$meta3.fields;
    const field = String(column.key);

    if (field === (0,_utils__WEBPACK_IMPORTED_MODULE_23__.getVitalDetailTablePoorStatusFunction)(vitalName)) {
      if (dataRow[field]) {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(UniqueTagCell, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(PoorTag, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Poor')
          })
        });
      }

      if (dataRow[(0,_utils__WEBPACK_IMPORTED_MODULE_23__.getVitalDetailTableMehStatusFunction)(vitalName)]) {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(UniqueTagCell, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(MehTag, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Meh')
          })
        });
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(UniqueTagCell, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(GoodTag, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Good')
        })
      });
    }

    const fieldRenderer = (0,sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_15__.getFieldRenderer)(field, tableMeta, false);
    const rendered = fieldRenderer(dataRow, {
      organization,
      location
    });
    const allowActions = [sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_19__.Actions.ADD, sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_19__.Actions.EXCLUDE, sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_19__.Actions.SHOW_GREATER_THAN, sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_19__.Actions.SHOW_LESS_THAN];

    if (field === 'transaction') {
      const projectID = getProjectID(dataRow, projects);
      const summaryView = eventView.clone();
      const conditions = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_18__.MutableSearch(summaryConditions);
      conditions.addFilterValues('has', [`${vitalName}`]);
      summaryView.query = conditions.formatString();
      const transaction = String(dataRow.transaction) || '';
      const target = (0,_transactionSummary_utils__WEBPACK_IMPORTED_MODULE_21__.transactionSummaryRouteWithQuery)({
        orgSlug: organization.slug,
        transaction,
        query: summaryView.generateQueryStringObject(),
        projectID,
        showTransactions: _transactionSummary_utils__WEBPACK_IMPORTED_MODULE_21__.TransactionFilterOptions.RECENT,
        display: _transactionSummary_transactionOverview_charts__WEBPACK_IMPORTED_MODULE_20__.DisplayModes.VITALS
      });
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_19__["default"], {
        column: column,
        dataRow: dataRow,
        handleCellAction: this.handleCellAction(column),
        allowActions: allowActions,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__["default"], {
          to: target,
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('See transaction summary of the transaction %s', transaction),
          onClick: this.handleSummaryClick,
          children: rendered
        })
      });
    }

    if (field.startsWith('team_key_transaction')) {
      return rendered;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_19__["default"], {
      column: column,
      dataRow: dataRow,
      handleCellAction: this.handleCellAction(column),
      allowActions: allowActions,
      children: rendered
    });
  }

  renderHeadCell(column, title, tableMeta) {
    const {
      eventView,
      location
    } = this.props; // TODO: Need to map table meta keys to aggregate alias since eventView sorting still expects
    // aggregate aliases for now. We'll need to refactor event view to get rid of all aggregate
    // alias references and then we can remove this.

    const aggregateAliasTableMeta = tableMeta ? {} : undefined;

    if (tableMeta) {
      Object.keys(tableMeta).forEach(key => {
        aggregateAliasTableMeta[(0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.getAggregateAlias)(key)] = tableMeta[key];
      });
    }

    const align = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.fieldAlignment)(column.name, column.type, aggregateAliasTableMeta);
    const field = {
      field: column.name,
      width: column.width
    };

    function generateSortLink() {
      if (!aggregateAliasTableMeta) {
        return undefined;
      }

      const nextEventView = eventView.sortOnField(field, aggregateAliasTableMeta);
      const queryStringObject = nextEventView.generateQueryStringObject();
      return { ...location,
        query: { ...location.query,
          sort: queryStringObject.sort
        }
      };
    }

    const currentSort = eventView.sortForField(field, aggregateAliasTableMeta);
    const canSort = (0,sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_14__.isFieldSortable)(field, aggregateAliasTableMeta);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_gridEditable_sortLink__WEBPACK_IMPORTED_MODULE_7__["default"], {
      align: align,
      title: title || field.field,
      direction: currentSort ? currentSort.kind : undefined,
      canSort: canSort,
      generateSortLink: generateSortLink
    });
  }

  getSortedEventView(vitalName) {
    const {
      eventView
    } = this.props;
    const aggregateFieldPoor = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.getAggregateAlias)((0,_utils__WEBPACK_IMPORTED_MODULE_23__.getVitalDetailTablePoorStatusFunction)(vitalName));
    const aggregateFieldMeh = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.getAggregateAlias)((0,_utils__WEBPACK_IMPORTED_MODULE_23__.getVitalDetailTableMehStatusFunction)(vitalName));
    const isSortingByStatus = eventView.sorts.some(sort => sort.field.includes(aggregateFieldPoor) || sort.field.includes(aggregateFieldMeh));
    const additionalSorts = isSortingByStatus ? [] : [{
      field: 'team_key_transaction',
      kind: 'desc'
    }, {
      field: aggregateFieldPoor,
      kind: 'desc'
    }, {
      field: aggregateFieldMeh,
      kind: 'desc'
    }];
    return eventView.withSorts([...additionalSorts, ...eventView.sorts]);
  }

  render() {
    const {
      eventView,
      organization,
      location
    } = this.props;
    const {
      widths
    } = this.state;
    const fakeColumnView = eventView.clone();
    fakeColumnView.fields = [...eventView.fields];
    const columnOrder = fakeColumnView.getColumns() // remove key_transactions from the column order as we'll be rendering it
    // via a prepended column
    .filter(col => col.name !== 'team_key_transaction').slice(0, -1).map((col, i) => {
      if (typeof widths[i] === 'number') {
        return { ...col,
          width: widths[i]
        };
      }

      return col;
    });
    const vitalName = (0,_utils__WEBPACK_IMPORTED_MODULE_23__.vitalNameFromLocation)(location);
    const sortedEventView = this.getSortedEventView(vitalName);
    const columnSortBy = sortedEventView.getSorts();
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)("div", {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_utils_performance_vitals_vitalsDetailsTableQuery__WEBPACK_IMPORTED_MODULE_17__["default"], {
        eventView: sortedEventView,
        orgSlug: organization.slug,
        location: location,
        limit: 10,
        referrer: "api.performance.vital-detail",
        children: _ref => {
          var _tableData$meta4;

          let {
            pageLinks,
            isLoading,
            tableData
          } = _ref;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_6__["default"], {
              isLoading: isLoading,
              data: tableData ? tableData.data : [],
              columnOrder: columnOrder,
              columnSortBy: columnSortBy,
              grid: {
                onResizeColumn: this.handleResizeColumn,
                renderHeadCell: this.renderHeadCellWithMeta(vitalName, tableData === null || tableData === void 0 ? void 0 : (_tableData$meta4 = tableData.meta) === null || _tableData$meta4 === void 0 ? void 0 : _tableData$meta4.fields),
                renderBodyCell: this.renderBodyCellWithData(tableData, vitalName),
                renderPrependColumns: this.renderPrependCellWithData(tableData, vitalName),
                prependColumnWidths: ['max-content']
              },
              location: location
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_9__["default"], {
              pageLinks: pageLinks
            })]
          });
        }
      })
    });
  }

}

Table.displayName = "Table";

const UniqueTagCell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ebw8yf93"
} : 0)( true ? {
  name: "1gnrgb9",
  styles: "text-align:right;justify-self:flex-end;flex-grow:1"
} : 0);

const GoodTag = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_tag__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "ebw8yf92"
} : 0)("div{background-color:", p => p.theme[_utils__WEBPACK_IMPORTED_MODULE_23__.vitalStateColors[_utils__WEBPACK_IMPORTED_MODULE_23__.VitalState.GOOD]], ";}span{color:", p => p.theme.white, ";}" + ( true ? "" : 0));

const MehTag = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_tag__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "ebw8yf91"
} : 0)("div{background-color:", p => p.theme[_utils__WEBPACK_IMPORTED_MODULE_23__.vitalStateColors[_utils__WEBPACK_IMPORTED_MODULE_23__.VitalState.MEH]], ";}span{color:", p => p.theme.white, ";}" + ( true ? "" : 0));

const PoorTag = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_tag__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "ebw8yf90"
} : 0)("div{background-color:", p => p.theme[_utils__WEBPACK_IMPORTED_MODULE_23__.vitalStateColors[_utils__WEBPACK_IMPORTED_MODULE_23__.VitalState.POOR]], ";}span{color:", p => p.theme.white, ";}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Table);

/***/ }),

/***/ "./app/views/performance/vitalDetail/vitalChart.tsx":
/*!**********************************************************!*\
  !*** ./app/views/performance/vitalDetail/vitalChart.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "_VitalChart": () => (/* binding */ _VitalChart),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/chartZoom */ "./app/components/charts/chartZoom.tsx");
/* harmony import */ var sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/errorPanel */ "./app/components/charts/errorPanel.tsx");
/* harmony import */ var sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/eventsRequest */ "./app/components/charts/eventsRequest.tsx");
/* harmony import */ var sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/lineChart */ "./app/components/charts/lineChart.tsx");
/* harmony import */ var sentry_components_charts_releaseSeries__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/charts/releaseSeries */ "./app/components/charts/releaseSeries.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/charts/transitionChart */ "./app/components/charts/transitionChart.tsx");
/* harmony import */ var sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/charts/transparentLoadingMask */ "./app/components/charts/transparentLoadingMask.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/discover/charts */ "./app/utils/discover/charts.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_fields__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/fields */ "./app/utils/fields/index.ts");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var _trends_utils__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ../trends/utils */ "./app/views/performance/trends/utils.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ./utils */ "./app/views/performance/vitalDetail/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


// eslint-disable-next-line no-restricted-imports
























function VitalChart(_ref) {
  let {
    project,
    environment,
    location,
    organization,
    query,
    statsPeriod,
    router,
    start,
    end,
    interval
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_19__["default"])();
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_22__.a)();
  const vitalName = (0,_utils__WEBPACK_IMPORTED_MODULE_21__.vitalNameFromLocation)(location);
  const yAxis = `p75(${vitalName})`;
  const {
    utc,
    legend,
    vitalPoor,
    markLines,
    chartOptions
  } = (0,_utils__WEBPACK_IMPORTED_MODULE_21__.getVitalChartDefinitions)({
    theme,
    location,
    yAxis,
    vital: vitalName
  });

  function handleLegendSelectChanged(legendChange) {
    const {
      selected
    } = legendChange;
    const unselected = Object.keys(selected).filter(key => !selected[key]);
    const to = { ...location,
      query: { ...location.query,
        unselectedSeries: unselected
      }
    };
    react_router__WEBPACK_IMPORTED_MODULE_2__.browserHistory.push(to);
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__.Panel, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_8__.ChartContainer, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_8__.HeaderTitleLegend, {
        children: [(0,_utils__WEBPACK_IMPORTED_MODULE_21__.getVitalChartTitle)(vitalName), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_12__["default"], {
          size: "sm",
          position: "top",
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)(`The durations shown should fall under the vital threshold.`)
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_3__["default"], {
        router: router,
        period: statsPeriod,
        start: start,
        end: end,
        utc: utc,
        children: zoomRenderProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_5__["default"], {
          api: api,
          organization: organization,
          period: statsPeriod,
          project: project,
          environment: environment,
          start: start,
          end: end,
          interval: interval,
          showLoading: false,
          query: query,
          includePrevious: false,
          yAxis: [yAxis],
          partial: true,
          children: _ref2 => {
            let {
              timeseriesData: results,
              errored,
              loading,
              reloading
            } = _ref2;

            if (errored) {
              return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_4__["default"], {
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_13__.IconWarning, {
                  color: "gray500",
                  size: "lg"
                })
              });
            }

            const colors = results && theme.charts.getColorPalette(results.length - 2) || [];
            const {
              smoothedResults
            } = (0,_trends_utils__WEBPACK_IMPORTED_MODULE_20__.transformEventStatsSmoothed)(results);
            const smoothedSeries = smoothedResults ? smoothedResults.map((_ref3, i) => {
              let {
                seriesName,
                ...rest
              } = _ref3;
              return {
                seriesName: (0,_trends_utils__WEBPACK_IMPORTED_MODULE_20__.replaceSeriesName)(seriesName) || 'p75',
                ...rest,
                color: colors[i],
                lineStyle: {
                  opacity: 1,
                  width: 2
                }
              };
            }) : [];
            const seriesMax = (0,_utils__WEBPACK_IMPORTED_MODULE_21__.getMaxOfSeries)(smoothedSeries);
            const yAxisMax = Math.max(seriesMax, vitalPoor);
            chartOptions.yAxis.max = yAxisMax * 1.1;
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_charts_releaseSeries__WEBPACK_IMPORTED_MODULE_7__["default"], {
              start: start,
              end: end,
              period: statsPeriod,
              utc: utc,
              projects: project,
              environments: environment,
              children: _ref4 => {
                let {
                  releaseSeries
                } = _ref4;
                return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_9__["default"], {
                  loading: loading,
                  reloading: reloading,
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_10__["default"], {
                    visible: reloading
                  }), (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_18__["default"])({
                    value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_6__.LineChart, { ...zoomRenderProps,
                      ...chartOptions,
                      legend: legend,
                      onLegendSelectChanged: handleLegendSelectChanged,
                      series: [...markLines, ...releaseSeries, ...smoothedSeries]
                    }),
                    fixed: 'Web Vitals Chart'
                  })]
                });
              }
            });
          }
        })
      })]
    })
  });
}

VitalChart.displayName = "VitalChart";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_2__.withRouter)(VitalChart));

function fieldToVitalType(seriesName, vitalFields) {
  if (seriesName === (vitalFields === null || vitalFields === void 0 ? void 0 : vitalFields.poorCountField.replace('equation|', ''))) {
    return _utils__WEBPACK_IMPORTED_MODULE_21__.VitalState.POOR;
  }

  if (seriesName === (vitalFields === null || vitalFields === void 0 ? void 0 : vitalFields.mehCountField.replace('equation|', ''))) {
    return _utils__WEBPACK_IMPORTED_MODULE_21__.VitalState.MEH;
  }

  if (seriesName === (vitalFields === null || vitalFields === void 0 ? void 0 : vitalFields.goodCountField.replace('equation|', ''))) {
    return _utils__WEBPACK_IMPORTED_MODULE_21__.VitalState.GOOD;
  }

  return undefined;
}

function _VitalChart(props) {
  const {
    field: yAxis,
    data: _results,
    loading,
    reloading,
    height,
    grid,
    utc,
    vitalFields
  } = props;
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_22__.a)();

  if (!_results || !vitalFields) {
    return null;
  }

  const chartOptions = {
    grid,
    seriesOptions: {
      showSymbol: false
    },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value, seriesName) => {
        return (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_15__.tooltipFormatter)(value, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.aggregateOutputType)(vitalFields[0] === sentry_utils_fields__WEBPACK_IMPORTED_MODULE_17__.WebVital.CLS ? seriesName : yAxis));
      }
    },
    xAxis: {
      show: false
    },
    xAxes: undefined,
    yAxis: {
      axisLabel: {
        color: theme.chartLabel,
        showMaxLabel: false,
        formatter: value => (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_15__.axisLabelFormatter)(value, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.aggregateOutputType)(yAxis))
      }
    },
    utc,
    isGroupedByDate: true,
    showTimeInTooltip: true
  };

  const results = _results.filter(s => !!fieldToVitalType(s.seriesName, vitalFields));

  const smoothedSeries = results !== null && results !== void 0 && results.length ? results.map(_ref5 => {
    let {
      seriesName,
      ...rest
    } = _ref5;
    const adjustedSeries = fieldToVitalType(seriesName, vitalFields) || 'count';
    return {
      seriesName: adjustedSeries,
      ...rest,
      color: theme[_utils__WEBPACK_IMPORTED_MODULE_21__.vitalStateColors[adjustedSeries]],
      lineStyle: {
        opacity: 1,
        width: 2
      }
    };
  }) : [];
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)("div", {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_9__["default"], {
      loading: loading,
      reloading: reloading,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_10__["default"], {
        visible: reloading
      }), (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_18__["default"])({
        value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_6__.LineChart, {
          height: height,
          ...chartOptions,
          onLegendSelectChanged: () => {},
          series: [...smoothedSeries],
          isGroupedByDate: true
        }),
        fixed: 'Web Vitals Chart'
      })]
    })
  });
}
_VitalChart.displayName = "_VitalChart";

/***/ }),

/***/ "./app/views/performance/vitalDetail/vitalDetailContent.tsx":
/*!******************************************************************!*\
  !*** ./app/views/performance/vitalDetail/vitalDetailContent.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_components_createAlertButton__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/createAlertButton */ "./app/components/createAlertButton.tsx");
/* harmony import */ var sentry_components_datePageFilter__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/datePageFilter */ "./app/components/datePageFilter.tsx");
/* harmony import */ var sentry_components_dropdownMenuControl__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/dropdownMenuControl */ "./app/components/dropdownMenuControl.tsx");
/* harmony import */ var sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/environmentPageFilter */ "./app/components/environmentPageFilter.tsx");
/* harmony import */ var sentry_components_events_searchBar__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/events/searchBar */ "./app/components/events/searchBar.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_organizations_pageFilterBar__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/organizations/pageFilterBar */ "./app/components/organizations/pageFilterBar.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_components_performance_teamKeyTransactionsManager__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/components/performance/teamKeyTransactionsManager */ "./app/components/performance/teamKeyTransactionsManager.tsx");
/* harmony import */ var sentry_components_projectPageFilter__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/components/projectPageFilter */ "./app/components/projectPageFilter.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_fields__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/utils/fields */ "./app/utils/fields/index.ts");
/* harmony import */ var sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! sentry/utils/performance/vitals/constants */ "./app/utils/performance/vitals/constants.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_teams__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! sentry/utils/teams */ "./app/utils/teams.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var _breadcrumb__WEBPACK_IMPORTED_MODULE_32__ = __webpack_require__(/*! ../breadcrumb */ "./app/views/performance/breadcrumb.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_33__ = __webpack_require__(/*! ../utils */ "./app/views/performance/utils.tsx");
/* harmony import */ var _table__WEBPACK_IMPORTED_MODULE_34__ = __webpack_require__(/*! ./table */ "./app/views/performance/vitalDetail/table.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_35__ = __webpack_require__(/*! ./utils */ "./app/views/performance/vitalDetail/utils.tsx");
/* harmony import */ var _vitalChart__WEBPACK_IMPORTED_MODULE_36__ = __webpack_require__(/*! ./vitalChart */ "./app/views/performance/vitalDetail/vitalChart.tsx");
/* harmony import */ var _vitalInfo__WEBPACK_IMPORTED_MODULE_37__ = __webpack_require__(/*! ./vitalInfo */ "./app/views/performance/vitalDetail/vitalInfo.tsx");
/* harmony import */ var _vitalsComparison__WEBPACK_IMPORTED_MODULE_38__ = __webpack_require__(/*! ./vitalsComparison */ "./app/views/performance/vitalDetail/vitalsComparison.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









































const FRONTEND_VITALS = [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_26__.WebVital.FCP, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_26__.WebVital.LCP, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_26__.WebVital.FID, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_26__.WebVital.CLS];

function getSummaryConditions(query) {
  const parsed = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_30__.MutableSearch(query);
  parsed.freeText = [];
  return parsed.formatString();
}

function VitalDetailContent(props) {
  const [error, setError] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(undefined);

  function handleSearch(query) {
    const {
      location
    } = props;
    const queryParams = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_18__.normalizeDateTimeParams)({ ...(location.query || {}),
      query
    }); // do not propagate pagination when making a new search

    const searchQueryParams = lodash_omit__WEBPACK_IMPORTED_MODULE_5___default()(queryParams, 'cursor');
    react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.push({
      pathname: location.pathname,
      query: searchQueryParams
    });
  }

  function renderCreateAlertButton() {
    const {
      eventView,
      organization,
      projects,
      vitalName
    } = props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(sentry_components_createAlertButton__WEBPACK_IMPORTED_MODULE_10__.CreateAlertFromViewButton, {
      eventView: eventView,
      organization: organization,
      projects: projects,
      "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Create Alert'),
      alertType: _utils__WEBPACK_IMPORTED_MODULE_35__.vitalAlertTypes[vitalName],
      referrer: "performance"
    });
  }

  function renderVitalSwitcher() {
    const {
      vitalName,
      location,
      organization
    } = props;
    const position = FRONTEND_VITALS.indexOf(vitalName);

    if (position < 0) {
      return null;
    }

    const items = FRONTEND_VITALS.reduce((acc, newVitalName) => {
      const itemProps = {
        key: newVitalName,
        label: _utils__WEBPACK_IMPORTED_MODULE_35__.vitalAbbreviations[newVitalName],
        onAction: function switchWebVital() {
          var _vitalAbbreviations$v, _vitalAbbreviations$n;

          react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.push({
            pathname: location.pathname,
            query: { ...location.query,
              vitalName: newVitalName,
              cursor: undefined
            }
          });
          (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_24__["default"])('performance_views.vital_detail.switch_vital', {
            organization,
            from_vital: (_vitalAbbreviations$v = _utils__WEBPACK_IMPORTED_MODULE_35__.vitalAbbreviations[vitalName]) !== null && _vitalAbbreviations$v !== void 0 ? _vitalAbbreviations$v : 'undefined',
            to_vital: (_vitalAbbreviations$n = _utils__WEBPACK_IMPORTED_MODULE_35__.vitalAbbreviations[newVitalName]) !== null && _vitalAbbreviations$n !== void 0 ? _vitalAbbreviations$n : 'undefined'
          });
        }
      };

      if (vitalName === newVitalName) {
        acc.unshift(itemProps);
      } else {
        acc.push(itemProps);
      }

      return acc;
    }, []);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(sentry_components_dropdownMenuControl__WEBPACK_IMPORTED_MODULE_12__["default"], {
      items: items,
      triggerLabel: _utils__WEBPACK_IMPORTED_MODULE_35__.vitalAbbreviations[vitalName],
      triggerProps: {
        'aria-label': `Web Vitals: ${_utils__WEBPACK_IMPORTED_MODULE_35__.vitalAbbreviations[vitalName]}`,
        prefix: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Web Vitals')
      },
      placement: "bottom left"
    });
  }

  function renderError() {
    if (!error) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_7__["default"], {
      type: "error",
      showIcon: true,
      children: error
    });
  }

  function renderContent(vital) {
    const {
      location,
      organization,
      eventView,
      projects
    } = props;
    const {
      fields,
      start,
      end,
      statsPeriod,
      environment,
      project
    } = eventView;
    const query = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_28__.decodeScalar)(location.query.query, '');
    const orgSlug = organization.slug;
    const localDateStart = start ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_25__.getUtcToLocalDateObject)(start) : null;
    const localDateEnd = end ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_25__.getUtcToLocalDateObject)(end) : null;
    const interval = (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_9__.getInterval)({
      start: localDateStart,
      end: localDateEnd,
      period: statsPeriod
    }, 'high');
    const filterString = (0,_utils__WEBPACK_IMPORTED_MODULE_33__.getTransactionSearchQuery)(location);
    const summaryConditions = getSummaryConditions(filterString);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsxs)(FilterActions, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsxs)(sentry_components_organizations_pageFilterBar__WEBPACK_IMPORTED_MODULE_17__["default"], {
          condensed: true,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(sentry_components_projectPageFilter__WEBPACK_IMPORTED_MODULE_20__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_13__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(sentry_components_datePageFilter__WEBPACK_IMPORTED_MODULE_11__["default"], {
            alignDropdown: "left"
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(sentry_components_events_searchBar__WEBPACK_IMPORTED_MODULE_14__["default"], {
          searchSource: "performance_vitals",
          organization: organization,
          projectIds: project,
          query: query,
          fields: fields,
          onSearch: handleSearch
        })]
      }), organization.experiments.VitalsAlertExperiment ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(_vitalsComparison__WEBPACK_IMPORTED_MODULE_38__["default"], {
        organization,
        location,
        vital,
        project,
        end,
        environment,
        statsPeriod,
        start
      }) : null, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(_vitalChart__WEBPACK_IMPORTED_MODULE_36__["default"], {
        organization: organization,
        query: query,
        project: project,
        environment: environment,
        start: localDateStart,
        end: localDateEnd,
        statsPeriod: statsPeriod,
        interval: interval
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(StyledVitalInfo, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(_vitalInfo__WEBPACK_IMPORTED_MODULE_37__["default"], {
          orgSlug: orgSlug,
          location: location,
          vital: vital,
          project: project,
          environment: environment,
          start: start,
          end: end,
          statsPeriod: statsPeriod
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(sentry_utils_teams__WEBPACK_IMPORTED_MODULE_29__["default"], {
        provideUserTeams: true,
        children: _ref => {
          let {
            teams,
            initiallyLoaded
          } = _ref;
          return initiallyLoaded ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(sentry_components_performance_teamKeyTransactionsManager__WEBPACK_IMPORTED_MODULE_19__.Provider, {
            organization: organization,
            teams: teams,
            selectedTeams: ['myteams'],
            selectedProjects: project.map(String),
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(_table__WEBPACK_IMPORTED_MODULE_34__["default"], {
              eventView: eventView,
              projects: projects,
              organization: organization,
              location: location,
              setError: setError,
              summaryConditions: summaryConditions
            })
          }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_16__["default"], {});
        }
      })]
    });
  }

  const {
    location,
    organization,
    vitalName
  } = props;
  const vital = vitalName || sentry_utils_fields__WEBPACK_IMPORTED_MODULE_26__.WebVital.LCP;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_15__.Header, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_15__.HeaderContent, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(_breadcrumb__WEBPACK_IMPORTED_MODULE_32__["default"], {
          organization: organization,
          location: location,
          vitalName: vital
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_15__.Title, {
          children: _utils__WEBPACK_IMPORTED_MODULE_35__.vitalMap[vital]
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_15__.HeaderActions, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_8__["default"], {
          gap: 1,
          children: [renderVitalSwitcher(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_6__["default"], {
            organization: organization,
            features: ['incidents'],
            children: _ref2 => {
              let {
                hasFeature
              } = _ref2;
              return hasFeature && renderCreateAlertButton();
            }
          })]
        })
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_15__.Body, {
      children: [renderError(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_15__.Main, {
        fullWidth: true,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(StyledDescription, {
          children: _utils__WEBPACK_IMPORTED_MODULE_35__.vitalDescription[vitalName]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(SupportedBrowsers, {
          children: Object.values(sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_27__.Browser).map(browser => {
            var _vitalSupportedBrowse;

            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsxs)(BrowserItem, {
              children: [(_vitalSupportedBrowse = _utils__WEBPACK_IMPORTED_MODULE_35__.vitalSupportedBrowsers[vitalName]) !== null && _vitalSupportedBrowse !== void 0 && _vitalSupportedBrowse.includes(browser) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_21__.IconCheckmark, {
                color: "green300",
                size: "sm"
              }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_39__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_21__.IconClose, {
                color: "red300",
                size: "sm"
              }), browser]
            }, browser);
          })
        }), renderContent(vital)]
      })]
    })]
  });
}

VitalDetailContent.displayName = "VitalDetailContent";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_31__["default"])(VitalDetailContent));

const StyledDescription = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e150wv1u4"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_23__["default"])(3), ";" + ( true ? "" : 0));

const StyledVitalInfo = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e150wv1u3"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_23__["default"])(3), ";" + ( true ? "" : 0));

const SupportedBrowsers = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e150wv1u2"
} : 0)("display:inline-flex;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_23__["default"])(2), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_23__["default"])(3), ";" + ( true ? "" : 0));

const BrowserItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e150wv1u1"
} : 0)("display:flex;align-items:center;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_23__["default"])(1), ";" + ( true ? "" : 0));

const FilterActions = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e150wv1u0"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_23__["default"])(2), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_23__["default"])(2), ";@media (min-width: ", p => p.theme.breakpoints.small, "){grid-template-columns:auto 1fr;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/performance/vitalDetail/vitalInfo.tsx":
/*!*********************************************************!*\
  !*** ./app/views/performance/vitalDetail/vitalInfo.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_utils_performance_vitals_vitalsCardsDiscoverQuery__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/performance/vitals/vitalsCardsDiscoverQuery */ "./app/utils/performance/vitals/vitalsCardsDiscoverQuery.tsx");
/* harmony import */ var _landing_vitalsCards__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../landing/vitalsCards */ "./app/views/performance/landing/vitalsCards.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function VitalInfo(_ref) {
  let {
    vital,
    location,
    isLoading,
    hideBar,
    hideStates,
    hideVitalPercentNames,
    hideVitalThresholds,
    hideDurationDetail
  } = _ref;
  const vitals = Array.isArray(vital) ? vital : [vital];
  const contentCommonProps = {
    vital,
    showBar: !hideBar,
    showStates: !hideStates,
    showVitalPercentNames: !hideVitalPercentNames,
    showVitalThresholds: !hideVitalThresholds,
    showDurationDetail: !hideDurationDetail
  };
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_utils_performance_vitals_vitalsCardsDiscoverQuery__WEBPACK_IMPORTED_MODULE_0__["default"], {
    location: location,
    vitals: vitals,
    children: _ref2 => {
      let {
        isLoading: loading,
        vitalsData
      } = _ref2;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(_landing_vitalsCards__WEBPACK_IMPORTED_MODULE_1__.VitalBar, { ...contentCommonProps,
        isLoading: isLoading || loading,
        data: vitalsData
      });
    }
  });
}

VitalInfo.displayName = "VitalInfo";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (VitalInfo);

/***/ }),

/***/ "./app/views/performance/vitalDetail/vitalsComparison.tsx":
/*!****************************************************************!*\
  !*** ./app/views/performance/vitalDetail/vitalsComparison.tsx ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_performance_vitalsAlert_constants__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/performance/vitalsAlert/constants */ "./app/components/performance/vitalsAlert/constants.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_components_tag__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/tag */ "./app/components/tag.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_performance_vitals_vitalsCardsDiscoverQuery__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/performance/vitals/vitalsCardsDiscoverQuery */ "./app/utils/performance/vitals/vitalsCardsDiscoverQuery.tsx");
/* harmony import */ var sentry_views_performance_vitalDetail_utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/performance/vitalDetail/utils */ "./app/views/performance/vitalDetail/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }












const SUPPORTED_VITALS = ['measurements.fcp', 'measurements.lcp'];

function getScore(vital, value) {
  const poorScore = sentry_views_performance_vitalDetail_utils__WEBPACK_IMPORTED_MODULE_10__.webVitalPoor[vital];
  const mehScore = sentry_views_performance_vitalDetail_utils__WEBPACK_IMPORTED_MODULE_10__.webVitalMeh[vital];

  if (value > poorScore) {
    return 'poor';
  }

  if (value > mehScore) {
    return 'meh';
  }

  return 'good';
}

function getIndicatorString(score) {
  switch (score) {
    case 'poor':
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Poor');

    case 'meh':
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Meh');

    default:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Good');
  }
}

function getTagLevel(score) {
  switch (score) {
    case 'poor':
      return 'error';

    case 'meh':
      return 'warning';

    default:
      return 'success';
  }
}

function MetricsCard(_ref) {
  let {
    title,
    vital,
    value,
    tooltip
  } = _ref;
  // round to 2 decimals if <10s, otherwise use just 1 decimal
  const score = getScore(vital, value);
  const numDecimals = value >= 10_000 ? 1 : 2;
  const timeInSeconds = value / 1000.0;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(MetricsCardWrapper, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(MetricsTitle, {
      children: [title, " (p75) ", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(StyledQuestionTooltip, {
        title: tooltip,
        size: "xs"
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(ScoreWrapper, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(ScoreContent, {
        children: [timeInSeconds.toFixed(numDecimals), "s"]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(TagWrapper, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(StyledTag, {
          type: getTagLevel(score),
          children: getIndicatorString(score)
        })
      })]
    })]
  });
}

MetricsCard.displayName = "MetricsCard";

function ContentWrapper(_ref2) {
  let {
    organization,
    vital,
    children,
    count,
    p75
  } = _ref2;
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__["default"])('performance_views.vital_detail.comparison_viewed', {
      organization,
      vital,
      count,
      p75
    });
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Container, {
    children: children
  });
}

ContentWrapper.displayName = "ContentWrapper";

function VitalsComparison(props) {
  const {
    location,
    vital: _vital,
    organization
  } = props;
  const vitals = Array.isArray(_vital) ? _vital : [_vital];
  const vital = vitals[0];

  if (!SUPPORTED_VITALS.includes(vital)) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_utils_performance_vitals_vitalsCardsDiscoverQuery__WEBPACK_IMPORTED_MODULE_9__["default"], {
    location: location,
    vitals: vitals,
    children: _ref3 => {
      let {
        isLoading,
        vitalsData
      } = _ref3;

      if (isLoading || !vitalsData) {
        return null;
      }

      const data = vitalsData[vital];

      if (!data || !data.p75) {
        return null;
      }

      const {
        p75
      } = data;
      const lookupName = vital === 'measurements.fcp' ? 'FCP' : 'LCP';
      const sentryStandard = sentry_components_performance_vitalsAlert_constants__WEBPACK_IMPORTED_MODULE_3__.SENTRY_CUSTOMERS[lookupName];
      const industryStandard = sentry_components_performance_vitalsAlert_constants__WEBPACK_IMPORTED_MODULE_3__.INDUSTRY_STANDARDS[lookupName];
      const count = vitalsData[vital].total; // only show it if we hit the min number

      if (count < sentry_components_performance_vitalsAlert_constants__WEBPACK_IMPORTED_MODULE_3__.MIN_VITAL_COUNT_FOR_DISPLAY) {
        return null;
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(ContentWrapper, {
        organization,
        vital,
        count,
        p75,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(MetricsCard, {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Selected Projects'),
          vital: vital,
          value: p75,
          tooltip: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)("25% of your project's transactions have an [lookupName] greater than this number. Good, Bad, Meh segmentation is based on Google industry standards.", {
            lookupName
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(MetricsCard, {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Sentry Peers'),
          vital: vital,
          value: sentryStandard,
          tooltip: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)('20% of Sentry customers have a p75 [lookupName] lower than this.', {
            lookupName
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(MetricsCard, {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Industry Standard'),
          vital: vital,
          value: industryStandard,
          tooltip: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)("Calculated as a Good [lookupName] based on Google's industry standards.", {
            lookupName
          })
        })]
      });
    }
  });
}

VitalsComparison.displayName = "VitalsComparison";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (VitalsComparison);

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1pbqx6y7"
} : 0)("display:grid;grid-template-columns:1fr 1fr 1fr;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(2), ";" + ( true ? "" : 0));

const ScoreContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('h6',  true ? {
  target: "e1pbqx6y6"
} : 0)( true ? {
  name: "y1f223",
  styles: "margin:auto"
} : 0);

const ScoreWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1pbqx6y5"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const MetricsCardWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1pbqx6y4"
} : 0)("display:flex;flex-direction:row;justify-content:space-between;border:1px ", p => p.theme.gray200, ";border-radius:4px;border-style:solid;align-items:center;height:57px;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(2), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(2), ";" + ( true ? "" : 0));

const StyledTag = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_tag__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e1pbqx6y3"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";" + ( true ? "" : 0));

const MetricsTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1pbqx6y2"
} : 0)( true ? {
  name: "mmdt3g",
  styles: "font-size:14px"
} : 0);

const TagWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1pbqx6y1"
} : 0)( true ? {
  name: "y1f223",
  styles: "margin:auto"
} : 0);

const StyledQuestionTooltip = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "e1pbqx6y0"
} : 0)( true ? {
  name: "1w4n49d",
  styles: "position:relative;top:1px"
} : 0);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_links_listLink_tsx-app_views_performance_vitalDetail_index_tsx.98a173f665b5e24de717aaa22d4564d8.js.map