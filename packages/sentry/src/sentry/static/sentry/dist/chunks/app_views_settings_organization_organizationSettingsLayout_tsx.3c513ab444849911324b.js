"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_organization_organizationSettingsLayout_tsx"],{

/***/ "./app/views/settings/organization/organizationSettingsLayout.tsx":
/*!************************************************************************!*\
  !*** ./app/views/settings/organization/organizationSettingsLayout.tsx ***!
  \************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_views_settings_components_settingsLayout__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/views/settings/components/settingsLayout */ "./app/views/settings/components/settingsLayout.tsx");
/* harmony import */ var sentry_views_settings_organization_organizationSettingsNavigation__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/views/settings/organization/organizationSettingsNavigation */ "./app/views/settings/organization/organizationSettingsNavigation.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function OrganizationSettingsLayout(props) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_views_settings_components_settingsLayout__WEBPACK_IMPORTED_MODULE_0__["default"], { ...props,
    renderNavigation: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_views_settings_organization_organizationSettingsNavigation__WEBPACK_IMPORTED_MODULE_1__["default"], {})
  });
}

OrganizationSettingsLayout.displayName = "OrganizationSettingsLayout";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OrganizationSettingsLayout);

/***/ }),

/***/ "./app/views/settings/organization/organizationSettingsNavigation.tsx":
/*!****************************************************************************!*\
  !*** ./app/views/settings/organization/organizationSettingsNavigation.tsx ***!
  \****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_stores_hookStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/hookStore */ "./app/stores/hookStore.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_settings_components_settingsNavigation__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/settings/components/settingsNavigation */ "./app/views/settings/components/settingsNavigation.tsx");
/* harmony import */ var sentry_views_settings_organization_navigationConfiguration__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/views/settings/organization/navigationConfiguration */ "./app/views/settings/organization/navigationConfiguration.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









class OrganizationSettingsNavigation extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", this.getHooks());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "unsubscribe", sentry_stores_hookStore__WEBPACK_IMPORTED_MODULE_3__["default"].listen((hookName, hooks) => {
      this.handleHooks(hookName, hooks);
    }, undefined));
  }

  componentDidMount() {
    // eslint-disable-next-line react/no-did-mount-set-state
    this.setState(this.getHooks());
  }

  componentWillUnmount() {
    this.unsubscribe();
  }
  /**
   * TODO(epurkhiser): Becase the settings organization navigation hooks
   * do not conform to a normal component style hook, and take a single
   * parameter 'organization', we cannot use the `Hook` component here,
   * and must resort to using listening to the HookStore to retrieve hook data.
   *
   * We should update the hook interface for the two hooks used here
   */


  getHooks() {
    // Allow injection via getsentry et all
    const {
      organization
    } = this.props;
    return {
      hookConfigs: sentry_stores_hookStore__WEBPACK_IMPORTED_MODULE_3__["default"].get('settings:organization-navigation-config').map(cb => cb(organization)),
      hooks: sentry_stores_hookStore__WEBPACK_IMPORTED_MODULE_3__["default"].get('settings:organization-navigation').map(cb => cb(organization))
    };
  }

  handleHooks(name, hooks) {
    const org = this.props.organization;

    if (name !== 'settings:organization-navigation-config') {
      return;
    }

    this.setState({
      hookConfigs: hooks.map(cb => cb(org))
    });
  }

  render() {
    const {
      hooks,
      hookConfigs
    } = this.state;
    const {
      organization
    } = this.props;
    const access = new Set(organization.access);
    const features = new Set(organization.features);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_views_settings_components_settingsNavigation__WEBPACK_IMPORTED_MODULE_5__["default"], {
      navigationObjects: sentry_views_settings_organization_navigationConfiguration__WEBPACK_IMPORTED_MODULE_6__["default"],
      access: access,
      features: features,
      organization: organization,
      hooks: hooks,
      hookConfigs: hookConfigs
    });
  }

}

OrganizationSettingsNavigation.displayName = "OrganizationSettingsNavigation";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_4__["default"])(OrganizationSettingsNavigation));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_organization_organizationSettingsLayout_tsx.91483cdbc06a650488f2b74c32195500.js.map