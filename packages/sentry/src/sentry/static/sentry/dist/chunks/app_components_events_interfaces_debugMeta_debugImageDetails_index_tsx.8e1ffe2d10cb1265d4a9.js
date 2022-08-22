"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_events_interfaces_debugMeta_debugImageDetails_index_tsx"],{

/***/ "./app/components/events/interfaces/debugMeta/debugImageDetails/candidate/actions.tsx":
/*!********************************************************************************************!*\
  !*** ./app/components/events/interfaces/debugMeta/debugImageDetails/candidate/actions.tsx ***!
  \********************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_acl_role__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/acl/role */ "./app/components/acl/role.tsx");
/* harmony import */ var sentry_components_actions_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/actions/button */ "./app/components/actions/button.tsx");
/* harmony import */ var sentry_components_actions_menuItemActionLink__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/actions/menuItemActionLink */ "./app/components/actions/menuItemActionLink.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_dropdownLink__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/dropdownLink */ "./app/components/dropdownLink.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/types/debugImage */ "./app/types/debugImage.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
















const noPermissionToDownloadDebugFilesInfo = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('You do not have permission to download debug files');
const noPermissionToDeleteDebugFilesInfo = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('You do not have permission to delete debug files');
const debugFileDeleteConfirmationInfo = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Are you sure you wish to delete this file?');

function Actions(_ref) {
  let {
    candidate,
    organization,
    isInternalSource,
    baseUrl,
    projSlug,
    onDelete
  } = _ref;
  const {
    download,
    location: debugFileId
  } = candidate;
  const {
    status
  } = download;

  if (!debugFileId || !isInternalSource) {
    return null;
  }

  const deleted = status === sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_13__.CandidateDownloadStatus.DELETED;
  const downloadUrl = `${baseUrl}/projects/${organization.slug}/${projSlug}/files/dsyms/?id=${debugFileId}`;

  const actions = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_acl_role__WEBPACK_IMPORTED_MODULE_3__.Role, {
    role: organization.debugFilesRole,
    organization: organization,
    children: _ref2 => {
      let {
        hasRole
      } = _ref2;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_2__["default"], {
        access: ['project:write'],
        organization: organization,
        children: _ref3 => {
          let {
            hasAccess
          } = _ref3;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(StyledDropdownLink, {
              caret: false,
              customTitle: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_actions_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
                "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Actions'),
                disabled: deleted,
                icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconEllipsis, {
                  size: "sm"
                })
              }),
              anchorRight: true,
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_10__["default"], {
                disabled: hasRole,
                title: noPermissionToDownloadDebugFilesInfo,
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_actions_menuItemActionLink__WEBPACK_IMPORTED_MODULE_5__["default"], {
                  shouldConfirm: false,
                  icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconDownload, {
                    size: "xs"
                  }),
                  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Download'),
                  href: downloadUrl,
                  onClick: event => {
                    if (deleted) {
                      event.preventDefault();
                    }
                  },
                  disabled: !hasRole || deleted,
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Download')
                })
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_10__["default"], {
                disabled: hasAccess,
                title: noPermissionToDeleteDebugFilesInfo,
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_actions_menuItemActionLink__WEBPACK_IMPORTED_MODULE_5__["default"], {
                  onAction: () => onDelete(debugFileId),
                  message: debugFileDeleteConfirmationInfo,
                  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Delete'),
                  disabled: !hasAccess || deleted,
                  shouldConfirm: true,
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Delete')
                })
              })]
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(StyledButtonBar, {
              gap: 1,
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_10__["default"], {
                disabled: hasRole,
                title: noPermissionToDownloadDebugFilesInfo,
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
                  size: "xs",
                  icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconDownload, {
                    size: "xs"
                  }),
                  href: downloadUrl,
                  disabled: !hasRole,
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Download')
                })
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_10__["default"], {
                disabled: hasAccess,
                title: noPermissionToDeleteDebugFilesInfo,
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_8__["default"], {
                  confirmText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Delete'),
                  message: debugFileDeleteConfirmationInfo,
                  onConfirm: () => onDelete(debugFileId),
                  disabled: !hasAccess,
                  children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
                    priority: "danger",
                    icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconDelete, {
                      size: "xs"
                    }),
                    size: "xs",
                    disabled: !hasAccess,
                    "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Delete')
                  })
                })
              })]
            })]
          });
        }
      });
    }
  });

  if (!deleted) {
    return actions;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_10__["default"], {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Actions not available because this debug file was deleted'),
    children: actions
  });
}

Actions.displayName = "Actions";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Actions);

const StyledDropdownLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_dropdownLink__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "e1bi06kf1"
} : 0)("display:none;@media (min-width: ", props => props.theme.breakpoints.xxlarge, "){display:flex;align-items:center;transition:none;}" + ( true ? "" : 0));

const StyledButtonBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "e1bi06kf0"
} : 0)("@media (min-width: ", props => props.theme.breakpoints.xxlarge, "){display:none;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/events/interfaces/debugMeta/debugImageDetails/candidate/index.tsx":
/*!******************************************************************************************!*\
  !*** ./app/components/events/interfaces/debugMeta/debugImageDetails/candidate/index.tsx ***!
  \******************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../utils */ "./app/components/events/interfaces/debugMeta/debugImageDetails/utils.tsx");
/* harmony import */ var _status_statusTooltip__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./status/statusTooltip */ "./app/components/events/interfaces/debugMeta/debugImageDetails/candidate/status/statusTooltip.tsx");
/* harmony import */ var _actions__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./actions */ "./app/components/events/interfaces/debugMeta/debugImageDetails/candidate/actions.tsx");
/* harmony import */ var _information__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./information */ "./app/components/events/interfaces/debugMeta/debugImageDetails/candidate/information/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









function Candidate(_ref) {
  let {
    candidate,
    organization,
    projSlug,
    baseUrl,
    haveCandidatesAtLeastOneAction,
    hasReprocessWarning,
    onDelete,
    eventDateReceived
  } = _ref;
  const {
    source
  } = candidate;
  const isInternalSource = source === _utils__WEBPACK_IMPORTED_MODULE_2__.INTERNAL_SOURCE;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Column, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(_status_statusTooltip__WEBPACK_IMPORTED_MODULE_3__["default"], {
        candidate: candidate,
        hasReprocessWarning: hasReprocessWarning
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(InformationColumn, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(_information__WEBPACK_IMPORTED_MODULE_5__["default"], {
        candidate: candidate,
        isInternalSource: isInternalSource,
        eventDateReceived: eventDateReceived,
        hasReprocessWarning: hasReprocessWarning
      })
    }), haveCandidatesAtLeastOneAction && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(ActionsColumn, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(_actions__WEBPACK_IMPORTED_MODULE_4__["default"], {
        onDelete: onDelete,
        baseUrl: baseUrl,
        projSlug: projSlug,
        organization: organization,
        candidate: candidate,
        isInternalSource: isInternalSource
      })
    })]
  });
}

Candidate.displayName = "Candidate";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Candidate);

const Column = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e13xxgly2"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const InformationColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Column,  true ? {
  target: "e13xxgly1"
} : 0)( true ? {
  name: "1ejri1g",
  styles: "flex-direction:column;align-items:flex-start"
} : 0);

const ActionsColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Column,  true ? {
  target: "e13xxgly0"
} : 0)( true ? {
  name: "1f60if8",
  styles: "justify-content:flex-end"
} : 0);

/***/ }),

/***/ "./app/components/events/interfaces/debugMeta/debugImageDetails/candidate/information/divider.tsx":
/*!********************************************************************************************************!*\
  !*** ./app/components/events/interfaces/debugMeta/debugImageDetails/candidate/information/divider.tsx ***!
  \********************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function Divider() {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)(Wrapper, {
    children: '|'
  });
}

Divider.displayName = "Divider";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Divider);

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "etzc1de0"
} : 0)("color:", p => p.theme.gray200, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/events/interfaces/debugMeta/debugImageDetails/candidate/information/features.tsx":
/*!*********************************************************************************************************!*\
  !*** ./app/components/events/interfaces/debugMeta/debugImageDetails/candidate/information/features.tsx ***!
  \*********************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_tag__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/tag */ "./app/components/tag.tsx");
/* harmony import */ var sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/types/debugImage */ "./app/types/debugImage.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../utils */ "./app/components/events/interfaces/debugMeta/debugImageDetails/candidate/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








function Features(_ref) {
  let {
    download
  } = _ref;
  let features = [];

  if (download.status === sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_4__.CandidateDownloadStatus.OK || download.status === sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_4__.CandidateDownloadStatus.DELETED || download.status === sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_4__.CandidateDownloadStatus.UNAPPLIED) {
    features = Object.keys(download.features).filter(feature => download.features[feature]);
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
    children: Object.keys(sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_4__.ImageFeature).map(imageFeature => {
      const {
        label,
        description
      } = (0,_utils__WEBPACK_IMPORTED_MODULE_5__.getImageFeatureDescription)(imageFeature);
      const isDisabled = !features.includes(imageFeature);
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(StyledTag, {
        disabled: isDisabled,
        tooltipText: isDisabled ? undefined : description,
        children: label
      }, label);
    })
  });
}

Features.displayName = "Features";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Features);

const StyledTag = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_tag__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e1bcv2r60"
} : 0)("opacity:", p => p.disabled ? '0.35' : 1, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/events/interfaces/debugMeta/debugImageDetails/candidate/information/index.tsx":
/*!******************************************************************************************************!*\
  !*** ./app/components/events/interfaces/debugMeta/debugImageDetails/candidate/information/index.tsx ***!
  \******************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_capitalize__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/capitalize */ "../node_modules/lodash/capitalize.js");
/* harmony import */ var lodash_capitalize__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_capitalize__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var moment_timezone__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! moment-timezone */ "../node_modules/moment-timezone/index.js");
/* harmony import */ var moment_timezone__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(moment_timezone__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_fileSize__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/fileSize */ "./app/components/fileSize.tsx");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/types/debugImage */ "./app/types/debugImage.tsx");
/* harmony import */ var _processing_item__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ../../../processing/item */ "./app/components/events/interfaces/debugMeta/processing/item.tsx");
/* harmony import */ var _processing_list__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ../../../processing/list */ "./app/components/events/interfaces/debugMeta/processing/list.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ../../utils */ "./app/components/events/interfaces/debugMeta/debugImageDetails/utils.tsx");
/* harmony import */ var _divider__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./divider */ "./app/components/events/interfaces/debugMeta/debugImageDetails/candidate/information/divider.tsx");
/* harmony import */ var _features__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ./features */ "./app/components/events/interfaces/debugMeta/debugImageDetails/candidate/information/features.tsx");
/* harmony import */ var _processingIcon__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ./processingIcon */ "./app/components/events/interfaces/debugMeta/debugImageDetails/candidate/information/processingIcon.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }





















function Information(_ref) {
  let {
    candidate,
    isInternalSource,
    hasReprocessWarning,
    eventDateReceived
  } = _ref;
  const {
    source_name,
    source,
    location,
    download
  } = candidate;

  function getFilenameOrLocation() {
    if (candidate.download.status === sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_11__.CandidateDownloadStatus.UNAPPLIED || candidate.download.status === sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_11__.CandidateDownloadStatus.OK && isInternalSource) {
      const {
        symbolType,
        filename
      } = candidate;
      return symbolType === sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_11__.SymbolType.PROGUARD && filename === 'proguard-mapping' ? null : filename;
    }

    if (location && !isInternalSource) {
      return location;
    }

    return null;
  }

  function getTimeSinceData(dateCreated) {
    const dateTime = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_4__["default"], {
      date: dateCreated
    });

    if (candidate.download.status !== sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_11__.CandidateDownloadStatus.UNAPPLIED) {
      return {
        tooltipDesc: dateTime,
        displayIcon: false
      };
    }

    const uploadedBeforeEvent = moment_timezone__WEBPACK_IMPORTED_MODULE_3___default()(dateCreated).isBefore(eventDateReceived);

    if (uploadedBeforeEvent) {
      if (hasReprocessWarning) {
        return {
          tooltipDesc: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
            children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)('This debug file was uploaded [when] before this event. It takes up to 1 hour for new files to propagate. To apply new debug information, reprocess this issue.', {
              when: moment_timezone__WEBPACK_IMPORTED_MODULE_3___default()(eventDateReceived).from(dateCreated, true)
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(DateTimeWrapper, {
              children: dateTime
            })]
          }),
          displayIcon: true
        };
      }

      const uplodadedMinutesDiff = moment_timezone__WEBPACK_IMPORTED_MODULE_3___default()(eventDateReceived).diff(dateCreated, 'minutes');

      if (uplodadedMinutesDiff >= 60) {
        return {
          tooltipDesc: dateTime,
          displayIcon: false
        };
      }

      return {
        tooltipDesc: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)('This debug file was uploaded [when] before this event. It takes up to 1 hour for new files to propagate.', {
            when: moment_timezone__WEBPACK_IMPORTED_MODULE_3___default()(eventDateReceived).from(dateCreated, true)
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(DateTimeWrapper, {
            children: dateTime
          })]
        }),
        displayIcon: true
      };
    }

    if (hasReprocessWarning) {
      return {
        tooltipDesc: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)('This debug file was uploaded [when] after this event. To apply new debug information, reprocess this issue.', {
            when: moment_timezone__WEBPACK_IMPORTED_MODULE_3___default()(dateCreated).from(eventDateReceived, true)
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(DateTimeWrapper, {
            children: dateTime
          })]
        }),
        displayIcon: true
      };
    }

    return {
      tooltipDesc: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
        children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)('This debug file was uploaded [when] after this event.', {
          when: moment_timezone__WEBPACK_IMPORTED_MODULE_3___default()(eventDateReceived).from(dateCreated, true)
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(DateTimeWrapper, {
          children: dateTime
        })]
      }),
      displayIcon: true
    };
  }

  function renderProcessingInfo() {
    if (candidate.download.status !== sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_11__.CandidateDownloadStatus.OK && candidate.download.status !== sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_11__.CandidateDownloadStatus.DELETED) {
      return null;
    }

    const items = [];
    const {
      debug,
      unwind
    } = candidate;

    if (debug) {
      items.push((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(_processing_item__WEBPACK_IMPORTED_MODULE_12__["default"], {
        type: "symbolication",
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(_processingIcon__WEBPACK_IMPORTED_MODULE_17__["default"], {
          processingInfo: debug
        })
      }, "symbolication"));
    }

    if (unwind) {
      items.push((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(_processing_item__WEBPACK_IMPORTED_MODULE_12__["default"], {
        type: "stack_unwinding",
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(_processingIcon__WEBPACK_IMPORTED_MODULE_17__["default"], {
          processingInfo: unwind
        })
      }, "stack_unwinding"));
    }

    if (!items.length) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(StyledProcessingList, {
        items: items
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(_divider__WEBPACK_IMPORTED_MODULE_15__["default"], {})]
    });
  }

  function renderExtraDetails() {
    if (candidate.download.status !== sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_11__.CandidateDownloadStatus.UNAPPLIED && candidate.download.status !== sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_11__.CandidateDownloadStatus.OK || source !== _utils__WEBPACK_IMPORTED_MODULE_14__.INTERNAL_SOURCE) {
      return null;
    }

    const {
      symbolType,
      fileType,
      cpuName,
      size,
      dateCreated
    } = candidate;
    const {
      tooltipDesc,
      displayIcon
    } = getTimeSinceData(dateCreated);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_7__["default"], {
        title: tooltipDesc,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(TimeSinceWrapper, {
          children: [displayIcon && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_8__.IconWarning, {
            color: "red300",
            size: "xs"
          }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)('Uploaded [timesince]', {
            timesince: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_6__["default"], {
              disabledAbsoluteTooltip: true,
              date: dateCreated
            })
          })]
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(_divider__WEBPACK_IMPORTED_MODULE_15__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_fileSize__WEBPACK_IMPORTED_MODULE_5__["default"], {
        bytes: size
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(_divider__WEBPACK_IMPORTED_MODULE_15__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("span", {
        children: symbolType === sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_11__.SymbolType.PROGUARD && cpuName === 'any' ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('proguard mapping') : `${symbolType}${fileType ? ` ${fileType}` : ''}`
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(_divider__WEBPACK_IMPORTED_MODULE_15__["default"], {})]
    });
  }

  const filenameOrLocation = getFilenameOrLocation();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(Wrapper, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("strong", {
        "data-test-id": "source_name",
        children: source_name ? lodash_capitalize__WEBPACK_IMPORTED_MODULE_2___default()(source_name) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Unknown')
      }), filenameOrLocation && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(FilenameOrLocation, {
        children: filenameOrLocation
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(Details, {
      children: [renderExtraDetails(), renderProcessingInfo(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(_features__WEBPACK_IMPORTED_MODULE_16__["default"], {
        download: download
      })]
    })]
  });
}

Information.displayName = "Information";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Information);

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e19vxbfv5"
} : 0)( true ? {
  name: "2w899g",
  styles: "white-space:pre-wrap;word-break:break-all;max-width:100%"
} : 0);

const FilenameOrLocation = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e19vxbfv4"
} : 0)("padding-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";font-size:", p => p.theme.fontSizeSmall, ";" + ( true ? "" : 0));

const Details = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e19vxbfv3"
} : 0)("display:grid;grid-auto-flow:column;grid-auto-columns:max-content;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";color:", p => p.theme.gray400, ";font-size:", p => p.theme.fontSizeSmall, ";" + ( true ? "" : 0));

const TimeSinceWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e19vxbfv2"
} : 0)("display:grid;grid-template-columns:max-content 1fr;align-items:center;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(0.5), ";font-variant-numeric:tabular-nums;" + ( true ? "" : 0));

const DateTimeWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e19vxbfv1"
} : 0)("padding-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";font-variant-numeric:tabular-nums;" + ( true ? "" : 0));

const StyledProcessingList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_processing_list__WEBPACK_IMPORTED_MODULE_13__["default"],  true ? {
  target: "e19vxbfv0"
} : 0)("display:grid;grid-auto-flow:column;grid-auto-columns:max-content;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/events/interfaces/debugMeta/debugImageDetails/candidate/information/processingIcon.tsx":
/*!***************************************************************************************************************!*\
  !*** ./app/components/events/interfaces/debugMeta/debugImageDetails/candidate/information/processingIcon.tsx ***!
  \***************************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/types/debugImage */ "./app/types/debugImage.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







function ProcessingIcon(_ref) {
  let {
    processingInfo
  } = _ref;

  switch (processingInfo.status) {
    case sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_3__.CandidateProcessingStatus.OK:
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_2__.IconCheckmark, {
        color: "green300",
        size: "xs"
      });

    case sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_3__.CandidateProcessingStatus.ERROR:
      {
        const {
          details
        } = processingInfo;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_1__["default"], {
          title: details,
          disabled: !details,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_2__.IconClose, {
            color: "red300",
            size: "xs"
          })
        });
      }

    case sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_3__.CandidateProcessingStatus.MALFORMED:
      {
        const {
          details
        } = processingInfo;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_1__["default"], {
          title: details,
          disabled: !details,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_2__.IconWarning, {
            color: "yellow300",
            size: "xs"
          })
        });
      }

    default:
      {
        _sentry_react__WEBPACK_IMPORTED_MODULE_5__.withScope(scope => {
          scope.setLevel('warning');
          _sentry_react__WEBPACK_IMPORTED_MODULE_5__.captureException(new Error('Unknown image candidate ProcessingIcon status'));
        });
        return null; // this shall never happen
      }
  }
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProcessingIcon);

/***/ }),

/***/ "./app/components/events/interfaces/debugMeta/debugImageDetails/candidate/status/index.tsx":
/*!*************************************************************************************************!*\
  !*** ./app/components/events/interfaces/debugMeta/debugImageDetails/candidate/status/index.tsx ***!
  \*************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_components_tag__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/tag */ "./app/components/tag.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/types/debugImage */ "./app/types/debugImage.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







function Status(_ref) {
  let {
    status
  } = _ref;

  switch (status) {
    case sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_3__.CandidateDownloadStatus.OK:
      {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_tag__WEBPACK_IMPORTED_MODULE_1__["default"], {
          type: "success",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Ok')
        });
      }

    case sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_3__.CandidateDownloadStatus.ERROR:
    case sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_3__.CandidateDownloadStatus.MALFORMED:
      {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_tag__WEBPACK_IMPORTED_MODULE_1__["default"], {
          type: "error",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Failed')
        });
      }

    case sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_3__.CandidateDownloadStatus.NOT_FOUND:
      {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_tag__WEBPACK_IMPORTED_MODULE_1__["default"], {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Not Found')
        });
      }

    case sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_3__.CandidateDownloadStatus.NO_PERMISSION:
      {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_tag__WEBPACK_IMPORTED_MODULE_1__["default"], {
          type: "highlight",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Permissions')
        });
      }

    case sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_3__.CandidateDownloadStatus.DELETED:
      {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_tag__WEBPACK_IMPORTED_MODULE_1__["default"], {
          type: "success",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Deleted')
        });
      }

    case sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_3__.CandidateDownloadStatus.UNAPPLIED:
      {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_tag__WEBPACK_IMPORTED_MODULE_1__["default"], {
          type: "warning",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Unapplied')
        });
      }

    default:
      {
        _sentry_react__WEBPACK_IMPORTED_MODULE_5__.withScope(scope => {
          scope.setLevel('warning');
          _sentry_react__WEBPACK_IMPORTED_MODULE_5__.captureException(new Error('Unknown image candidate download status'));
        });
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_tag__WEBPACK_IMPORTED_MODULE_1__["default"], {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Unknown')
        }); // This shall not happen
      }
  }
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Status);

/***/ }),

/***/ "./app/components/events/interfaces/debugMeta/debugImageDetails/candidate/status/statusTooltip.tsx":
/*!*********************************************************************************************************!*\
  !*** ./app/components/events/interfaces/debugMeta/debugImageDetails/candidate/status/statusTooltip.tsx ***!
  \*********************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../utils */ "./app/components/events/interfaces/debugMeta/debugImageDetails/candidate/utils.tsx");
/* harmony import */ var ___WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! . */ "./app/components/events/interfaces/debugMeta/debugImageDetails/candidate/status/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }








function StatusTooltip(_ref) {
  let {
    candidate,
    hasReprocessWarning
  } = _ref;
  const {
    download
  } = candidate;
  const {
    label,
    description,
    disabled
  } = (0,_utils__WEBPACK_IMPORTED_MODULE_3__.getStatusTooltipDescription)(candidate, hasReprocessWarning);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_1__["default"], {
    title: label && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(Title, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Label, {
        children: label
      }), description && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("div", {
        children: description
      })]
    }),
    disabled: disabled,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(___WEBPACK_IMPORTED_MODULE_4__["default"], {
      status: download.status
    })
  });
}

StatusTooltip.displayName = "StatusTooltip";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (StatusTooltip);

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e18y9fix1"
} : 0)( true ? {
  name: "1flj9lk",
  styles: "text-align:left"
} : 0);

const Label = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e18y9fix0"
} : 0)("display:inline-block;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(0.25), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/events/interfaces/debugMeta/debugImageDetails/candidate/utils.tsx":
/*!******************************************************************************************!*\
  !*** ./app/components/events/interfaces/debugMeta/debugImageDetails/candidate/utils.tsx ***!
  \******************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getImageFeatureDescription": () => (/* binding */ getImageFeatureDescription),
/* harmony export */   "getSourceTooltipDescription": () => (/* binding */ getSourceTooltipDescription),
/* harmony export */   "getStatusTooltipDescription": () => (/* binding */ getStatusTooltipDescription)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/types/debugImage */ "./app/types/debugImage.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../utils */ "./app/components/events/interfaces/debugMeta/debugImageDetails/utils.tsx");





function getImageFeatureDescription(type) {
  switch (type) {
    case sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_2__.ImageFeature.has_debug_info:
      return {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('debug'),
        description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Debug information provides function names and resolves inlined frames during symbolication')
      };

    case sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_2__.ImageFeature.has_sources:
      return {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('sources'),
        description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Source code information allows Sentry to display source code context for stack frames')
      };

    case sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_2__.ImageFeature.has_symbols:
      return {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('symtab'),
        description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Symbol tables are used as a fallback when full debug information is not available')
      };

    case sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_2__.ImageFeature.has_unwind_info:
      return {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('unwind'),
        description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Stack unwinding information improves the quality of stack traces extracted from minidumps')
      };

    default:
      {
        _sentry_react__WEBPACK_IMPORTED_MODULE_4__.withScope(scope => {
          scope.setLevel('warning');
          _sentry_react__WEBPACK_IMPORTED_MODULE_4__.captureException(new Error('Unknown image candidate feature'));
        });
        return {}; // this shall not happen
      }
  }
}
function getSourceTooltipDescription(source, builtinSymbolSources) {
  if (source === _utils__WEBPACK_IMPORTED_MODULE_3__.INTERNAL_SOURCE) {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)("This debug information file is from Sentry's internal symbol server for this project");
  }

  if (builtinSymbolSources !== null && builtinSymbolSources !== void 0 && builtinSymbolSources.find(builtinSymbolSource => builtinSymbolSource.id === source)) {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('This debug information file is from a built-in symbol server');
  }

  return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('This debug information file is from a custom symbol server');
}
function getStatusTooltipDescription(candidate, hasReprocessWarning) {
  const {
    download,
    location,
    source
  } = candidate;

  switch (download.status) {
    case sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_2__.CandidateDownloadStatus.OK:
      {
        return {
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Download Details'),
          description: location,
          disabled: !location || source === _utils__WEBPACK_IMPORTED_MODULE_3__.INTERNAL_SOURCE
        };
      }

    case sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_2__.CandidateDownloadStatus.ERROR:
    case sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_2__.CandidateDownloadStatus.MALFORMED:
      {
        const {
          details
        } = download;
        return {
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Download Details'),
          description: details,
          disabled: !details
        };
      }

    case sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_2__.CandidateDownloadStatus.NOT_FOUND:
      {
        return {};
      }

    case sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_2__.CandidateDownloadStatus.NO_PERMISSION:
      {
        const {
          details
        } = download;
        return {
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Permission Error'),
          description: details,
          disabled: !details
        };
      }

    case sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_2__.CandidateDownloadStatus.DELETED:
      {
        return {
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('This file was deleted after the issue was processed.')
        };
      }

    case sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_2__.CandidateDownloadStatus.UNAPPLIED:
      {
        return {
          label: hasReprocessWarning ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('This issue was processed before this debug information file was available. To apply new debug information, reprocess this issue.') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('This issue was processed before this debug information file was available')
        };
      }

    default:
      {
        _sentry_react__WEBPACK_IMPORTED_MODULE_4__.withScope(scope => {
          scope.setLevel('warning');
          _sentry_react__WEBPACK_IMPORTED_MODULE_4__.captureException(new Error('Unknown image candidate download status'));
        });
        return {}; // This shall not happen
      }
  }
}

/***/ }),

/***/ "./app/components/events/interfaces/debugMeta/debugImageDetails/candidates.tsx":
/*!*************************************************************************************!*\
  !*** ./app/components/events/interfaces/debugMeta/debugImageDetails/candidates.tsx ***!
  \*************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_8__);
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_panels_panelTable__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/panels/panelTable */ "./app/components/panels/panelTable.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/types/debugImage */ "./app/types/debugImage.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _searchBarAction__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ../../searchBarAction */ "./app/components/events/interfaces/searchBarAction.tsx");
/* harmony import */ var _candidate_status__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ./candidate/status */ "./app/components/events/interfaces/debugMeta/debugImageDetails/candidate/status/index.tsx");
/* harmony import */ var _candidate__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ./candidate */ "./app/components/events/interfaces/debugMeta/debugImageDetails/candidate/index.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ./utils */ "./app/components/events/interfaces/debugMeta/debugImageDetails/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }



















const filterOptionCategories = {
  status: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Status'),
  source: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Source')
};

class Candidates extends react__WEBPACK_IMPORTED_MODULE_5__.Component {
  constructor() {
    var _this;

    super(...arguments);
    _this = this;

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      searchTerm: '',
      filterOptions: [],
      filterSelections: [],
      filteredCandidatesBySearch: [],
      filteredCandidatesByFilter: []
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "doSearch", lodash_debounce__WEBPACK_IMPORTED_MODULE_6___default()(this.filterCandidatesBySearch, 300));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeSearchTerm", function () {
      let searchTerm = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';

      _this.setState({
        searchTerm
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeFilter", filterSelections => {
      const {
        filteredCandidatesBySearch
      } = this.state;
      const filteredCandidatesByFilter = this.getFilteredCandidatedByFilter(filteredCandidatesBySearch, filterSelections);
      this.setState({
        filterSelections,
        filteredCandidatesByFilter
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleResetFilter", () => {
      this.setState({
        filterSelections: []
      }, this.filterCandidatesBySearch);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleResetSearchBar", () => {
      const {
        candidates
      } = this.props;
      this.setState({
        searchTerm: '',
        filteredCandidatesByFilter: candidates,
        filteredCandidatesBySearch: candidates
      });
    });
  }

  componentDidMount() {
    this.getFilters();
  }

  componentDidUpdate(prevProps, prevState) {
    if (!lodash_isEqual__WEBPACK_IMPORTED_MODULE_7___default()(prevProps.candidates, this.props.candidates)) {
      this.getFilters();
      return;
    }

    if (prevState.searchTerm !== this.state.searchTerm) {
      this.doSearch();
    }
  }

  filterCandidatesBySearch() {
    const {
      searchTerm,
      filterSelections
    } = this.state;
    const {
      candidates
    } = this.props;

    if (!searchTerm.trim()) {
      const filteredCandidatesByFilter = this.getFilteredCandidatedByFilter(candidates, filterSelections);
      this.setState({
        filteredCandidatesBySearch: candidates,
        filteredCandidatesByFilter
      });
      return;
    } // Slightly hacky, but it works
    // the string is being `stringify`d here in order to match exactly the same `stringify`d string of the loop


    const searchFor = JSON.stringify(searchTerm) // it replaces double backslash generate by JSON.stringify with single backslash
    .replace(/((^")|("$))/g, '').toLocaleLowerCase();
    const filteredCandidatesBySearch = candidates.filter(obj => Object.keys(lodash_pick__WEBPACK_IMPORTED_MODULE_8___default()(obj, ['source_name', 'location'])).some(key => {
      const info = obj[key];

      if (key === 'location' && typeof Number(info) === 'number') {
        return false;
      }

      if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_16__.defined)(info) || !String(info).trim()) {
        return false;
      }

      return JSON.stringify(info).replace(/((^")|("$))/g, '').toLocaleLowerCase().trim().includes(searchFor);
    }));
    const filteredCandidatesByFilter = this.getFilteredCandidatedByFilter(filteredCandidatesBySearch, filterSelections);
    this.setState({
      filteredCandidatesBySearch,
      filteredCandidatesByFilter
    });
  }

  getFilters() {
    var _filterOptions$find$o, _filterOptions$find;

    const {
      imageStatus
    } = this.props;
    const candidates = [...this.props.candidates];
    const filterOptions = this.getFilterOptions(candidates);
    const defaultFilterSelections = ((_filterOptions$find$o = (_filterOptions$find = filterOptions.find(section => section.value === 'status')) === null || _filterOptions$find === void 0 ? void 0 : _filterOptions$find.options) !== null && _filterOptions$find$o !== void 0 ? _filterOptions$find$o : []).filter(opt => opt.value !== `status-${sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_15__.CandidateDownloadStatus.NOT_FOUND}` || imageStatus === sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_15__.ImageStatus.MISSING);
    this.setState({
      filterOptions,
      filterSelections: defaultFilterSelections,
      filteredCandidatesBySearch: candidates,
      filteredCandidatesByFilter: this.getFilteredCandidatedByFilter(candidates, defaultFilterSelections)
    });
  }

  getFilterOptions(candidates) {
    const filterOptions = [];
    const candidateStatus = [...new Set(candidates.map(candidate => candidate.download.status))];

    if (candidateStatus.length > 1) {
      filterOptions.push({
        value: 'status',
        label: filterOptionCategories.status,
        options: candidateStatus.map(status => ({
          value: `status-${status}`,
          label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(_candidate_status__WEBPACK_IMPORTED_MODULE_18__["default"], {
            status: status
          })
        }))
      });
    }

    const candidateSources = [...new Set(candidates.map(candidate => {
      var _candidate$source_nam;

      return (_candidate$source_nam = candidate.source_name) !== null && _candidate$source_nam !== void 0 ? _candidate$source_nam : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Unknown');
    }))];

    if (candidateSources.length > 1) {
      filterOptions.push({
        value: 'source',
        label: filterOptionCategories.source,
        options: candidateSources.map(sourceName => ({
          value: `source-${sourceName}`,
          label: sourceName
        }))
      });
    }

    return filterOptions;
  }

  getFilteredCandidatedByFilter(candidates, filterOptions) {
    const checkedStatusOptions = new Set(filterOptions.filter(option => option.value.split('-')[0] === 'status').map(option => option.value.split('-')[1]));
    const checkedSourceOptions = new Set(filterOptions.filter(option => option.value.split('-')[0] === 'source').map(option => option.value.split('-')[1]));

    if (filterOptions.length === 0) {
      return candidates;
    }

    if (checkedStatusOptions.size > 0) {
      const filteredByStatus = candidates.filter(candidate => checkedStatusOptions.has(candidate.download.status));

      if (checkedSourceOptions.size === 0) {
        return filteredByStatus;
      }

      return filteredByStatus.filter(candidate => {
        var _candidate$source_nam2;

        return checkedSourceOptions.has((_candidate$source_nam2 = candidate === null || candidate === void 0 ? void 0 : candidate.source_name) !== null && _candidate$source_nam2 !== void 0 ? _candidate$source_nam2 : '');
      });
    }

    return candidates.filter(candidate => {
      var _candidate$source_nam3;

      return checkedSourceOptions.has((_candidate$source_nam3 = candidate === null || candidate === void 0 ? void 0 : candidate.source_name) !== null && _candidate$source_nam3 !== void 0 ? _candidate$source_nam3 : '');
    });
  }

  getEmptyMessage() {
    const {
      searchTerm,
      filteredCandidatesByFilter: images,
      filterSelections
    } = this.state;

    if (!!images.length) {
      return {};
    }

    const hasActiveFilter = filterSelections.length > 0;

    if (searchTerm || hasActiveFilter) {
      return {
        emptyMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Sorry, no debug files match your search query'),
        emptyAction: hasActiveFilter ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_9__["default"], {
          onClick: this.handleResetFilter,
          priority: "primary",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Reset filter')
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_9__["default"], {
          onClick: this.handleResetSearchBar,
          priority: "primary",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Clear search bar')
        })
      };
    }

    return {
      emptyMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('There are no debug files to be displayed')
    };
  }

  render() {
    const {
      organization,
      projSlug,
      baseUrl,
      onDelete,
      isLoading,
      candidates,
      eventDateReceived,
      hasReprocessWarning
    } = this.props;
    const {
      searchTerm,
      filterOptions,
      filterSelections,
      filteredCandidatesByFilter
    } = this.state;
    const haveCandidatesOkOrDeletedDebugFile = candidates.some(candidate => candidate.download.status === sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_15__.CandidateDownloadStatus.OK && candidate.source === _utils__WEBPACK_IMPORTED_MODULE_20__.INTERNAL_SOURCE || candidate.download.status === sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_15__.CandidateDownloadStatus.DELETED);
    const haveCandidatesAtLeastOneAction = haveCandidatesOkOrDeletedDebugFile || hasReprocessWarning;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(Wrapper, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(Header, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(Title, {
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Debug File Candidates'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_12__["default"], {
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.tct)('These are the Debug Information Files (DIFs) corresponding to this image which have been looked up on [docLink:symbol servers] during the processing of the stacktrace.', {
              docLink: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_10__["default"], {
                href: "https://docs.sentry.io/platforms/native/data-management/debug-files/symbol-servers/"
              })
            }),
            size: "xs",
            position: "top",
            isHoverable: true
          })]
        }), !!candidates.length && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(StyledSearchBarAction, {
          query: searchTerm,
          onChange: value => this.handleChangeSearchTerm(value),
          placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Search debug file candidates'),
          filterOptions: filterOptions,
          filterSelections: filterSelections,
          onFilterChange: this.handleChangeFilter
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(StyledPanelTable, {
        headers: haveCandidatesAtLeastOneAction ? [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Status'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Information'), ''] : [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Status'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Information')],
        isEmpty: !filteredCandidatesByFilter.length,
        isLoading: isLoading,
        ...this.getEmptyMessage(),
        children: filteredCandidatesByFilter.map((candidate, index) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(_candidate__WEBPACK_IMPORTED_MODULE_19__["default"], {
          candidate: candidate,
          organization: organization,
          baseUrl: baseUrl,
          projSlug: projSlug,
          eventDateReceived: eventDateReceived,
          hasReprocessWarning: hasReprocessWarning,
          haveCandidatesAtLeastOneAction: haveCandidatesAtLeastOneAction,
          onDelete: onDelete
        }, index))
      })]
    });
  }

}

Candidates.displayName = "Candidates";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Candidates);

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e13bc14a4"
} : 0)( true ? {
  name: "vetbs0",
  styles: "display:grid"
} : 0);

const Header = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e13bc14a3"
} : 0)("display:flex;flex-direction:column;@media (min-width: ", props => props.theme.breakpoints.small, "){flex-wrap:wrap;flex-direction:row;}" + ( true ? "" : 0));

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e13bc14a2"
} : 0)("padding-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(4), ";display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(0.5), ";grid-template-columns:repeat(2, max-content);align-items:center;font-weight:600;color:", p => p.theme.gray400, ";height:32px;flex:1;@media (min-width: ", props => props.theme.breakpoints.small, "){margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), ";}" + ( true ? "" : 0));

const StyledPanelTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels_panelTable__WEBPACK_IMPORTED_MODULE_11__["default"],  true ? {
  target: "e13bc14a1"
} : 0)("grid-template-columns:", p => p.headers.length === 3 ? 'max-content 1fr max-content' : 'max-content 1fr', ";height:100%;@media (min-width: ", props => props.theme.breakpoints.xxlarge, "){overflow:visible;}" + ( true ? "" : 0));

const StyledSearchBarAction = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(_searchBarAction__WEBPACK_IMPORTED_MODULE_17__["default"],  true ? {
  target: "e13bc14a0"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1.5), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/events/interfaces/debugMeta/debugImageDetails/generalInfo.tsx":
/*!**************************************************************************************!*\
  !*** ./app/components/events/interfaces/debugMeta/debugImageDetails/generalInfo.tsx ***!
  \**************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_notAvailable__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/notAvailable */ "./app/components/notAvailable.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _debugImage_processings__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../debugImage/processings */ "./app/components/events/interfaces/debugMeta/debugImage/processings.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../utils */ "./app/components/events/interfaces/debugMeta/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









function GeneralInfo(_ref) {
  let {
    image
  } = _ref;
  const {
    debug_id,
    debug_file,
    code_id,
    code_file,
    arch,
    unwind_status,
    debug_status
  } = image !== null && image !== void 0 ? image : {};
  const imageAddress = image ? (0,_utils__WEBPACK_IMPORTED_MODULE_5__.getImageAddress)(image) : undefined;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(Wrapper, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Label, {
      coloredBg: true,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Address Range')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Value, {
      coloredBg: true,
      children: imageAddress !== null && imageAddress !== void 0 ? imageAddress : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_notAvailable__WEBPACK_IMPORTED_MODULE_1__["default"], {})
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Label, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Debug ID')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Value, {
      children: debug_id !== null && debug_id !== void 0 ? debug_id : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_notAvailable__WEBPACK_IMPORTED_MODULE_1__["default"], {})
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Label, {
      coloredBg: true,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Debug File')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Value, {
      coloredBg: true,
      children: debug_file !== null && debug_file !== void 0 ? debug_file : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_notAvailable__WEBPACK_IMPORTED_MODULE_1__["default"], {})
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Label, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Code ID')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Value, {
      children: code_id !== null && code_id !== void 0 ? code_id : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_notAvailable__WEBPACK_IMPORTED_MODULE_1__["default"], {})
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Label, {
      coloredBg: true,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Code File')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Value, {
      coloredBg: true,
      children: code_file !== null && code_file !== void 0 ? code_file : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_notAvailable__WEBPACK_IMPORTED_MODULE_1__["default"], {})
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Label, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Architecture')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Value, {
      children: arch !== null && arch !== void 0 ? arch : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_notAvailable__WEBPACK_IMPORTED_MODULE_1__["default"], {})
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Label, {
      coloredBg: true,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Processing')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Value, {
      coloredBg: true,
      children: unwind_status || debug_status ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(_debugImage_processings__WEBPACK_IMPORTED_MODULE_4__["default"], {
        unwind_status: unwind_status,
        debug_status: debug_status
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_notAvailable__WEBPACK_IMPORTED_MODULE_1__["default"], {})
    })]
  });
}

GeneralInfo.displayName = "GeneralInfo";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GeneralInfo);

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ef0syc72"
} : 0)( true ? {
  name: "24qvpm",
  styles: "display:grid;grid-template-columns:max-content 1fr"
} : 0);

const Label = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ef0syc71"
} : 0)("color:", p => p.theme.textColor, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(1.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(1), ";", p => p.coloredBg && `background-color: ${p.theme.backgroundSecondary};`, ";" + ( true ? "" : 0));

const Value = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Label,  true ? {
  target: "ef0syc70"
} : 0)("white-space:pre-wrap;word-break:break-all;color:", p => p.theme.subText, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(1), ";font-family:", p => p.theme.text.familyMono, ";", p => p.coloredBg && `background-color: ${p.theme.backgroundSecondary};`, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/events/interfaces/debugMeta/debugImageDetails/index.tsx":
/*!********************************************************************************!*\
  !*** ./app/components/events/interfaces/debugMeta/debugImageDetails/index.tsx ***!
  \********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "modalCss": () => (/* binding */ modalCss)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var lodash_partition__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/partition */ "../node_modules/lodash/partition.js");
/* harmony import */ var lodash_partition__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_partition__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var lodash_sortBy__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/sortBy */ "../node_modules/lodash/sortBy.js");
/* harmony import */ var lodash_sortBy__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_sortBy__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/types/debugFiles */ "./app/types/debugFiles.tsx");
/* harmony import */ var sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/types/debugImage */ "./app/types/debugImage.tsx");
/* harmony import */ var sentry_utils_displayReprocessEventAction__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/displayReprocessEventAction */ "./app/utils/displayReprocessEventAction.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var sentry_views_settings_projectDebugFiles_utils__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/views/settings/projectDebugFiles/utils */ "./app/views/settings/projectDebugFiles/utils.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ../utils */ "./app/components/events/interfaces/debugMeta/utils.tsx");
/* harmony import */ var _candidates__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ./candidates */ "./app/components/events/interfaces/debugMeta/debugImageDetails/candidates.tsx");
/* harmony import */ var _generalInfo__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ./generalInfo */ "./app/components/events/interfaces/debugMeta/debugImageDetails/generalInfo.tsx");
/* harmony import */ var _reprocessAlert__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ./reprocessAlert */ "./app/components/events/interfaces/debugMeta/debugImageDetails/reprocessAlert.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ./utils */ "./app/components/events/interfaces/debugMeta/debugImageDetails/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }
























class DebugImageDetails extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_8__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDelete", async debugId => {
      const {
        organization,
        projSlug
      } = this.props;
      this.setState({
        loading: true
      });

      try {
        await this.api.requestPromise(`/projects/${organization.slug}/${projSlug}/files/dsyms/?id=${debugId}`, {
          method: 'DELETE'
        });
        this.fetchData();
      } catch {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_7__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('An error occurred while deleting the debug file.'));
        this.setState({
          loading: false
        });
      }
    });
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      debugFiles: []
    };
  }

  componentDidUpdate(prevProps, prevState) {
    if (!prevProps.image && !!this.props.image) {
      this.remountComponent();
    }

    super.componentDidUpdate(prevProps, prevState);
  }

  getUplodedDebugFiles(candidates) {
    return candidates.find(candidate => candidate.source === _utils__WEBPACK_IMPORTED_MODULE_22__.INTERNAL_SOURCE);
  }

  getEndpoints() {
    const {
      organization,
      projSlug,
      image
    } = this.props;

    if (!image) {
      return [];
    }

    const {
      debug_id,
      candidates = []
    } = image;
    const uploadedDebugFiles = this.getUplodedDebugFiles(candidates);
    const endpoints = [];

    if (uploadedDebugFiles) {
      endpoints.push(['debugFiles', `/projects/${organization.slug}/${projSlug}/files/dsyms/?debug_id=${debug_id}`, {
        query: {
          file_formats: ['breakpad', 'macho', 'elf', 'pe', 'pdb', 'sourcebundle']
        }
      }]);
    }

    return endpoints;
  }

  sortCandidates(candidates, unAppliedCandidates) {
    const [noPermissionCandidates, restNoPermissionCandidates] = lodash_partition__WEBPACK_IMPORTED_MODULE_5___default()(candidates, candidate => candidate.download.status === sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_14__.CandidateDownloadStatus.NO_PERMISSION);
    const [malFormedCandidates, restMalFormedCandidates] = lodash_partition__WEBPACK_IMPORTED_MODULE_5___default()(restNoPermissionCandidates, candidate => candidate.download.status === sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_14__.CandidateDownloadStatus.MALFORMED);
    const [errorCandidates, restErrorCandidates] = lodash_partition__WEBPACK_IMPORTED_MODULE_5___default()(restMalFormedCandidates, candidate => candidate.download.status === sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_14__.CandidateDownloadStatus.ERROR);
    const [okCandidates, restOKCandidates] = lodash_partition__WEBPACK_IMPORTED_MODULE_5___default()(restErrorCandidates, candidate => candidate.download.status === sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_14__.CandidateDownloadStatus.OK);
    const [deletedCandidates, notFoundCandidates] = lodash_partition__WEBPACK_IMPORTED_MODULE_5___default()(restOKCandidates, candidate => candidate.download.status === sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_14__.CandidateDownloadStatus.DELETED);
    return [...lodash_sortBy__WEBPACK_IMPORTED_MODULE_6___default()(noPermissionCandidates, ['source_name', 'location']), ...lodash_sortBy__WEBPACK_IMPORTED_MODULE_6___default()(malFormedCandidates, ['source_name', 'location']), ...lodash_sortBy__WEBPACK_IMPORTED_MODULE_6___default()(errorCandidates, ['source_name', 'location']), ...lodash_sortBy__WEBPACK_IMPORTED_MODULE_6___default()(okCandidates, ['source_name', 'location']), ...lodash_sortBy__WEBPACK_IMPORTED_MODULE_6___default()(deletedCandidates, ['source_name', 'location']), ...lodash_sortBy__WEBPACK_IMPORTED_MODULE_6___default()(unAppliedCandidates, ['source_name', 'location']), ...lodash_sortBy__WEBPACK_IMPORTED_MODULE_6___default()(notFoundCandidates, ['source_name', 'location'])];
  }

  getCandidates() {
    const {
      debugFiles,
      loading
    } = this.state;
    const {
      image
    } = this.props;
    const {
      candidates = []
    } = image !== null && image !== void 0 ? image : {};

    if (!debugFiles || loading) {
      return candidates;
    }

    const debugFileCandidates = candidates.map(_ref => {
      let {
        location,
        ...candidate
      } = _ref;
      return { ...candidate,
        location: location !== null && location !== void 0 && location.includes(_utils__WEBPACK_IMPORTED_MODULE_22__.INTERNAL_SOURCE_LOCATION) ? location.split(_utils__WEBPACK_IMPORTED_MODULE_22__.INTERNAL_SOURCE_LOCATION)[1] : location
      };
    });
    const candidateLocations = new Set(debugFileCandidates.map(_ref2 => {
      let {
        location
      } = _ref2;
      return location;
    }).filter(location => !!location));
    const [unAppliedDebugFiles, appliedDebugFiles] = lodash_partition__WEBPACK_IMPORTED_MODULE_5___default()(debugFiles, debugFile => !candidateLocations.has(debugFile.id));
    const unAppliedCandidates = unAppliedDebugFiles.map(debugFile => {
      var _data$features;

      const {
        data,
        symbolType,
        objectName: filename,
        id: location,
        size,
        dateCreated,
        cpuName
      } = debugFile;
      const features = (_data$features = data === null || data === void 0 ? void 0 : data.features) !== null && _data$features !== void 0 ? _data$features : [];
      return {
        download: {
          status: sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_14__.CandidateDownloadStatus.UNAPPLIED,
          features: {
            has_sources: features.includes(sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_13__.DebugFileFeature.SOURCES),
            has_debug_info: features.includes(sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_13__.DebugFileFeature.DEBUG),
            has_unwind_info: features.includes(sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_13__.DebugFileFeature.UNWIND),
            has_symbols: features.includes(sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_13__.DebugFileFeature.SYMTAB)
          }
        },
        cpuName,
        location,
        filename,
        size,
        dateCreated,
        symbolType,
        fileType: (0,sentry_views_settings_projectDebugFiles_utils__WEBPACK_IMPORTED_MODULE_17__.getFileType)(debugFile),
        source: _utils__WEBPACK_IMPORTED_MODULE_22__.INTERNAL_SOURCE,
        source_name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Sentry')
      };
    });
    const [debugFileInternalOkCandidates, debugFileOtherCandidates] = lodash_partition__WEBPACK_IMPORTED_MODULE_5___default()(debugFileCandidates, debugFileCandidate => debugFileCandidate.download.status === sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_14__.CandidateDownloadStatus.OK && debugFileCandidate.source === _utils__WEBPACK_IMPORTED_MODULE_22__.INTERNAL_SOURCE);
    const convertedDebugFileInternalOkCandidates = debugFileInternalOkCandidates.map(debugFileOkCandidate => {
      const internalDebugFileInfo = appliedDebugFiles.find(appliedDebugFile => appliedDebugFile.id === debugFileOkCandidate.location);

      if (!internalDebugFileInfo) {
        return { ...debugFileOkCandidate,
          download: { ...debugFileOkCandidate.download,
            status: sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_14__.CandidateDownloadStatus.DELETED
          }
        };
      }

      const {
        symbolType,
        objectName: filename,
        id: location,
        size,
        dateCreated,
        cpuName
      } = internalDebugFileInfo;
      return { ...debugFileOkCandidate,
        cpuName,
        location,
        filename,
        size,
        dateCreated,
        symbolType,
        fileType: (0,sentry_views_settings_projectDebugFiles_utils__WEBPACK_IMPORTED_MODULE_17__.getFileType)(internalDebugFileInfo)
      };
    });
    return this.sortCandidates([...convertedDebugFileInternalOkCandidates, ...debugFileOtherCandidates], unAppliedCandidates);
  }

  getDebugFilesSettingsLink() {
    const {
      organization,
      projSlug,
      image
    } = this.props;
    const orgSlug = organization.slug;
    const debugId = image === null || image === void 0 ? void 0 : image.debug_id;

    if (!orgSlug || !projSlug || !debugId) {
      return undefined;
    }

    return `/settings/${orgSlug}/projects/${projSlug}/debug-symbols/?query=${debugId}`;
  }

  renderBody() {
    const {
      Header,
      Body,
      Footer,
      image,
      organization,
      projSlug,
      event,
      onReprocessEvent
    } = this.props;
    const {
      loading
    } = this.state;
    const {
      code_file,
      status
    } = image !== null && image !== void 0 ? image : {};
    const debugFilesSettingsLink = this.getDebugFilesSettingsLink();
    const candidates = this.getCandidates();
    const baseUrl = this.api.baseUrl;
    const fileName = (0,_utils__WEBPACK_IMPORTED_MODULE_18__.getFileName)(code_file);
    const haveCandidatesUnappliedDebugFile = candidates.some(candidate => candidate.download.status === sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_14__.CandidateDownloadStatus.UNAPPLIED);
    const hasReprocessWarning = haveCandidatesUnappliedDebugFile && (0,sentry_utils_displayReprocessEventAction__WEBPACK_IMPORTED_MODULE_15__.displayReprocessEventAction)(organization.features, event) && !!onReprocessEvent;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(Header, {
        closeButton: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(Title, {
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Image'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(FileName, {
            children: fileName !== null && fileName !== void 0 ? fileName : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Unknown')
          })]
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(Body, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(Content, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(_generalInfo__WEBPACK_IMPORTED_MODULE_20__["default"], {
            image: image
          }), hasReprocessWarning && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(_reprocessAlert__WEBPACK_IMPORTED_MODULE_21__["default"], {
            api: this.api,
            orgSlug: organization.slug,
            projSlug: projSlug,
            eventId: event.id,
            onReprocessEvent: onReprocessEvent
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(_candidates__WEBPACK_IMPORTED_MODULE_19__["default"], {
            imageStatus: status,
            candidates: candidates,
            organization: organization,
            projSlug: projSlug,
            baseUrl: baseUrl,
            isLoading: loading,
            eventDateReceived: event.dateReceived,
            onDelete: this.handleDelete,
            hasReprocessWarning: hasReprocessWarning
          })]
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(Footer, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(StyledButtonBar, {
          gap: 1,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_9__["default"], {
            href: "https://docs.sentry.io/platforms/native/data-management/debug-files/",
            external: true,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Read the docs')
          }), debugFilesSettingsLink && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_9__["default"], {
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Search for this debug file in all images for the %s project', projSlug),
            to: debugFilesSettingsLink,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Open in Settings')
          })]
        })
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DebugImageDetails);

const Content = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1k6huf23"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(3), ";font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1k6huf22"
} : 0)("display:grid;grid-template-columns:max-content 1fr;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";align-items:center;font-size:", p => p.theme.fontSizeExtraLarge, ";max-width:calc(100% - 40px);word-break:break-all;" + ( true ? "" : 0));

const FileName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e1k6huf21"
} : 0)("font-family:", p => p.theme.text.familyMono, ";" + ( true ? "" : 0));

const StyledButtonBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "e1k6huf20"
} : 0)( true ? {
  name: "1bmnxg7",
  styles: "white-space:nowrap"
} : 0);

const modalCss = /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_24__.css)("[role='document']{overflow:initial;}@media (min-width: ", sentry_utils_theme__WEBPACK_IMPORTED_MODULE_16__["default"].breakpoints.small, "){width:90%;}@media (min-width: ", sentry_utils_theme__WEBPACK_IMPORTED_MODULE_16__["default"].breakpoints.xlarge, "){width:70%;}@media (min-width: ", sentry_utils_theme__WEBPACK_IMPORTED_MODULE_16__["default"].breakpoints.xxlarge, "){width:50%;}" + ( true ? "" : 0),  true ? "" : 0);

/***/ }),

/***/ "./app/components/events/interfaces/debugMeta/debugImageDetails/reprocessAlert.tsx":
/*!*****************************************************************************************!*\
  !*** ./app/components/events/interfaces/debugMeta/debugImageDetails/reprocessAlert.tsx ***!
  \*****************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_alertLink__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/alertLink */ "./app/components/alertLink.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






var ReprocessableEventReason;

(function (ReprocessableEventReason) {
  ReprocessableEventReason["UNPROCESSED_EVENT_NOT_FOUND"] = "unprocessed_event.not_found";
  ReprocessableEventReason["EVENT_NOT_FOUND"] = "event.not_found";
  ReprocessableEventReason["ATTACHMENT_NOT_FOUND"] = "attachment.not_found";
})(ReprocessableEventReason || (ReprocessableEventReason = {}));

function ReprocessAlert(_ref) {
  let {
    onReprocessEvent,
    api,
    orgSlug,
    projSlug,
    eventId
  } = _ref;
  const [reprocessableEvent, setReprocessableEvent] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)();
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    checkEventReprocessable();
  }, []);

  async function checkEventReprocessable() {
    try {
      const response = await api.requestPromise(`/projects/${orgSlug}/${projSlug}/events/${eventId}/reprocessable/`);
      setReprocessableEvent(response);
    } catch {// do nothing
    }
  }

  if (!reprocessableEvent) {
    return null;
  }

  const {
    reprocessable,
    reason
  } = reprocessableEvent;

  if (reprocessable) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_alertLink__WEBPACK_IMPORTED_MODULE_4__["default"], {
      priority: "warning",
      size: "small",
      onClick: onReprocessEvent,
      withoutMarginBottom: true,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('You’ve uploaded new debug files. Reprocess events in this issue to view a better stack trace')
    });
  }

  function getAlertInfoMessage() {
    switch (reason) {
      case ReprocessableEventReason.EVENT_NOT_FOUND:
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('This event cannot be reprocessed because the event has not been found');

      case ReprocessableEventReason.ATTACHMENT_NOT_FOUND:
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('This event cannot be reprocessed because a required attachment is missing');

      case ReprocessableEventReason.UNPROCESSED_EVENT_NOT_FOUND:
      default:
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('This event cannot be reprocessed');
    }
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(StyledAlert, {
    type: "info",
    children: getAlertInfoMessage()
  });
}

ReprocessAlert.displayName = "ReprocessAlert";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReprocessAlert);

const StyledAlert = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "eveg1ko0"
} : 0)( true ? {
  name: "1ykowef",
  styles: "margin-bottom:0"
} : 0);

/***/ }),

/***/ "./app/components/events/interfaces/debugMeta/debugImageDetails/utils.tsx":
/*!********************************************************************************!*\
  !*** ./app/components/events/interfaces/debugMeta/debugImageDetails/utils.tsx ***!
  \********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "INTERNAL_SOURCE": () => (/* binding */ INTERNAL_SOURCE),
/* harmony export */   "INTERNAL_SOURCE_LOCATION": () => (/* binding */ INTERNAL_SOURCE_LOCATION)
/* harmony export */ });
const INTERNAL_SOURCE = 'sentry:project';
const INTERNAL_SOURCE_LOCATION = 'sentry://project_debug_file/';

/***/ }),

/***/ "./app/types/debugFiles.tsx":
/*!**********************************!*\
  !*** ./app/types/debugFiles.tsx ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CustomRepoType": () => (/* binding */ CustomRepoType),
/* harmony export */   "DebugFileFeature": () => (/* binding */ DebugFileFeature),
/* harmony export */   "DebugFileType": () => (/* binding */ DebugFileType)
/* harmony export */ });
let DebugFileType;

(function (DebugFileType) {
  DebugFileType["EXE"] = "exe";
  DebugFileType["DBG"] = "dbg";
  DebugFileType["LIB"] = "lib";
})(DebugFileType || (DebugFileType = {}));

let DebugFileFeature;

(function (DebugFileFeature) {
  DebugFileFeature["SYMTAB"] = "symtab";
  DebugFileFeature["DEBUG"] = "debug";
  DebugFileFeature["UNWIND"] = "unwind";
  DebugFileFeature["SOURCES"] = "sources";
})(DebugFileFeature || (DebugFileFeature = {}));

// Custom Repository
let CustomRepoType;

(function (CustomRepoType) {
  CustomRepoType["HTTP"] = "http";
  CustomRepoType["S3"] = "s3";
  CustomRepoType["GCS"] = "gcs";
  CustomRepoType["APP_STORE_CONNECT"] = "appStoreConnect";
})(CustomRepoType || (CustomRepoType = {}));

/***/ }),

/***/ "./app/utils/displayReprocessEventAction.tsx":
/*!***************************************************!*\
  !*** ./app/utils/displayReprocessEventAction.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "displayReprocessEventAction": () => (/* binding */ displayReprocessEventAction)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");



const NATIVE_PLATFORMS = ['cocoa', 'native']; // Finds all frames in a given data blob and returns it's platforms

function getPlatforms(exceptionValue) {
  var _exceptionValue$frame, _stacktrace$frames, _stacktrace;

  const frames = (_exceptionValue$frame = exceptionValue === null || exceptionValue === void 0 ? void 0 : exceptionValue.frames) !== null && _exceptionValue$frame !== void 0 ? _exceptionValue$frame : [];
  const stacktraceFrames = (_stacktrace$frames = exceptionValue === null || exceptionValue === void 0 ? void 0 : (_stacktrace = exceptionValue.stacktrace) === null || _stacktrace === void 0 ? void 0 : _stacktrace.frames) !== null && _stacktrace$frames !== void 0 ? _stacktrace$frames : [];

  if (!frames.length && !stacktraceFrames.length) {
    return [];
  }

  return [...frames, ...stacktraceFrames].map(frame => frame.platform).filter(platform => !!platform);
}

function getStackTracePlatforms(event, exceptionEntry) {
  var _exceptionEntry$data$, _event$entries$find$d, _event$entries$find, _event$entries$find$d2, _event$entries$find2;

  // Fetch platforms in stack traces of an exception entry
  const exceptionEntryPlatforms = ((_exceptionEntry$data$ = exceptionEntry.data.values) !== null && _exceptionEntry$data$ !== void 0 ? _exceptionEntry$data$ : []).flatMap(getPlatforms); // Fetch platforms in an exception entry

  const stackTraceEntry = (_event$entries$find$d = (_event$entries$find = event.entries.find(entry => entry.type === sentry_types__WEBPACK_IMPORTED_MODULE_2__.EntryType.STACKTRACE)) === null || _event$entries$find === void 0 ? void 0 : _event$entries$find.data) !== null && _event$entries$find$d !== void 0 ? _event$entries$find$d : {}; // Fetch platforms in an exception entry

  const stackTraceEntryPlatforms = Object.keys(stackTraceEntry).flatMap(key => getPlatforms(stackTraceEntry[key])); // Fetch platforms in an thread entry

  const threadEntry = (_event$entries$find$d2 = (_event$entries$find2 = event.entries.find(entry => entry.type === sentry_types__WEBPACK_IMPORTED_MODULE_2__.EntryType.THREADS)) === null || _event$entries$find2 === void 0 ? void 0 : _event$entries$find2.data.values) !== null && _event$entries$find$d2 !== void 0 ? _event$entries$find$d2 : []; // Fetch platforms in a thread entry

  const threadEntryPlatforms = threadEntry.flatMap(_ref => {
    let {
      stacktrace
    } = _ref;
    return getPlatforms(stacktrace);
  });
  return new Set([...exceptionEntryPlatforms, ...stackTraceEntryPlatforms, ...threadEntryPlatforms]);
} // Checks whether an event indicates that it is a native event.


function isNativeEvent(event, exceptionEntry) {
  const {
    platform
  } = event;

  if (platform && NATIVE_PLATFORMS.includes(platform)) {
    return true;
  }

  const stackTracePlatforms = getStackTracePlatforms(event, exceptionEntry);
  return NATIVE_PLATFORMS.some(nativePlatform => stackTracePlatforms.has(nativePlatform));
} //  Checks whether an event indicates that it has an associated minidump.


function isMinidumpEvent(exceptionEntry) {
  var _data$values;

  const {
    data
  } = exceptionEntry;
  return ((_data$values = data.values) !== null && _data$values !== void 0 ? _data$values : []).some(value => {
    var _value$mechanism;

    return ((_value$mechanism = value.mechanism) === null || _value$mechanism === void 0 ? void 0 : _value$mechanism.type) === 'minidump';
  });
} // Checks whether an event indicates that it has an apple crash report.


function isAppleCrashReportEvent(exceptionEntry) {
  var _data$values2;

  const {
    data
  } = exceptionEntry;
  return ((_data$values2 = data.values) !== null && _data$values2 !== void 0 ? _data$values2 : []).some(value => {
    var _value$mechanism2;

    return ((_value$mechanism2 = value.mechanism) === null || _value$mechanism2 === void 0 ? void 0 : _value$mechanism2.type) === 'applecrashreport';
  });
}

function displayReprocessEventAction(orgFeatures, event) {
  if (!event || !orgFeatures.includes('reprocessing-v2')) {
    return false;
  }

  const {
    entries
  } = event;
  const exceptionEntry = entries.find(entry => entry.type === sentry_types__WEBPACK_IMPORTED_MODULE_2__.EntryType.EXCEPTION);

  if (!exceptionEntry) {
    return false;
  } // We want to show the reprocessing button if the issue in question is native or contains native frames.
  // The logic is taken from the symbolication pipeline in Python, where it is used to determine whether reprocessing
  // payloads should be stored:
  // https://github.com/getsentry/sentry/blob/cb7baef414890336881d67b7a8433ee47198c701/src/sentry/lang/native/processing.py#L425-L426
  // It is still not ideal as one can always merge native and non-native events together into one issue,
  // but it's the best approximation we have.


  if (!isMinidumpEvent(exceptionEntry) && !isAppleCrashReportEvent(exceptionEntry) && !isNativeEvent(event, exceptionEntry)) {
    return false;
  }

  return true;
}

/***/ }),

/***/ "./app/views/settings/projectDebugFiles/utils.tsx":
/*!********************************************************!*\
  !*** ./app/views/settings/projectDebugFiles/utils.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getFeatureTooltip": () => (/* binding */ getFeatureTooltip),
/* harmony export */   "getFileType": () => (/* binding */ getFileType)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/types/debugFiles */ "./app/types/debugFiles.tsx");


function getFileType(dsym) {
  var _dsym$data;

  switch ((_dsym$data = dsym.data) === null || _dsym$data === void 0 ? void 0 : _dsym$data.type) {
    case sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_1__.DebugFileType.EXE:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('executable');

    case sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_1__.DebugFileType.DBG:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('debug companion');

    case sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_1__.DebugFileType.LIB:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('dynamic library');

    default:
      return null;
  }
}
function getFeatureTooltip(feature) {
  switch (feature) {
    case sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_1__.DebugFileFeature.SYMTAB:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Symbol tables are used as a fallback when full debug information is not available');

    case sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_1__.DebugFileFeature.DEBUG:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Debug information provides function names and resolves inlined frames during symbolication');

    case sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_1__.DebugFileFeature.UNWIND:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Stack unwinding information improves the quality of stack traces extracted from minidumps');

    case sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_1__.DebugFileFeature.SOURCES:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Source code information allows Sentry to display source code context for stack frames');

    default:
      return null;
  }
}

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_events_interfaces_debugMeta_debugImageDetails_index_tsx.36e5bc13b28ac9e85ac41f8915064faf.js.map