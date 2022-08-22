"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_projectSourceMaps_detail_index_tsx"],{

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

/***/ "./app/views/settings/projectSourceMaps/detail/index.tsx":
/*!***************************************************************!*\
  !*** ./app/views/settings/projectSourceMaps/detail/index.tsx ***!
  \***************************************************************/
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
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/searchBar */ "./app/components/searchBar.tsx");
/* harmony import */ var sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/textOverflow */ "./app/components/textOverflow.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_components_version__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/version */ "./app/components/version.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/routeTitle */ "./app/utils/routeTitle.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var _sourceMapsArtifactRow__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ./sourceMapsArtifactRow */ "./app/views/settings/projectSourceMaps/detail/sourceMapsArtifactRow.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

























class ProjectSourceMapsDetail extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_21__["default"] {
  constructor() {
    super(...arguments);

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

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleArtifactDelete", async id => {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Removing artifact\u2026'));

      try {
        await this.api.requestPromise(`${this.getArtifactsUrl()}${id}/`, {
          method: 'DELETE'
        });
        this.fetchData();
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Artifact removed.'));
      } catch {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Unable to remove artifact. Please try again.'));
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleArchiveDelete", async () => {
      const {
        orgId,
        projectId,
        name
      } = this.props.params;
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Removing artifacts\u2026'));

      try {
        await this.api.requestPromise(`/projects/${orgId}/${projectId}/files/source-maps/`, {
          method: 'DELETE',
          query: {
            name
          }
        });
        this.fetchData();
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Artifacts removed.'));
      } catch {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Unable to remove artifacts. Please try again.'));
      }
    });
  }

  getTitle() {
    const {
      projectId,
      name
    } = this.props.params;
    return (0,sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_20__["default"])((0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Archive %s', (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_18__.formatVersion)(name)), projectId, false);
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      artifacts: []
    };
  }

  getEndpoints() {
    return [['artifacts', this.getArtifactsUrl(), {
      query: {
        query: this.getQuery()
      }
    }]];
  }

  getArtifactsUrl() {
    const {
      orgId,
      projectId,
      name
    } = this.props.params;
    return `/projects/${orgId}/${projectId}/releases/${encodeURIComponent(name)}/files/`;
  }

  getQuery() {
    const {
      query
    } = this.props.location.query;
    return (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_19__.decodeScalar)(query);
  }

  getEmptyMessage() {
    if (this.getQuery()) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('There are no artifacts that match your search.');
    }

    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('There are no artifacts in this archive.');
  }

  renderLoading() {
    return this.renderBody();
  }

  renderArtifacts() {
    const {
      organization
    } = this.props;
    const {
      artifacts
    } = this.state;
    const artifactApiUrl = this.api.baseUrl + this.getArtifactsUrl();

    if (!artifacts.length) {
      return null;
    }

    return artifacts.map(artifact => {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(_sourceMapsArtifactRow__WEBPACK_IMPORTED_MODULE_23__["default"], {
        artifact: artifact,
        onDelete: this.handleArtifactDelete,
        downloadUrl: `${artifactApiUrl}${artifact.id}/?download=1`,
        downloadRole: organization.debugFilesRole,
        orgSlug: organization.slug
      }, artifact.id);
    });
  }

  renderBody() {
    const {
      loading,
      artifacts,
      artifactsPageLinks
    } = this.state;
    const {
      name,
      orgId
    } = this.props.params;
    const {
      project
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(StyledSettingsPageHeader, {
        title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(Title, {
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Archive'), "\xA0", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_12__["default"], {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_version__WEBPACK_IMPORTED_MODULE_14__["default"], {
              version: name,
              tooltipRawVersion: true,
              anchor: false,
              truncate: true
            })
          })]
        }),
        action: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(StyledButtonBar, {
          gap: 1,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(ReleaseButton, {
            to: `/organizations/${orgId}/releases/${encodeURIComponent(name)}/?project=${project.id}`,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Go to Release')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_5__["default"], {
            access: ['project:releases'],
            children: _ref => {
              let {
                hasAccess
              } = _ref;
              return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_13__["default"], {
                disabled: hasAccess,
                title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('You do not have permission to delete artifacts.'),
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_8__["default"], {
                  message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Are you sure you want to remove all artifacts in this archive?'),
                  onConfirm: this.handleArchiveDelete,
                  disabled: !hasAccess,
                  children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
                    icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_15__.IconDelete, {
                      size: "sm"
                    }),
                    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Remove All Artifacts'),
                    "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Remove All Artifacts'),
                    disabled: !hasAccess
                  })
                })
              });
            }
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_11__["default"], {
            placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Filter artifacts'),
            onSearch: this.handleSearch,
            query: this.getQuery()
          })]
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(StyledPanelTable, {
        headers: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Artifact'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(SizeColumn, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('File Size')
        }, "size"), ''],
        emptyMessage: this.getEmptyMessage(),
        isEmpty: artifacts.length === 0,
        isLoading: loading,
        children: this.renderArtifacts()
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_9__["default"], {
        pageLinks: artifactsPageLinks
      })]
    });
  }

}

const StyledSettingsPageHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_22__["default"],  true ? {
  target: "e1qrdj7c5"
} : 0)(">div{@media (max-width: ", p => p.theme.breakpoints.large, "){>div{}display:block;}>div{min-width:0;@media (max-width: ", p => p.theme.breakpoints.large, "){>div{}margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(2), ";}}}" + ( true ? "" : 0));

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1qrdj7c4"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const StyledButtonBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "e1qrdj7c3"
} : 0)( true ? {
  name: "11g6mpt",
  styles: "justify-content:flex-start"
} : 0);

const StyledPanelTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.PanelTable,  true ? {
  target: "e1qrdj7c2"
} : 0)( true ? {
  name: "qc2mzu",
  styles: "grid-template-columns:minmax(220px, 1fr) max-content 120px"
} : 0);

const ReleaseButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e1qrdj7c1"
} : 0)( true ? {
  name: "1bmnxg7",
  styles: "white-space:nowrap"
} : 0);

const SizeColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1qrdj7c0"
} : 0)( true ? {
  name: "2qga7i",
  styles: "text-align:right"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectSourceMapsDetail);

/***/ }),

/***/ "./app/views/settings/projectSourceMaps/detail/sourceMapsArtifactRow.tsx":
/*!*******************************************************************************!*\
  !*** ./app/views/settings/projectSourceMaps/detail/sourceMapsArtifactRow.tsx ***!
  \*******************************************************************************/
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
/* harmony import */ var sentry_components_tag__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/tag */ "./app/components/tag.tsx");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


















const SourceMapsArtifactRow = _ref => {
  let {
    artifact,
    onDelete,
    downloadUrl,
    downloadRole,
    orgSlug
  } = _ref;
  const {
    name,
    size,
    dateCreated,
    id,
    dist
  } = artifact;

  const handleDeleteClick = () => {
    onDelete(id);
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(NameColumn, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(Name, {
        children: name || `(${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('empty')})`
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(TimeAndDistWrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(TimeWrapper, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_12__.IconClock, {
            size: "sm"
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_10__["default"], {
            date: dateCreated
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(StyledTag, {
          type: dist ? 'info' : undefined,
          tooltipText: dist ? undefined : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('No distribution set'),
          children: dist !== null && dist !== void 0 ? dist : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('none')
        })]
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(SizeColumn, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_fileSize__WEBPACK_IMPORTED_MODULE_7__["default"], {
        bytes: size
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(ActionsColumn, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_5__["default"], {
        gap: 0.5,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_acl_role__WEBPACK_IMPORTED_MODULE_3__.Role, {
          role: downloadRole,
          children: _ref2 => {
            let {
              hasRole
            } = _ref2;
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_11__["default"], {
              title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.tct)('Artifacts can only be downloaded by users with organization [downloadRole] role[orHigher]. This can be changed in [settingsLink:Debug Files Access] settings.', {
                downloadRole,
                orHigher: downloadRole !== 'owner' ? ` ${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('or higher')}` : '',
                settingsLink: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__["default"], {
                  to: `/settings/${orgSlug}/#debugFilesRole`
                })
              }),
              disabled: hasRole,
              isHoverable: true,
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
                size: "sm",
                icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_12__.IconDownload, {
                  size: "sm"
                }),
                disabled: !hasRole,
                href: downloadUrl,
                title: hasRole ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Download Artifact') : undefined,
                "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Download Artifact')
              })
            });
          }
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_2__["default"], {
          access: ['project:releases'],
          children: _ref3 => {
            let {
              hasAccess
            } = _ref3;
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_11__["default"], {
              disabled: hasAccess,
              title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('You do not have permission to delete artifacts.'),
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_6__["default"], {
                message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Are you sure you want to remove this artifact?'),
                onConfirm: handleDeleteClick,
                disabled: !hasAccess,
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
                  size: "sm",
                  icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_12__.IconDelete, {
                    size: "sm"
                  }),
                  title: hasAccess ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Remove Artifact') : undefined,
                  "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Remove Artifact'),
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

SourceMapsArtifactRow.displayName = "SourceMapsArtifactRow";

const NameColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e2h2xmi6"
} : 0)( true ? {
  name: "1ij1o5n",
  styles: "display:flex;flex-direction:column;align-items:flex-start;justify-content:center"
} : 0);

const SizeColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e2h2xmi5"
} : 0)( true ? {
  name: "ivtwc8",
  styles: "display:flex;justify-content:flex-end;text-align:right;align-items:center"
} : 0);

const ActionsColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(SizeColumn,  true ? {
  target: "e2h2xmi4"
} : 0)( true ? "" : 0);

const Name = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e2h2xmi3"
} : 0)("padding-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(4), ";overflow-wrap:break-word;word-break:break-all;" + ( true ? "" : 0));

const TimeAndDistWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e2h2xmi2"
} : 0)("width:100%;display:flex;margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), ";align-items:center;" + ( true ? "" : 0));

const TimeWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e2h2xmi1"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(0.5), ";grid-template-columns:min-content 1fr;font-size:", p => p.theme.fontSizeMedium, ";align-items:center;color:", p => p.theme.subText, ";" + ( true ? "" : 0));

const StyledTag = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_tag__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "e2h2xmi0"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SourceMapsArtifactRow);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_projectSourceMaps_detail_index_tsx.81e272420a0382cb348c1efebabd892e.js.map