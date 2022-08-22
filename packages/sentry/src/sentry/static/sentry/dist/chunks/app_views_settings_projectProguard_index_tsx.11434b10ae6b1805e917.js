"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_projectProguard_index_tsx"],{

/***/ "./app/components/acl/role.tsx":
/*!*************************************!*\
  !*** ./app/components/acl/role.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Role": () => (/* binding */ withOrganizationRole)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_utils_isActiveSuperuser__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/isActiveSuperuser */ "./app/utils/isActiveSuperuser.tsx");
/* harmony import */ var sentry_utils_isRenderFunc__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/isRenderFunc */ "./app/utils/isRenderFunc.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");







function checkUserRole(user, organization, role) {
  var _organization$role, _organization$role2;

  if (!user) {
    return false;
  }

  if ((0,sentry_utils_isActiveSuperuser__WEBPACK_IMPORTED_MODULE_3__.isActiveSuperuser)()) {
    return true;
  }

  if (!Array.isArray(organization.orgRoleList)) {
    return false;
  }

  const roleIds = organization.orgRoleList.map(r => r.id);

  if (!roleIds.includes(role) || !roleIds.includes((_organization$role = organization.role) !== null && _organization$role !== void 0 ? _organization$role : '')) {
    return false;
  }

  const requiredIndex = roleIds.indexOf(role);
  const currentIndex = roleIds.indexOf((_organization$role2 = organization.role) !== null && _organization$role2 !== void 0 ? _organization$role2 : '');
  return currentIndex >= requiredIndex;
}

function Role(_ref) {
  let {
    role,
    organization,
    children
  } = _ref;
  const user = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_2__["default"].get('user');
  const hasRole = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => checkUserRole(user, organization, role), // It seems that this returns a stable reference, but
  [organization, role, user]);

  if ((0,sentry_utils_isRenderFunc__WEBPACK_IMPORTED_MODULE_4__.isRenderFunc)(children)) {
    return children({
      hasRole
    });
  }

  return hasRole ? children : null;
}

const withOrganizationRole = (0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_5__["default"])(Role);


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

/***/ "./app/views/settings/projectProguard/index.tsx":
/*!******************************************************!*\
  !*** ./app/views/settings/projectProguard/index.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _projectProguard__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./projectProguard */ "./app/views/settings/projectProguard/projectProguard.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





class ProjectProguardContainer extends react__WEBPACK_IMPORTED_MODULE_0__.Component {
  render() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_projectProguard__WEBPACK_IMPORTED_MODULE_2__["default"], { ...this.props
    });
  }

}

ProjectProguardContainer.displayName = "ProjectProguardContainer";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_1__["default"])(ProjectProguardContainer));

/***/ }),

/***/ "./app/views/settings/projectProguard/projectProguard.tsx":
/*!****************************************************************!*\
  !*** ./app/views/settings/projectProguard/projectProguard.tsx ***!
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
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/searchBar */ "./app/components/searchBar.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/routeTitle */ "./app/utils/routeTitle.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var _projectProguardRow__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./projectProguardRow */ "./app/views/settings/projectProguard/projectProguardRow.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }















class ProjectProguard extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_10__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDelete", id => {
      const {
        orgId,
        projectId
      } = this.props.params;
      this.setState({
        loading: true
      });
      this.api.request(`/projects/${orgId}/${projectId}/files/dsyms/?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        complete: () => this.fetchData()
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSearch", query => {
      const {
        location,
        router
      } = this.props;
      router.push({ ...location,
        query: { ...location.query,
          cursor: undefined,
          query
        }
      });
    });
  }

  getTitle() {
    const {
      projectId
    } = this.props.params;
    return (0,sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_9__["default"])((0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('ProGuard Mappings'), projectId, false);
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      mappings: []
    };
  }

  getEndpoints() {
    const {
      params,
      location
    } = this.props;
    const {
      orgId,
      projectId
    } = params;
    const endpoints = [['mappings', `/projects/${orgId}/${projectId}/files/dsyms/`, {
      query: {
        query: location.query.query,
        file_formats: 'proguard'
      }
    }]];
    return endpoints;
  }

  getQuery() {
    const {
      query
    } = this.props.location.query;
    return typeof query === 'string' ? query : undefined;
  }

  getEmptyMessage() {
    if (this.getQuery()) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('There are no mappings that match your search.');
    }

    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('There are no mappings for this project.');
  }

  renderLoading() {
    return this.renderBody();
  }

  renderMappings() {
    const {
      mappings
    } = this.state;
    const {
      organization,
      params
    } = this.props;
    const {
      orgId,
      projectId
    } = params;

    if (!(mappings !== null && mappings !== void 0 && mappings.length)) {
      return null;
    }

    return mappings.map(mapping => {
      const downloadUrl = `${this.api.baseUrl}/projects/${orgId}/${projectId}/files/dsyms/?id=${encodeURIComponent(mapping.id)}`;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(_projectProguardRow__WEBPACK_IMPORTED_MODULE_13__["default"], {
        mapping: mapping,
        downloadUrl: downloadUrl,
        onDelete: this.handleDelete,
        downloadRole: organization.debugFilesRole,
        orgSlug: organization.slug
      }, mapping.id);
    });
  }

  renderBody() {
    const {
      loading,
      mappings,
      mappingsPageLinks
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_11__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('ProGuard Mappings'),
        action: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_7__["default"], {
          placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Filter mappings'),
          onSearch: this.handleSearch,
          query: this.getQuery(),
          width: "280px"
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_12__["default"], {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)(`ProGuard mapping files are used to convert minified classes, methods and field names into a human readable format. To learn more about proguard mapping files, [link: read the docs].`, {
          link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_4__["default"], {
            href: "https://docs.sentry.io/platforms/android/proguard/"
          })
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StyledPanelTable, {
        headers: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Mapping'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(SizeColumn, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('File Size')
        }, "size"), ''],
        emptyMessage: this.getEmptyMessage(),
        isEmpty: (mappings === null || mappings === void 0 ? void 0 : mappings.length) === 0,
        isLoading: loading,
        children: this.renderMappings()
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_5__["default"], {
        pageLinks: mappingsPageLinks
      })]
    });
  }

}

const StyledPanelTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelTable,  true ? {
  target: "et988281"
} : 0)( true ? {
  name: "qc2mzu",
  styles: "grid-template-columns:minmax(220px, 1fr) max-content 120px"
} : 0);

const SizeColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "et988280"
} : 0)( true ? {
  name: "2qga7i",
  styles: "text-align:right"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectProguard);

/***/ }),

/***/ "./app/views/settings/projectProguard/projectProguardRow.tsx":
/*!*******************************************************************!*\
  !*** ./app/views/settings/projectProguard/projectProguardRow.tsx ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_acl_role__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/acl/role */ "./app/components/acl/role.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_fileSize__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/fileSize */ "./app/components/fileSize.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

















const ProjectProguardRow = _ref => {
  let {
    mapping,
    onDelete,
    downloadUrl,
    downloadRole,
    orgSlug
  } = _ref;
  const {
    id,
    debugId,
    uuid,
    size,
    dateCreated
  } = mapping;

  const handleDeleteClick = () => {
    onDelete(id);
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(NameColumn, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(Name, {
        children: debugId || uuid || `(${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('empty')})`
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(TimeWrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconClock, {
          size: "sm"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_9__["default"], {
          date: dateCreated
        })]
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(SizeColumn, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_fileSize__WEBPACK_IMPORTED_MODULE_7__["default"], {
        bytes: size
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(ActionsColumn, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_5__["default"], {
        gap: 0.5,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_acl_role__WEBPACK_IMPORTED_MODULE_3__.Role, {
          role: downloadRole,
          children: _ref2 => {
            let {
              hasRole
            } = _ref2;
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_10__["default"], {
              title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('Mappings can only be downloaded by users with organization [downloadRole] role[orHigher]. This can be changed in [settingsLink:Debug Files Access] settings.', {
                downloadRole,
                orHigher: downloadRole !== 'owner' ? ` ${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('or higher')}` : '',
                settingsLink: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__["default"], {
                  to: `/settings/${orgSlug}/#debugFilesRole`
                })
              }),
              disabled: hasRole,
              isHoverable: true,
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
                size: "sm",
                icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconDownload, {
                  size: "sm"
                }),
                disabled: !hasRole,
                href: downloadUrl,
                title: hasRole ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Download Mapping') : undefined,
                "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Download Mapping')
              })
            });
          }
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_2__["default"], {
          access: ['project:releases'],
          children: _ref3 => {
            let {
              hasAccess
            } = _ref3;
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_10__["default"], {
              disabled: hasAccess,
              title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('You do not have permission to delete mappings.'),
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_6__["default"], {
                message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Are you sure you want to remove this mapping?'),
                onConfirm: handleDeleteClick,
                disabled: !hasAccess,
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
                  size: "sm",
                  icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconDelete, {
                    size: "sm"
                  }),
                  title: hasAccess ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Remove Mapping') : undefined,
                  "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Remove Mapping'),
                  disabled: !hasAccess
                })
              })
            });
          }
        })]
      })
    })]
  });
};

ProjectProguardRow.displayName = "ProjectProguardRow";

const NameColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1llzagh4"
} : 0)( true ? {
  name: "1ij1o5n",
  styles: "display:flex;flex-direction:column;align-items:flex-start;justify-content:center"
} : 0);

const SizeColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1llzagh3"
} : 0)( true ? {
  name: "ivtwc8",
  styles: "display:flex;justify-content:flex-end;text-align:right;align-items:center"
} : 0);

const ActionsColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(SizeColumn,  true ? {
  target: "e1llzagh2"
} : 0)( true ? "" : 0);

const Name = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1llzagh1"
} : 0)("padding-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(4), ";overflow-wrap:break-word;word-break:break-all;" + ( true ? "" : 0));

const TimeWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1llzagh0"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(0.5), ";grid-template-columns:min-content 1fr;font-size:", p => p.theme.fontSizeMedium, ";align-items:center;color:", p => p.theme.subText, ";margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectProguardRow);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_projectProguard_index_tsx.b643310a1ad8b1e11c9b6bc5fa9378ba.js.map