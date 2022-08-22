(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_organizationRelay_index_tsx"],{

/***/ "./app/components/commandLine.tsx":
/*!****************************************!*\
  !*** ./app/components/commandLine.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




const CommandLine = _ref => {
  let {
    children
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(Wrapper, {
    children: children
  });
};

CommandLine.displayName = "CommandLine";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (CommandLine);

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('code',  true ? {
  target: "e16w4sj70"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(0.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1), ";color:", p => p.theme.pink300, ";background:", p => p.theme.pink100, ";border:1px solid ", p => p.theme.pink200, ";font-family:", p => p.theme.text.familyMono, ";font-size:", p => p.theme.fontSizeMedium, ";white-space:nowrap;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/confirmDelete.tsx":
/*!******************************************!*\
  !*** ./app/components/confirmDelete.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_components_input__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/input */ "./app/components/input.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









const ConfirmDelete = _ref => {
  let {
    message,
    confirmInput,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_2__["default"], { ...props,
    bypass: false,
    disableConfirmButton: true,
    renderMessage: _ref2 => {
      let {
        disableConfirmButton
      } = _ref2;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__["default"], {
          type: "error",
          children: message
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_3__["default"], {
          flexibleControlStateSize: true,
          inline: false,
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Please enter %s to confirm the deletion', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("code", {
            children: confirmInput
          })),
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_input__WEBPACK_IMPORTED_MODULE_4__["default"], {
            type: "text",
            placeholder: confirmInput,
            onChange: e => disableConfirmButton(e.target.value !== confirmInput)
          })
        })]
      });
    }
  });
};

ConfirmDelete.displayName = "ConfirmDelete";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ConfirmDelete);

/***/ }),

/***/ "./app/views/asyncView.tsx":
/*!*********************************!*\
  !*** ./app/views/asyncView.tsx ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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

/***/ "./app/views/settings/organization/permissionAlert.tsx":
/*!*************************************************************!*\
  !*** ./app/views/settings/organization/permissionAlert.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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

/***/ }),

/***/ "./app/views/settings/organizationRelay/emptyState.tsx":
/*!*************************************************************!*\
  !*** ./app/views/settings/organizationRelay/emptyState.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





const EmptyState = () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_0__.Panel, {
  children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_2__["default"], {
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('No Keys Registered.')
  })
});

EmptyState.displayName = "EmptyState";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EmptyState);

/***/ }),

/***/ "./app/views/settings/organizationRelay/index.tsx":
/*!********************************************************!*\
  !*** ./app/views/settings/organizationRelay/index.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var _relayWrapper__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./relayWrapper */ "./app/views/settings/organizationRelay/relayWrapper.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function OrganizationRelay(props) {
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_1__["default"])();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_0__["default"], {
    organization: organization,
    features: ['relay'],
    hookName: "feature-disabled:relay",
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_relayWrapper__WEBPACK_IMPORTED_MODULE_2__["default"], {
      organization: organization,
      ...props
    })
  });
}

OrganizationRelay.displayName = "OrganizationRelay";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OrganizationRelay);

/***/ }),

/***/ "./app/views/settings/organizationRelay/list/activityList.tsx":
/*!********************************************************************!*\
  !*** ./app/views/settings/organizationRelay/list/activityList.tsx ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }








const ActivityList = _ref => {
  let {
    activities
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(StyledPanelTable, {
    headers: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Version'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('First Used'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Last Used')],
    children: activities.map(_ref2 => {
      let {
        relayId,
        version,
        firstSeen,
        lastSeen
      } = _ref2;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Version, {
          children: version
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_2__["default"], {
          date: firstSeen,
          seconds: false
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_2__["default"], {
          date: lastSeen,
          seconds: false
        })]
      }, relayId);
    })
  });
};

ActivityList.displayName = "ActivityList";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ActivityList);

const StyledPanelTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.PanelTable,  true ? {
  target: "e1rub0301"
} : 0)("grid-template-columns:repeat(3, 2fr);@media (min-width: ", p => p.theme.breakpoints.large, "){grid-template-columns:2fr repeat(2, 1fr);}" + ( true ? "" : 0));

const Version = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1rub0300"
} : 0)( true ? {
  name: "kow0uz",
  styles: "font-variant-numeric:tabular-nums"
} : 0);

/***/ }),

/***/ "./app/views/settings/organizationRelay/list/cardHeader.tsx":
/*!******************************************************************!*\
  !*** ./app/views/settings/organizationRelay/list/cardHeader.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_clipboard__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/clipboard */ "./app/components/clipboard.tsx");
/* harmony import */ var sentry_components_confirmDelete__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/confirmDelete */ "./app/components/confirmDelete.tsx");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













const CardHeader = _ref => {
  let {
    publicKey,
    name,
    description,
    created,
    disabled,
    onEdit,
    onDelete
  } = _ref;

  const deleteButton = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"], {
    size: "sm",
    icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconDelete, {}),
    "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Delete Key'),
    disabled: disabled,
    title: disabled ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('You do not have permission to delete keys') : undefined
  });

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(Header, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(KeyName, {
      children: [name, description && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_6__["default"], {
        position: "top",
        size: "sm",
        title: description
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(DateCreated, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('Created on [date]', {
        date: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_5__["default"], {
          date: created
        })
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(StyledButtonBar, {
      gap: 1,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_clipboard__WEBPACK_IMPORTED_MODULE_3__["default"], {
        value: publicKey,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"], {
          size: "sm",
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconCopy, {}),
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Copy Key')
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"], {
        size: "sm",
        onClick: onEdit(publicKey),
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconEdit, {}),
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Edit Key'),
        disabled: disabled,
        title: disabled ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('You do not have permission to edit keys') : undefined
      }), disabled ? deleteButton : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_confirmDelete__WEBPACK_IMPORTED_MODULE_4__["default"], {
        message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('After removing this Public Key, your Relay will no longer be able to communicate with Sentry and events will be dropped.'),
        onConfirm: onDelete(publicKey),
        confirmInput: name,
        children: deleteButton
      })]
    })]
  });
};

CardHeader.displayName = "CardHeader";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (CardHeader);

const KeyName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e2k0mun3"
} : 0)("grid-row:1/2;display:grid;grid-template-columns:repeat(2, max-content);grid-column-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(0.5), ";" + ( true ? "" : 0));

const DateCreated = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e2k0mun2"
} : 0)("grid-row:2/3;color:", p => p.theme.gray300, ";font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

const StyledButtonBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_2__["default"],  true ? {
  target: "e2k0mun1"
} : 0)("@media (min-width: ", p => p.theme.breakpoints.medium, "){grid-row:1/3;}" + ( true ? "" : 0));

const Header = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e2k0mun0"
} : 0)("display:grid;grid-row-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";@media (min-width: ", p => p.theme.breakpoints.medium, "){grid-template-columns:1fr max-content;grid-template-rows:repeat(2, max-content);}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/organizationRelay/list/index.tsx":
/*!*************************************************************!*\
  !*** ./app/views/settings/organizationRelay/list/index.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var lodash_orderBy__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash/orderBy */ "../node_modules/lodash/orderBy.js");
/* harmony import */ var lodash_orderBy__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash_orderBy__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _activityList__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./activityList */ "./app/views/settings/organizationRelay/list/activityList.tsx");
/* harmony import */ var _cardHeader__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./cardHeader */ "./app/views/settings/organizationRelay/list/cardHeader.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./utils */ "./app/views/settings/organizationRelay/list/utils.tsx");
/* harmony import */ var _waitingActivity__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./waitingActivity */ "./app/views/settings/organizationRelay/list/waitingActivity.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








const List = _ref => {
  let {
    relays,
    relayActivities,
    onRefresh,
    onDelete,
    onEdit,
    disabled
  } = _ref;
  const orderedRelays = lodash_orderBy__WEBPACK_IMPORTED_MODULE_0___default()(relays, relay => relay.created, ['desc']);
  const relaysByPublicKey = (0,_utils__WEBPACK_IMPORTED_MODULE_3__.getRelaysByPublicKey)(orderedRelays, relayActivities);

  const renderCardContent = activities => {
    if (!activities.length) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(_waitingActivity__WEBPACK_IMPORTED_MODULE_4__["default"], {
        onRefresh: onRefresh,
        disabled: disabled
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(_activityList__WEBPACK_IMPORTED_MODULE_1__["default"], {
      activities: activities
    });
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("div", {
    children: Object.keys(relaysByPublicKey).map(relayByPublicKey => {
      const {
        name,
        description,
        created,
        activities
      } = relaysByPublicKey[relayByPublicKey];
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(_cardHeader__WEBPACK_IMPORTED_MODULE_2__["default"], {
          publicKey: relayByPublicKey,
          name: name,
          description: description,
          created: created,
          onEdit: onEdit,
          onDelete: onDelete,
          disabled: disabled
        }), renderCardContent(activities)]
      }, relayByPublicKey);
    })
  });
};

List.displayName = "List";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (List);

/***/ }),

/***/ "./app/views/settings/organizationRelay/list/utils.tsx":
/*!*************************************************************!*\
  !*** ./app/views/settings/organizationRelay/list/utils.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getRelaysByPublicKey": () => (/* binding */ getRelaysByPublicKey),
/* harmony export */   "getShortPublicKey": () => (/* binding */ getShortPublicKey)
/* harmony export */ });
/**
 * Convert list of individual relay objects into a per-file summary grouped by publicKey
 */
function getRelaysByPublicKey(relays, relayActivities) {
  return relays.reduce((relaysByPublicKey, relay) => {
    const {
      name,
      description,
      created,
      publicKey
    } = relay;

    if (!relaysByPublicKey.hasOwnProperty(publicKey)) {
      relaysByPublicKey[publicKey] = {
        name,
        description,
        created,
        activities: []
      };
    }

    if (!relaysByPublicKey[publicKey].activities.length) {
      relaysByPublicKey[publicKey].activities = relayActivities.filter(activity => activity.publicKey === publicKey);
    }

    return relaysByPublicKey;
  }, {});
}
/**
 * Returns a short publicKey with only 20 characters
 */

function getShortPublicKey(publicKey) {
  return publicKey.substring(0, 20);
}

/***/ }),

/***/ "./app/views/settings/organizationRelay/list/waitingActivity.tsx":
/*!***********************************************************************!*\
  !*** ./app/views/settings/organizationRelay/list/waitingActivity.tsx ***!
  \***********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_commandLine__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/commandLine */ "./app/components/commandLine.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








const WaitingActivity = _ref => {
  let {
    onRefresh,
    disabled
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.Panel, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_5__["default"], {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Waiting on Activity!'),
      description: disabled ? undefined : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)('Run relay in your terminal with [commandLine]', {
        commandLine: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_commandLine__WEBPACK_IMPORTED_MODULE_1__["default"], {
          children: 'relay run'
        })
      }),
      action: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_0__["default"], {
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconRefresh, {}),
        onClick: onRefresh,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Refresh')
      })
    })
  });
};

WaitingActivity.displayName = "WaitingActivity";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (WaitingActivity);

/***/ }),

/***/ "./app/views/settings/organizationRelay/modals/add/index.tsx":
/*!*******************************************************************!*\
  !*** ./app/views/settings/organizationRelay/modals/add/index.tsx ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_list__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/list */ "./app/components/list/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _modalManager__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../modalManager */ "./app/views/settings/organizationRelay/modals/modalManager.tsx");
/* harmony import */ var _item__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./item */ "./app/views/settings/organizationRelay/modals/add/item.tsx");
/* harmony import */ var _terminal__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./terminal */ "./app/views/settings/organizationRelay/modals/add/terminal.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












class Add extends _modalManager__WEBPACK_IMPORTED_MODULE_6__["default"] {
  getTitle() {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Register Key');
  }

  getBtnSaveLabel() {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Register');
  }

  getData() {
    const {
      savedRelays
    } = this.props;
    const trustedRelays = [...savedRelays, this.state.values];
    return {
      trustedRelays
    };
  }

  getContent() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(StyledList, {
      symbol: "colored-numeric",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_item__WEBPACK_IMPORTED_MODULE_7__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)('Initialize the configuration. [link: Learn how]', {
          link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_2__["default"], {
            href: "https://docs.sentry.io/product/relay/getting-started/#initializing-configuration"
          })
        }),
        subtitle: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Within your terminal:'),
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_terminal__WEBPACK_IMPORTED_MODULE_8__["default"], {
          command: "relay config init"
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_item__WEBPACK_IMPORTED_MODULE_7__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)('Go to the file [jsonFile: credentials.json] to find the public key and enter it below.', {
          jsonFile: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_2__["default"], {
            href: "https://docs.sentry.io/product/relay/getting-started/#registering-relay-with-sentry"
          })
        }),
        children: super.getForm()
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Add);

const StyledList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_list__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e1d8ehcl0"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(3), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/organizationRelay/modals/add/item.tsx":
/*!******************************************************************!*\
  !*** ./app/views/settings/organizationRelay/modals/add/item.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/list/listItem */ "./app/components/list/listItem.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






const Item = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_ref => {
  let {
    title,
    subtitle,
    children,
    className
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_1__["default"], {
    className: className,
    children: [title, subtitle && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("small", {
      children: subtitle
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("div", {
      children: children
    })]
  });
},  true ? {
  target: "e1jgkchl0"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1.5), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Item);

/***/ }),

/***/ "./app/views/settings/organizationRelay/modals/add/terminal.tsx":
/*!**********************************************************************!*\
  !*** ./app/views/settings/organizationRelay/modals/add/terminal.tsx ***!
  \**********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





const Terminal = _ref => {
  let {
    command
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)(Wrapper, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(Prompt, {
      children: '\u0024'
    }), command]
  });
};

Terminal.displayName = "Terminal";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Terminal);

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e15plznr1"
} : 0)("background:", p => p.theme.gray500, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(3), ";font-family:", p => p.theme.text.familyMono, ";color:", p => p.theme.white, ";border-radius:", p => p.theme.borderRadius, ";display:grid;grid-template-columns:max-content 1fr;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(0.75), ";" + ( true ? "" : 0));

const Prompt = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e15plznr0"
} : 0)("color:", p => p.theme.gray300, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/organizationRelay/modals/edit.tsx":
/*!**************************************************************!*\
  !*** ./app/views/settings/organizationRelay/modals/edit.tsx ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _modalManager__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./modalManager */ "./app/views/settings/organizationRelay/modals/modalManager.tsx");




class Edit extends _modalManager__WEBPACK_IMPORTED_MODULE_2__["default"] {
  getDefaultState() {
    return { ...super.getDefaultState(),
      values: {
        name: this.props.relay.name,
        publicKey: this.props.relay.publicKey,
        description: this.props.relay.description || ''
      },
      disables: {
        publicKey: true
      }
    };
  }

  getTitle() {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Edit Key');
  }

  getData() {
    const {
      savedRelays
    } = this.props;
    const updatedRelay = this.state.values;
    const trustedRelays = savedRelays.map(relay => {
      if (relay.publicKey === updatedRelay.publicKey) {
        return updatedRelay;
      }

      return relay;
    });
    return {
      trustedRelays
    };
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Edit);

/***/ }),

/***/ "./app/views/settings/organizationRelay/modals/form.tsx":
/*!**************************************************************!*\
  !*** ./app/views/settings/organizationRelay/modals/form.tsx ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_forms_controls_textarea__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/forms/controls/textarea */ "./app/components/forms/controls/textarea.tsx");
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_components_forms_field_fieldHelp__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/forms/field/fieldHelp */ "./app/components/forms/field/fieldHelp.tsx");
/* harmony import */ var sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/textCopyInput */ "./app/components/forms/textCopyInput.tsx");
/* harmony import */ var sentry_components_input__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/input */ "./app/components/input.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }











const Form = _ref => {
  let {
    values,
    onChange,
    errors,
    onValidate,
    isFormValid,
    disables,
    onValidateKey,
    onSave
  } = _ref;

  const handleChange = field => event => {
    onChange(field, event.target.value);
  };

  const handleSubmit = () => {
    if (isFormValid) {
      onSave();
    }
  }; // code below copied from app/views/organizationIntegrations/SplitInstallationIdModal.tsx
  // TODO: fix the common method selectText


  const onCopy = value => async () => // This hack is needed because the normal copying methods with TextCopyInput do not work correctly
  await navigator.clipboard.writeText(value);

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)("form", {
    onSubmit: handleSubmit,
    id: "relay-form",
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_3__["default"], {
      flexibleControlStateSize: true,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Display Name'),
      error: errors.name,
      inline: false,
      stacked: true,
      required: true,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_input__WEBPACK_IMPORTED_MODULE_6__["default"], {
        type: "text",
        name: "name",
        placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Display Name'),
        onChange: handleChange('name'),
        value: values.name,
        onBlur: onValidate('name'),
        disabled: disables.name
      })
    }), disables.publicKey ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_3__["default"], {
      flexibleControlStateSize: true,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Public Key'),
      inline: false,
      stacked: true,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_5__["default"], {
        onCopy: onCopy(values.publicKey),
        children: values.publicKey
      })
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(FieldWrapper, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(StyledField, {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Public Key'),
        error: errors.publicKey,
        flexibleControlStateSize: true,
        inline: false,
        stacked: true,
        required: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_input__WEBPACK_IMPORTED_MODULE_6__["default"], {
          type: "text",
          name: "publicKey",
          placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Public Key'),
          onChange: handleChange('publicKey'),
          value: values.publicKey,
          onBlur: onValidateKey
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_forms_field_fieldHelp__WEBPACK_IMPORTED_MODULE_4__["default"], {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Only enter the Public Key value from your credentials file. Never share the Secret key with Sentry or any third party')
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_3__["default"], {
      flexibleControlStateSize: true,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Description'),
      inline: false,
      stacked: true,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_forms_controls_textarea__WEBPACK_IMPORTED_MODULE_2__["default"], {
        name: "description",
        placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Description'),
        onChange: handleChange('description'),
        value: values.description,
        disabled: disables.description,
        autosize: true
      })
    })]
  });
};

Form.displayName = "Form";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Form);

const FieldWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1v36iaq1"
} : 0)("padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(2), ";" + ( true ? "" : 0));

const StyledField = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e1v36iaq0"
} : 0)( true ? {
  name: "18g08sj",
  styles: "padding-bottom:0"
} : 0);

/***/ }),

/***/ "./app/views/settings/organizationRelay/modals/handleXhrErrorResponse.tsx":
/*!********************************************************************************!*\
  !*** ./app/views/settings/organizationRelay/modals/handleXhrErrorResponse.tsx ***!
  \********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");


function handleError(error) {
  var _error$responseJSON;

  const errorMessage = (_error$responseJSON = error.responseJSON) === null || _error$responseJSON === void 0 ? void 0 : _error$responseJSON.trustedRelays[0];

  if (!errorMessage) {
    return {
      type: 'unknown',
      message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('An unknown error occurred while saving Relay public key.')
    };
  }

  if (errorMessage === 'Bad structure received for Trusted Relays') {
    return {
      type: 'bad-structure',
      message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('An invalid structure was sent.')
    };
  }

  if (errorMessage === 'Relay key info with missing name in Trusted Relays') {
    return {
      type: 'missing-name',
      message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Field Required')
    };
  }

  if (errorMessage === 'Relay key info with empty name in Trusted Relays') {
    return {
      type: 'empty-name',
      message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Invalid Field')
    };
  }

  if (errorMessage.startsWith('Missing public key for Relay key info with name:')) {
    return {
      type: 'missing-key',
      message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Field Required')
    };
  }

  if (errorMessage.startsWith('Invalid public key for relay key info with name:')) {
    return {
      type: 'invalid-key',
      message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Invalid Relay key')
    };
  }

  if (errorMessage.startsWith('Duplicated key in Trusted Relays:')) {
    return {
      type: 'duplicated-key',
      message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Relay key already taken')
    };
  }

  return {
    type: 'unknown',
    message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('An unknown error occurred while saving Relay public key.')
  };
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (handleError);

/***/ }),

/***/ "./app/views/settings/organizationRelay/modals/modal.tsx":
/*!***************************************************************!*\
  !*** ./app/views/settings/organizationRelay/modals/modal.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







const Modal = _ref => {
  let {
    title,
    onSave,
    content,
    disabled,
    Header,
    Body,
    Footer,
    closeModal,
    btnSaveLabel = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Save')
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(Header, {
      closeButton: true,
      children: title
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(Body, {
      children: content
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(Footer, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_2__["default"], {
        gap: 1.5,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"], {
          onClick: closeModal,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Cancel')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"], {
          onClick: event => {
            event.preventDefault();
            onSave();
          },
          disabled: disabled,
          type: "submit",
          priority: "primary",
          form: "relay-form",
          children: btnSaveLabel
        })]
      })
    })]
  });
};

Modal.displayName = "Modal";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Modal);

/***/ }),

/***/ "./app/views/settings/organizationRelay/modals/modalManager.tsx":
/*!**********************************************************************!*\
  !*** ./app/views/settings/organizationRelay/modals/modalManager.tsx ***!
  \**********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _form__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./form */ "./app/views/settings/organizationRelay/modals/form.tsx");
/* harmony import */ var _handleXhrErrorResponse__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./handleXhrErrorResponse */ "./app/views/settings/organizationRelay/modals/handleXhrErrorResponse.tsx");
/* harmony import */ var _modal__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./modal */ "./app/views/settings/organizationRelay/modals/modal.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");














class DialogManager extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", this.getDefaultState());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChange", (field, value) => {
      this.setState(prevState => ({
        values: { ...prevState.values,
          [field]: value
        },
        errors: lodash_omit__WEBPACK_IMPORTED_MODULE_6___default()(prevState.errors, field)
      }));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSave", async () => {
      const {
        onSubmitSuccess,
        closeModal,
        orgSlug,
        api
      } = this.props;
      const trustedRelays = this.getData().trustedRelays.map(trustedRelay => lodash_omit__WEBPACK_IMPORTED_MODULE_6___default()(trustedRelay, ['created', 'lastModified']));

      try {
        const response = await api.requestPromise(`/organizations/${orgSlug}/`, {
          method: 'PUT',
          data: {
            trustedRelays
          }
        });
        onSubmitSuccess(response);
        closeModal();
      } catch (error) {
        this.convertErrorXhrResponse((0,_handleXhrErrorResponse__WEBPACK_IMPORTED_MODULE_10__["default"])(error));
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleValidate", field => () => {
      const isFieldValueEmpty = !this.state.values[field].replace(/\s/g, '');
      const fieldErrorAlreadyExist = this.state.errors[field];

      if (isFieldValueEmpty && fieldErrorAlreadyExist) {
        return;
      }

      if (isFieldValueEmpty && !fieldErrorAlreadyExist) {
        this.setState(prevState => ({
          errors: { ...prevState.errors,
            [field]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Field Required')
          }
        }));
        return;
      }

      if (!isFieldValueEmpty && fieldErrorAlreadyExist) {
        this.clearError(field);
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleValidateKey", () => {
      const {
        savedRelays
      } = this.props;
      const {
        values,
        errors
      } = this.state;
      const isKeyAlreadyTaken = savedRelays.find(savedRelay => savedRelay.publicKey === values.publicKey);

      if (isKeyAlreadyTaken && !errors.publicKey) {
        this.setState({
          errors: { ...errors,
            publicKey: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Relay key already taken')
          }
        });
        return;
      }

      if (errors.publicKey) {
        this.setState({
          errors: lodash_omit__WEBPACK_IMPORTED_MODULE_6___default()(errors, 'publicKey')
        });
      }

      this.handleValidate('publicKey')();
    });
  }

  componentDidMount() {
    this.validateForm();
  }

  componentDidUpdate(_prevProps, prevState) {
    if (!lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(prevState.values, this.state.values)) {
      this.validateForm();
    }

    if (!lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(prevState.errors, this.state.errors) && Object.keys(this.state.errors).length > 0) {
      this.setValidForm(false);
    }
  }

  getDefaultState() {
    return {
      values: {
        name: '',
        publicKey: '',
        description: ''
      },
      requiredValues: ['name', 'publicKey'],
      errors: {},
      disables: {},
      isFormValid: false,
      title: this.getTitle()
    };
  }

  getTitle() {
    return '';
  }

  getData() {
    // Child has to implement this
    throw new Error('Not implemented');
  }

  getBtnSaveLabel() {
    return undefined;
  }

  setValidForm(isFormValid) {
    this.setState({
      isFormValid
    });
  }

  validateForm() {
    const {
      values,
      requiredValues,
      errors
    } = this.state;
    const isFormValid = requiredValues.every(requiredValue => !!values[requiredValue].replace(/\s/g, '') && !errors[requiredValue]);
    this.setValidForm(isFormValid);
  }

  clearError(field) {
    this.setState(prevState => ({
      errors: lodash_omit__WEBPACK_IMPORTED_MODULE_6___default()(prevState.errors, field)
    }));
  }

  convertErrorXhrResponse(error) {
    switch (error.type) {
      case 'invalid-key':
      case 'missing-key':
        this.setState(prevState => ({
          errors: { ...prevState.errors,
            publicKey: error.message
          }
        }));
        break;

      case 'empty-name':
      case 'missing-name':
        this.setState(prevState => ({
          errors: { ...prevState.errors,
            name: error.message
          }
        }));
        break;

      default:
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_7__.addErrorMessage)(error.message);
    }
  }

  getForm() {
    const {
      values,
      errors,
      disables,
      isFormValid
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(_form__WEBPACK_IMPORTED_MODULE_9__["default"], {
      isFormValid: isFormValid,
      onSave: this.handleSave,
      onChange: this.handleChange,
      onValidate: this.handleValidate,
      onValidateKey: this.handleValidateKey,
      errors: errors,
      values: values,
      disables: disables
    });
  }

  getContent() {
    return this.getForm();
  }

  render() {
    const {
      title,
      isFormValid
    } = this.state;
    const btnSaveLabel = this.getBtnSaveLabel();
    const content = this.getContent();
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(_modal__WEBPACK_IMPORTED_MODULE_11__["default"], { ...this.props,
      title: title,
      onSave: this.handleSave,
      btnSaveLabel: btnSaveLabel,
      disabled: !isFormValid,
      content: content
    });
  }

}

DialogManager.displayName = "DialogManager";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DialogManager);

/***/ }),

/***/ "./app/views/settings/organizationRelay/relayWrapper.tsx":
/*!***************************************************************!*\
  !*** ./app/views/settings/organizationRelay/relayWrapper.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_actionCreators_organizations__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/actionCreators/organizations */ "./app/actionCreators/organizations.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var sentry_views_settings_organization_permissionAlert__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/views/settings/organization/permissionAlert */ "./app/views/settings/organization/permissionAlert.tsx");
/* harmony import */ var _modals_add__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ./modals/add */ "./app/views/settings/organizationRelay/modals/add/index.tsx");
/* harmony import */ var _modals_edit__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ./modals/edit */ "./app/views/settings/organizationRelay/modals/edit.tsx");
/* harmony import */ var _emptyState__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ./emptyState */ "./app/views/settings/organizationRelay/emptyState.tsx");
/* harmony import */ var _list__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ./list */ "./app/views/settings/organizationRelay/list/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");























const RELAY_DOCS_LINK = 'https://getsentry.github.io/relay/';

class RelayWrapper extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_13__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDelete", publicKey => async () => {
      const {
        relays
      } = this.state;
      const trustedRelays = relays.filter(relay => relay.publicKey !== publicKey).map(relay => lodash_omit__WEBPACK_IMPORTED_MODULE_5___default()(relay, ['created', 'lastModified']));

      try {
        const response = await this.api.requestPromise(`/organizations/${this.props.organization.slug}/`, {
          method: 'PUT',
          data: {
            trustedRelays
          }
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Successfully deleted Relay public key'));
        this.setRelays(response.trustedRelays);
      } catch {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('An unknown error occurred while deleting Relay public key'));
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleOpenEditDialog", publicKey => () => {
      const editRelay = this.state.relays.find(relay => relay.publicKey === publicKey);

      if (!editRelay) {
        return;
      }

      (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_7__.openModal)(modalProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(_modals_edit__WEBPACK_IMPORTED_MODULE_18__["default"], { ...modalProps,
        savedRelays: this.state.relays,
        api: this.api,
        orgSlug: this.props.organization.slug,
        relay: editRelay,
        onSubmitSuccess: response => {
          this.successfullySaved(response, (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Successfully updated Relay public key'));
        }
      }));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleOpenAddDialog", () => {
      (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_7__.openModal)(modalProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(_modals_add__WEBPACK_IMPORTED_MODULE_17__["default"], { ...modalProps,
        savedRelays: this.state.relays,
        api: this.api,
        orgSlug: this.props.organization.slug,
        onSubmitSuccess: response => {
          this.successfullySaved(response, (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Successfully added Relay public key'));
        }
      }));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleRefresh", () => {
      // Fetch fresh activities
      this.fetchData();
    });
  }

  componentDidUpdate(prevProps, prevState) {
    if (!lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default()(prevState.relays, this.state.relays)) {
      // Fetch fresh activities
      this.fetchData();
      (0,sentry_actionCreators_organizations__WEBPACK_IMPORTED_MODULE_8__.updateOrganization)({ ...prevProps.organization,
        trustedRelays: this.state.relays
      });
    }

    super.componentDidUpdate(prevProps, prevState);
  }

  getTitle() {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Relay');
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      relays: this.props.organization.trustedRelays
    };
  }

  getEndpoints() {
    const {
      organization
    } = this.props;
    return [['relayActivities', `/organizations/${organization.slug}/relay_usage/`]];
  }

  setRelays(trustedRelays) {
    this.setState({
      relays: trustedRelays
    });
  }

  successfullySaved(response, successMessage) {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addSuccessMessage)(successMessage);
    this.setRelays(response.trustedRelays);
  }

  renderContent(disabled) {
    const {
      relays,
      relayActivities,
      loading
    } = this.state;

    if (loading) {
      return this.renderLoading();
    }

    if (!relays.length) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(_emptyState__WEBPACK_IMPORTED_MODULE_19__["default"], {});
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(_list__WEBPACK_IMPORTED_MODULE_20__["default"], {
      relays: relays,
      relayActivities: relayActivities,
      onEdit: this.handleOpenEditDialog,
      onRefresh: this.handleRefresh,
      onDelete: this.handleDelete,
      disabled: disabled
    });
  }

  renderBody() {
    const {
      organization
    } = this.props;
    const disabled = !organization.access.includes('org:write');
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_14__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Relay'),
        action: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_9__["default"], {
          title: disabled ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('You do not have permission to register keys') : undefined,
          priority: "primary",
          size: "sm",
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconAdd, {
            size: "xs",
            isCircled: true
          }),
          onClick: this.handleOpenAddDialog,
          disabled: disabled,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Register Key')
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_views_settings_organization_permissionAlert__WEBPACK_IMPORTED_MODULE_16__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_15__["default"], {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('Sentry Relay offers enterprise-grade data security by providing a standalone service that acts as a middle layer between your application and sentry.io. Go to [link:Relay Documentation] for setup and details.', {
          link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_10__["default"], {
            href: RELAY_DOCS_LINK
          })
        })
      }), this.renderContent(disabled)]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (RelayWrapper);

/***/ }),

/***/ "../node_modules/lodash/orderBy.js":
/*!*****************************************!*\
  !*** ../node_modules/lodash/orderBy.js ***!
  \*****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseOrderBy = __webpack_require__(/*! ./_baseOrderBy */ "../node_modules/lodash/_baseOrderBy.js"),
    isArray = __webpack_require__(/*! ./isArray */ "../node_modules/lodash/isArray.js");

/**
 * This method is like `_.sortBy` except that it allows specifying the sort
 * orders of the iteratees to sort by. If `orders` is unspecified, all values
 * are sorted in ascending order. Otherwise, specify an order of "desc" for
 * descending or "asc" for ascending sort order of corresponding values.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Collection
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Array[]|Function[]|Object[]|string[]} [iteratees=[_.identity]]
 *  The iteratees to sort by.
 * @param {string[]} [orders] The sort orders of `iteratees`.
 * @param- {Object} [guard] Enables use as an iteratee for methods like `_.reduce`.
 * @returns {Array} Returns the new sorted array.
 * @example
 *
 * var users = [
 *   { 'user': 'fred',   'age': 48 },
 *   { 'user': 'barney', 'age': 34 },
 *   { 'user': 'fred',   'age': 40 },
 *   { 'user': 'barney', 'age': 36 }
 * ];
 *
 * // Sort by `user` in ascending order and by `age` in descending order.
 * _.orderBy(users, ['user', 'age'], ['asc', 'desc']);
 * // => objects for [['barney', 36], ['barney', 34], ['fred', 48], ['fred', 40]]
 */
function orderBy(collection, iteratees, orders, guard) {
  if (collection == null) {
    return [];
  }
  if (!isArray(iteratees)) {
    iteratees = iteratees == null ? [] : [iteratees];
  }
  orders = guard ? undefined : orders;
  if (!isArray(orders)) {
    orders = orders == null ? [] : [orders];
  }
  return baseOrderBy(collection, iteratees, orders);
}

module.exports = orderBy;


/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_organizationRelay_index_tsx.9b16320646ebbb9490c8e08b64f9cb18.js.map