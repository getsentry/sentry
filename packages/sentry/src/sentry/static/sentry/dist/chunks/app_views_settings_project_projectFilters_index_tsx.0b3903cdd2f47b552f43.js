"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_project_projectFilters_index_tsx"],{

/***/ "./app/data/forms/inboundFilters.tsx":
/*!*******************************************!*\
  !*** ./app/data/forms/inboundFilters.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "customFilterFields": () => (/* binding */ customFilterFields),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "route": () => (/* binding */ route)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


 // Export route to make these forms searchable by label/help



const route = '/settings/:orgId/projects/:projectId/filters/';
const newLineHelpText = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Separate multiple entries with a newline.');
const globHelpText = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.tct)('Allows [link:glob pattern matching].', {
  link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_1__["default"], {
    href: "https://en.wikipedia.org/wiki/Glob_(programming)"
  })
});

const getOptionsData = data => ({
  options: data
});

const formGroups = [{
  // Form "section"/"panel"
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Custom Filters'),
  fields: [{
    name: 'filters:blacklisted_ips',
    type: 'string',
    multiline: true,
    autosize: true,
    rows: 1,
    maxRows: 10,
    placeholder: 'e.g. 127.0.0.1 or 10.0.0.0/8',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('IP Addresses'),
    help: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Filter events from these IP addresses. '), newLineHelpText]
    }),
    getData: getOptionsData
  }]
}];
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (formGroups); // These require a feature flag

const customFilterFields = [{
  name: 'filters:releases',
  type: 'string',
  multiline: true,
  autosize: true,
  maxRows: 10,
  rows: 1,
  placeholder: 'e.g. 1.* or [!3].[0-9].*',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Releases'),
  help: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Filter events from these releases. '), newLineHelpText, " ", globHelpText]
  }),
  getData: getOptionsData
}, {
  name: 'filters:error_messages',
  type: 'string',
  multiline: true,
  autosize: true,
  maxRows: 10,
  rows: 1,
  placeholder: 'e.g. TypeError* or *: integer division or modulo by zero',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Error Message'),
  help: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Filter events by error messages. '), newLineHelpText, " ", globHelpText]
  }),
  getData: getOptionsData
}];

/***/ }),

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

/***/ "./app/views/settings/project/permissionAlert.tsx":
/*!********************************************************!*\
  !*** ./app/views/settings/project/permissionAlert.tsx ***!
  \********************************************************/
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
    access = ['project:write'],
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
        ...props,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('These settings can only be edited by users with the organization owner, manager, or admin role.')
      });
    }
  });
};

PermissionAlert.displayName = "PermissionAlert";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PermissionAlert);

/***/ }),

/***/ "./app/views/settings/project/projectFilters/groupTombstones.tsx":
/*!***********************************************************************!*\
  !*** ./app/views/settings/project/projectFilters/groupTombstones.tsx ***!
  \***********************************************************************/
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
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_avatar__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/avatar */ "./app/components/avatar/index.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_eventOrGroupHeader__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/eventOrGroupHeader */ "./app/components/eventOrGroupHeader.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

















function GroupTombstoneRow(_ref) {
  let {
    data,
    onUndiscard
  } = _ref;
  const actor = data.actor;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__.PanelItem, {
    center: true,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledBox, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_eventOrGroupHeader__WEBPACK_IMPORTED_MODULE_9__["default"], {
        includeLink: false,
        hideIcons: true,
        className: "truncate",
        size: "normal",
        data: data
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(AvatarContainer, {
      children: actor && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_avatar__WEBPACK_IMPORTED_MODULE_6__["default"], {
        user: actor,
        hasTooltip: true,
        tooltip: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Discarded by %s', actor.name || actor.email)
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(ActionContainer, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_8__["default"], {
        message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Undiscarding this issue means that ' + 'incoming events that match this will no longer be discarded. ' + 'New incoming events will count toward your event quota ' + 'and will display on your issues dashboard. ' + 'Are you sure you wish to continue?'),
        onConfirm: () => onUndiscard(data.id),
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Undiscard'),
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Undiscard'),
          size: "xs",
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_12__.IconDelete, {
            size: "xs"
          })
        })
      })
    })]
  });
}

GroupTombstoneRow.displayName = "GroupTombstoneRow";

class GroupTombstones extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_5__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleUndiscard", tombstoneId => {
      const {
        orgId,
        projectId
      } = this.props;
      const path = `/projects/${orgId}/${projectId}/tombstones/${tombstoneId}/`;
      this.api.requestPromise(path, {
        method: 'DELETE'
      }).then(() => {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Events similar to these will no longer be filtered'));
        this.fetchData();
      }).catch(() => {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('We were unable to undiscard this issue'));
        this.fetchData();
      });
    });
  }

  getEndpoints() {
    const {
      orgId,
      projectId
    } = this.props;
    return [['tombstones', `/projects/${orgId}/${projectId}/tombstones/`, {}, {
      paginate: true
    }]];
  }

  renderEmpty() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__.Panel, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_15__["default"], {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('You have no discarded issues')
      })
    });
  }

  renderBody() {
    const {
      tombstones,
      tombstonesPageLinks
    } = this.state;
    return tombstones.length ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__.Panel, {
        children: tombstones.map(data => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(GroupTombstoneRow, {
          data: data,
          onUndiscard: this.handleUndiscard
        }, data.id))
      }), tombstonesPageLinks && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_10__["default"], {
        pageLinks: tombstonesPageLinks
      })]
    }) : this.renderEmpty();
  }

}

const StyledBox = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eehuqin2"
} : 0)( true ? {
  name: "mfxqnx",
  styles: "flex:1;align-items:center;min-width:0"
} : 0);

const AvatarContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eehuqin1"
} : 0)("margin:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(3), ";flex-shrink:1;align-items:center;" + ( true ? "" : 0));

const ActionContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eehuqin0"
} : 0)( true ? {
  name: "nq9fxm",
  styles: "flex-shrink:1;align-items:center"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GroupTombstones);

/***/ }),

/***/ "./app/views/settings/project/projectFilters/index.tsx":
/*!*************************************************************!*\
  !*** ./app/views/settings/project/projectFilters/index.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/navTabs */ "./app/components/navTabs.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/recreateRoute */ "./app/utils/recreateRoute.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var sentry_views_settings_project_permissionAlert__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/views/settings/project/permissionAlert */ "./app/views/settings/project/permissionAlert.tsx");
/* harmony import */ var sentry_views_settings_project_projectFilters_groupTombstones__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/settings/project/projectFilters/groupTombstones */ "./app/views/settings/project/projectFilters/groupTombstones.tsx");
/* harmony import */ var sentry_views_settings_project_projectFilters_projectFiltersChart__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/settings/project/projectFilters/projectFiltersChart */ "./app/views/settings/project/projectFilters/projectFiltersChart.tsx");
/* harmony import */ var sentry_views_settings_project_projectFilters_projectFiltersSettings__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/settings/project/projectFilters/projectFiltersSettings */ "./app/views/settings/project/projectFilters/projectFiltersSettings.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
















function ProjectFilters(props) {
  const {
    project,
    params,
    location
  } = props;
  const {
    orgId,
    projectId,
    filterType
  } = params;

  if (!project) {
    return null;
  }

  const features = new Set(project.features);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_4__["default"], {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Inbound Filters'),
      projectSlug: projectId
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_7__["default"], {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Inbound Data Filters')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_views_settings_project_permissionAlert__WEBPACK_IMPORTED_MODULE_9__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_8__["default"], {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Filters allow you to prevent Sentry from storing events in certain situations. Filtered events are tracked separately from rate limits, and do not apply to any project quotas.')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_views_settings_project_projectFilters_projectFiltersChart__WEBPACK_IMPORTED_MODULE_11__["default"], {
        project: project,
        params: params
      }), features.has('discard-groups') && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_3__["default"], {
        underlined: true,
        style: {
          paddingTop: '30px'
        },
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("li", {
          className: filterType === 'data-filters' ? 'active' : '',
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_2__["default"], {
            to: (0,sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_6__["default"])('data-filters/', { ...props,
              stepBack: -1
            }),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Data Filters')
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("li", {
          className: filterType === 'discarded-groups' ? 'active' : '',
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_2__["default"], {
            to: (0,sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_6__["default"])('discarded-groups/', { ...props,
              stepBack: -1
            }),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Discarded Issues')
          })
        })]
      }), filterType === 'discarded-groups' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_views_settings_project_projectFilters_groupTombstones__WEBPACK_IMPORTED_MODULE_10__["default"], {
        orgId: orgId,
        projectId: project.slug,
        location: location
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_views_settings_project_projectFilters_projectFiltersSettings__WEBPACK_IMPORTED_MODULE_12__["default"], {
        project: project,
        params: params,
        features: features
      })]
    })]
  });
}

ProjectFilters.displayName = "ProjectFilters";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectFilters);

/***/ }),

/***/ "./app/views/settings/project/projectFilters/projectFiltersChart.tsx":
/*!***************************************************************************!*\
  !*** ./app/views/settings/project/projectFilters/projectFiltersChart.tsx ***!
  \***************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ProjectFiltersChart": () => (/* binding */ ProjectFiltersChart),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_charts_miniBarChart__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/miniBarChart */ "./app/components/charts/miniBarChart.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













const STAT_OPS = {
  'browser-extensions': {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Browser Extension'),
    color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_8__["default"].gray200
  },
  cors: {
    title: 'CORS',
    color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_8__["default"].yellow300
  },
  'error-message': {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Error Message'),
    color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_8__["default"].purple300
  },
  'discarded-hash': {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Discarded Issue'),
    color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_8__["default"].gray200
  },
  'invalid-csp': {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Invalid CSP'),
    color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_8__["default"].blue300
  },
  'ip-address': {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('IP Address'),
    color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_8__["default"].red200
  },
  'legacy-browsers': {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Legacy Browser'),
    color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_8__["default"].gray200
  },
  localhost: {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Localhost'),
    color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_8__["default"].blue300
  },
  'release-version': {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Release'),
    color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_8__["default"].purple200
  },
  'web-crawlers': {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Web Crawler'),
    color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_8__["default"].red300
  }
};

class ProjectFiltersChart extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      loading: true,
      error: false,
      statsError: false,
      formattedData: [],
      blankStats: true
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchData", () => {
      this.getFilterStats();
    });
  }

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.project !== this.props.project) {
      this.fetchData();
    }
  }

  formatData(rawData) {
    const seriesWithData = new Set();
    const transformed = Object.keys(STAT_OPS).map(stat => ({
      data: rawData[stat].map(_ref => {
        let [timestamp, value] = _ref;

        if (value > 0) {
          seriesWithData.add(STAT_OPS[stat].title);
          this.setState({
            blankStats: false
          });
        }

        return {
          name: timestamp * 1000,
          value
        };
      }),
      seriesName: STAT_OPS[stat].title,
      color: STAT_OPS[stat].color
    }));
    return transformed.filter(series => seriesWithData.has(series.seriesName));
  }

  getFilterStats() {
    const statOptions = Object.keys(STAT_OPS);
    const {
      project
    } = this.props;
    const {
      orgId
    } = this.props.params;
    const until = Math.floor(new Date().getTime() / 1000);
    const since = until - 3600 * 24 * 30;
    const statEndpoint = `/projects/${orgId}/${project.slug}/stats/`;
    const query = {
      since,
      until,
      resolution: '1d'
    };
    const requests = statOptions.map(stat => this.props.api.requestPromise(statEndpoint, {
      query: Object.assign({
        stat
      }, query)
    }));
    Promise.all(requests).then(results => {
      const rawStatsData = {};

      for (let i = 0; i < statOptions.length; i++) {
        rawStatsData[statOptions[i]] = results[i];
      }

      this.setState({
        formattedData: this.formatData(rawStatsData),
        error: false,
        loading: false
      });
    }).catch(() => {
      this.setState({
        error: true,
        loading: false
      });
    });
  }

  render() {
    const {
      loading,
      error,
      formattedData
    } = this.state;
    const isLoading = loading || !formattedData;
    const hasError = !isLoading && error;
    const hasLoaded = !isLoading && !error;
    const colors = formattedData ? formattedData.map(series => series.color || sentry_utils_theme__WEBPACK_IMPORTED_MODULE_8__["default"].gray200) : undefined;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__.Panel, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__.PanelHeader, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Errors filtered in the last 30 days (by day)')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__.PanelBody, {
        withPadding: true,
        children: [isLoading && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_6__["default"], {
          height: "100px"
        }), hasError && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_4__["default"], {
          onRetry: this.fetchData
        }), hasLoaded && !this.state.blankStats && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_charts_miniBarChart__WEBPACK_IMPORTED_MODULE_3__["default"], {
          series: formattedData,
          colors: colors,
          height: 100,
          isGroupedByDate: true,
          stacked: true,
          labelYAxisExtents: true
        }), hasLoaded && this.state.blankStats && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_10__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Nothing filtered in the last 30 days.'),
          description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Issues filtered as a result of your settings below will be shown here.')
        })]
      })]
    });
  }

}

ProjectFiltersChart.displayName = "ProjectFiltersChart";

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_9__["default"])(ProjectFiltersChart));

/***/ }),

/***/ "./app/views/settings/project/projectFilters/projectFiltersSettings.tsx":
/*!******************************************************************************!*\
  !*** ./app/views/settings/project/projectFilters/projectFiltersSettings.tsx ***!
  \******************************************************************************/
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
/* harmony import */ var sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actions/projectActions */ "./app/actions/projectActions.tsx");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/acl/featureDisabled */ "./app/components/acl/featureDisabled.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_forms_fieldFromConfig__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/forms/fieldFromConfig */ "./app/components/forms/fieldFromConfig.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/forms/formField */ "./app/components/forms/formField/index.tsx");
/* harmony import */ var sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/forms/jsonForm */ "./app/components/forms/jsonForm.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_switchButton__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/switchButton */ "./app/components/switchButton.tsx");
/* harmony import */ var sentry_data_forms_inboundFilters__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/data/forms/inboundFilters */ "./app/data/forms/inboundFilters.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_hookStore__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/stores/hookStore */ "./app/stores/hookStore.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


















const LEGACY_BROWSER_SUBFILTERS = {
  ie_pre_9: {
    icon: 'internet-explorer',
    helpText: 'Version 8 and lower',
    title: 'Internet Explorer'
  },
  ie9: {
    icon: 'internet-explorer',
    helpText: 'Version 9',
    title: 'Internet Explorer'
  },
  ie10: {
    icon: 'internet-explorer',
    helpText: 'Version 10',
    title: 'Internet Explorer'
  },
  ie11: {
    icon: 'internet-explorer',
    helpText: 'Version 11',
    title: 'Internet Explorer'
  },
  safari_pre_6: {
    icon: 'safari',
    helpText: 'Version 5 and lower',
    title: 'Safari'
  },
  opera_pre_15: {
    icon: 'opera',
    helpText: 'Version 14 and lower',
    title: 'Opera'
  },
  opera_mini_pre_8: {
    icon: 'opera',
    helpText: 'Version 8 and lower',
    title: 'Opera Mini'
  },
  android_pre_4: {
    icon: 'android',
    helpText: 'Version 3 and lower',
    title: 'Android'
  }
};
const LEGACY_BROWSER_KEYS = Object.keys(LEGACY_BROWSER_SUBFILTERS);

var _ref =  true ? {
  name: "nb8u23",
  styles: "flex-shrink:0;margin-left:6px"
} : 0;

class LegacyBrowserFilterRow extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor(props) {
    super(props);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleToggleSubfilters", (subfilter, e) => {
      let {
        subfilters
      } = this.state;

      if (subfilter === true) {
        subfilters = new Set(LEGACY_BROWSER_KEYS);
      } else if (subfilter === false) {
        subfilters = new Set();
      } else if (subfilters.has(subfilter)) {
        subfilters.delete(subfilter);
      } else {
        subfilters.add(subfilter);
      }

      this.setState({
        subfilters: new Set(subfilters)
      }, () => {
        this.props.onToggle(this.props.data, subfilters, e);
      });
    });

    let initialSubfilters;

    if (props.data.active === true) {
      initialSubfilters = new Set(LEGACY_BROWSER_KEYS);
    } else if (props.data.active === false) {
      initialSubfilters = new Set();
    } else {
      initialSubfilters = new Set(props.data.active);
    }

    this.state = {
      loading: false,
      error: false,
      subfilters: initialSubfilters
    };
  }

  render() {
    const {
      disabled
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)("div", {
      children: [!disabled && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(BulkFilter, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(BulkFilterLabel, {
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Filter'), ":"]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(BulkFilterItem, {
          onClick: this.handleToggleSubfilters.bind(this, true),
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('All')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(BulkFilterItem, {
          onClick: this.handleToggleSubfilters.bind(this, false),
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('None')
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(FilterGrid, {
        children: LEGACY_BROWSER_KEYS.map(key => {
          const subfilter = LEGACY_BROWSER_SUBFILTERS[key];
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(FilterGridItemWrapper, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(FilterGridItem, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(FilterItem, {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(FilterGridIcon, {
                  className: `icon-${subfilter.icon}`
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)("div", {
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(FilterTitle, {
                    children: subfilter.title
                  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(FilterDescription, {
                    children: subfilter.helpText
                  })]
                })]
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_switchButton__WEBPACK_IMPORTED_MODULE_14__["default"], {
                isActive: this.state.subfilters.has(key),
                isDisabled: disabled,
                css: _ref,
                toggle: this.handleToggleSubfilters.bind(this, key),
                size: "lg"
              })]
            })
          }, key);
        })
      })]
    });
  }

}

LegacyBrowserFilterRow.displayName = "LegacyBrowserFilterRow";

class ProjectFiltersSettings extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_8__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleLegacyChange", (onChange, onBlur, _filter, subfilters, e) => {
      onChange === null || onChange === void 0 ? void 0 : onChange(subfilters, e);
      onBlur === null || onBlur === void 0 ? void 0 : onBlur(subfilters, e);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmit", response => {
      // This will update our project context
      sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_4__["default"].updateSuccess(response);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderDisabledCustomFilters", p => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_7__["default"], {
      featureName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Custom Inbound Filters'),
      features: p.features,
      alert: sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__.PanelAlert,
      message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Release and Error Message filtering are not enabled on your Sentry installation')
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderCustomFilters", disabled => () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_6__["default"], {
      features: ['projects:custom-inbound-filters'],
      hookName: "feature-disabled:custom-inbound-filters",
      renderDisabled: _ref2 => {
        let {
          children,
          ...props
        } = _ref2;

        if (typeof children === 'function') {
          return children({ ...props,
            renderDisabled: this.renderDisabledCustomFilters
          });
        }

        return null;
      },
      children: _ref3 => {
        var _this$props$project$o;

        let {
          hasFeature,
          organization,
          renderDisabled,
          ...featureProps
        } = _ref3;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
          children: [!hasFeature && typeof renderDisabled === 'function' && // XXX: children is set to null as we're doing tricksy things
          // in the renderDisabled prop a few lines higher.
          renderDisabled({
            organization,
            hasFeature,
            children: null,
            ...featureProps
          }), sentry_data_forms_inboundFilters__WEBPACK_IMPORTED_MODULE_15__.customFilterFields.map(field => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_forms_fieldFromConfig__WEBPACK_IMPORTED_MODULE_9__["default"], {
            field: field,
            disabled: disabled || !hasFeature
          }, field.name)), hasFeature && ((_this$props$project$o = this.props.project.options) === null || _this$props$project$o === void 0 ? void 0 : _this$props$project$o['filters:error_messages']) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__.PanelAlert, {
            type: "warning",
            "data-test-id": "error-message-disclaimer",
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)("Minidumps, errors in the minified production build of React, and Internet Explorer's i18n errors cannot be filtered by message.")
          })]
        });
      }
    }));
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      hooksDisabled: sentry_stores_hookStore__WEBPACK_IMPORTED_MODULE_17__["default"].get('feature-disabled:custom-inbound-filters')
    };
  }

  getEndpoints() {
    const {
      orgId,
      projectId
    } = this.props.params;
    return [['filterList', `/projects/${orgId}/${projectId}/filters/`]];
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevProps.project.slug !== this.props.project.slug) {
      this.reloadData();
    }

    super.componentDidUpdate(prevProps, prevState);
  }

  renderBody() {
    const {
      features,
      params,
      project
    } = this.props;
    const {
      orgId,
      projectId
    } = params;
    const projectEndpoint = `/projects/${orgId}/${projectId}/`;
    const filtersEndpoint = `${projectEndpoint}filters/`;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_5__["default"], {
      access: ['project:write'],
      children: _ref4 => {
        let {
          hasAccess
        } = _ref4;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__.Panel, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__.PanelHeader, {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Filters')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__.PanelBody, {
              children: this.state.filterList.map(filter => {
                const fieldProps = {
                  name: filter.id,
                  label: filter.name,
                  help: filter.description,
                  disabled: !hasAccess
                }; // Note by default, forms generate data in the format of:
                // { [fieldName]: [value] }
                // Endpoints for these filters expect data to be:
                // { 'active': [value] }

                return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__.PanelItem, {
                  noPadding: true,
                  children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(NestedForm, {
                    apiMethod: "PUT",
                    apiEndpoint: `${filtersEndpoint}${filter.id}/`,
                    initialData: {
                      [filter.id]: filter.active
                    },
                    saveOnBlur: true,
                    children: filter.id !== 'legacy-browsers' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_forms_fieldFromConfig__WEBPACK_IMPORTED_MODULE_9__["default"], {
                      getData: data => ({
                        active: data[filter.id]
                      }),
                      field: {
                        type: 'boolean',
                        ...fieldProps
                      }
                    }, filter.id) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_11__["default"], {
                      inline: false,
                      ...fieldProps,
                      getData: data => ({
                        subfilters: [...data[filter.id]]
                      }),
                      children: _ref5 => {
                        let {
                          onChange,
                          onBlur
                        } = _ref5;
                        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(LegacyBrowserFilterRow, {
                          data: filter,
                          disabled: !hasAccess,
                          onToggle: this.handleLegacyChange.bind(this, onChange, onBlur)
                        }, filter.id);
                      }
                    })
                  })
                }, filter.id);
              })
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_10__["default"], {
            apiMethod: "PUT",
            apiEndpoint: projectEndpoint,
            initialData: project.options,
            saveOnBlur: true,
            onSubmitSuccess: this.handleSubmit,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_12__["default"], {
              features: features,
              forms: sentry_data_forms_inboundFilters__WEBPACK_IMPORTED_MODULE_15__["default"],
              disabled: !hasAccess,
              renderFooter: this.renderCustomFilters(!hasAccess)
            })
          })]
        });
      }
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectFiltersSettings); // TODO(ts): Understand why styled is not correctly inheriting props here

const NestedForm = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "eawr7uk10"
} : 0)( true ? {
  name: "82a6rk",
  styles: "flex:1"
} : 0);

const FilterGrid = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eawr7uk9"
} : 0)( true ? {
  name: "5kov97",
  styles: "display:flex;flex-wrap:wrap"
} : 0);

const FilterGridItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eawr7uk8"
} : 0)("display:flex;align-items:center;background:", p => p.theme.backgroundSecondary, ";border-radius:3px;flex:1;padding:12px;height:100%;" + ( true ? "" : 0)); // We want this wrapper to maining 30% width


const FilterGridItemWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eawr7uk7"
} : 0)( true ? {
  name: "1516fzb",
  styles: "padding:12px;width:50%"
} : 0);

const FilterItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eawr7uk6"
} : 0)( true ? {
  name: "zol16h",
  styles: "display:flex;flex:1;align-items:center"
} : 0);

const FilterGridIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eawr7uk5"
} : 0)( true ? {
  name: "1onzlav",
  styles: "width:38px;height:38px;background-repeat:no-repeat;background-position:center;background-size:38px 38px;margin-right:6px;flex-shrink:0"
} : 0);

const FilterTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eawr7uk4"
} : 0)( true ? {
  name: "19au3w7",
  styles: "font-size:14px;font-weight:bold;line-height:1;white-space:nowrap"
} : 0);

const FilterDescription = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eawr7uk3"
} : 0)("color:", p => p.theme.subText, ";font-size:12px;line-height:1;white-space:nowrap;" + ( true ? "" : 0));

const BulkFilter = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eawr7uk2"
} : 0)( true ? {
  name: "fq0hzo",
  styles: "text-align:right;padding:0 12px"
} : 0);

const BulkFilterLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "eawr7uk1"
} : 0)( true ? {
  name: "akdn31",
  styles: "font-weight:bold;margin-right:6px"
} : 0);

const BulkFilterItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('a',  true ? {
  target: "eawr7uk0"
} : 0)( true ? {
  name: "ahpk6n",
  styles: "border-right:1px solid #f1f2f3;margin-right:6px;padding-right:6px;&:last-child{border-right:none;margin-right:0;}"
} : 0);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_project_projectFilters_index_tsx.9f09073dbb89bb119f52328603180def.js.map