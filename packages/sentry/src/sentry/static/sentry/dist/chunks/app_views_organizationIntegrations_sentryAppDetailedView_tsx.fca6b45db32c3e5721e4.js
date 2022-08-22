(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_organizationIntegrations_sentryAppDetailedView_tsx"],{

/***/ "./app/actionCreators/sentryAppInstallations.tsx":
/*!*******************************************************!*\
  !*** ./app/actionCreators/sentryAppInstallations.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "installSentryApp": () => (/* binding */ installSentryApp),
/* harmony export */   "uninstallSentryApp": () => (/* binding */ uninstallSentryApp)
/* harmony export */ });
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");



/**
 * Install a sentry application
 *
 * @param {Object} client ApiClient
 * @param {String} orgId Organization Slug
 * @param {Object} app SentryApp
 */
function installSentryApp(client, orgId, app) {
  (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addLoadingMessage)();
  const promise = client.requestPromise(`/organizations/${orgId}/sentry-app-installations/`, {
    method: 'POST',
    data: {
      slug: app.slug
    }
  });
  promise.then(() => (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.clearIndicators)(), () => (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)(`Unable to install ${app.name}`)));
  return promise;
}
/**
 * Uninstall a sentry application
 *
 * @param {Object} client ApiClient
 * @param {Object} install SentryAppInstallation
 */

function uninstallSentryApp(client, install) {
  (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addLoadingMessage)();
  const promise = client.requestPromise(`/sentry-app-installations/${install.uuid}/`, {
    method: 'DELETE'
  });
  const capitalizedAppSlug = install.app.slug.charAt(0).toUpperCase() + install.app.slug.slice(1);
  promise.then(() => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)(`${capitalizedAppSlug} successfully uninstalled.`));
  }, () => (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.clearIndicators)());
  return promise;
}

/***/ }),

/***/ "./app/components/sentryAppIcon.tsx":
/*!******************************************!*\
  !*** ./app/components/sentryAppIcon.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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

/***/ "./app/utils/consolidatedScopes.tsx":
/*!******************************************!*\
  !*** ./app/utils/consolidatedScopes.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "toPermissions": () => (/* binding */ toPermissions),
/* harmony export */   "toResourcePermissions": () => (/* binding */ toResourcePermissions)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var lodash_groupBy__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/groupBy */ "../node_modules/lodash/groupBy.js");
/* harmony import */ var lodash_groupBy__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_groupBy__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var lodash_invertBy__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/invertBy */ "../node_modules/lodash/invertBy.js");
/* harmony import */ var lodash_invertBy__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_invertBy__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_4__);





const PERMISSION_LEVELS = {
  read: 0,
  write: 1,
  admin: 2
};
const HUMAN_RESOURCE_NAMES = {
  project: 'Project',
  team: 'Team',
  release: 'Release',
  event: 'Event',
  org: 'Organization',
  member: 'Member'
};
const DEFAULT_RESOURCE_PERMISSIONS = {
  Project: 'no-access',
  Team: 'no-access',
  Release: 'no-access',
  Event: 'no-access',
  Organization: 'no-access',
  Member: 'no-access'
};
const PROJECT_RELEASES = 'project:releases';

/**
 * Numerical value of the scope where Admin is higher than Write,
 * which is higher than Read. Used to sort scopes by access.
 */
const permissionLevel = scope => {
  const permission = scope.split(':')[1];
  return PERMISSION_LEVELS[permission];
};

const compareScopes = (a, b) => permissionLevel(a) - permissionLevel(b);
/**
 * Return the most permissive scope for each resource.
 *
 * Example:
 *    Given the full list of scopes:
 *      ['project:read', 'project:write', 'team:read', 'team:write', 'team:admin']
 *
 *    this would return:
 *      ['project:write', 'team:admin']
 */


function topScopes(scopeList) {
  return Object.values(lodash_groupBy__WEBPACK_IMPORTED_MODULE_2___default()(scopeList, scope => scope.split(':')[0])).map(scopes => scopes.sort(compareScopes)).map(scopes => scopes.pop());
}
/**
 * Convert into a list of Permissions, grouped by resource.
 *
 * This is used in the new/edit Sentry App form. That page displays permissions
 * in a per-Resource manner, meaning one row for Project, one for Organization, etc.
 *
 * This exposes scopes in a way that works for that UI.
 *
 * Example:
 *    {
 *      'Project': 'read',
 *      'Organization': 'write',
 *      'Team': 'no-access',
 *      ...
 *    }
 */


function toResourcePermissions(scopes) {
  const permissions = { ...DEFAULT_RESOURCE_PERMISSIONS
  };
  let filteredScopes = [...scopes]; // The scope for releases is `project:releases`, but instead of displaying
  // it as a permission of Project, we want to separate it out into its own
  // row for Releases.

  if (scopes.includes(PROJECT_RELEASES)) {
    permissions.Release = 'admin';
    filteredScopes = scopes.filter(scope => scope !== PROJECT_RELEASES); // remove project:releases
  }

  topScopes(filteredScopes).forEach(scope => {
    if (scope) {
      const [resource, permission] = scope.split(':');
      permissions[HUMAN_RESOURCE_NAMES[resource]] = permission;
    }
  });
  return permissions;
}
/**
 * Convert into a list of Permissions, grouped by access and including a
 * list of resources per access level.
 *
 * This is used in the Permissions Modal when installing an App. It displays
 * scopes in a per-Permission way, meaning one row for Read, one for Write,
 * and one for Admin.
 *
 * This exposes scopes in a way that works for that UI.
 *
 * Example:
 *    {
 *      read:  ['Project', 'Organization'],
 *      write: ['Member'],
 *      admin: ['Release']
 *    }
 */


function toPermissions(scopes) {
  const defaultPermissions = {
    read: [],
    write: [],
    admin: []
  };
  const resourcePermissions = toResourcePermissions(scopes); // Filter out the 'no-access' permissions

  const permissions = lodash_pick__WEBPACK_IMPORTED_MODULE_4___default()(lodash_invertBy__WEBPACK_IMPORTED_MODULE_3___default()(resourcePermissions), ['read', 'write', 'admin']);
  return { ...defaultPermissions,
    ...permissions
  };
}



/***/ }),

/***/ "./app/views/organizationIntegrations/SplitInstallationIdModal.tsx":
/*!*************************************************************************!*\
  !*** ./app/views/organizationIntegrations/SplitInstallationIdModal.tsx ***!
  \*************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SplitInstallationIdModal": () => (/* binding */ SplitInstallationIdModal)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/forms/textCopyInput */ "./app/components/forms/textCopyInput.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }








/**
 * This component is a hack for Split.
 * It will display the installation ID after installation so users can copy it and paste it in Split's website.
 * We also have a link for users to click so they can go to Split's website.
 */
function SplitInstallationIdModal(props) {
  const openAdminIntegrationTimeoutRef = (0,react__WEBPACK_IMPORTED_MODULE_1__.useRef)(undefined);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    return () => {
      window.clearTimeout(openAdminIntegrationTimeoutRef.current);
    };
  }, []);
  const onCopy = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async () => {
    // This hack is needed because the normal copying methods with TextCopyInput do not work correctly
    await navigator.clipboard.writeText(props.installationId);
  }, [props.installationId]);
  const handleContinue = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
    onCopy();
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__.addSuccessMessage)('Copied to clipboard');
    window.clearTimeout(openAdminIntegrationTimeoutRef.current);
    openAdminIntegrationTimeoutRef.current = window.setTimeout(() => {
      window.open('https://app.split.io/org/admin/integrations');
    }, 2000);
  }, [onCopy]); // no need to translate this temporary component

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(ItemHolder, {
      children: "Copy this Installation ID and click to continue. You will use it to finish setup on Split.io."
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(ItemHolder, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_4__["default"], {
        onCopy: onCopy,
        children: props.installationId
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(ButtonHolder, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
        size: "sm",
        onClick: props.closeModal,
        children: "Close"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
        size: "sm",
        priority: "primary",
        onClick: handleContinue,
        children: "Copy and Open Link"
      })]
    })]
  });
}
SplitInstallationIdModal.displayName = "SplitInstallationIdModal";

const ItemHolder = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1xepmaa1"
} : 0)( true ? {
  name: "13ubd8d",
  styles: "margin:10px"
} : 0);

const ButtonHolder = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(ItemHolder,  true ? {
  target: "e1xepmaa0"
} : 0)( true ? {
  name: "99h030",
  styles: "text-align:right;& button{margin:5px;}"
} : 0);

/***/ }),

/***/ "./app/views/organizationIntegrations/sentryAppDetailedView.tsx":
/*!**********************************************************************!*\
  !*** ./app/views/organizationIntegrations/sentryAppDetailedView.tsx ***!
  \**********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_actionCreators_sentryAppInstallations__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/sentryAppInstallations */ "./app/actionCreators/sentryAppInstallations.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_circleIndicator__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/circleIndicator */ "./app/components/circleIndicator.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_sentryAppIcon__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/sentryAppIcon */ "./app/components/sentryAppIcon.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_consolidatedScopes__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/consolidatedScopes */ "./app/utils/consolidatedScopes.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_recordSentryAppInteraction__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/recordSentryAppInteraction */ "./app/utils/recordSentryAppInteraction.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _abstractIntegrationDetailedView__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ./abstractIntegrationDetailedView */ "./app/views/organizationIntegrations/abstractIntegrationDetailedView.tsx");
/* harmony import */ var _SplitInstallationIdModal__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ./SplitInstallationIdModal */ "./app/views/organizationIntegrations/SplitInstallationIdModal.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }





















class SentryAppDetailedView extends _abstractIntegrationDetailedView__WEBPACK_IMPORTED_MODULE_19__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "tabs", ['overview']);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "redirectUser", install => {
      const {
        organization
      } = this.props;
      const {
        sentryApp
      } = this.state;
      const queryParams = {
        installationId: install.uuid,
        code: install.code,
        orgSlug: organization.slug
      };

      if (sentryApp.redirectUrl) {
        const redirectUrl = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_16__.addQueryParamsToExistingUrl)(sentryApp.redirectUrl, queryParams);
        window.location.assign(redirectUrl);
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleInstall", async () => {
      const {
        organization
      } = this.props;
      const {
        sentryApp
      } = this.state;
      this.trackIntegrationAnalytics('integrations.installation_start', {
        integration_status: sentryApp.status
      }); // installSentryApp adds a message on failure

      const install = await (0,sentry_actionCreators_sentryAppInstallations__WEBPACK_IMPORTED_MODULE_6__.installSentryApp)(this.api, organization.slug, sentryApp); // installation is complete if the status is installed

      if (install.status === 'installed') {
        this.trackIntegrationAnalytics('integrations.installation_complete', {
          integration_status: sentryApp.status
        });
      }

      if (!sentryApp.redirectUrl) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)(`${sentryApp.slug} successfully installed.`));
        this.setState({
          appInstalls: [install, ...this.state.appInstalls]
        }); // hack for split so we can show the install ID to users for them to copy
        // Will remove once the proper fix is in place

        if (['split', 'split-dev', 'split-testing'].includes(sentryApp.slug)) {
          (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_5__.openModal)(_ref => {
            let {
              closeModal
            } = _ref;
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(_SplitInstallationIdModal__WEBPACK_IMPORTED_MODULE_20__.SplitInstallationIdModal, {
              installationId: install.uuid,
              closeModal: closeModal
            });
          });
        }
      } else {
        this.redirectUser(install);
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleUninstall", async install => {
      try {
        await (0,sentry_actionCreators_sentryAppInstallations__WEBPACK_IMPORTED_MODULE_6__.uninstallSentryApp)(this.api, install);
        this.trackIntegrationAnalytics('integrations.uninstall_completed', {
          integration_status: this.sentryApp.status
        });
        const appInstalls = this.state.appInstalls.filter(i => i.app.slug !== this.sentryApp.slug);
        return this.setState({
          appInstalls
        });
      } catch (error) {
        return (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)(`Unable to uninstall ${this.sentryApp.name}`));
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "recordUninstallClicked", () => {
      const sentryApp = this.sentryApp;
      this.trackIntegrationAnalytics('integrations.uninstall_clicked', {
        integration_status: sentryApp.status
      });
    });
  }

  getEndpoints() {
    const {
      organization,
      params: {
        integrationSlug
      }
    } = this.props;
    return [['sentryApp', `/sentry-apps/${integrationSlug}/`], ['featureData', `/sentry-apps/${integrationSlug}/features/`], ['appInstalls', `/organizations/${organization.slug}/sentry-app-installations/`]];
  }

  onLoadAllEndpointsSuccess() {
    const {
      organization,
      params: {
        integrationSlug
      },
      router
    } = this.props; // redirect for internal integrations

    if (this.sentryApp.status === 'internal') {
      router.push(`/settings/${organization.slug}/developer-settings/${integrationSlug}/`);
      return;
    }

    super.onLoadAllEndpointsSuccess();
    (0,sentry_utils_recordSentryAppInteraction__WEBPACK_IMPORTED_MODULE_17__.recordInteraction)(integrationSlug, 'sentry_app_viewed');
  }

  get integrationType() {
    return 'sentry_app';
  }

  get sentryApp() {
    return this.state.sentryApp;
  }

  get description() {
    return this.state.sentryApp.overview || '';
  }

  get author() {
    return this.sentryApp.author;
  }

  get resourceLinks() {
    // only show links for published sentry apps
    if (this.sentryApp.status !== 'published') {
      return [];
    }

    return [{
      title: 'Documentation',
      url: `https://docs.sentry.io/product/integrations/${this.integrationSlug}/`
    }];
  }

  get permissions() {
    return (0,sentry_utils_consolidatedScopes__WEBPACK_IMPORTED_MODULE_14__.toPermissions)(this.sentryApp.scopes);
  }

  get installationStatus() {
    return (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_15__.getSentryAppInstallStatus)(this.install);
  }

  get integrationName() {
    return this.sentryApp.name;
  }

  get featureData() {
    return this.state.featureData;
  }

  get install() {
    return this.state.appInstalls.find(i => i.app.slug === this.sentryApp.slug);
  }

  renderPermissions() {
    const permissions = this.permissions;

    if (!Object.keys(permissions).some(scope => permissions[scope].length > 0)) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(PermissionWrapper, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(Title, {
        children: "Permissions"
      }), permissions.read.length > 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(Permission, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(Indicator, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(Text, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('[read] access to [resources] resources', {
            read: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)("strong", {
              children: "Read"
            }),
            resources: permissions.read.join(', ')
          })
        }, "read")]
      }), permissions.write.length > 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(Permission, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(Indicator, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(Text, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('[read] and [write] access to [resources] resources', {
            read: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)("strong", {
              children: "Read"
            }),
            write: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)("strong", {
              children: "Write"
            }),
            resources: permissions.write.join(', ')
          })
        }, "write")]
      }), permissions.admin.length > 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(Permission, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(Indicator, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(Text, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('[admin] access to [resources] resources', {
            admin: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)("strong", {
              children: "Admin"
            }),
            resources: permissions.admin.join(', ')
          })
        }, "admin")]
      })]
    });
  }

  renderTopButton(disabledFromFeatures, userHasAccess) {
    const install = this.install;
    const capitalizedSlug = this.integrationSlug.charAt(0).toUpperCase() + this.integrationSlug.slice(1);

    if (install) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_9__["default"], {
        disabled: !userHasAccess,
        message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('Are you sure you want to remove the [slug] installation?', {
          slug: capitalizedSlug
        }),
        onConfirm: () => this.handleUninstall(install) // called when the user confirms the action
        ,
        onConfirming: this.recordUninstallClicked // called when the confirm modal opens
        ,
        priority: "danger",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(StyledUninstallButton, {
          size: "sm",
          "data-test-id": "sentry-app-uninstall",
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconSubtract, {
            isCircled: true,
            style: {
              marginRight: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(0.75)
            }
          }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Uninstall')]
        })
      });
    }

    if (userHasAccess) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(InstallButton, {
        "data-test-id": "install-button",
        disabled: disabledFromFeatures,
        onClick: () => this.handleInstall(),
        priority: "primary",
        size: "sm",
        style: {
          marginLeft: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1)
        },
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Accept & Install')
      });
    }

    return this.renderRequestIntegrationButton();
  } // no configurations for sentry apps


  renderConfigurations() {
    return null;
  }

  renderIntegrationIcon() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_sentryAppIcon__WEBPACK_IMPORTED_MODULE_10__["default"], {
      sentryApp: this.sentryApp,
      size: 50
    });
  }

}

const Text = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('p',  true ? {
  target: "ev1fx9x6"
} : 0)( true ? {
  name: "1x9ekz7",
  styles: "margin:0px 6px"
} : 0);

const Permission = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ev1fx9x5"
} : 0)( true ? {
  name: "zjik7",
  styles: "display:flex"
} : 0);

const PermissionWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ev1fx9x4"
} : 0)("padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(2), ";" + ( true ? "" : 0));

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('p',  true ? {
  target: "ev1fx9x3"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1), ";font-weight:bold;" + ( true ? "" : 0));

const Indicator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(p => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_circleIndicator__WEBPACK_IMPORTED_MODULE_8__["default"], {
  size: 7,
  ...p
}),  true ? {
  target: "ev1fx9x2"
} : 0)("align-self:center;color:", p => p.theme.success, ";" + ( true ? "" : 0));

const InstallButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "ev1fx9x1"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1), ";" + ( true ? "" : 0));

const StyledUninstallButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "ev1fx9x0"
} : 0)("color:", p => p.theme.gray300, ";background:", p => p.theme.background, ";border:", p => `1px solid ${p.theme.gray300}`, ";box-sizing:border-box;box-shadow:0px 2px 1px rgba(0, 0, 0, 0.08);border-radius:4px;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_18__["default"])(SentryAppDetailedView));

/***/ }),

/***/ "../node_modules/lodash/invertBy.js":
/*!******************************************!*\
  !*** ../node_modules/lodash/invertBy.js ***!
  \******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseIteratee = __webpack_require__(/*! ./_baseIteratee */ "../node_modules/lodash/_baseIteratee.js"),
    createInverter = __webpack_require__(/*! ./_createInverter */ "../node_modules/lodash/_createInverter.js");

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString = objectProto.toString;

/**
 * This method is like `_.invert` except that the inverted object is generated
 * from the results of running each element of `object` thru `iteratee`. The
 * corresponding inverted value of each inverted key is an array of keys
 * responsible for generating the inverted value. The iteratee is invoked
 * with one argument: (value).
 *
 * @static
 * @memberOf _
 * @since 4.1.0
 * @category Object
 * @param {Object} object The object to invert.
 * @param {Function} [iteratee=_.identity] The iteratee invoked per element.
 * @returns {Object} Returns the new inverted object.
 * @example
 *
 * var object = { 'a': 1, 'b': 2, 'c': 1 };
 *
 * _.invertBy(object);
 * // => { '1': ['a', 'c'], '2': ['b'] }
 *
 * _.invertBy(object, function(value) {
 *   return 'group' + value;
 * });
 * // => { 'group1': ['a', 'c'], 'group2': ['b'] }
 */
var invertBy = createInverter(function(result, value, key) {
  if (value != null &&
      typeof value.toString != 'function') {
    value = nativeObjectToString.call(value);
  }

  if (hasOwnProperty.call(result, value)) {
    result[value].push(key);
  } else {
    result[value] = [key];
  }
}, baseIteratee);

module.exports = invertBy;


/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_organizationIntegrations_sentryAppDetailedView_tsx.47b294b89ea3f89cee03179a7c95147a.js.map