"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_organizationRepositories_index_tsx"],{

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

/***/ "./app/views/settings/organizationRepositories/index.tsx":
/*!***************************************************************!*\
  !*** ./app/views/settings/organizationRepositories/index.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ OrganizationRepositoriesContainer)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/routeTitle */ "./app/utils/routeTitle.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var _organizationRepositories__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./organizationRepositories */ "./app/views/settings/organizationRepositories/organizationRepositories.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










class OrganizationRepositoriesContainer extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_6__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onRepositoryChange", data => {
      const itemList = this.state.itemList;
      itemList === null || itemList === void 0 ? void 0 : itemList.forEach(item => {
        if (item.id === data.id) {
          item.status = data.status;
        }
      });
      this.setState({
        itemList
      });
    });
  }

  getEndpoints() {
    const {
      orgId
    } = this.props.params;
    return [['itemList', `/organizations/${orgId}/repos/`, {
      query: {
        status: ''
      }
    }]];
  } // Callback used by child component to signal state change


  getTitle() {
    const {
      orgId
    } = this.props.params;
    return (0,sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_5__["default"])((0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Repositories'), orgId, false);
  }

  renderBody() {
    const {
      itemList,
      itemListPageLinks
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_organizationRepositories__WEBPACK_IMPORTED_MODULE_7__["default"], { ...this.props,
        itemList: itemList,
        onRepositoryChange: this.onRepositoryChange
      }), itemListPageLinks && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_3__["default"], {
        pageLinks: itemListPageLinks,
        ...this.props
      })]
    });
  }

}

/***/ }),

/***/ "./app/views/settings/organizationRepositories/organizationRepositories.tsx":
/*!**********************************************************************************!*\
  !*** ./app/views/settings/organizationRepositories/organizationRepositories.tsx ***!
  \**********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_alertLink__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/alertLink */ "./app/components/alertLink.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_repositoryRow__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/repositoryRow */ "./app/components/repositoryRow.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");














function OrganizationRepositories(_ref) {
  let {
    itemList,
    onRepositoryChange,
    params
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_7__["default"])();
  const {
    orgId
  } = params;
  const hasItemList = itemList && itemList.length > 0;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)("div", {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_9__["default"], {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Repositories')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_alertLink__WEBPACK_IMPORTED_MODULE_0__["default"], {
      to: `/settings/${orgId}/integrations/`,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Want to add a repository to start tracking commits? Install or configure your version control integration here.')
    }), !hasItemList && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)("div", {
      className: "m-b-2",
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_10__["default"], {
        children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Connecting a repository allows Sentry to capture commit data via webhooks. ' + 'This enables features like suggested assignees and resolving issues via commit message. ' + "Once you've connected a repository, you can associate commits with releases via the API."), "\xA0", (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)('See our [link:documentation] for more details.', {
          link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_2__["default"], {
            href: "https://docs.sentry.io/learn/releases/"
          })
        })]
      })
    }), hasItemList ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.Panel, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.PanelHeader, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Added Repositories')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.PanelBody, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)("div", {
          children: itemList.map(repo => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_repositoryRow__WEBPACK_IMPORTED_MODULE_4__["default"], {
            api: api,
            repository: repo,
            showProvider: true,
            orgId: orgId,
            onRepositoryChange: onRepositoryChange
          }, repo.id))
        })
      })]
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.Panel, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_8__["default"], {
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconCommit, {
          size: "xl"
        }),
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Sentry is better with commit data'),
        description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Adding one or more repositories will enable enhanced releases and the ability to resolve Sentry Issues via git message.'),
        action: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"], {
          external: true,
          href: "https://docs.sentry.io/learn/releases/",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Learn more')
        })
      })
    })]
  });
}

OrganizationRepositories.displayName = "OrganizationRepositories";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OrganizationRepositories);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_organizationRepositories_index_tsx.260524988ca8736a96001ef6917c378f.js.map