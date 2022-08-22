"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_organizationIntegrations_integrationListDirectory_tsx"],{

/***/ "./app/components/sentryAppIcon.tsx":
/*!******************************************!*\
  !*** ./app/components/sentryAppIcon.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_avatar_sentryAppAvatar__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/avatar/sentryAppAvatar */ "./app/components/avatar/sentryAppAvatar.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



const SentryAppIcon = _ref => {
  let {
    sentryApp,
    size
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)(sentry_components_avatar_sentryAppAvatar__WEBPACK_IMPORTED_MODULE_0__["default"], {
    sentryApp: sentryApp,
    size: size,
    isColor: true
  });
};

SentryAppIcon.displayName = "SentryAppIcon";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SentryAppIcon);

/***/ }),

/***/ "./app/utils/fuzzySearch.tsx":
/*!***********************************!*\
  !*** ./app/utils/fuzzySearch.tsx ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "createFuzzySearch": () => (/* binding */ createFuzzySearch)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);


// See http://fusejs.io/ for more information
const DEFAULT_FUSE_OPTIONS = {
  includeScore: true,
  includeMatches: true,
  threshold: 0.4,
  location: 0,
  distance: 75,
  minMatchCharLength: 2
};
async function createFuzzySearch(objects, options) {
  if (!options.keys) {
    throw new Error('You need to define `options.keys`');
  }

  const fuseImported = await __webpack_require__.e(/*! import() */ "vendors-node_modules_fuse_js_dist_fuse_esm_js").then(__webpack_require__.bind(__webpack_require__, /*! fuse.js */ "../node_modules/fuse.js/dist/fuse.esm.js"));
  const fuse = {
    Fuse: fuseImported.default
  };
  return new fuse.Fuse(objects, { ...DEFAULT_FUSE_OPTIONS,
    ...options
  });
} // re-export fuse type to make it easier to use

/***/ }),

/***/ "./app/views/organizationIntegrations/constants.tsx":
/*!**********************************************************!*\
  !*** ./app/views/organizationIntegrations/constants.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "COLORS": () => (/* binding */ COLORS),
/* harmony export */   "DISABLED": () => (/* binding */ DISABLED),
/* harmony export */   "INSTALLED": () => (/* binding */ INSTALLED),
/* harmony export */   "LEARN_MORE": () => (/* binding */ LEARN_MORE),
/* harmony export */   "NOT_INSTALLED": () => (/* binding */ NOT_INSTALLED),
/* harmony export */   "PENDING": () => (/* binding */ PENDING),
/* harmony export */   "POPULARITY_WEIGHT": () => (/* binding */ POPULARITY_WEIGHT)
/* harmony export */ });
const INSTALLED = 'Installed';
const NOT_INSTALLED = 'Not Installed';
const PENDING = 'Pending';
const DISABLED = 'Disabled';
const LEARN_MORE = 'Learn More';
const COLORS = {
  [INSTALLED]: 'success',
  [NOT_INSTALLED]: 'gray300',
  [DISABLED]: 'gray300',
  [PENDING]: 'pink300',
  [LEARN_MORE]: 'gray300'
};
/**
 * Integrations in the integration directory should be sorted by their popularity (weight).
 * The weights should reflect the relative popularity of each integration are hardcoded, except for
 * Sentry-apps which read popularity from the db.
 */

const POPULARITY_WEIGHT = {
  // First-party-integrations
  slack: 50,
  github: 20,
  jira: 10,
  bitbucket: 10,
  gitlab: 10,
  pagerduty: 10,
  vsts: 10,
  jira_server: 10,
  bitbucket_server: 10,
  github_enterprise: 10,
  vercel: 10,
  msteams: 10,
  aws_lambda: 10,
  // Plugins
  webhooks: 10,
  asana: 8,
  trello: 8,
  heroku: 8,
  pivotal: 8,
  twilio: 8,
  pushover: 5,
  redmine: 5,
  phabricator: 5,
  opsgenie: 5,
  victorops: 5,
  sessionstack: 5,
  segment: 2,
  'amazon-sqs': 2,
  splunk: 2
};

/***/ }),

/***/ "./app/views/organizationIntegrations/createIntegrationButton.tsx":
/*!************************************************************************!*\
  !*** ./app/views/organizationIntegrations/createIntegrationButton.tsx ***!
  \************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics_integrations_platformAnalyticsEvents__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/analytics/integrations/platformAnalyticsEvents */ "./app/utils/analytics/integrations/platformAnalyticsEvents.ts");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









/**
 * Button to open the modal to create a new public/internal integration (Sentry App)
 */
function CreateIntegrationButton(_ref) {
  let {
    organization,
    analyticsView
  } = _ref;
  const permissionTooltipText = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Manager or Owner permissions are required to create a new integration');
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_1__["default"], {
    organization: organization,
    access: ['org:write'],
    children: _ref2 => {
      let {
        hasAccess
      } = _ref2;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
        size: "sm",
        priority: "primary",
        disabled: !hasAccess,
        title: !hasAccess ? permissionTooltipText : undefined,
        onClick: () => {
          (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_0__.openCreateNewIntegrationModal)({
            organization
          });
          (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_5__.trackIntegrationAnalytics)(sentry_utils_analytics_integrations_platformAnalyticsEvents__WEBPACK_IMPORTED_MODULE_4__.PlatformEvents.OPEN_CREATE_MODAL, {
            organization,
            view: analyticsView
          });
        },
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Create New Integration')
      });
    }
  });
}

CreateIntegrationButton.displayName = "CreateIntegrationButton";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_6__["default"])(CreateIntegrationButton));

/***/ }),

/***/ "./app/views/organizationIntegrations/integrationAlertContainer.tsx":
/*!**************************************************************************!*\
  !*** ./app/views/organizationIntegrations/integrationAlertContainer.tsx ***!
  \**************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");


/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (/*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div', {
  target: "e11o7gjf0"
})("padding:0px ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(3), " 0px 68px;" + ( true ? "" : 0)));

/***/ }),

/***/ "./app/views/organizationIntegrations/integrationListDirectory.tsx":
/*!*************************************************************************!*\
  !*** ./app/views/organizationIntegrations/integrationListDirectory.tsx ***!
  \*************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "IntegrationListDirectory": () => (/* binding */ IntegrationListDirectory),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var core_js_modules_web_url_search_params_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! core-js/modules/web.url-search-params.js */ "../node_modules/core-js/modules/web.url-search-params.js");
/* harmony import */ var core_js_modules_web_url_search_params_js__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_url_search_params_js__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_8__);
/* harmony import */ var lodash_flatten__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! lodash/flatten */ "../node_modules/lodash/flatten.js");
/* harmony import */ var lodash_flatten__WEBPACK_IMPORTED_MODULE_9___default = /*#__PURE__*/__webpack_require__.n(lodash_flatten__WEBPACK_IMPORTED_MODULE_9__);
/* harmony import */ var lodash_groupBy__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! lodash/groupBy */ "../node_modules/lodash/groupBy.js");
/* harmony import */ var lodash_groupBy__WEBPACK_IMPORTED_MODULE_10___default = /*#__PURE__*/__webpack_require__.n(lodash_groupBy__WEBPACK_IMPORTED_MODULE_10__);
/* harmony import */ var lodash_startCase__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! lodash/startCase */ "../node_modules/lodash/startCase.js");
/* harmony import */ var lodash_startCase__WEBPACK_IMPORTED_MODULE_11___default = /*#__PURE__*/__webpack_require__.n(lodash_startCase__WEBPACK_IMPORTED_MODULE_11__);
/* harmony import */ var lodash_uniq__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! lodash/uniq */ "../node_modules/lodash/uniq.js");
/* harmony import */ var lodash_uniq__WEBPACK_IMPORTED_MODULE_12___default = /*#__PURE__*/__webpack_require__.n(lodash_uniq__WEBPACK_IMPORTED_MODULE_12__);
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_avatar_docIntegrationAvatar__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/avatar/docIntegrationAvatar */ "./app/components/avatar/docIntegrationAvatar.tsx");
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_components_hookOrDefault__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/hookOrDefault */ "./app/components/hookOrDefault.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/components/searchBar */ "./app/components/searchBar.tsx");
/* harmony import */ var sentry_components_sentryAppIcon__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/components/sentryAppIcon */ "./app/components/sentryAppIcon.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_fuzzySearch__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/utils/fuzzySearch */ "./app/utils/fuzzySearch.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_organizationIntegrations_createIntegrationButton__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! sentry/views/organizationIntegrations/createIntegrationButton */ "./app/views/organizationIntegrations/createIntegrationButton.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_organization_permissionAlert__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! sentry/views/settings/organization/permissionAlert */ "./app/views/settings/organization/permissionAlert.tsx");
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! ./constants */ "./app/views/organizationIntegrations/constants.tsx");
/* harmony import */ var _integrationRow__WEBPACK_IMPORTED_MODULE_32__ = __webpack_require__(/*! ./integrationRow */ "./app/views/organizationIntegrations/integrationRow.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






























const FirstPartyIntegrationAlert = (0,sentry_components_hookOrDefault__WEBPACK_IMPORTED_MODULE_17__["default"])({
  hookName: 'component:first-party-integration-alert',
  defaultComponent: () => null
});
const fuseOptions = {
  threshold: 0.3,
  location: 0,
  distance: 100,
  includeScore: true,
  keys: ['slug', 'key', 'name', 'id']
};
const TEXT_SEARCH_ANALYTICS_DEBOUNCE_IN_MS = 1000;
class IntegrationListDirectory extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_14__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "shouldReload", true);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "reloadOnVisible", true);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "shouldReloadOnVisible", true);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getAppInstall", app => {
      var _this$state$appInstal;

      return (_this$state$appInstal = this.state.appInstalls) === null || _this$state$appInstal === void 0 ? void 0 : _this$state$appInstal.find(i => i.app.slug === app.slug);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getPopularityWeight", integration => {
      var _POPULARITY_WEIGHT$in;

      if ((0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_26__.isSentryApp)(integration) || (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_26__.isDocIntegration)(integration)) {
        var _integration$populari;

        return (_integration$populari = integration === null || integration === void 0 ? void 0 : integration.popularity) !== null && _integration$populari !== void 0 ? _integration$populari : 1;
      }

      return (_POPULARITY_WEIGHT$in = _constants__WEBPACK_IMPORTED_MODULE_31__.POPULARITY_WEIGHT[integration.slug]) !== null && _POPULARITY_WEIGHT$in !== void 0 ? _POPULARITY_WEIGHT$in : 1;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "sortByName", (a, b) => a.slug.localeCompare(b.slug));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "sortByPopularity", (a, b) => {
      const weightA = this.getPopularityWeight(a);
      const weightB = this.getPopularityWeight(b);
      return weightB - weightA;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "sortByInstalled", (a, b) => this.getInstallValue(b) - this.getInstallValue(a));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "debouncedTrackIntegrationSearch", lodash_debounce__WEBPACK_IMPORTED_MODULE_8___default()((search, numResults) => {
      (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_26__.trackIntegrationAnalytics)('integrations.directory_item_searched', {
        view: 'integrations_directory',
        search_term: search,
        num_results: numResults,
        organization: this.props.organization
      });
    }, TEXT_SEARCH_ANALYTICS_DEBOUNCE_IN_MS));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getFilterParameters", () => {
      const {
        category,
        search
      } = query_string__WEBPACK_IMPORTED_MODULE_13__.parse(this.props.location.search);
      const selectedCategory = Array.isArray(category) ? category[0] : category || '';
      const searchInput = Array.isArray(search) ? search[0] : search || '';
      return {
        searchInput,
        selectedCategory
      };
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "updateQueryString", () => {
      const {
        searchInput,
        selectedCategory
      } = this.state;
      const searchString = query_string__WEBPACK_IMPORTED_MODULE_13__.stringify({ ...query_string__WEBPACK_IMPORTED_MODULE_13__.parse(this.props.location.search),
        search: searchInput ? searchInput : undefined,
        category: selectedCategory ? selectedCategory : undefined
      });
      react_router__WEBPACK_IMPORTED_MODULE_7__.browserHistory.replace({
        pathname: this.props.location.pathname,
        search: searchString ? `?${searchString}` : undefined
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "updateDisplayedList", () => {
      const {
        fuzzy,
        list,
        searchInput,
        selectedCategory
      } = this.state;
      let displayedList = list;

      if (searchInput && fuzzy) {
        const searchResults = fuzzy.search(searchInput);
        displayedList = this.sortIntegrations(searchResults.map(i => i.item));
      }

      if (selectedCategory) {
        displayedList = displayedList.filter(integration => (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_26__.getCategoriesForIntegration)(integration).includes(selectedCategory));
      }

      this.setState({
        displayedList
      });
      return displayedList;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSearchChange", value => {
      this.setState({
        searchInput: value
      }, () => {
        this.updateQueryString();
        const result = this.updateDisplayedList();

        if (value) {
          this.debouncedTrackIntegrationSearch(value, result.length);
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onCategorySelect", _ref => {
      let {
        value: category
      } = _ref;
      this.setState({
        selectedCategory: category
      }, () => {
        this.updateQueryString();
        this.updateDisplayedList();

        if (category) {
          (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_26__.trackIntegrationAnalytics)('integrations.directory_category_selected', {
            view: 'integrations_directory',
            category,
            organization: this.props.organization
          });
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderProvider", provider => {
      var _this$state$integrati, _this$state$integrati2;

      const {
        organization
      } = this.props; // find the integration installations for that provider

      const integrations = (_this$state$integrati = (_this$state$integrati2 = this.state.integrations) === null || _this$state$integrati2 === void 0 ? void 0 : _this$state$integrati2.filter(i => i.provider.key === provider.key)) !== null && _this$state$integrati !== void 0 ? _this$state$integrati : [];
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(_integrationRow__WEBPACK_IMPORTED_MODULE_32__["default"], {
        "data-test-id": "integration-row",
        organization: organization,
        type: "firstParty",
        slug: provider.slug,
        displayName: provider.name,
        status: integrations.length ? 'Installed' : 'Not Installed',
        publishStatus: "published",
        configurations: integrations.length,
        categories: (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_26__.getCategoriesForIntegration)(provider),
        alertText: (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_26__.getAlertText)(integrations),
        resolveText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_23__.t)('Update Now'),
        customAlert: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(FirstPartyIntegrationAlert, {
          integrations: integrations,
          wrapWithContainer: true
        })
      }, `row-${provider.key}`);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderPlugin", plugin => {
      const {
        organization
      } = this.props;
      const isLegacy = plugin.isHidden;
      const displayName = `${plugin.name} ${isLegacy ? '(Legacy)' : ''}`; // hide legacy integrations if we don't have any projects with them

      if (isLegacy && !plugin.projectList.length) {
        return null;
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(_integrationRow__WEBPACK_IMPORTED_MODULE_32__["default"], {
        "data-test-id": "integration-row",
        organization: organization,
        type: "plugin",
        slug: plugin.slug,
        displayName: displayName,
        status: plugin.projectList.length ? 'Installed' : 'Not Installed',
        publishStatus: "published",
        configurations: plugin.projectList.length,
        categories: (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_26__.getCategoriesForIntegration)(plugin),
        plugin: plugin
      }, `row-plugin-${plugin.id}`);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderSentryApp", app => {
      const {
        organization
      } = this.props;
      const status = (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_26__.getSentryAppInstallStatus)(this.getAppInstall(app));
      const categories = (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_26__.getCategoriesForIntegration)(app);
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(_integrationRow__WEBPACK_IMPORTED_MODULE_32__["default"], {
        "data-test-id": "integration-row",
        organization: organization,
        type: "sentryApp",
        slug: app.slug,
        displayName: app.name,
        status: status,
        publishStatus: app.status,
        configurations: 0,
        categories: categories,
        customIcon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_sentryAppIcon__WEBPACK_IMPORTED_MODULE_21__["default"], {
          sentryApp: app,
          size: 36
        })
      }, `sentry-app-row-${app.slug}`);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderDocIntegration", doc => {
      const {
        organization
      } = this.props;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(_integrationRow__WEBPACK_IMPORTED_MODULE_32__["default"], {
        "data-test-id": "integration-row",
        organization: organization,
        type: "docIntegration",
        slug: doc.slug,
        displayName: doc.name,
        publishStatus: "published",
        configurations: 0,
        categories: (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_26__.getCategoriesForIntegration)(doc),
        customIcon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_avatar_docIntegrationAvatar__WEBPACK_IMPORTED_MODULE_15__["default"], {
          docIntegration: doc,
          size: 36
        })
      }, `doc-int-${doc.slug}`);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderIntegration", integration => {
      if ((0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_26__.isSentryApp)(integration)) {
        return this.renderSentryApp(integration);
      }

      if ((0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_26__.isPlugin)(integration)) {
        return this.renderPlugin(integration);
      }

      if ((0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_26__.isDocIntegration)(integration)) {
        return this.renderDocIntegration(integration);
      }

      return this.renderProvider(integration);
    });
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      list: [],
      displayedList: [],
      selectedCategory: ''
    };
  }

  onLoadAllEndpointsSuccess() {
    const {
      publishedApps,
      orgOwnedApps,
      extraApp,
      plugins,
      docIntegrations
    } = this.state;
    const published = publishedApps || []; // If we have an extra app in state from query parameter, add it as org owned app

    if (orgOwnedApps !== null && extraApp) {
      orgOwnedApps.push(extraApp);
    } // we don't want the app to render twice if its the org that created
    // the published app.


    const orgOwned = orgOwnedApps === null || orgOwnedApps === void 0 ? void 0 : orgOwnedApps.filter(app => !published.find(p => p.slug === app.slug));
    /**
     * We should have three sections:
     * 1. Public apps and integrations available to everyone
     * 2. Unpublished apps available to that org
     * 3. Internal apps available to that org
     */

    const combined = [].concat(published).concat(orgOwned !== null && orgOwned !== void 0 ? orgOwned : []).concat(this.providers).concat(plugins !== null && plugins !== void 0 ? plugins : []).concat(docIntegrations !== null && docIntegrations !== void 0 ? docIntegrations : []);
    const list = this.sortIntegrations(combined);
    const {
      searchInput,
      selectedCategory
    } = this.getFilterParameters();
    this.setState({
      list,
      searchInput,
      selectedCategory
    }, () => {
      this.updateDisplayedList();
      this.trackPageViewed();
    });
  }

  trackPageViewed() {
    // count the number of installed apps
    const {
      integrations,
      publishedApps,
      plugins
    } = this.state;
    const integrationsInstalled = new Set(); // add installed integrations

    integrations === null || integrations === void 0 ? void 0 : integrations.forEach(integration => {
      integrationsInstalled.add(integration.provider.key);
    }); // add sentry apps

    publishedApps === null || publishedApps === void 0 ? void 0 : publishedApps.filter(this.getAppInstall).forEach(sentryApp => {
      integrationsInstalled.add(sentryApp.slug);
    }); // add plugins

    plugins === null || plugins === void 0 ? void 0 : plugins.forEach(plugin => {
      if (plugin.projectList.length) {
        integrationsInstalled.add(plugin.slug);
      }
    });
    (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_26__.trackIntegrationAnalytics)('integrations.index_viewed', {
      integrations_installed: integrationsInstalled.size,
      view: 'integrations_directory',
      organization: this.props.organization
    }, {
      startSession: true
    });
  }

  getEndpoints() {
    const {
      orgId
    } = this.props.params;
    const baseEndpoints = [['config', `/organizations/${orgId}/config/integrations/`], ['integrations', `/organizations/${orgId}/integrations/`, {
      query: {
        includeConfig: 0
      }
    }], ['orgOwnedApps', `/organizations/${orgId}/sentry-apps/`], ['publishedApps', '/sentry-apps/', {
      query: {
        status: 'published'
      }
    }], ['appInstalls', `/organizations/${orgId}/sentry-app-installations/`], ['plugins', `/organizations/${orgId}/plugins/configs/`], ['docIntegrations', '/doc-integrations/']];
    /**
     * optional app to load for super users
     * should only be done for unpublished integrations from another org
     * but no checks are in place to ensure the above condition
     */

    const extraAppSlug = new URLSearchParams(this.props.location.search).get('extra_app');

    if (extraAppSlug) {
      baseEndpoints.push(['extraApp', `/sentry-apps/${extraAppSlug}/`]);
    }

    return baseEndpoints;
  } // State


  get unmigratableReposByOrg() {
    // Group by [GitHub|BitBucket|VSTS] Org name
    return lodash_groupBy__WEBPACK_IMPORTED_MODULE_10___default()(this.state.unmigratableRepos, repo => repo.name.split('/')[0]);
  }

  get providers() {
    var _this$state$config$pr, _this$state$config;

    return (_this$state$config$pr = (_this$state$config = this.state.config) === null || _this$state$config === void 0 ? void 0 : _this$state$config.providers) !== null && _this$state$config$pr !== void 0 ? _this$state$config$pr : [];
  }

  // Returns 0 if uninstalled, 1 if pending, and 2 if installed
  getInstallValue(integration) {
    const {
      integrations
    } = this.state;

    if ((0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_26__.isPlugin)(integration)) {
      return integration.projectList.length > 0 ? 2 : 0;
    }

    if ((0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_26__.isSentryApp)(integration)) {
      const install = this.getAppInstall(integration);

      if (install) {
        return install.status === 'pending' ? 1 : 2;
      }

      return 0;
    }

    if ((0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_26__.isDocIntegration)(integration)) {
      return 0;
    }

    return integrations !== null && integrations !== void 0 && integrations.find(i => i.provider.key === integration.key) ? 2 : 0;
  }

  sortIntegrations(integrations) {
    return integrations.sort((a, b) => {
      // sort by whether installed first
      const diffWeight = this.sortByInstalled(a, b);

      if (diffWeight !== 0) {
        return diffWeight;
      } // then sort by popularity


      const diffPop = this.sortByPopularity(a, b);

      if (diffPop !== 0) {
        return diffPop;
      } // then sort by name


      return this.sortByName(a, b);
    });
  }

  async componentDidUpdate(_, prevState) {
    if (this.state.list.length !== prevState.list.length) {
      await this.createSearch();
    }
  }

  async createSearch() {
    const {
      list
    } = this.state;
    this.setState({
      fuzzy: await (0,sentry_utils_fuzzySearch__WEBPACK_IMPORTED_MODULE_25__.createFuzzySearch)(list || [], fuseOptions)
    });
  }

  renderBody() {
    const {
      params: {
        orgId
      }
    } = this.props;
    const {
      displayedList,
      list,
      searchInput,
      selectedCategory
    } = this.state;
    const title = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_23__.t)('Integrations');
    const categoryList = lodash_uniq__WEBPACK_IMPORTED_MODULE_12___default()(lodash_flatten__WEBPACK_IMPORTED_MODULE_9___default()(list.map(sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_26__.getCategoriesForIntegration))).sort();
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsxs)(react__WEBPACK_IMPORTED_MODULE_6__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_22__["default"], {
        title: title,
        orgSlug: orgId
      }), !this.props.hideHeader && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_29__["default"], {
        title: title,
        body: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsxs)(ActionContainer, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_16__["default"], {
            name: "select-categories",
            onChange: this.onCategorySelect,
            value: selectedCategory,
            options: [{
              value: '',
              label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_23__.t)('All Categories')
            }, ...categoryList.map(category => ({
              value: category,
              label: lodash_startCase__WEBPACK_IMPORTED_MODULE_11___default()(category)
            }))]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_20__["default"], {
            query: searchInput || '',
            onChange: this.handleSearchChange,
            placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_23__.t)('Filter Integrations...'),
            width: "100%",
            "data-test-id": "search-bar"
          })]
        }),
        action: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_views_organizationIntegrations_createIntegrationButton__WEBPACK_IMPORTED_MODULE_28__["default"], {
          analyticsView: "integrations_directory"
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_views_settings_organization_permissionAlert__WEBPACK_IMPORTED_MODULE_30__["default"], {
        access: ['org:integrations']
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_19__.Panel, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_19__.PanelBody, {
          "data-test-id": "integration-panel",
          children: displayedList.length ? displayedList.map(this.renderIntegration) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsxs)(EmptyResultsContainer, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(EmptyResultsBody, {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_23__.tct)('No Integrations found for "[searchTerm]".', {
                searchTerm: searchInput
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(EmptyResultsBodyBold, {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_23__.t)("Not seeing what you're looking for?")
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(EmptyResultsBody, {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_23__.tct)('[link:Build it on the Sentry Integration Platform.]', {
                link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_18__["default"], {
                  href: "https://docs.sentry.io/product/integrations/integration-platform/"
                })
              })
            })]
          })
        })
      })]
    });
  }

}

const ActionContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e623bgk3"
} : 0)("display:grid;grid-template-columns:240px auto;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_24__["default"])(2), ";" + ( true ? "" : 0));

const EmptyResultsContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e623bgk2"
} : 0)( true ? {
  name: "1nm5mqn",
  styles: "height:200px;display:flex;flex-direction:column;align-items:center;justify-content:center"
} : 0);

const EmptyResultsBody = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e623bgk1"
} : 0)("font-size:16px;line-height:28px;color:", p => p.theme.gray300, ";padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_24__["default"])(2), ";" + ( true ? "" : 0));

const EmptyResultsBodyBold = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(EmptyResultsBody,  true ? {
  target: "e623bgk0"
} : 0)( true ? {
  name: "1efi8gv",
  styles: "font-weight:bold"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_27__["default"])(IntegrationListDirectory));

/***/ }),

/***/ "./app/views/organizationIntegrations/integrationRow.tsx":
/*!***************************************************************!*\
  !*** ./app/views/organizationIntegrations/integrationRow.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var lodash_startCase__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/startCase */ "../node_modules/lodash/startCase.js");
/* harmony import */ var lodash_startCase__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_startCase__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_plugins_components_pluginIcon__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/plugins/components/pluginIcon */ "./app/plugins/components/pluginIcon.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var _integrationAlertContainer__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./integrationAlertContainer */ "./app/views/organizationIntegrations/integrationAlertContainer.tsx");
/* harmony import */ var _integrationStatus__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./integrationStatus */ "./app/views/organizationIntegrations/integrationStatus.tsx");
/* harmony import */ var _pluginDeprecationAlert__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./pluginDeprecationAlert */ "./app/views/organizationIntegrations/pluginDeprecationAlert.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }















const urlMap = {
  plugin: 'plugins',
  firstParty: 'integrations',
  sentryApp: 'sentry-apps',
  docIntegration: 'document-integrations'
};

const IntegrationRow = props => {
  const {
    organization,
    type,
    slug,
    displayName,
    status,
    publishStatus,
    configurations,
    categories,
    alertText,
    resolveText,
    plugin,
    customAlert,
    customIcon
  } = props;
  const baseUrl = publishStatus === 'internal' ? `/settings/${organization.slug}/developer-settings/${slug}/` : `/settings/${organization.slug}/${urlMap[type]}/${slug}/`;

  const renderDetails = () => {
    if (type === 'sentryApp') {
      return publishStatus !== 'published' && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(PublishStatus, {
        status: publishStatus
      });
    } // TODO: Use proper translations


    return configurations > 0 ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(StyledLink, {
      to: `${baseUrl}?tab=configurations`,
      children: `${configurations} Configuration${configurations > 1 ? 's' : ''}`
    }) : null;
  };

  const renderStatus = () => {
    // status should be undefined for document integrations
    if (status) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(_integrationStatus__WEBPACK_IMPORTED_MODULE_11__["default"], {
        status: status
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(LearnMore, {
      to: baseUrl,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Learn More')
    });
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(PanelRow, {
    noPadding: true,
    "data-test-id": slug,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(FlexContainer, {
      children: [customIcon !== null && customIcon !== void 0 ? customIcon : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_plugins_components_pluginIcon__WEBPACK_IMPORTED_MODULE_7__["default"], {
        size: 36,
        pluginId: slug
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(TitleContainer, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(IntegrationName, {
          to: baseUrl,
          children: displayName
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(IntegrationDetails, {
          children: [renderStatus(), renderDetails()]
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(TagsContainer, {
        children: categories === null || categories === void 0 ? void 0 : categories.map(category => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(CategoryTag, {
          category: category === 'api' ? 'API' : lodash_startCase__WEBPACK_IMPORTED_MODULE_1___default()(category),
          priority: category === publishStatus
        }, category))
      })]
    }), alertText && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(_integrationAlertContainer__WEBPACK_IMPORTED_MODULE_10__["default"], {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_2__["default"], {
        type: "warning",
        showIcon: true,
        trailingItems: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(ResolveNowButton, {
          href: `${baseUrl}?tab=configurations&referrer=directory_resolve_now`,
          size: "xs",
          onClick: () => (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_9__.trackIntegrationAnalytics)('integrations.resolve_now_clicked', {
            integration_type: (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_9__.convertIntegrationTypeToSnakeCase)(type),
            integration: slug,
            organization
          }),
          children: resolveText || (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Resolve Now')
        }),
        children: alertText
      })
    }), customAlert, (plugin === null || plugin === void 0 ? void 0 : plugin.deprecationDate) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(PluginDeprecationAlertWrapper, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(_pluginDeprecationAlert__WEBPACK_IMPORTED_MODULE_12__["default"], {
        organization: organization,
        plugin: plugin
      })
    })]
  });
};

IntegrationRow.displayName = "IntegrationRow";

const PluginDeprecationAlertWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ejka4t011"
} : 0)("padding:0px ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(3), " 0px 68px;" + ( true ? "" : 0));

const PanelRow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__.PanelItem,  true ? {
  target: "ejka4t010"
} : 0)( true ? {
  name: "qdeacm",
  styles: "flex-direction:column"
} : 0);

const FlexContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ejka4t09"
} : 0)("display:flex;align-items:center;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(2), ";" + ( true ? "" : 0));

const TitleContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ejka4t08"
} : 0)( true ? {
  name: "pfworo",
  styles: "flex:1;padding:0 16px;white-space:nowrap"
} : 0);

const TagsContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ejka4t07"
} : 0)("flex:3;text-align:right;padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(2), ";" + ( true ? "" : 0));

const IntegrationName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "ejka4t06"
} : 0)( true ? {
  name: "1efi8gv",
  styles: "font-weight:bold"
} : 0);

const IntegrationDetails = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ejka4t05"
} : 0)("display:flex;align-items:center;font-size:", p => p.theme.fontSizeSmall, ";" + ( true ? "" : 0));

const StyledLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "ejka4t04"
} : 0)("color:", p => p.theme.gray300, ";&:before{content:'|';color:", p => p.theme.gray200, ";margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(0.75), ";}" + ( true ? "" : 0));

const LearnMore = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "ejka4t03"
} : 0)("color:", p => p.theme.gray300, ";" + ( true ? "" : 0));

const PublishStatus = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_ref => {
  let {
    status,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("div", { ...props,
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)(`${status}`)
  });
},  true ? {
  target: "ejka4t02"
} : 0)("color:", props => props.status === 'published' ? props.theme.success : props.theme.gray300, ";font-weight:light;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(0.75), ";text-transform:capitalize;&:before{content:'|';color:", p => p.theme.gray200, ";margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(0.75), ";font-weight:normal;}" + ( true ? "" : 0)); // TODO(Priscila): Replace this component with the Tag component


const CategoryTag = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_ref2 => {
  let {
    priority: _priority,
    category,
    ...p
  } = _ref2;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("div", { ...p,
    children: category
  });
},  true ? {
  target: "ejka4t01"
} : 0)("display:inline-block;padding:1px 10px;background:", p => p.priority ? p.theme.purple200 : p.theme.gray100, ";border-radius:20px;font-size:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1.5), ";margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(0.25), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(0.5), ";line-height:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(3), ";text-align:center;color:", p => p.priority ? p.theme.white : p.theme.gray500, ";" + ( true ? "" : 0));

const ResolveNowButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "ejka4t00"
} : 0)("color:", p => p.theme.subText, ";float:right;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (IntegrationRow);

/***/ }),

/***/ "./app/views/organizationIntegrations/integrationStatus.tsx":
/*!******************************************************************!*\
  !*** ./app/views/organizationIntegrations/integrationStatus.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var sentry_components_circleIndicator__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/circleIndicator */ "./app/components/circleIndicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./constants */ "./app/views/organizationIntegrations/constants.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









const StatusWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1tnl65t1"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const IntegrationStatus = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_ref => {
  let {
    status,
    ...p
  } = _ref;
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_5__.a)();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(StatusWrapper, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_circleIndicator__WEBPACK_IMPORTED_MODULE_1__["default"], {
      size: 6,
      color: theme[_constants__WEBPACK_IMPORTED_MODULE_4__.COLORS[status]]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("div", { ...p,
      children: `${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)(status)}`
    })]
  });
},  true ? {
  target: "e1tnl65t0"
} : 0)("color:", p => p.theme[_constants__WEBPACK_IMPORTED_MODULE_4__.COLORS[p.status]], ";margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(0.5), ";font-weight:light;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(0.75), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (IntegrationStatus);

/***/ }),

/***/ "./app/views/organizationIntegrations/pluginDeprecationAlert.tsx":
/*!***********************************************************************!*\
  !*** ./app/views/organizationIntegrations/pluginDeprecationAlert.tsx ***!
  \***********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








class PluginDeprecationAlert extends react__WEBPACK_IMPORTED_MODULE_1__.Component {
  render() {
    const {
      organization,
      plugin
    } = this.props; // Short-circuit if not deprecated.

    if (!plugin.deprecationDate) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {});
    }

    const resource = plugin.altIsSentryApp ? 'sentry-apps' : 'integrations';
    const upgradeUrl = `/settings/${organization.slug}/${resource}/${plugin.firstPartyAlternative}/`;
    const queryParams = `?${plugin.altIsSentryApp ? '' : 'tab=configurations&'}referrer=directory_upgrade_now`;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("div", {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_2__["default"], {
        type: "warning",
        showIcon: true,
        trailingItems: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(UpgradeNowButton, {
          href: `${upgradeUrl}${queryParams}`,
          size: "xs",
          onClick: () => (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_5__.trackIntegrationAnalytics)('integrations.resolve_now_clicked', {
            integration_type: 'plugin',
            integration: plugin.slug,
            organization
          }),
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Upgrade Now')
        }),
        children: `This integration is being deprecated on ${plugin.deprecationDate}. Please upgrade to avoid any disruption.`
      })
    });
  }

}

PluginDeprecationAlert.displayName = "PluginDeprecationAlert";

const UpgradeNowButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e1otf8d90"
} : 0)("color:", p => p.theme.subText, ";float:right;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PluginDeprecationAlert);

/***/ }),

/***/ "./app/views/settings/organization/permissionAlert.tsx":
/*!*************************************************************!*\
  !*** ./app/views/settings/organization/permissionAlert.tsx ***!
  \*************************************************************/
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
    access = ['org:write'],
    message = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('These settings can only be edited by users with the organization owner or manager role.'),
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
        showIcon: true,
        ...props,
        children: message
      });
    }
  });
};

PermissionAlert.displayName = "PermissionAlert";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PermissionAlert);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_organizationIntegrations_integrationListDirectory_tsx.7d9ed4164717e09eb4da7859679378b8.js.map