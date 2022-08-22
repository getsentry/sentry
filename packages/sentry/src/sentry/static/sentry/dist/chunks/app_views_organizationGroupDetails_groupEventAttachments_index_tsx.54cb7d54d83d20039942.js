(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_organizationGroupDetails_groupEventAttachments_index_tsx"],{

/***/ "./app/components/acl/role.tsx":
/*!*************************************!*\
  !*** ./app/components/acl/role.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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

/***/ "./app/components/events/eventAttachmentActions.tsx":
/*!**********************************************************!*\
  !*** ./app/components/events/eventAttachmentActions.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












class EventAttachmentActions extends react__WEBPACK_IMPORTED_MODULE_1__.Component {
  handlePreview() {
    const {
      onPreview,
      attachmentId
    } = this.props;

    if (onPreview) {
      onPreview(attachmentId);
    }
  }

  render() {
    const {
      url,
      withPreviewButton,
      hasPreview,
      previewIsOpen,
      onDelete,
      attachmentId
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_3__["default"], {
      gap: 1,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_4__["default"], {
        confirmText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Delete'),
        message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Are you sure you wish to delete this file?'),
        priority: "danger",
        onConfirm: () => onDelete(attachmentId),
        disabled: !url,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
          size: "xs",
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconDelete, {
            size: "xs"
          }),
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Delete'),
          disabled: !url,
          title: !url ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Insufficient permissions to delete attachments') : undefined
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(DownloadButton, {
        size: "xs",
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconDownload, {
          size: "xs"
        }),
        href: url ? `${url}?download=1` : '',
        disabled: !url,
        title: !url ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Insufficient permissions to download attachments') : undefined,
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Download')
      }), withPreviewButton && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(DownloadButton, {
        size: "xs",
        disabled: !url || !hasPreview,
        priority: previewIsOpen ? 'primary' : 'default',
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconShow, {
          size: "xs"
        }),
        onClick: () => this.handlePreview(),
        title: !url ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Insufficient permissions to preview attachments') : !hasPreview ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('This attachment cannot be previewed') : undefined,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Preview')
      })]
    });
  }

}

EventAttachmentActions.displayName = "EventAttachmentActions";

const DownloadButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"],  true ? {
  target: "erg6n450"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(0.5), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_8__["default"])(EventAttachmentActions));

/***/ }),

/***/ "./app/utils/attachmentUrl.tsx":
/*!*************************************!*\
  !*** ./app/utils/attachmentUrl.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_acl_role__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/acl/role */ "./app/components/acl/role.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function AttachmentUrl(_ref) {
  let {
    attachment,
    organization,
    eventId,
    projectId,
    children
  } = _ref;

  function getDownloadUrl() {
    return `/api/0/projects/${organization.slug}/${projectId}/events/${eventId}/attachments/${attachment.id}/`;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_acl_role__WEBPACK_IMPORTED_MODULE_1__.Role, {
    role: organization.attachmentsRole,
    children: _ref2 => {
      let {
        hasRole
      } = _ref2;
      return children(hasRole ? getDownloadUrl() : null);
    }
  });
}

AttachmentUrl.displayName = "AttachmentUrl";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_2__["default"])( /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_0__.memo)(AttachmentUrl)));

/***/ }),

/***/ "./app/views/organizationGroupDetails/groupEventAttachments/groupEventAttachments.tsx":
/*!********************************************************************************************!*\
  !*** ./app/views/organizationGroupDetails/groupEventAttachments/groupEventAttachments.tsx ***!
  \********************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/emptyStateWarning */ "./app/components/emptyStateWarning.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _groupEventAttachmentsFilter__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./groupEventAttachmentsFilter */ "./app/views/organizationGroupDetails/groupEventAttachments/groupEventAttachmentsFilter.tsx");
/* harmony import */ var _groupEventAttachmentsTable__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./groupEventAttachmentsTable */ "./app/views/organizationGroupDetails/groupEventAttachments/groupEventAttachmentsTable.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


// eslint-disable-next-line no-restricted-imports















class GroupEventAttachments extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_5__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDelete", async deletedAttachmentId => {
      var _this$state, _this$state$eventAtta;

      const {
        params,
        projectSlug
      } = this.props;
      const attachment = (_this$state = this.state) === null || _this$state === void 0 ? void 0 : (_this$state$eventAtta = _this$state.eventAttachments) === null || _this$state$eventAtta === void 0 ? void 0 : _this$state$eventAtta.find(item => item.id === deletedAttachmentId);

      if (!attachment) {
        return;
      }

      this.setState(prevState => ({
        deletedAttachments: [...prevState.deletedAttachments, deletedAttachmentId]
      }));

      try {
        await this.api.requestPromise(`/projects/${params.orgId}/${projectSlug}/events/${attachment.event_id}/attachments/${attachment.id}/`, {
          method: 'DELETE'
        });
      } catch (error) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)('An error occurred while deleteting the attachment');
      }
    });
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      deletedAttachments: []
    };
  }

  getEndpoints() {
    const {
      params,
      location
    } = this.props;
    return [['eventAttachments', `/issues/${params.groupId}/attachments/`, {
      query: { ...lodash_pick__WEBPACK_IMPORTED_MODULE_3___default()(location.query, ['cursor', 'environment', 'types']),
        limit: 50
      }
    }]];
  }

  renderNoQueryResults() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_6__["default"], {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('No crash reports found')
      })
    });
  }

  renderEmpty() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_6__["default"], {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('No attachments found')
      })
    });
  }

  renderLoading() {
    return this.renderBody();
  }

  renderInnerBody() {
    const {
      projectSlug,
      params,
      location
    } = this.props;
    const {
      loading,
      eventAttachments,
      deletedAttachments
    } = this.state;

    if (loading) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_8__["default"], {});
    }

    if (eventAttachments && eventAttachments.length > 0) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(_groupEventAttachmentsTable__WEBPACK_IMPORTED_MODULE_13__["default"], {
        attachments: eventAttachments,
        orgId: params.orgId,
        projectId: projectSlug,
        groupId: params.groupId,
        onDelete: this.handleDelete,
        deletedAttachments: deletedAttachments
      });
    }

    if (location.query.types) {
      return this.renderNoQueryResults();
    }

    return this.renderEmpty();
  }

  renderBody() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_7__.Body, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_7__.Main, {
        fullWidth: true,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(_groupEventAttachmentsFilter__WEBPACK_IMPORTED_MODULE_12__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.Panel, {
          className: "event-list",
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.PanelBody, {
            children: this.renderInnerBody()
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_9__["default"], {
          pageLinks: this.state.eventAttachmentsPageLinks
        })]
      })
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_2__.withRouter)(GroupEventAttachments));

/***/ }),

/***/ "./app/views/organizationGroupDetails/groupEventAttachments/groupEventAttachmentsFilter.tsx":
/*!**************************************************************************************************!*\
  !*** ./app/views/organizationGroupDetails/groupEventAttachments/groupEventAttachmentsFilter.tsx ***!
  \**************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "crashReportTypes": () => (/* binding */ crashReportTypes),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var lodash_xor__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/xor */ "../node_modules/lodash/xor.js");
/* harmony import */ var lodash_xor__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_xor__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");

// eslint-disable-next-line no-restricted-imports









const crashReportTypes = ['event.minidump', 'event.applecrashreport'];

const GroupEventAttachmentsFilter = props => {
  const {
    query,
    pathname
  } = props.location;
  const {
    types
  } = query;
  const allAttachmentsQuery = lodash_omit__WEBPACK_IMPORTED_MODULE_2___default()(query, 'types');
  const onlyCrashReportsQuery = { ...query,
    types: crashReportTypes
  };
  let activeButton = '';

  if (types === undefined) {
    activeButton = 'all';
  } else if (lodash_xor__WEBPACK_IMPORTED_MODULE_3___default()(crashReportTypes, types).length === 0) {
    activeButton = 'onlyCrash';
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(FilterWrapper, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_5__["default"], {
      merged: true,
      active: activeButton,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
        barId: "all",
        size: "sm",
        to: {
          pathname,
          query: allAttachmentsQuery
        },
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('All Attachments')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
        barId: "onlyCrash",
        size: "sm",
        to: {
          pathname,
          query: onlyCrashReportsQuery
        },
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Only Crash Reports')
      })]
    })
  });
};

GroupEventAttachmentsFilter.displayName = "GroupEventAttachmentsFilter";

const FilterWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eftnont0"
} : 0)("display:flex;justify-content:flex-end;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(3), ";" + ( true ? "" : 0));


/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_1__.withRouter)(GroupEventAttachmentsFilter));

/***/ }),

/***/ "./app/views/organizationGroupDetails/groupEventAttachments/groupEventAttachmentsTable.tsx":
/*!*************************************************************************************************!*\
  !*** ./app/views/organizationGroupDetails/groupEventAttachments/groupEventAttachmentsTable.tsx ***!
  \*************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_organizationGroupDetails_groupEventAttachments_groupEventAttachmentsTableRow__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/views/organizationGroupDetails/groupEventAttachments/groupEventAttachmentsTableRow */ "./app/views/organizationGroupDetails/groupEventAttachments/groupEventAttachmentsTableRow.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





const GroupEventAttachmentsTable = _ref => {
  let {
    attachments,
    orgId,
    projectId,
    groupId,
    onDelete,
    deletedAttachments
  } = _ref;
  const tableRowNames = [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Name'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Type'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Size'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Actions')];
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("table", {
    className: "table events-table",
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("thead", {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("tr", {
        children: tableRowNames.map(name => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("th", {
          children: name
        }, name))
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("tbody", {
      children: attachments.map(attachment => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_views_organizationGroupDetails_groupEventAttachments_groupEventAttachmentsTableRow__WEBPACK_IMPORTED_MODULE_1__["default"], {
        attachment: attachment,
        orgId: orgId,
        projectId: projectId,
        groupId: groupId,
        onDelete: onDelete,
        isDeleted: deletedAttachments.some(id => attachment.id === id)
      }, attachment.id))
    })]
  });
};

GroupEventAttachmentsTable.displayName = "GroupEventAttachmentsTable";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GroupEventAttachmentsTable);

/***/ }),

/***/ "./app/views/organizationGroupDetails/groupEventAttachments/groupEventAttachmentsTableRow.tsx":
/*!****************************************************************************************************!*\
  !*** ./app/views/organizationGroupDetails/groupEventAttachments/groupEventAttachmentsTableRow.tsx ***!
  \****************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_events_eventAttachmentActions__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/events/eventAttachmentActions */ "./app/components/events/eventAttachmentActions.tsx");
/* harmony import */ var sentry_components_fileSize__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/fileSize */ "./app/components/fileSize.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_attachmentUrl__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/attachmentUrl */ "./app/utils/attachmentUrl.tsx");
/* harmony import */ var sentry_views_organizationGroupDetails_groupEventAttachments_types__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/views/organizationGroupDetails/groupEventAttachments/types */ "./app/views/organizationGroupDetails/groupEventAttachments/types.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }











const GroupEventAttachmentsTableRow = _ref => {
  let {
    attachment,
    projectId,
    onDelete,
    isDeleted,
    orgId,
    groupId
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(TableRow, {
    isDeleted: isDeleted,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("td", {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)("h5", {
        children: [attachment.name, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("br", {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)("small", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_1__["default"], {
            date: attachment.dateCreated
          }), " \xB7", ' ', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_4__["default"], {
            to: `/organizations/${orgId}/issues/${groupId}/events/${attachment.event_id}/`,
            children: attachment.event_id
          })]
        })]
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("td", {
      children: sentry_views_organizationGroupDetails_groupEventAttachments_types__WEBPACK_IMPORTED_MODULE_7__.types[attachment.type] || (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Other')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("td", {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_fileSize__WEBPACK_IMPORTED_MODULE_3__["default"], {
        bytes: attachment.size
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("td", {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(ActionsWrapper, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_utils_attachmentUrl__WEBPACK_IMPORTED_MODULE_6__["default"], {
          projectId: projectId,
          eventId: attachment.event_id,
          attachment: attachment,
          children: url => !isDeleted ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_events_eventAttachmentActions__WEBPACK_IMPORTED_MODULE_2__["default"], {
            url: url,
            onDelete: onDelete,
            attachmentId: attachment.id
          }) : null
        })
      })
    })]
  });
};

GroupEventAttachmentsTableRow.displayName = "GroupEventAttachmentsTableRow";

const TableRow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('tr',  true ? {
  target: "egfj2n61"
} : 0)("opacity:", p => p.isDeleted ? 0.3 : 1, ";td{text-decoration:", p => p.isDeleted ? 'line-through' : 'normal', ";}" + ( true ? "" : 0));

const ActionsWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "egfj2n60"
} : 0)( true ? {
  name: "1r5gb7q",
  styles: "display:inline-block"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GroupEventAttachmentsTableRow);

/***/ }),

/***/ "./app/views/organizationGroupDetails/groupEventAttachments/index.tsx":
/*!****************************************************************************!*\
  !*** ./app/views/organizationGroupDetails/groupEventAttachments/index.tsx ***!
  \****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/acl/featureDisabled */ "./app/components/acl/featureDisabled.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _groupEventAttachments__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./groupEventAttachments */ "./app/views/organizationGroupDetails/groupEventAttachments/groupEventAttachments.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







const GroupEventAttachmentsContainer = _ref => {
  let {
    organization,
    group
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_0__["default"], {
    features: ['event-attachments'],
    organization: organization,
    renderDisabled: props => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_1__["default"], { ...props,
      featureName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Event Attachments')
    }),
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(_groupEventAttachments__WEBPACK_IMPORTED_MODULE_4__["default"], {
      projectSlug: group.project.slug
    })
  });
};

GroupEventAttachmentsContainer.displayName = "GroupEventAttachmentsContainer";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_3__["default"])(GroupEventAttachmentsContainer));

/***/ }),

/***/ "./app/views/organizationGroupDetails/groupEventAttachments/types.tsx":
/*!****************************************************************************!*\
  !*** ./app/views/organizationGroupDetails/groupEventAttachments/types.tsx ***!
  \****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "types": () => (/* binding */ types)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");

const types = {
  'event.minidump': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Minidump'),
  'event.applecrashreport': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Apple Crash Report'),
  'event.attachment': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Other')
};

/***/ }),

/***/ "../node_modules/lodash/_baseDifference.js":
/*!*************************************************!*\
  !*** ../node_modules/lodash/_baseDifference.js ***!
  \*************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var SetCache = __webpack_require__(/*! ./_SetCache */ "../node_modules/lodash/_SetCache.js"),
    arrayIncludes = __webpack_require__(/*! ./_arrayIncludes */ "../node_modules/lodash/_arrayIncludes.js"),
    arrayIncludesWith = __webpack_require__(/*! ./_arrayIncludesWith */ "../node_modules/lodash/_arrayIncludesWith.js"),
    arrayMap = __webpack_require__(/*! ./_arrayMap */ "../node_modules/lodash/_arrayMap.js"),
    baseUnary = __webpack_require__(/*! ./_baseUnary */ "../node_modules/lodash/_baseUnary.js"),
    cacheHas = __webpack_require__(/*! ./_cacheHas */ "../node_modules/lodash/_cacheHas.js");

/** Used as the size to enable large array optimizations. */
var LARGE_ARRAY_SIZE = 200;

/**
 * The base implementation of methods like `_.difference` without support
 * for excluding multiple arrays or iteratee shorthands.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {Array} values The values to exclude.
 * @param {Function} [iteratee] The iteratee invoked per element.
 * @param {Function} [comparator] The comparator invoked per element.
 * @returns {Array} Returns the new array of filtered values.
 */
function baseDifference(array, values, iteratee, comparator) {
  var index = -1,
      includes = arrayIncludes,
      isCommon = true,
      length = array.length,
      result = [],
      valuesLength = values.length;

  if (!length) {
    return result;
  }
  if (iteratee) {
    values = arrayMap(values, baseUnary(iteratee));
  }
  if (comparator) {
    includes = arrayIncludesWith;
    isCommon = false;
  }
  else if (values.length >= LARGE_ARRAY_SIZE) {
    includes = cacheHas;
    isCommon = false;
    values = new SetCache(values);
  }
  outer:
  while (++index < length) {
    var value = array[index],
        computed = iteratee == null ? value : iteratee(value);

    value = (comparator || value !== 0) ? value : 0;
    if (isCommon && computed === computed) {
      var valuesIndex = valuesLength;
      while (valuesIndex--) {
        if (values[valuesIndex] === computed) {
          continue outer;
        }
      }
      result.push(value);
    }
    else if (!includes(values, computed, comparator)) {
      result.push(value);
    }
  }
  return result;
}

module.exports = baseDifference;


/***/ }),

/***/ "../node_modules/lodash/_baseXor.js":
/*!******************************************!*\
  !*** ../node_modules/lodash/_baseXor.js ***!
  \******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseDifference = __webpack_require__(/*! ./_baseDifference */ "../node_modules/lodash/_baseDifference.js"),
    baseFlatten = __webpack_require__(/*! ./_baseFlatten */ "../node_modules/lodash/_baseFlatten.js"),
    baseUniq = __webpack_require__(/*! ./_baseUniq */ "../node_modules/lodash/_baseUniq.js");

/**
 * The base implementation of methods like `_.xor`, without support for
 * iteratee shorthands, that accepts an array of arrays to inspect.
 *
 * @private
 * @param {Array} arrays The arrays to inspect.
 * @param {Function} [iteratee] The iteratee invoked per element.
 * @param {Function} [comparator] The comparator invoked per element.
 * @returns {Array} Returns the new array of values.
 */
function baseXor(arrays, iteratee, comparator) {
  var length = arrays.length;
  if (length < 2) {
    return length ? baseUniq(arrays[0]) : [];
  }
  var index = -1,
      result = Array(length);

  while (++index < length) {
    var array = arrays[index],
        othIndex = -1;

    while (++othIndex < length) {
      if (othIndex != index) {
        result[index] = baseDifference(result[index] || array, arrays[othIndex], iteratee, comparator);
      }
    }
  }
  return baseUniq(baseFlatten(result, 1), iteratee, comparator);
}

module.exports = baseXor;


/***/ }),

/***/ "../node_modules/lodash/xor.js":
/*!*************************************!*\
  !*** ../node_modules/lodash/xor.js ***!
  \*************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var arrayFilter = __webpack_require__(/*! ./_arrayFilter */ "../node_modules/lodash/_arrayFilter.js"),
    baseRest = __webpack_require__(/*! ./_baseRest */ "../node_modules/lodash/_baseRest.js"),
    baseXor = __webpack_require__(/*! ./_baseXor */ "../node_modules/lodash/_baseXor.js"),
    isArrayLikeObject = __webpack_require__(/*! ./isArrayLikeObject */ "../node_modules/lodash/isArrayLikeObject.js");

/**
 * Creates an array of unique values that is the
 * [symmetric difference](https://en.wikipedia.org/wiki/Symmetric_difference)
 * of the given arrays. The order of result values is determined by the order
 * they occur in the arrays.
 *
 * @static
 * @memberOf _
 * @since 2.4.0
 * @category Array
 * @param {...Array} [arrays] The arrays to inspect.
 * @returns {Array} Returns the new array of filtered values.
 * @see _.difference, _.without
 * @example
 *
 * _.xor([2, 1], [2, 3]);
 * // => [1, 3]
 */
var xor = baseRest(function(arrays) {
  return baseXor(arrayFilter(arrays, isArrayLikeObject));
});

module.exports = xor;


/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_organizationGroupDetails_groupEventAttachments_index_tsx.ef3cfb203733028b559c3b5447af1b43.js.map