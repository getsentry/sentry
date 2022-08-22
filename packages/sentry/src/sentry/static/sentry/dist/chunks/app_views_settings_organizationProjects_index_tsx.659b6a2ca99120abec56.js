"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_organizationProjects_index_tsx"],{

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

/***/ "./app/views/settings/components/settingsProjectItem.tsx":
/*!***************************************************************!*\
  !*** ./app/views/settings/components/settingsProjectItem.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/idBadge/projectBadge */ "./app/components/idBadge/projectBadge.tsx");
/* harmony import */ var sentry_components_projects_bookmarkStar__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/projects/bookmarkStar */ "./app/components/projects/bookmarkStar.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









function ProjectItem(_ref) {
  let {
    project,
    organization
  } = _ref;
  const [isBookmarked, setBookmarked] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(project.isBookmarked);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(Wrapper, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_projects_bookmarkStar__WEBPACK_IMPORTED_MODULE_4__["default"], {
      organization: organization,
      project: project,
      isBookmarked: isBookmarked,
      onToggle: state => setBookmarked(state)
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_3__["default"], {
      to: `/settings/${organization.slug}/projects/${project.slug}/`,
      avatarSize: 18,
      project: project
    })]
  });
}

ProjectItem.displayName = "ProjectItem";

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e3cl2ic0"
} : 0)("display:grid;grid-template-columns:max-content 1fr;align-items:center;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1.5), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectItem);

/***/ }),

/***/ "./app/views/settings/organizationProjects/index.tsx":
/*!***********************************************************!*\
  !*** ./app/views/settings/organizationProjects/index.tsx ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/routeTitle */ "./app/utils/routeTitle.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_components_settingsProjectItem__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/views/settings/components/settingsProjectItem */ "./app/views/settings/components/settingsProjectItem.tsx");
/* harmony import */ var _projectStatsGraph__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ./projectStatsGraph */ "./app/views/settings/organizationProjects/projectStatsGraph.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }





















const ITEMS_PER_PAGE = 50;

class OrganizationProjects extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_15__["default"] {
  getEndpoints() {
    const {
      orgId
    } = this.props.params;
    const {
      location
    } = this.props;
    const query = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_12__.decodeScalar)(location.query.query);
    return [['projectList', `/organizations/${orgId}/projects/`, {
      query: {
        query,
        per_page: ITEMS_PER_PAGE
      }
    }], ['projectStats', `/organizations/${orgId}/stats/`, {
      query: {
        since: new Date().getTime() / 1000 - 3600 * 24,
        stat: 'generated',
        group: 'project',
        per_page: ITEMS_PER_PAGE
      }
    }]];
  }

  getTitle() {
    const {
      organization
    } = this.props;
    return (0,sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_13__["default"])((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Projects'), organization.slug, false);
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {
      projectList,
      projectListPageLinks,
      projectStats
    } = this.state;
    const {
      organization
    } = this.props;
    const canCreateProjects = new Set(organization.access).has('project:admin');

    const action = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
      priority: "primary",
      size: "sm",
      disabled: !canCreateProjects,
      title: !canCreateProjects ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('You do not have permission to create projects') : undefined,
      to: `/organizations/${organization.slug}/projects/new/`,
      icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_8__.IconAdd, {
        size: "xs",
        isCircled: true
      }),
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Create Project')
    });

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_17__["default"], {
        title: "Projects",
        action: action
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(SearchWrapper, {
        children: this.renderSearchInput({
          updateRoute: true,
          placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Search Projects'),
          className: 'search'
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Projects')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelBody, {
          children: [projectList ? (0,sentry_utils__WEBPACK_IMPORTED_MODULE_11__.sortProjects)(projectList).map(project => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(GridPanelItem, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(ProjectListItemWrapper, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_settings_components_settingsProjectItem__WEBPACK_IMPORTED_MODULE_18__["default"], {
                project: project,
                organization: organization
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(ProjectStatsGraphWrapper, {
              children: projectStats ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(_projectStatsGraph__WEBPACK_IMPORTED_MODULE_19__["default"], {
                project: project,
                stats: projectStats[project.id]
              }, project.id) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_7__["default"], {
                height: "25px"
              })
            })]
          }, project.id)) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_4__["default"], {}), projectList && projectList.length === 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_16__["default"], {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('No projects found.')
          })]
        })]
      }), projectListPageLinks && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_5__["default"], {
        pageLinks: projectListPageLinks,
        ...this.props
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_14__["default"])(OrganizationProjects));

const SearchWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1wqwm893"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(2), ";" + ( true ? "" : 0));

const GridPanelItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelItem,  true ? {
  target: "e1wqwm892"
} : 0)( true ? {
  name: "awz0iq",
  styles: "display:flex;align-items:center;padding:0"
} : 0);

const ProjectListItemWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1wqwm891"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(2), ";flex:1;" + ( true ? "" : 0));

const ProjectStatsGraphWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1wqwm890"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(2), ";width:25%;margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(2), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/organizationProjects/projectStatsGraph.tsx":
/*!***********************************************************************!*\
  !*** ./app/views/settings/organizationProjects/projectStatsGraph.tsx ***!
  \***********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_lazyload__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-lazyload */ "../node_modules/react-lazyload/lib/index.js");
/* harmony import */ var sentry_components_charts_miniBarChart__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/charts/miniBarChart */ "./app/components/charts/miniBarChart.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






const ProjectStatsGraph = _ref => {
  let {
    project,
    stats
  } = _ref;
  stats = stats || project.stats || [];
  const series = [{
    seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Events'),
    data: stats.map(point => ({
      name: point[0] * 1000,
      value: point[1]
    }))
  }];
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: series && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(react_lazyload__WEBPACK_IMPORTED_MODULE_1__["default"], {
      height: 25,
      debounce: 50,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_charts_miniBarChart__WEBPACK_IMPORTED_MODULE_2__["default"], {
        isGroupedByDate: true,
        showTimeInTooltip: true,
        series: series,
        height: 25
      })
    })
  });
};

ProjectStatsGraph.displayName = "ProjectStatsGraph";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectStatsGraph);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_organizationProjects_index_tsx.238ef558aac52497a16e6f567687e112.js.map