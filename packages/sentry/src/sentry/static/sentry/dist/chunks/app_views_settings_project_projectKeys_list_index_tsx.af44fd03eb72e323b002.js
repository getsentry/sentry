"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_project_projectKeys_list_index_tsx"],{

/***/ "./app/utils/recreateRoute.tsx":
/*!*************************************!*\
  !*** ./app/utils/recreateRoute.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ recreateRoute)
/* harmony export */ });
/* harmony import */ var lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash/findLastIndex */ "../node_modules/lodash/findLastIndex.js");
/* harmony import */ var lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils_replaceRouterParams__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/replaceRouterParams */ "./app/utils/replaceRouterParams.tsx");



/**
 * Given a route object or a string and a list of routes + params from router, this will attempt to recreate a location string while replacing url params.
 * Can additionally specify the number of routes to move back
 *
 * See tests for examples
 */
function recreateRoute(to, options) {
  var _location$search, _location$hash;

  const {
    routes,
    params,
    location,
    stepBack
  } = options;
  const paths = routes.map(_ref => {
    let {
      path
    } = _ref;
    return path || '';
  });
  let lastRootIndex;
  let routeIndex; // TODO(ts): typescript things

  if (typeof to !== 'string') {
    routeIndex = routes.indexOf(to) + 1;
    lastRootIndex = lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0___default()(paths.slice(0, routeIndex), path => path[0] === '/');
  } else {
    lastRootIndex = lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0___default()(paths, path => path[0] === '/');
  }

  let baseRoute = paths.slice(lastRootIndex, routeIndex);

  if (typeof stepBack !== 'undefined') {
    baseRoute = baseRoute.slice(0, stepBack);
  }

  const search = (_location$search = location === null || location === void 0 ? void 0 : location.search) !== null && _location$search !== void 0 ? _location$search : '';
  const hash = (_location$hash = location === null || location === void 0 ? void 0 : location.hash) !== null && _location$hash !== void 0 ? _location$hash : '';
  const fullRoute = `${baseRoute.join('')}${typeof to !== 'string' ? '' : to}${search}${hash}`;
  return (0,sentry_utils_replaceRouterParams__WEBPACK_IMPORTED_MODULE_1__["default"])(fullRoute, params);
}

/***/ }),

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

/***/ "./app/views/settings/project/projectKeys/list/index.tsx":
/*!***************************************************************!*\
  !*** ./app/views/settings/project/projectKeys/list/index.tsx ***!
  \***************************************************************/
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
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/routeTitle */ "./app/utils/routeTitle.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var _keyRow__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ./keyRow */ "./app/views/settings/project/projectKeys/list/keyRow.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




















class ProjectKeys extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_12__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleRemoveKey", async data => {
      const oldKeyList = [...this.state.keyList];
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Revoking key\u2026'));
      this.setState(state => ({
        keyList: state.keyList.filter(key => key.id !== data.id)
      }));
      const {
        orgId,
        projectId
      } = this.props.params;

      try {
        await this.api.requestPromise(`/projects/${orgId}/${projectId}/keys/${data.id}/`, {
          method: 'DELETE'
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Revoked key'));
      } catch (_err) {
        this.setState({
          keyList: oldKeyList
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Unable to revoke key'));
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleToggleKey", async (isActive, data) => {
      const oldKeyList = [...this.state.keyList];
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Saving changes\u2026'));
      this.setState(state => {
        const keyList = state.keyList.map(key => {
          if (key.id === data.id) {
            return { ...key,
              isActive: !data.isActive
            };
          }

          return key;
        });
        return {
          keyList
        };
      });
      const {
        orgId,
        projectId
      } = this.props.params;

      try {
        await this.api.requestPromise(`/projects/${orgId}/${projectId}/keys/${data.id}/`, {
          method: 'PUT',
          data: {
            isActive
          }
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addSuccessMessage)(isActive ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Enabled key') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Disabled key'));
      } catch (_err) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)(isActive ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Error enabling key') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Error disabling key'));
        this.setState({
          keyList: oldKeyList
        });
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleCreateKey", async () => {
      const {
        orgId,
        projectId
      } = this.props.params;

      try {
        const data = await this.api.requestPromise(`/projects/${orgId}/${projectId}/keys/`, {
          method: 'POST'
        });
        this.setState(state => ({
          keyList: [...state.keyList, data]
        }));
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Created a new key.'));
      } catch (_err) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Unable to create new key. Please try again.'));
      }
    });
  }

  getTitle() {
    const {
      projectId
    } = this.props.params;
    return (0,sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_10__["default"])((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Client Keys'), projectId, false);
  }

  getEndpoints() {
    const {
      orgId,
      projectId
    } = this.props.params;
    return [['keyList', `/projects/${orgId}/${projectId}/keys/`]];
  }
  /**
   * Optimistically remove key
   */


  renderEmpty() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__.Panel, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_13__["default"], {
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_8__.IconFlag, {
          size: "xl"
        }),
        description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('There are no keys active for this project.')
      })
    });
  }

  renderResults() {
    const {
      location,
      organization,
      routes,
      params
    } = this.props;
    const {
      orgId,
      projectId
    } = params;
    const access = new Set(organization.access);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [this.state.keyList.map(key => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(_keyRow__WEBPACK_IMPORTED_MODULE_16__["default"], {
        api: this.api,
        access: access,
        orgId: orgId,
        projectId: `${projectId}`,
        data: key,
        onToggle: this.handleToggleKey,
        onRemove: this.handleRemoveKey,
        routes: routes,
        location: location,
        params: params
      }, key.id)), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_6__["default"], {
        pageLinks: this.state.keyListPageLinks
      })]
    });
  }

  renderBody() {
    const access = new Set(this.props.organization.access);
    const isEmpty = !this.state.keyList.length;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)("div", {
      "data-test-id": "project-keys",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_14__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Client Keys'),
        action: access.has('project:write') ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
          onClick: this.handleCreateKey,
          size: "sm",
          priority: "primary",
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_8__.IconAdd, {
            size: "xs",
            isCircled: true
          }),
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Generate New Key')
        }) : null
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_15__["default"], {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)(`To send data to Sentry you will need to configure an SDK with a client key
          (usually referred to as the [code:SENTRY_DSN] value). For more
          information on integrating Sentry with your application take a look at our
          [link:documentation].`, {
          link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_5__["default"], {
            href: "https://docs.sentry.io/platform-redirect/?next=/configuration/options/"
          }),
          code: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("code", {})
        })
      }), isEmpty ? this.renderEmpty() : this.renderResults()]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_11__["default"])(ProjectKeys));

/***/ }),

/***/ "./app/views/settings/project/projectKeys/list/keyRow.tsx":
/*!****************************************************************!*\
  !*** ./app/views/settings/project/projectKeys/list/keyRow.tsx ***!
  \****************************************************************/
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
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_clippedBox__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/clippedBox */ "./app/components/clippedBox.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/recreateRoute */ "./app/utils/recreateRoute.tsx");
/* harmony import */ var sentry_views_settings_project_projectKeys_projectKeyCredentials__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/settings/project/projectKeys/projectKeyCredentials */ "./app/views/settings/project/projectKeys/projectKeyCredentials.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");

















class KeyRow extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleRemove", () => {
      const {
        data,
        onRemove
      } = this.props;
      onRemove(data);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleEnable", () => {
      const {
        onToggle,
        data
      } = this.props;
      onToggle(true, data);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDisable", () => {
      const {
        onToggle,
        data
      } = this.props;
      onToggle(false, data);
    });
  }

  render() {
    const {
      access,
      data,
      routes,
      location,
      params
    } = this.props;
    const editUrl = (0,sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_12__["default"])(`${data.id}/`, {
      routes,
      params,
      location
    });
    const controlActive = access.has('project:write');
    const controls = [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
      to: editUrl,
      size: "sm",
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Configure')
    }, "edit"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
      size: "sm",
      onClick: data.isActive ? this.handleDisable : this.handleEnable,
      disabled: !controlActive,
      children: data.isActive ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Disable') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Enable')
    }, "toggle"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_6__["default"], {
      priority: "danger",
      disabled: !controlActive,
      onConfirm: this.handleRemove,
      confirmText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Remove Key'),
      message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Are you sure you want to remove this key? This action is irreversible.'),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
        size: "sm",
        disabled: !controlActive,
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconDelete, {}),
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Delete')
      })
    }, "remove")];
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.Panel, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.PanelHeader, {
        hasButtons: true,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(Title, {
          disabled: !data.isActive,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(PanelHeaderLink, {
            to: editUrl,
            children: data.label
          }), !data.isActive && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)("small", {
            children: [' \u2014  ', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Disabled')]
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(Controls, {
          children: controls.map((c, n) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)("span", {
            children: [" ", c]
          }, n))
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StyledClippedBox, {
        clipHeight: 300,
        defaultClipped: true,
        btnText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Expand'),
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StyledPanelBody, {
          disabled: !data.isActive,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_views_settings_project_projectKeys_projectKeyCredentials__WEBPACK_IMPORTED_MODULE_13__["default"], {
            projectId: `${data.projectId}`,
            data: data
          })
        })
      })]
    });
  }

}

KeyRow.displayName = "KeyRow";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (KeyRow);

const StyledClippedBox = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_clippedBox__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "eufuc714"
} : 0)("padding:0;margin:0;>*:last-child{padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(3), ";}" + ( true ? "" : 0));

const PanelHeaderLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "eufuc713"
} : 0)("color:", p => p.theme.subText, ";" + ( true ? "" : 0));

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eufuc712"
} : 0)("flex:1;", p => p.disabled ? 'opacity: 0.5;' : '', ";margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(1), ";" + ( true ? "" : 0));

const Controls = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eufuc711"
} : 0)("display:grid;align-items:center;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(1), ";grid-auto-flow:column;" + ( true ? "" : 0));

const StyledPanelBody = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.PanelBody,  true ? {
  target: "eufuc710"
} : 0)(p => p.disabled ? 'opacity: 0.5;' : '', ";" + ( true ? "" : 0));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_project_projectKeys_list_index_tsx.f207dba90c47d78bca2c0d0d9d5b2e03.js.map