"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_actionCreators_release_tsx-app_views_organizationActivity_index_tsx"],{

/***/ "./app/actionCreators/release.tsx":
/*!****************************************!*\
  !*** ./app/actionCreators/release.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "archiveRelease": () => (/* binding */ archiveRelease),
/* harmony export */   "getProjectRelease": () => (/* binding */ getProjectRelease),
/* harmony export */   "getReleaseDeploys": () => (/* binding */ getReleaseDeploys),
/* harmony export */   "restoreRelease": () => (/* binding */ restoreRelease)
/* harmony export */ });
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actions/releaseActions */ "./app/actions/releaseActions.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_releaseStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/releaseStore */ "./app/stores/releaseStore.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");






function getProjectRelease(api, params) {
  const {
    orgSlug,
    projectSlug,
    releaseVersion
  } = params;
  const path = `/projects/${orgSlug}/${projectSlug}/releases/${encodeURIComponent(releaseVersion)}/`; // HACK(leedongwei): Actions fired by the ActionCreators are queued to
  // the back of the event loop, allowing another getRelease for the same
  // release to be fired before the loading state is updated in store.
  // This hack short-circuits that and update the state immediately.

  sentry_stores_releaseStore__WEBPACK_IMPORTED_MODULE_3__["default"].state.releaseLoading[(0,sentry_stores_releaseStore__WEBPACK_IMPORTED_MODULE_3__.getReleaseStoreKey)(projectSlug, releaseVersion)] = true;
  sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadRelease(orgSlug, projectSlug, releaseVersion);
  return api.requestPromise(path, {
    method: 'GET'
  }).then(res => {
    sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadReleaseSuccess(projectSlug, releaseVersion, res);
  }).catch(err => {
    // This happens when a Project is not linked to a specific Release
    if (err.status === 404) {
      sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadReleaseSuccess(projectSlug, releaseVersion, null);
      return;
    }

    sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadReleaseError(projectSlug, releaseVersion, err);
    _sentry_react__WEBPACK_IMPORTED_MODULE_5__.withScope(scope => {
      scope.setLevel('warning');
      scope.setFingerprint(['getRelease-action-creator']);
      _sentry_react__WEBPACK_IMPORTED_MODULE_5__.captureException(err);
    });
  });
}
function getReleaseDeploys(api, params) {
  const {
    orgSlug,
    projectSlug,
    releaseVersion
  } = params;
  const path = `/organizations/${orgSlug}/releases/${encodeURIComponent(releaseVersion)}/deploys/`; // HACK(leedongwei): Same as above

  sentry_stores_releaseStore__WEBPACK_IMPORTED_MODULE_3__["default"].state.deploysLoading[(0,sentry_stores_releaseStore__WEBPACK_IMPORTED_MODULE_3__.getReleaseStoreKey)(projectSlug, releaseVersion)] = true;
  sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadDeploys(orgSlug, projectSlug, releaseVersion);
  return api.requestPromise(path, {
    method: 'GET'
  }).then(res => {
    sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadDeploysSuccess(projectSlug, releaseVersion, res);
  }).catch(err => {
    // This happens when a Project is not linked to a specific Release
    if (err.status === 404) {
      sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadDeploysSuccess(projectSlug, releaseVersion, null);
      return;
    }

    sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadDeploysError(projectSlug, releaseVersion, err);
    _sentry_react__WEBPACK_IMPORTED_MODULE_5__.withScope(scope => {
      scope.setLevel('warning');
      scope.setFingerprint(['getReleaseDeploys-action-creator']);
      _sentry_react__WEBPACK_IMPORTED_MODULE_5__.captureException(err);
    });
  });
}
function archiveRelease(api, params) {
  const {
    orgSlug,
    projectSlug,
    releaseVersion
  } = params;
  sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadRelease(orgSlug, projectSlug, releaseVersion);
  (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Archiving Release\u2026'));
  return api.requestPromise(`/organizations/${orgSlug}/releases/`, {
    method: 'POST',
    data: {
      status: sentry_types__WEBPACK_IMPORTED_MODULE_4__.ReleaseStatus.Archived,
      projects: [],
      version: releaseVersion
    }
  }).then(release => {
    sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadReleaseSuccess(projectSlug, releaseVersion, release);
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Release was successfully archived.'));
  }).catch(error => {
    var _error$responseJSON$d, _error$responseJSON;

    sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadReleaseError(projectSlug, releaseVersion, error);
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addErrorMessage)((_error$responseJSON$d = (_error$responseJSON = error.responseJSON) === null || _error$responseJSON === void 0 ? void 0 : _error$responseJSON.detail) !== null && _error$responseJSON$d !== void 0 ? _error$responseJSON$d : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Release could not be be archived.'));
    throw error;
  });
}
function restoreRelease(api, params) {
  const {
    orgSlug,
    projectSlug,
    releaseVersion
  } = params;
  sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadRelease(orgSlug, projectSlug, releaseVersion);
  (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Restoring Release\u2026'));
  return api.requestPromise(`/organizations/${orgSlug}/releases/`, {
    method: 'POST',
    data: {
      status: sentry_types__WEBPACK_IMPORTED_MODULE_4__.ReleaseStatus.Active,
      projects: [],
      version: releaseVersion
    }
  }).then(release => {
    sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadReleaseSuccess(projectSlug, releaseVersion, release);
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Release was successfully restored.'));
  }).catch(error => {
    var _error$responseJSON$d2, _error$responseJSON2;

    sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadReleaseError(projectSlug, releaseVersion, error);
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addErrorMessage)((_error$responseJSON$d2 = (_error$responseJSON2 = error.responseJSON) === null || _error$responseJSON2 === void 0 ? void 0 : _error$responseJSON2.detail) !== null && _error$responseJSON$d2 !== void 0 ? _error$responseJSON$d2 : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Release could not be be restored.'));
    throw error;
  });
}

/***/ }),

/***/ "./app/actions/releaseActions.tsx":
/*!****************************************!*\
  !*** ./app/actions/releaseActions.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);

const ReleaseActions = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createActions)(['loadRelease', // Singular as it loads 1 release
'loadReleaseError', 'loadReleaseSuccess', 'loadDeploys', // Plural as it loads all deploys related to a release
'loadDeploysError', 'loadDeploysSuccess']);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReleaseActions);

/***/ }),

/***/ "./app/components/activity/item/avatar.tsx":
/*!*************************************************!*\
  !*** ./app/components/activity/item/avatar.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/avatar/userAvatar */ "./app/components/avatar/userAvatar.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






function ActivityAvatar(_ref) {
  let {
    className,
    type,
    user,
    size = 38
  } = _ref;

  if (user) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_1__["default"], {
      user: user,
      size: size,
      className: className
    });
  }

  if (type === 'system') {
    // Return Sentry avatar
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(SystemAvatar, {
      className: className,
      size: size,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(StyledIconSentry, {
        size: "md"
      })
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_2__["default"], {
    className: className,
    width: `${size}px`,
    height: `${size}px`,
    shape: "circle"
  });
}

ActivityAvatar.displayName = "ActivityAvatar";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ActivityAvatar);

const SystemAvatar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "ety7k0b1"
} : 0)("display:flex;justify-content:center;align-items:center;width:", p => p.size, "px;height:", p => p.size, "px;background-color:", p => p.theme.textColor, ";color:", p => p.theme.background, ";border-radius:50%;" + ( true ? "" : 0));

const StyledIconSentry = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconSentry,  true ? {
  target: "ety7k0b0"
} : 0)( true ? {
  name: "1p2ly5v",
  styles: "padding-bottom:3px"
} : 0);

/***/ }),

/***/ "./app/components/commitLink.tsx":
/*!***************************************!*\
  !*** ./app/components/commitLink.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








// TODO(epurkhiser, jess): This should be moved into plugins.
const SUPPORTED_PROVIDERS = [{
  icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconGithub, {
    size: "xs"
  }),
  providerIds: ['github', 'integrations:github', 'integrations:github_enterprise'],
  commitUrl: _ref => {
    let {
      baseUrl,
      commitId
    } = _ref;
    return `${baseUrl}/commit/${commitId}`;
  }
}, {
  icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconBitbucket, {
    size: "xs"
  }),
  providerIds: ['bitbucket', 'integrations:bitbucket'],
  commitUrl: _ref2 => {
    let {
      baseUrl,
      commitId
    } = _ref2;
    return `${baseUrl}/commits/${commitId}`;
  }
}, {
  icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconVsts, {
    size: "xs"
  }),
  providerIds: ['visualstudio', 'integrations:vsts'],
  commitUrl: _ref3 => {
    let {
      baseUrl,
      commitId
    } = _ref3;
    return `${baseUrl}/commit/${commitId}`;
  }
}, {
  icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconGitlab, {
    size: "xs"
  }),
  providerIds: ['gitlab', 'integrations:gitlab'],
  commitUrl: _ref4 => {
    let {
      baseUrl,
      commitId
    } = _ref4;
    return `${baseUrl}/commit/${commitId}`;
  }
}];

function CommitLink(_ref5) {
  let {
    inline,
    commitId,
    repository,
    showIcon = true
  } = _ref5;

  if (!commitId || !repository) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("span", {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Unknown Commit')
    });
  }

  const shortId = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_5__.getShortCommitHash)(commitId);
  const providerData = SUPPORTED_PROVIDERS.find(provider => {
    if (!repository.provider) {
      return false;
    }

    return provider.providerIds.includes(repository.provider.id);
  });

  if (providerData === undefined) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("span", {
      children: shortId
    });
  }

  const commitUrl = repository.url && providerData.commitUrl({
    commitId,
    baseUrl: repository.url
  });
  return !inline ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"], {
    external: true,
    href: commitUrl,
    size: "sm",
    icon: showIcon ? providerData.icon : null,
    children: shortId
  }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_2__["default"], {
    href: commitUrl,
    children: [showIcon ? providerData.icon : null, ' ' + shortId]
  });
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (CommitLink);

/***/ }),

/***/ "./app/components/events/errorLevel.tsx":
/*!**********************************************!*\
  !*** ./app/components/events/errorLevel.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");

const DEFAULT_SIZE = '13px';

const ErrorLevel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e145dcfe0"
} : 0)("padding:0;position:relative;width:", p => p.size || DEFAULT_SIZE, ";height:", p => p.size || DEFAULT_SIZE, ";text-indent:-9999em;display:inline-block;border-radius:50%;flex-shrink:0;background-color:", p => p.level ? p.theme.level[p.level] : p.theme.level.error, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ErrorLevel);

/***/ }),

/***/ "./app/components/events/eventMessage.tsx":
/*!************************************************!*\
  !*** ./app/components/events/eventMessage.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_events_errorLevel__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/events/errorLevel */ "./app/components/events/errorLevel.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






const BaseEventMessage = _ref => {
  let {
    className,
    level,
    levelIndicatorSize,
    message,
    annotations
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
    className: className,
    children: [level && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(StyledErrorLevel, {
      size: levelIndicatorSize,
      level: level,
      children: level
    }), message && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Message, {
      children: message
    }), annotations]
  });
};

BaseEventMessage.displayName = "BaseEventMessage";

const EventMessage = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(BaseEventMessage,  true ? {
  target: "e1rp796r2"
} : 0)( true ? {
  name: "1go2o7p",
  styles: "display:flex;align-items:center;position:relative;line-height:1.2;overflow:hidden"
} : 0);

const StyledErrorLevel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_events_errorLevel__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "e1rp796r1"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), ";" + ( true ? "" : 0));

const Message = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1rp796r0"
} : 0)(p => p.theme.overflowEllipsis, " width:auto;max-height:38px;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EventMessage);

/***/ }),

/***/ "./app/components/issueLink.tsx":
/*!**************************************!*\
  !*** ./app/components/issueLink.tsx ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! classnames */ "../node_modules/classnames/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(classnames__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_components_count__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/count */ "./app/components/count.tsx");
/* harmony import */ var sentry_components_eventOrGroupTitle__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/eventOrGroupTitle */ "./app/components/eventOrGroupTitle.tsx");
/* harmony import */ var sentry_components_events_eventAnnotation__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/events/eventAnnotation */ "./app/components/events/eventAnnotation.tsx");
/* harmony import */ var sentry_components_events_eventMessage__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/events/eventMessage */ "./app/components/events/eventMessage.tsx");
/* harmony import */ var sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/hovercard */ "./app/components/hovercard.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_events__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/events */ "./app/utils/events.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }
















const IssueLink = _ref => {
  let {
    children,
    orgId,
    issue,
    to,
    card = true
  } = _ref;

  if (!card) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__["default"], {
      to: to,
      children: children
    });
  }

  const message = (0,sentry_utils_events__WEBPACK_IMPORTED_MODULE_12__.getMessage)(issue);
  const className = classnames__WEBPACK_IMPORTED_MODULE_2___default()({
    isBookmarked: issue.isBookmarked,
    hasSeen: issue.hasSeen,
    isResolved: issue.status === 'resolved'
  });
  const streamPath = `/organizations/${orgId}/issues/`;

  const hovercardBody = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)("div", {
    className: className,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(Section, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(Title, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_eventOrGroupTitle__WEBPACK_IMPORTED_MODULE_4__["default"], {
          data: issue
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(HovercardEventMessage, {
        level: issue.level,
        levelIndicatorSize: "9px",
        message: message,
        annotations: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
          children: [issue.logger && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_events_eventAnnotation__WEBPACK_IMPORTED_MODULE_5__["default"], {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__["default"], {
              to: {
                pathname: streamPath,
                query: {
                  query: `logger:${issue.logger}`
                }
              },
              children: issue.logger
            })
          }), issue.annotations.map((annotation, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_events_eventAnnotation__WEBPACK_IMPORTED_MODULE_5__["default"], {
            dangerouslySetInnerHTML: {
              __html: annotation
            }
          }, i))]
        })
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(Grid, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)("div", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(GridHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('First Seen')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(StyledTimeSince, {
          date: issue.firstSeen
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)("div", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(GridHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Last Seen')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(StyledTimeSince, {
          date: issue.lastSeen
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)("div", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(GridHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Occurrences')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_3__["default"], {
          value: issue.count
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)("div", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(GridHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Users Affected')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_3__["default"], {
          value: issue.userCount
        })]
      })]
    })]
  });

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_7__.Hovercard, {
    body: hovercardBody,
    header: issue.shortId,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__["default"], {
      to: to,
      children: children
    })
  });
};

IssueLink.displayName = "IssueLink";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (IssueLink);

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('h3',  true ? {
  target: "e12d9cgd5"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";margin:0 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(0.5), ";", p => p.theme.overflowEllipsis, ";em{font-style:normal;font-weight:400;color:", p => p.theme.gray300, ";font-size:90%;}" + ( true ? "" : 0));

const Section = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('section',  true ? {
  target: "e12d9cgd4"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(2), ";" + ( true ? "" : 0));

const Grid = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e12d9cgd3"
} : 0)("display:grid;grid-template-columns:1fr 1fr;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(2), ";" + ( true ? "" : 0));

const HovercardEventMessage = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_events_eventMessage__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e12d9cgd2"
} : 0)( true ? {
  name: "rnnx2x",
  styles: "font-size:12px"
} : 0);

const GridHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('h5',  true ? {
  target: "e12d9cgd1"
} : 0)("color:", p => p.theme.gray300, ";font-size:11px;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(0.5), ";text-transform:uppercase;" + ( true ? "" : 0));

const StyledTimeSince = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "e12d9cgd0"
} : 0)( true ? {
  name: "opde7s",
  styles: "color:inherit"
} : 0);

/***/ }),

/***/ "./app/components/pullRequestLink.tsx":
/*!********************************************!*\
  !*** ./app/components/pullRequestLink.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









function renderIcon(repo) {
  if (!repo.provider) {
    return null;
  }

  const {
    id
  } = repo.provider;
  const providerId = id.includes(':') ? id.split(':').pop() : id;

  switch (providerId) {
    case 'github':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_4__.IconGithub, {
        size: "xs",
        "data-test-id": "pull-request-github"
      });

    case 'gitlab':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_4__.IconGitlab, {
        size: "xs",
        "data-test-id": "pull-request-gitlab"
      });

    case 'bitbucket':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_4__.IconBitbucket, {
        size: "xs"
      });

    default:
      return null;
  }
}

function PullRequestLink(_ref) {
  let {
    pullRequest,
    repository,
    inline
  } = _ref;
  const displayId = `${repository.name} #${pullRequest.id}: ${pullRequest.title}`;

  if (!pullRequest.externalUrl) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("span", {
      children: displayId
    });
  }

  return !inline ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
    external: true,
    href: pullRequest.externalUrl,
    size: "sm",
    icon: renderIcon(repository),
    children: displayId
  }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(ExternalPullLink, {
    href: pullRequest.externalUrl,
    children: [renderIcon(repository), displayId]
  });
}

const ExternalPullLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e10ywx4z0"
} : 0)("display:inline-flex;align-items:center;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(0.5), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PullRequestLink);

/***/ }),

/***/ "./app/stores/releaseStore.tsx":
/*!*************************************!*\
  !*** ./app/stores/releaseStore.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "getReleaseStoreKey": () => (/* binding */ getReleaseStoreKey)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_actions_organizationActions__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actions/organizationActions */ "./app/actions/organizationActions.tsx");
/* harmony import */ var sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actions/releaseActions */ "./app/actions/releaseActions.tsx");
/* harmony import */ var sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/makeSafeRefluxStore */ "./app/utils/makeSafeRefluxStore.ts");





const getReleaseStoreKey = (projectSlug, releaseVersion) => `${projectSlug}${releaseVersion}`;
const storeConfig = {
  state: {
    orgSlug: undefined,
    release: new Map(),
    releaseLoading: new Map(),
    releaseError: new Map(),
    deploys: new Map(),
    deploysLoading: new Map(),
    deploysError: new Map()
  },
  listenables: sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_3__["default"],
  unsubscribeListeners: [],

  init() {
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_organizationActions__WEBPACK_IMPORTED_MODULE_2__["default"].update, this.updateOrganization));
    this.reset();
  },

  reset() {
    this.state = {
      orgSlug: undefined,
      release: new Map(),
      releaseLoading: new Map(),
      releaseError: new Map(),
      deploys: new Map(),
      deploysLoading: new Map(),
      deploysError: new Map()
    };
    this.trigger(this.state);
  },

  updateOrganization(org) {
    this.reset();
    this.state.orgSlug = org.slug;
    this.trigger(this.state);
  },

  loadRelease(orgSlug, projectSlug, releaseVersion) {
    // Wipe entire store if the user switched organizations
    if (!this.orgSlug || this.orgSlug !== orgSlug) {
      this.reset();
      this.orgSlug = orgSlug;
    }

    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);
    const {
      releaseLoading,
      releaseError,
      ...state
    } = this.state;
    this.state = { ...state,
      releaseLoading: { ...releaseLoading,
        [releaseKey]: true
      },
      releaseError: { ...releaseError,
        [releaseKey]: undefined
      }
    };
    this.trigger(this.state);
  },

  loadReleaseError(projectSlug, releaseVersion, error) {
    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);
    const {
      releaseLoading,
      releaseError,
      ...state
    } = this.state;
    this.state = { ...state,
      releaseLoading: { ...releaseLoading,
        [releaseKey]: false
      },
      releaseError: { ...releaseError,
        [releaseKey]: error
      }
    };
    this.trigger(this.state);
  },

  loadReleaseSuccess(projectSlug, releaseVersion, data) {
    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);
    const {
      release,
      releaseLoading,
      releaseError,
      ...state
    } = this.state;
    this.state = { ...state,
      release: { ...release,
        [releaseKey]: data
      },
      releaseLoading: { ...releaseLoading,
        [releaseKey]: false
      },
      releaseError: { ...releaseError,
        [releaseKey]: undefined
      }
    };
    this.trigger(this.state);
  },

  loadDeploys(orgSlug, projectSlug, releaseVersion) {
    // Wipe entire store if the user switched organizations
    if (!this.orgSlug || this.orgSlug !== orgSlug) {
      this.reset();
      this.orgSlug = orgSlug;
    }

    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);
    const {
      deploysLoading,
      deploysError,
      ...state
    } = this.state;
    this.state = { ...state,
      deploysLoading: { ...deploysLoading,
        [releaseKey]: true
      },
      deploysError: { ...deploysError,
        [releaseKey]: undefined
      }
    };
    this.trigger(this.state);
  },

  loadDeploysError(projectSlug, releaseVersion, error) {
    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);
    const {
      deploysLoading,
      deploysError,
      ...state
    } = this.state;
    this.state = { ...state,
      deploysLoading: { ...deploysLoading,
        [releaseKey]: false
      },
      deploysError: { ...deploysError,
        [releaseKey]: error
      }
    };
    this.trigger(this.state);
  },

  loadDeploysSuccess(projectSlug, releaseVersion, data) {
    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);
    const {
      deploys,
      deploysLoading,
      deploysError,
      ...state
    } = this.state;
    this.state = { ...state,
      deploys: { ...deploys,
        [releaseKey]: data
      },
      deploysLoading: { ...deploysLoading,
        [releaseKey]: false
      },
      deploysError: { ...deploysError,
        [releaseKey]: undefined
      }
    };
    this.trigger(this.state);
  },

  get(projectSlug, releaseVersion) {
    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);
    return {
      release: this.state.release[releaseKey],
      releaseLoading: this.state.releaseLoading[releaseKey],
      releaseError: this.state.releaseError[releaseKey],
      deploys: this.state.deploys[releaseKey],
      deploysLoading: this.state.deploysLoading[releaseKey],
      deploysError: this.state.deploysError[releaseKey]
    };
  }

};
const ReleaseStore = (0,reflux__WEBPACK_IMPORTED_MODULE_1__.createStore)((0,sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_4__.makeSafeRefluxStore)(storeConfig));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReleaseStore);

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

/***/ "./app/views/organizationActivity/activityFeedItem.tsx":
/*!*************************************************************!*\
  !*** ./app/views/organizationActivity/activityFeedItem.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_activity_item_avatar__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/activity/item/avatar */ "./app/components/activity/item/avatar.tsx");
/* harmony import */ var sentry_components_commitLink__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/commitLink */ "./app/components/commitLink.tsx");
/* harmony import */ var sentry_components_duration__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/duration */ "./app/components/duration.tsx");
/* harmony import */ var sentry_components_issueLink__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/issueLink */ "./app/components/issueLink.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_pullRequestLink__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/pullRequestLink */ "./app/components/pullRequestLink.tsx");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_components_version__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/version */ "./app/components/version.tsx");
/* harmony import */ var sentry_components_versionHoverCard__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/versionHoverCard */ "./app/components/versionHoverCard.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/stores/memberListStore */ "./app/stores/memberListStore.tsx");
/* harmony import */ var sentry_stores_teamStore__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/stores/teamStore */ "./app/stores/teamStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_marked__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/marked */ "./app/utils/marked.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }



















const defaultProps = {
  defaultClipped: false,
  clipHeight: 68
};

class ActivityItem extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      clipped: this.props.defaultClipped
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "activityBubbleRef", /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_4__.createRef)());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "formatProjectActivity", (author, item) => {
      const data = item.data;
      const {
        organization
      } = this.props;
      const orgId = organization.slug;
      const issue = item.issue;
      const basePath = `/organizations/${orgId}/issues/`;
      const issueLink = issue ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_issueLink__WEBPACK_IMPORTED_MODULE_8__["default"], {
        orgId: orgId,
        issue: issue,
        to: `${basePath}${issue.id}/`,
        card: true,
        children: issue.shortId
      }) : null;
      const versionLink = this.renderVersionLink(data.version, item);

      switch (item.type) {
        case 'note':
          return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[author] commented on [issue]', {
            author,
            issue: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_issueLink__WEBPACK_IMPORTED_MODULE_8__["default"], {
              card: true,
              orgId: orgId,
              issue: issue,
              to: `${basePath}${issue.id}/activity/#event_${item.id}`,
              children: issue.shortId
            })
          });

        case 'set_resolved':
          return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[author] marked [issue] as resolved', {
            author,
            issue: issueLink
          });

        case 'set_resolved_by_age':
          return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[author] marked [issue] as resolved due to age', {
            author,
            issue: issueLink
          });

        case 'set_resolved_in_release':
          const {
            current_release_version,
            version
          } = item.data;

          if (current_release_version) {
            return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[author] marked [issue] as resolved in releases greater than [version]', {
              author,
              version: this.renderVersionLink(current_release_version, item),
              issue: issueLink
            });
          }

          if (version) {
            return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[author] marked [issue] as resolved in [version]', {
              author,
              version: versionLink,
              issue: issueLink
            });
          }

          return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[author] marked [issue] as resolved in the upcoming release', {
            author,
            issue: issueLink
          });

        case 'set_resolved_in_commit':
          return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[author] marked [issue] as resolved in [version]', {
            author,
            version: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_commitLink__WEBPACK_IMPORTED_MODULE_6__["default"], {
              inline: true,
              commitId: data.commit && data.commit.id,
              repository: data.commit && data.commit.repository
            }),
            issue: issueLink
          });

        case 'set_resolved_in_pull_request':
          return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[author] marked [issue] as resolved in [version]', {
            author,
            version: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_pullRequestLink__WEBPACK_IMPORTED_MODULE_11__["default"], {
              inline: true,
              pullRequest: data.pullRequest,
              repository: data.pullRequest && data.pullRequest.repository
            }),
            issue: issueLink
          });

        case 'set_unresolved':
          return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[author] marked [issue] as unresolved', {
            author,
            issue: issueLink
          });

        case 'set_ignored':
          if (data.ignoreDuration) {
            return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[author] ignored [issue] for [duration]', {
              author,
              duration: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_duration__WEBPACK_IMPORTED_MODULE_7__["default"], {
                seconds: data.ignoreDuration * 60
              }),
              issue: issueLink
            });
          }

          if (data.ignoreCount && data.ignoreWindow) {
            return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[author] ignored [issue] until it happens [count] time(s) in [duration]', {
              author,
              count: data.ignoreCount,
              duration: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_duration__WEBPACK_IMPORTED_MODULE_7__["default"], {
                seconds: data.ignoreWindow * 60
              }),
              issue: issueLink
            });
          }

          if (data.ignoreCount) {
            return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[author] ignored [issue] until it happens [count] time(s)', {
              author,
              count: data.ignoreCount,
              issue: issueLink
            });
          }

          if (data.ignoreUserCount && data.ignoreUserWindow) {
            return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[author] ignored [issue] until it affects [count] user(s) in [duration]', {
              author,
              count: data.ignoreUserCount,
              duration: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_duration__WEBPACK_IMPORTED_MODULE_7__["default"], {
                seconds: data.ignoreUserWindow * 60
              }),
              issue: issueLink
            });
          }

          if (data.ignoreUserCount) {
            return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[author] ignored [issue] until it affects [count] user(s)', {
              author,
              count: data.ignoreUserCount,
              issue: issueLink
            });
          }

          return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[author] ignored [issue]', {
            author,
            issue: issueLink
          });

        case 'set_public':
          return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[author] made [issue] public', {
            author,
            issue: issueLink
          });

        case 'set_private':
          return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[author] made [issue] private', {
            author,
            issue: issueLink
          });

        case 'set_regression':
          if (data.version) {
            return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[author] marked [issue] as a regression in [version]', {
              author,
              version: versionLink,
              issue: issueLink
            });
          }

          return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[author] marked [issue] as a regression', {
            author,
            issue: issueLink
          });

        case 'create_issue':
          return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[author] linked [issue] on [provider]', {
            author,
            provider: data.provider,
            issue: issueLink
          });

        case 'unmerge_destination':
          return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tn)('%2$s migrated %1$s fingerprint from %3$s to %4$s', '%2$s migrated %1$s fingerprints from %3$s to %4$s', data.fingerprints.length, author, data.source ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("a", {
            href: `${basePath}${data.source.id}`,
            children: data.source.shortId
          }) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('a group'), issueLink);

        case 'first_seen':
          return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[author] saw [link:issue]', {
            author,
            issue: issueLink
          });

        case 'assigned':
          let assignee;

          if (data.assigneeType === 'team') {
            const team = sentry_stores_teamStore__WEBPACK_IMPORTED_MODULE_17__["default"].getById(data.assignee);
            assignee = team ? team.slug : '<unknown-team>';
            return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[author] assigned [issue] to #[assignee]', {
              author,
              issue: issueLink,
              assignee
            });
          }

          if (item.user && data.assignee === item.user.id) {
            return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[author] assigned [issue] to themselves', {
              author,
              issue: issueLink
            });
          }

          assignee = sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_16__["default"].getById(data.assignee);

          if (assignee && assignee.email) {
            return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[author] assigned [issue] to [assignee]', {
              author,
              assignee: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("span", {
                title: assignee.email,
                children: assignee.name
              }),
              issue: issueLink
            });
          }

          if (data.assigneeEmail) {
            return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[author] assigned [issue] to [assignee]', {
              author,
              assignee: data.assigneeEmail,
              issue: issueLink
            });
          }

          return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[author] assigned [issue] to an [help:unknown user]', {
            author,
            help: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("span", {
              title: data.assignee
            }),
            issue: issueLink
          });

        case 'unassigned':
          return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[author] unassigned [issue]', {
            author,
            issue: issueLink
          });

        case 'merge':
          return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[author] merged [count] [link:issues]', {
            author,
            count: data.issues.length + 1,
            link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_10__["default"], {
              to: `${basePath}${issue.id}/`
            })
          });

        case 'release':
          return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[author] released version [version]', {
            author,
            version: versionLink
          });

        case 'deploy':
          return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[author] deployed version [version] to [environment].', {
            author,
            version: versionLink,
            environment: data.environment || 'Default Environment'
          });

        case 'mark_reviewed':
          return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[author] marked [issue] as reviewed', {
            author,
            issue: issueLink
          });

        default:
          return '';
        // should never hit (?)
      }
    });
  }

  componentDidMount() {
    if (this.activityBubbleRef.current) {
      const bubbleHeight = this.activityBubbleRef.current.offsetHeight;

      if (bubbleHeight > this.props.clipHeight) {
        // okay if this causes re-render; cannot determine until
        // rendered first anyways
        // eslint-disable-next-line react/no-did-mount-set-state
        this.setState({
          clipped: true
        });
      }
    }
  }

  renderVersionLink(version, item) {
    const {
      organization
    } = this.props;
    const {
      project
    } = item;
    return version ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_versionHoverCard__WEBPACK_IMPORTED_MODULE_14__["default"], {
      organization: organization,
      projectSlug: project.slug,
      releaseVersion: version,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_version__WEBPACK_IMPORTED_MODULE_13__["default"], {
        version: version,
        projectId: project.id
      })
    }) : null;
  }

  render() {
    var _item$user;

    const {
      className,
      item
    } = this.props;

    const avatar = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_activity_item_avatar__WEBPACK_IMPORTED_MODULE_5__["default"], {
      type: !item.user ? 'system' : 'user',
      user: (_item$user = item.user) !== null && _item$user !== void 0 ? _item$user : undefined,
      size: 36
    });

    const author = {
      name: item.user ? item.user.name : 'Sentry',
      avatar
    };
    const hasBubble = ['note', 'create_issue'].includes(item.type);
    const bubbleProps = { ...(item.type === 'note' ? {
        dangerouslySetInnerHTML: {
          __html: (0,sentry_utils_marked__WEBPACK_IMPORTED_MODULE_19__["default"])(item.data.text)
        }
      } : {}),
      ...(item.type === 'create_issue' ? {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_9__["default"], {
          href: item.data.location,
          children: item.data.title
        })
      } : {})
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)("div", {
      className: className,
      children: [author.avatar, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)("div", {
        children: [this.formatProjectActivity((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("span", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(ActivityAuthor, {
            children: author.name
          })
        }), item), hasBubble && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(Bubble, {
          ref: this.activityBubbleRef,
          clipped: this.state.clipped,
          ...bubbleProps
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(Meta, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(Project, {
            children: item.project.slug
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(StyledTimeSince, {
            date: item.dateCreated
          })]
        })]
      })]
    });
  }

}

ActivityItem.displayName = "ActivityItem";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(ActivityItem, "defaultProps", defaultProps);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (/*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(ActivityItem, {
  target: "eha57q15"
})("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(1), ";grid-template-columns:max-content auto;position:relative;margin:0;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(1), ";border-bottom:1px solid ", p => p.theme.innerBorder, ";line-height:1.4;font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0)));

const ActivityAuthor = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "eha57q14"
} : 0)( true ? {
  name: "16ceglb",
  styles: "font-weight:600"
} : 0);

const Meta = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eha57q13"
} : 0)("color:", p => p.theme.textColor, ";font-size:", p => p.theme.fontSizeRelativeSmall, ";" + ( true ? "" : 0));

const Project = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "eha57q12"
} : 0)( true ? {
  name: "1efi8gv",
  styles: "font-weight:bold"
} : 0);

const Bubble = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eha57q11"
} : 0)("background:", p => p.theme.backgroundSecondary, ";margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(0.5), " 0;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(2), ";border:1px solid ", p => p.theme.border, ";border-radius:3px;box-shadow:0 1px 1px rgba(0, 0, 0, 0.04);position:relative;overflow:hidden;a{max-width:100%;overflow-x:hidden;text-overflow:ellipsis;}p{&:last-child{margin-bottom:0;}}", p => p.clipped && `
    max-height: 68px;

    &:after {
      position: absolute;
      content: '';
      display: block;
      bottom: 0;
      right: 0;
      left: 0;
      height: 36px;
      background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 1));
      border-bottom: 6px solid #fff;
      border-radius: 0 0 3px 3px;
      pointer-events: none;
    }
  `, ";" + ( true ? "" : 0));

const StyledTimeSince = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_12__["default"],  true ? {
  target: "eha57q10"
} : 0)("color:", p => p.theme.gray300, ";padding-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(1), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/organizationActivity/index.tsx":
/*!**************************************************!*\
  !*** ./app/views/organizationActivity/index.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/emptyStateWarning */ "./app/components/emptyStateWarning.tsx");
/* harmony import */ var sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/errorBoundary */ "./app/components/errorBoundary.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_pageHeading__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/pageHeading */ "./app/components/pageHeading.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_organization__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/organization */ "./app/styles/organization.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/routeTitle */ "./app/utils/routeTitle.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var _activityFeedItem__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./activityFeedItem */ "./app/views/organizationActivity/activityFeedItem.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");

















class OrganizationActivity extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_11__["default"] {
  getTitle() {
    const {
      orgId
    } = this.props.params;
    return (0,sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_9__["default"])((0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Activity'), orgId, false);
  }

  getEndpoints() {
    return [['activity', `/organizations/${this.props.params.orgId}/activity/`]];
  }

  renderLoading() {
    return this.renderBody();
  }

  renderEmpty() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_0__["default"], {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Nothing to show here, move along.')
      })
    });
  }

  renderError(error) {
    let disableLog = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    const {
      errors
    } = this.state;
    const notFound = Object.values(errors).find(resp => resp && resp.status === 404);

    if (notFound) {
      return this.renderBody();
    }

    return super.renderError(error, disableLog);
  }

  renderBody() {
    const {
      loading,
      activity,
      activityPageLinks
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_7__.PageContent, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_pageHeading__WEBPACK_IMPORTED_MODULE_3__["default"], {
        withMargins: true,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Activity')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__.Panel, {
        children: [loading && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_2__["default"], {}), !loading && !(activity !== null && activity !== void 0 && activity.length) && this.renderEmpty(), !loading && (activity === null || activity === void 0 ? void 0 : activity.length) > 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("div", {
          "data-test-id": "activity-feed-list",
          children: activity.map(item => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_1__["default"], {
            mini: true,
            css: /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_14__.css)({
              marginBottom: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1),
              borderRadius: 0
            },  true ? "" : 0,  true ? "" : 0),
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(_activityFeedItem__WEBPACK_IMPORTED_MODULE_12__["default"], {
              organization: this.props.organization,
              item: item
            })
          }, item.id))
        })]
      }), activityPageLinks && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_4__["default"], {
        pageLinks: activityPageLinks,
        ...this.props
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_10__["default"])(OrganizationActivity));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_actionCreators_release_tsx-app_views_organizationActivity_index_tsx.9bb88dbbab0b17f510303c737808f056.js.map