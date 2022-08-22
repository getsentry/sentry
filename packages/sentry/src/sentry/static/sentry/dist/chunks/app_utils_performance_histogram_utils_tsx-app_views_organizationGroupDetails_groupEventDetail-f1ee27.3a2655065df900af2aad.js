(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_utils_performance_histogram_utils_tsx-app_views_organizationGroupDetails_groupEventDetail-f1ee27"],{

/***/ "./app/actionCreators/environments.tsx":
/*!*********************************************!*\
  !*** ./app/actionCreators/environments.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "fetchOrganizationEnvironments": () => (/* binding */ fetchOrganizationEnvironments)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_actions_environmentActions__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actions/environmentActions */ "./app/actions/environmentActions.tsx");



/**
 * Fetches all environments for an organization
 *
 * @param organizationSlug The organization slug
 */
async function fetchOrganizationEnvironments(api, organizationSlug) {
  sentry_actions_environmentActions__WEBPACK_IMPORTED_MODULE_1__["default"].fetchEnvironments();

  try {
    const environments = await api.requestPromise(`/organizations/${organizationSlug}/environments/`);

    if (!environments) {
      sentry_actions_environmentActions__WEBPACK_IMPORTED_MODULE_1__["default"].fetchEnvironmentsError(new Error('retrieved environments is falsey'));
      return;
    }

    sentry_actions_environmentActions__WEBPACK_IMPORTED_MODULE_1__["default"].fetchEnvironmentsSuccess(environments);
  } catch (err) {
    sentry_actions_environmentActions__WEBPACK_IMPORTED_MODULE_1__["default"].fetchEnvironmentsError(err);
  }
}

/***/ }),

/***/ "./app/actionCreators/platformExternalIssues.tsx":
/*!*******************************************************!*\
  !*** ./app/actionCreators/platformExternalIssues.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "deleteExternalIssue": () => (/* binding */ deleteExternalIssue)
/* harmony export */ });
async function deleteExternalIssue(api, groupId, externalIssueId) {
  return await api.requestPromise(`/issues/${groupId}/external-issues/${externalIssueId}/`, {
    method: 'DELETE'
  });
}

/***/ }),

/***/ "./app/actionCreators/sentryAppComponents.tsx":
/*!****************************************************!*\
  !*** ./app/actionCreators/sentryAppComponents.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "fetchSentryAppComponents": () => (/* binding */ fetchSentryAppComponents)
/* harmony export */ });
/* harmony import */ var sentry_stores_sentryAppComponentsStore__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/stores/sentryAppComponentsStore */ "./app/stores/sentryAppComponentsStore.tsx");

async function fetchSentryAppComponents(api, orgSlug, projectId) {
  const componentsUri = `/organizations/${orgSlug}/sentry-app-components/?projectId=${projectId}`;
  const res = await api.requestPromise(componentsUri);
  sentry_stores_sentryAppComponentsStore__WEBPACK_IMPORTED_MODULE_0__["default"].loadComponents(res);
  return res;
}

/***/ }),

/***/ "./app/actions/environmentActions.tsx":
/*!********************************************!*\
  !*** ./app/actions/environmentActions.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);

const EnvironmentActions = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createActions)(['fetchEnvironments', 'fetchEnvironmentsError', 'fetchEnvironmentsSuccess']);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EnvironmentActions);

/***/ }),

/***/ "./app/components/errors/groupEventDetailsLoadingError.tsx":
/*!*****************************************************************!*\
  !*** ./app/components/errors/groupEventDetailsLoadingError.tsx ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_errors_detailedError__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/errors/detailedError */ "./app/components/errors/detailedError.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





const GroupEventDetailsLoadingError = _ref => {
  let {
    onRetry,
    environments
  } = _ref;
  const reasons = [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('The events are still processing and are on their way'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('The events have been deleted'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('There is an internal systems error or active issue')];
  let message;

  if (environments.length === 0) {
    // All Environments case
    message = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('This could be due to a handful of reasons:')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("ol", {
        className: "detailed-error-list",
        children: reasons.map((reason, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("li", {
          children: reason
        }, i))
      })]
    });
  } else {
    message = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('No events were found for the currently selected environments')
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_errors_detailedError__WEBPACK_IMPORTED_MODULE_0__["default"], {
    className: "group-event-details-error",
    onRetry: environments.length === 0 ? onRetry : undefined,
    heading: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Sorry, the events for this issue could not be found.'),
    message: message
  });
};

GroupEventDetailsLoadingError.displayName = "GroupEventDetailsLoadingError";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GroupEventDetailsLoadingError);

/***/ }),

/***/ "./app/components/events/meta/metaProxy.tsx":
/*!**************************************************!*\
  !*** ./app/components/events/meta/metaProxy.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "MetaProxy": () => (/* binding */ MetaProxy),
/* harmony export */   "getMeta": () => (/* binding */ getMeta),
/* harmony export */   "withMeta": () => (/* binding */ withMeta)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_es_reflect_to_string_tag_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.reflect.to-string-tag.js */ "../node_modules/core-js/modules/es.reflect.to-string-tag.js");
/* harmony import */ var core_js_modules_es_reflect_to_string_tag_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_reflect_to_string_tag_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var lodash_isEmpty__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/isEmpty */ "../node_modules/lodash/isEmpty.js");
/* harmony import */ var lodash_isEmpty__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_isEmpty__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var lodash_isNull__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/isNull */ "../node_modules/lodash/isNull.js");
/* harmony import */ var lodash_isNull__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_isNull__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var lodash_memoize__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/memoize */ "../node_modules/lodash/memoize.js");
/* harmony import */ var lodash_memoize__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_memoize__WEBPACK_IMPORTED_MODULE_4__);





const GET_META = Symbol('GET_META');
const IS_PROXY = Symbol('IS_PROXY');

function isAnnotated(meta) {
  if (lodash_isEmpty__WEBPACK_IMPORTED_MODULE_2___default()(meta)) {
    return false;
  }

  return !lodash_isEmpty__WEBPACK_IMPORTED_MODULE_2___default()(meta.rem) || !lodash_isEmpty__WEBPACK_IMPORTED_MODULE_2___default()(meta.err);
}

class MetaProxy {
  constructor(local) {
    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "local", void 0);

    this.local = local;
  }

  get(obj, prop, receiver) {
    // trap calls to `getMeta` to return meta object
    if (prop === GET_META) {
      return key => {
        if (this.local && this.local[key] && this.local[key]['']) {
          // TODO: Error checks
          const meta = this.local[key][''];
          return isAnnotated(meta) ? meta : undefined;
        }

        return undefined;
      };
    } // this is how  we can determine if current `obj` is a proxy


    if (prop === IS_PROXY) {
      return true;
    }

    const value = Reflect.get(obj, prop, receiver);

    if (!Reflect.has(obj, prop) || typeof value !== 'object' || lodash_isNull__WEBPACK_IMPORTED_MODULE_3___default()(value)) {
      return value;
    } // This is so we don't create a new Proxy from an object that is
    // already a proxy. Otherwise we can get into very deep recursive calls


    if (Reflect.get(obj, IS_PROXY, receiver)) {
      return value;
    } // Make sure we apply proxy to all children (objects and arrays)
    // Do we need to check for annotated inside of objects?


    return new Proxy(value, new MetaProxy(this.local && this.local[prop]));
  }

}
const withMeta = lodash_memoize__WEBPACK_IMPORTED_MODULE_4___default()(function withMeta(event) {
  if (!event) {
    return event;
  } // Return unproxied `event` if browser does not support `Proxy`


  if (typeof window.Proxy === 'undefined' || typeof window.Reflect === 'undefined') {
    return event;
  } // withMeta returns a type that is supposed to be 100% compatible with its
  // input type. Proxy typing on typescript is not really functional enough to
  // make this work without casting.
  //
  // https://github.com/microsoft/TypeScript/issues/20846


  return new Proxy(event, new MetaProxy(event._meta));
});
function getMeta(obj, prop) {
  if (!obj || typeof obj[GET_META] !== 'function') {
    return undefined;
  }

  return obj[GET_META](prop);
}

/***/ }),

/***/ "./app/components/globalAppStoreConnectUpdateAlert/index.tsx":
/*!*******************************************************************!*\
  !*** ./app/components/globalAppStoreConnectUpdateAlert/index.tsx ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_projects_appStoreConnectContext__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/projects/appStoreConnectContext */ "./app/components/projects/appStoreConnectContext.tsx");
/* harmony import */ var _updateAlert__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./updateAlert */ "./app/components/globalAppStoreConnectUpdateAlert/updateAlert.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function GlobalAppStoreConnectUpdateAlert(_ref) {
  let {
    project,
    organization,
    ...rest
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_projects_appStoreConnectContext__WEBPACK_IMPORTED_MODULE_0__.Provider, {
    project: project,
    organization: organization,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(_updateAlert__WEBPACK_IMPORTED_MODULE_1__["default"], {
      project: project,
      ...rest
    })
  });
}

GlobalAppStoreConnectUpdateAlert.displayName = "GlobalAppStoreConnectUpdateAlert";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GlobalAppStoreConnectUpdateAlert);

/***/ }),

/***/ "./app/components/globalAppStoreConnectUpdateAlert/updateAlert.tsx":
/*!*************************************************************************!*\
  !*** ./app/components/globalAppStoreConnectUpdateAlert/updateAlert.tsx ***!
  \*************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_projects_appStoreConnectContext__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/projects/appStoreConnectContext */ "./app/components/projects/appStoreConnectContext.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }







function UpdateAlert(_ref) {
  let {
    Wrapper,
    project,
    className
  } = _ref;
  const appStoreConnectContext = (0,react__WEBPACK_IMPORTED_MODULE_1__.useContext)(sentry_components_projects_appStoreConnectContext__WEBPACK_IMPORTED_MODULE_3__["default"]);

  if (!project || !appStoreConnectContext || !Object.keys(appStoreConnectContext).some(key => !!appStoreConnectContext[key].updateAlertMessage)) {
    return null;
  }

  const notices = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Notices, {
    className: className,
    children: Object.keys(appStoreConnectContext).map(key => {
      const {
        updateAlertMessage
      } = appStoreConnectContext[key];

      if (!updateAlertMessage) {
        return null;
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(NoMarginBottomAlert, {
        type: "warning",
        showIcon: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(AlertContent, {
          children: updateAlertMessage
        })
      }, key);
    })
  });

  return Wrapper ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Wrapper, {
    children: notices
  }) : notices;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (UpdateAlert);

const Notices = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e16hnbbm2"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(2), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(3), ";" + ( true ? "" : 0));

const NoMarginBottomAlert = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_alert__WEBPACK_IMPORTED_MODULE_2__["default"],  true ? {
  target: "e16hnbbm1"
} : 0)( true ? {
  name: "1ykowef",
  styles: "margin-bottom:0"
} : 0);

const AlertContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e16hnbbm0"
} : 0)("display:grid;grid-template-columns:1fr max-content;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/group/externalIssueActions.tsx":
/*!*******************************************************!*\
  !*** ./app/components/group/externalIssueActions.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_issueSyncListElement__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/issueSyncListElement */ "./app/components/issueSyncListElement.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_views_organizationIntegrations_integrationItem__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/views/organizationIntegrations/integrationItem */ "./app/views/organizationIntegrations/integrationItem.tsx");
/* harmony import */ var _externalIssueForm__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./externalIssueForm */ "./app/components/group/externalIssueForm.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













const ExternalIssueActions = _ref => {
  let {
    configurations,
    group,
    onChange,
    api
  } = _ref;
  const {
    linked,
    unlinked
  } = configurations.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())).reduce((acc, curr) => {
    if (curr.externalIssues.length) {
      acc.linked.push(curr);
    } else {
      acc.unlinked.push(curr);
    }

    return acc;
  }, {
    linked: [],
    unlinked: []
  });

  const deleteIssue = integration => {
    const {
      externalIssues
    } = integration; // Currently we do not support a case where there is multiple external issues.
    // For example, we shouldn't have more than 1 jira ticket created for an issue for each jira configuration.

    const issue = externalIssues[0];
    const {
      id
    } = issue;
    const endpoint = `/groups/${group.id}/integrations/${integration.id}/?externalIssue=${id}`;
    api.request(endpoint, {
      method: 'DELETE',
      success: () => {
        onChange(() => (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Successfully unlinked issue.')), () => (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Unable to unlink issue.')));
      },
      error: () => {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Unable to unlink issue.'));
      }
    });
  };

  const doOpenModal = integration => (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_3__.openModal)(deps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(_externalIssueForm__WEBPACK_IMPORTED_MODULE_9__["default"], { ...deps,
    group,
    onChange,
    integration
  }), {
    allowClickClose: false
  });

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [linked.map(config => {
      const {
        provider,
        externalIssues
      } = config;
      const issue = externalIssues[0];
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_issueSyncListElement__WEBPACK_IMPORTED_MODULE_4__["default"], {
        externalIssueLink: issue.url,
        externalIssueId: issue.id,
        externalIssueKey: issue.key,
        externalIssueDisplayName: issue.displayName,
        onClose: () => deleteIssue(config),
        integrationType: provider.key,
        hoverCardHeader: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('%s Integration', provider.name),
        hoverCardBody: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)("div", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(IssueTitle, {
            children: issue.title
          }), issue.description && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(IssueDescription, {
            children: issue.description
          })]
        })
      }, issue.id);
    }), unlinked.length > 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_issueSyncListElement__WEBPACK_IMPORTED_MODULE_4__["default"], {
      integrationType: unlinked[0].provider.key,
      hoverCardHeader: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('%s Integration', unlinked[0].provider.name),
      hoverCardBody: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(Container, {
        children: unlinked.map(config => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(Wrapper, {
          onClick: () => doOpenModal(config),
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_views_organizationIntegrations_integrationItem__WEBPACK_IMPORTED_MODULE_8__["default"], {
            integration: config
          })
        }, config.id))
      }),
      onOpen: unlinked.length === 1 ? () => doOpenModal(unlinked[0]) : undefined
    })]
  });
};

ExternalIssueActions.displayName = "ExternalIssueActions";

const IssueTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ekb3y1q3"
} : 0)("font-size:1.1em;font-weight:600;", p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

const IssueDescription = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ekb3y1q2"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1), ";", p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ekb3y1q1"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(2), ";cursor:pointer;" + ( true ? "" : 0));

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ekb3y1q0"
} : 0)("&>div:last-child{margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1), ";}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_7__["default"])(ExternalIssueActions));

/***/ }),

/***/ "./app/components/group/externalIssueForm.tsx":
/*!****************************************************!*\
  !*** ./app/components/group/externalIssueForm.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ ExternalIssueForm)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/hub.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_externalIssues_abstractExternalIssueForm__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/externalIssues/abstractExternalIssueForm */ "./app/components/externalIssues/abstractExternalIssueForm.tsx");
/* harmony import */ var sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/navTabs */ "./app/components/navTabs.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








const MESSAGES_BY_ACTION = {
  link: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Successfully linked issue.'),
  create: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Successfully created issue.')
};
const SUBMIT_LABEL_BY_ACTION = {
  link: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Link Issue'),
  create: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Create Issue')
};
class ExternalIssueForm extends sentry_components_externalIssues_abstractExternalIssueForm__WEBPACK_IMPORTED_MODULE_2__["default"] {
  constructor(props) {
    super(props, {});

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "loadTransaction", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "submitTransaction", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleClick", action => {
      this.setState({
        action
      }, () => this.reloadData());
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "startTransaction", type => {
      const {
        group,
        integration
      } = this.props;
      const {
        action
      } = this.state;
      const transaction = _sentry_react__WEBPACK_IMPORTED_MODULE_5__.startTransaction({
        name: `externalIssueForm.${type}`
      });
      _sentry_react__WEBPACK_IMPORTED_MODULE_6__.getCurrentHub().configureScope(scope => scope.setSpan(transaction));
      transaction.setTag('issueAction', action);
      transaction.setTag('groupID', group.id);
      transaction.setTag('projectID', group.project.id);
      transaction.setTag('integrationSlug', integration.provider.slug);
      transaction.setTag('integrationType', 'firstParty');
      return transaction;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handlePreSubmit", () => {
      this.submitTransaction = this.startTransaction('submit');
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onSubmitSuccess", _data => {
      var _this$submitTransacti;

      const {
        onChange,
        closeModal
      } = this.props;
      const {
        action
      } = this.state;
      onChange(() => (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addSuccessMessage)(MESSAGES_BY_ACTION[action]));
      closeModal();
      (_this$submitTransacti = this.submitTransaction) === null || _this$submitTransacti === void 0 ? void 0 : _this$submitTransacti.finish();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmitError", () => {
      var _this$submitTransacti2;

      (_this$submitTransacti2 = this.submitTransaction) === null || _this$submitTransacti2 === void 0 ? void 0 : _this$submitTransacti2.finish();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onLoadAllEndpointsSuccess", () => {
      var _this$loadTransaction;

      (_this$loadTransaction = this.loadTransaction) === null || _this$loadTransaction === void 0 ? void 0 : _this$loadTransaction.finish();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onRequestError", () => {
      var _this$loadTransaction2;

      (_this$loadTransaction2 = this.loadTransaction) === null || _this$loadTransaction2 === void 0 ? void 0 : _this$loadTransaction2.finish();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getTitle", () => {
      const {
        integration
      } = this.props;
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)('[integration] Issue', {
        integration: integration.provider.name
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getFormProps", () => {
      const {
        action
      } = this.state;
      return { ...this.getDefaultFormProps(),
        submitLabel: SUBMIT_LABEL_BY_ACTION[action],
        apiEndpoint: this.getEndPointString(),
        apiMethod: action === 'create' ? 'POST' : 'PUT',
        onPreSubmit: this.handlePreSubmit,
        onSubmitError: this.handleSubmitError,
        onSubmitSuccess: this.onSubmitSuccess
      };
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderNavTabs", () => {
      const {
        action
      } = this.state;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_3__["default"], {
        underlined: true,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("li", {
          className: action === 'create' ? 'active' : '',
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("a", {
            onClick: () => this.handleClick('create'),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Create')
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("li", {
          className: action === 'link' ? 'active' : '',
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("a", {
            onClick: () => this.handleClick('link'),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Link')
          })
        })]
      });
    });

    this.loadTransaction = this.startTransaction('load');
  }

  getEndpoints() {
    var _this$state;

    const query = {};

    if ((_this$state = this.state) !== null && _this$state !== void 0 && _this$state.hasOwnProperty('action')) {
      query.action = this.state.action;
    }

    return [['integrationDetails', this.getEndPointString(), {
      query
    }]];
  }

  getEndPointString() {
    const {
      group,
      integration
    } = this.props;
    return `/groups/${group.id}/integrations/${integration.id}/`;
  }

  renderBody() {
    return this.renderForm(this.getCleanedFields());
  }

}

/***/ }),

/***/ "./app/components/group/externalIssuesList.tsx":
/*!*****************************************************!*\
  !*** ./app/components/group/externalIssuesList.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_components_alertLink__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/alertLink */ "./app/components/alertLink.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/errorBoundary */ "./app/components/errorBoundary.tsx");
/* harmony import */ var sentry_components_group_externalIssueActions__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/group/externalIssueActions */ "./app/components/group/externalIssueActions.tsx");
/* harmony import */ var sentry_components_group_pluginActions__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/group/pluginActions */ "./app/components/group/pluginActions.tsx");
/* harmony import */ var sentry_components_group_sentryAppExternalIssueActions__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/group/sentryAppExternalIssueActions */ "./app/components/group/sentryAppExternalIssueActions.tsx");
/* harmony import */ var sentry_components_issueSyncListElement__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/issueSyncListElement */ "./app/components/issueSyncListElement.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_externalIssueStore__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/stores/externalIssueStore */ "./app/stores/externalIssueStore.tsx");
/* harmony import */ var sentry_stores_sentryAppComponentsStore__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/stores/sentryAppComponentsStore */ "./app/stores/sentryAppComponentsStore.tsx");
/* harmony import */ var sentry_stores_sentryAppInstallationsStore__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/stores/sentryAppInstallationsStore */ "./app/stores/sentryAppInstallationsStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _sidebarSection__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ./sidebarSection */ "./app/components/group/sidebarSection.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





















class ExternalIssueList extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_4__["default"] {
  getEndpoints() {
    const {
      group
    } = this.props;
    return [['integrations', `/groups/${group.id}/integrations/`]];
  }

  constructor(props) {
    super(props, {});

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "unsubscribables", []);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onSentryAppInstallationChange", sentryAppInstallations => {
      this.setState({
        sentryAppInstallations
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onExternalIssueChange", externalIssues => {
      this.setState({
        externalIssues
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onSentryAppComponentsChange", sentryAppComponents => {
      const components = sentryAppComponents.filter(c => c.type === 'issue-link');
      this.setState({
        components
      });
    });

    this.state = Object.assign({}, this.state, {
      components: sentry_stores_sentryAppComponentsStore__WEBPACK_IMPORTED_MODULE_13__["default"].getInitialState(),
      sentryAppInstallations: sentry_stores_sentryAppInstallationsStore__WEBPACK_IMPORTED_MODULE_14__["default"].getInitialState(),
      externalIssues: sentry_stores_externalIssueStore__WEBPACK_IMPORTED_MODULE_12__["default"].getInitialState()
    });
  }

  UNSAFE_componentWillMount() {
    super.UNSAFE_componentWillMount();
    this.unsubscribables = [sentry_stores_sentryAppInstallationsStore__WEBPACK_IMPORTED_MODULE_14__["default"].listen(this.onSentryAppInstallationChange, this), sentry_stores_externalIssueStore__WEBPACK_IMPORTED_MODULE_12__["default"].listen(this.onExternalIssueChange, this), sentry_stores_sentryAppComponentsStore__WEBPACK_IMPORTED_MODULE_13__["default"].listen(this.onSentryAppComponentsChange, this)];
    this.fetchSentryAppData();
  }

  componentWillUnmount() {
    super.componentWillUnmount();
    this.unsubscribables.forEach(unsubscribe => unsubscribe());
  }

  // We want to do this explicitly so that we can handle errors gracefully,
  // instead of the entire component not rendering.
  //
  // Part of the API request here is fetching data from the Sentry App, so
  // we need to be more conservative about error cases since we don't have
  // control over those services.
  //
  fetchSentryAppData() {
    const {
      group,
      project,
      organization
    } = this.props;

    if (project && project.id && organization) {
      this.api.requestPromise(`/groups/${group.id}/external-issues/`).then(data => {
        sentry_stores_externalIssueStore__WEBPACK_IMPORTED_MODULE_12__["default"].load(data);
        this.setState({
          externalIssues: data
        });
      }).catch(_error => {});
    }
  }

  async updateIntegrations() {
    let onSuccess = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : () => {};
    let onError = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : () => {};

    try {
      const {
        group
      } = this.props;
      const integrations = await this.api.requestPromise(`/groups/${group.id}/integrations/`);
      this.setState({
        integrations
      }, () => onSuccess());
    } catch (error) {
      onError();
    }
  }

  renderIntegrationIssues() {
    let integrations = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
    const {
      group
    } = this.props;
    const activeIntegrations = integrations.filter(integration => integration.status === 'active');
    const activeIntegrationsByProvider = activeIntegrations.reduce((acc, curr) => {
      const items = acc.get(curr.provider.key);

      if (!!items) {
        acc.set(curr.provider.key, [...items, curr]);
      } else {
        acc.set(curr.provider.key, [curr]);
      }

      return acc;
    }, new Map());
    return activeIntegrations.length ? [...activeIntegrationsByProvider.entries()].map(_ref => {
      let [provider, configurations] = _ref;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_group_externalIssueActions__WEBPACK_IMPORTED_MODULE_6__["default"], {
        configurations: configurations,
        group: group,
        onChange: this.updateIntegrations.bind(this)
      }, provider);
    }) : null;
  }

  renderSentryAppIssues() {
    const {
      externalIssues,
      sentryAppInstallations,
      components
    } = this.state;
    const {
      group
    } = this.props;

    if (components.length === 0) {
      return null;
    }

    return components.map(component => {
      const {
        sentryApp,
        error: disabled
      } = component;
      const installation = sentryAppInstallations.find(i => i.app.uuid === sentryApp.uuid); // should always find a match but TS complains if we don't handle this case

      if (!installation) {
        return null;
      }

      const issue = (externalIssues || []).find(i => i.serviceType === sentryApp.slug);
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_5__["default"], {
        mini: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_group_sentryAppExternalIssueActions__WEBPACK_IMPORTED_MODULE_8__["default"], {
          group: group,
          event: this.props.event,
          sentryAppComponent: component,
          sentryAppInstallation: installation,
          externalIssue: issue,
          disabled: disabled
        }, sentryApp.slug)
      }, sentryApp.slug);
    });
  }

  renderPluginIssues() {
    const {
      group,
      project
    } = this.props;
    return group.pluginIssues && group.pluginIssues.length ? group.pluginIssues.map((plugin, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_group_pluginActions__WEBPACK_IMPORTED_MODULE_7__["default"], {
      group: group,
      project: project,
      plugin: plugin
    }, i)) : null;
  }

  renderPluginActions() {
    const {
      group
    } = this.props;
    return group.pluginActions && group.pluginActions.length ? group.pluginActions.map((plugin, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_issueSyncListElement__WEBPACK_IMPORTED_MODULE_9__["default"], {
      externalIssueLink: plugin[1],
      children: plugin[0]
    }, i)) : null;
  }

  renderLoading() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(_sidebarSection__WEBPACK_IMPORTED_MODULE_17__["default"], {
      "data-test-id": "linked-issues",
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Linked Issues'),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_10__["default"], {
        height: "120px"
      })
    });
  }

  renderBody() {
    const sentryAppIssues = this.renderSentryAppIssues();
    const integrationIssues = this.renderIntegrationIssues(this.state.integrations);
    const pluginIssues = this.renderPluginIssues();
    const pluginActions = this.renderPluginActions();
    const showSetup = !sentryAppIssues && !integrationIssues && !pluginIssues && !pluginActions;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(_sidebarSection__WEBPACK_IMPORTED_MODULE_17__["default"], {
      secondary: true,
      "data-test-id": "linked-issues",
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Issue Tracking'),
      children: [showSetup && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_alertLink__WEBPACK_IMPORTED_MODULE_3__["default"], {
        priority: "muted",
        size: "small",
        to: `/settings/${this.props.organization.slug}/integrations/?category=issue%20tracking`,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Track this issue in Jira, GitHub, etc.')
      }), sentryAppIssues && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(Wrapper, {
        children: sentryAppIssues
      }), integrationIssues && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(Wrapper, {
        children: integrationIssues
      }), pluginIssues && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(Wrapper, {
        children: pluginIssues
      }), pluginActions && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(Wrapper, {
        children: pluginActions
      })]
    });
  }

}

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e5jfgsv0"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(2), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_16__["default"])(ExternalIssueList));

/***/ }),

/***/ "./app/components/group/participants.tsx":
/*!***********************************************!*\
  !*** ./app/components/group/participants.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/avatar/userAvatar */ "./app/components/avatar/userAvatar.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _sidebarSection__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./sidebarSection */ "./app/components/group/sidebarSection.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }







const GroupParticipants = _ref => {
  let {
    participants
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(_sidebarSection__WEBPACK_IMPORTED_MODULE_4__["default"], {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.tn)('%s Participant', '%s Participants', participants.length),
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Faces, {
      children: participants.map(user => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Face, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_1__["default"], {
          size: 28,
          user: user,
          hasTooltip: true
        })
      }, user.username))
    })
  });
};

GroupParticipants.displayName = "GroupParticipants";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GroupParticipants);

const Faces = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e18aeel01"
} : 0)( true ? {
  name: "5kov97",
  styles: "display:flex;flex-wrap:wrap"
} : 0);

const Face = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e18aeel00"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(0.5), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(0.5), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/group/pluginActions.tsx":
/*!************************************************!*\
  !*** ./app/components/group/pluginActions.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "PluginActions": () => (/* binding */ PluginActions),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_issueSyncListElement__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/issueSyncListElement */ "./app/components/issueSyncListElement.tsx");
/* harmony import */ var sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/navTabs */ "./app/components/navTabs.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_plugins__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/plugins */ "./app/plugins/index.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");














class PluginActions extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      issue: null,
      pluginLoading: false
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "deleteIssue", () => {
      const plugin = { ...this.props.plugin,
        issue: null
      }; // override plugin.issue so that 'create/link' Modal
      // doesn't think the plugin still has an issue linked

      const endpoint = `/issues/${this.props.group.id}/plugins/${plugin.slug}/unlink/`;
      this.props.api.request(endpoint, {
        success: () => {
          this.loadPlugin(plugin);
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Successfully unlinked issue.'));
        },
        error: () => {
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Unable to unlink issue'));
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "loadPlugin", data => {
      this.setState({
        pluginLoading: true
      }, () => {
        sentry_plugins__WEBPACK_IMPORTED_MODULE_8__["default"].load(data, () => {
          const issue = data.issue || null;
          this.setState({
            pluginLoading: false,
            issue
          });
        });
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleModalClose", data => this.setState({
      issue: data !== null && data !== void 0 && data.id && data !== null && data !== void 0 && data.link ? {
        issue_id: data.id,
        url: data.link,
        label: data.label
      } : null
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "openModal", () => {
      const {
        issue
      } = this.state;
      const {
        project,
        group,
        organization
      } = this.props;
      const plugin = { ...this.props.plugin,
        issue
      };
      (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_4__.openModal)(deps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(PluginActionsModal, { ...deps,
        project: project,
        group: group,
        organization: organization,
        plugin: plugin,
        onSuccess: this.handleModalClose
      }), {
        onClose: this.handleModalClose
      });
    });
  }

  componentDidMount() {
    this.loadPlugin(this.props.plugin);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (this.props.plugin.id !== nextProps.plugin.id) {
      this.loadPlugin(nextProps.plugin);
    }
  }

  render() {
    const {
      issue
    } = this.state;
    const plugin = { ...this.props.plugin,
      issue
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_issueSyncListElement__WEBPACK_IMPORTED_MODULE_5__["default"], {
      onOpen: this.openModal,
      externalIssueDisplayName: issue ? issue.label : null,
      externalIssueId: issue ? issue.issue_id : null,
      externalIssueLink: issue ? issue.url : null,
      onClose: this.deleteIssue,
      integrationType: plugin.id
    });
  }

}

PluginActions.displayName = "PluginActions";

class PluginActionsModal extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      actionType: 'create'
    });
  }

  render() {
    const {
      Header,
      Body,
      group,
      project,
      organization,
      plugin,
      onSuccess
    } = this.props;
    const {
      actionType
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Header, {
        closeButton: true,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.tct)('[name] Issue', {
          name: plugin.name || plugin.title
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_6__["default"], {
        underlined: true,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)("li", {
          className: actionType === 'create' ? 'active' : '',
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)("a", {
            onClick: () => this.setState({
              actionType: 'create'
            }),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Create')
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)("li", {
          className: actionType === 'link' ? 'active' : '',
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)("a", {
            onClick: () => this.setState({
              actionType: 'link'
            }),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Link')
          })
        })]
      }), actionType && // need the key here so React will re-render
      // with new action prop
      (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Body, {
        children: sentry_plugins__WEBPACK_IMPORTED_MODULE_8__["default"].get(plugin).renderGroupActions({
          plugin,
          group,
          project,
          organization,
          actionType,
          onSuccess
        })
      }, actionType)]
    });
  }

}

PluginActionsModal.displayName = "PluginActionsModal";

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_9__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_10__["default"])(PluginActions)));

/***/ }),

/***/ "./app/components/group/releaseChart.tsx":
/*!***********************************************!*\
  !*** ./app/components/group/releaseChart.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "getGroupReleaseChartMarkers": () => (/* binding */ getGroupReleaseChartMarkers)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var sentry_components_charts_miniBarChart__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/charts/miniBarChart */ "./app/components/charts/miniBarChart.tsx");
/* harmony import */ var sentry_components_count__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/count */ "./app/components/count.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var _sidebarSection__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./sidebarSection */ "./app/components/group/sidebarSection.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








/**
 * Stats are provided indexed by statsPeriod strings.
 */



function getGroupReleaseChartMarkers(theme, stats, firstSeen, lastSeen) {
  const markers = []; // Get the timestamp of the first point.

  const firstGraphTime = stats[0][0] * 1000;
  const firstSeenX = new Date(firstSeen !== null && firstSeen !== void 0 ? firstSeen : 0).getTime();
  const lastSeenX = new Date(lastSeen !== null && lastSeen !== void 0 ? lastSeen : 0).getTime();
  const difference = lastSeenX - firstSeenX;
  const oneHourMs = 1000 * 60 * 60;

  if (firstSeen && stats.length > 2 && firstSeenX >= firstGraphTime && // Don't show first seen if the markers are too close together
  difference > oneHourMs) {
    var _bucketStart;

    // Find the first bucket that would contain our first seen event
    const firstBucket = stats.findIndex(_ref => {
      let [time] = _ref;
      return time * 1000 > firstSeenX;
    });
    let bucketStart;

    if (firstBucket > 0) {
      // The size of the data interval in ms
      const halfBucketSize = (stats[1][0] - stats[0][0]) * 1000 / 2; // Display the marker in front of the first bucket

      bucketStart = stats[firstBucket - 1][0] * 1000 - halfBucketSize;
    }

    markers.push({
      name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('First seen'),
      value: (_bucketStart = bucketStart) !== null && _bucketStart !== void 0 ? _bucketStart : firstSeenX,
      displayValue: firstSeenX,
      color: theme.pink300
    });
  }

  if (lastSeen && lastSeenX >= firstGraphTime) {
    markers.push({
      name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Last seen'),
      value: lastSeenX,
      displayValue: lastSeenX,
      color: theme.green300
    });
  }

  const markerTooltip = {
    show: true,
    trigger: 'item',
    formatter: _ref2 => {
      let {
        data
      } = _ref2;
      const time = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_4__.getFormattedDate)(data.displayValue, 'MMM D, YYYY LT', {
        local: true
      });
      return ['<div class="tooltip-series">', `<div><span class="tooltip-label"><strong>${data.name}</strong></span></div>`, '</div>', `<div class="tooltip-date">${time}</div>`, '</div>', '<div class="tooltip-arrow"></div>'].join('');
    }
  };
  return {
    data: markers.map(marker => ({
      name: marker.name,
      coord: [marker.value, 0],
      tooltip: markerTooltip,
      displayValue: marker.displayValue,
      symbol: 'circle',
      symbolSize: 8,
      itemStyle: {
        color: marker.color,
        borderColor: theme.background
      }
    }))
  };
}

function GroupReleaseChart(props) {
  const {
    className,
    group,
    lastSeen,
    firstSeen,
    statsPeriod,
    release,
    releaseStats,
    environment,
    environmentLabel,
    environmentStats,
    title
  } = props;
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_7__.a)();
  const stats = group.stats[statsPeriod];
  const environmentPeriodStats = environmentStats === null || environmentStats === void 0 ? void 0 : environmentStats[statsPeriod];

  if (!stats || !stats.length || !environmentPeriodStats) {
    return null;
  }

  const series = [];

  if (environment) {
    // Add all events.
    series.push({
      seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Events'),
      data: stats.map(point => ({
        name: point[0] * 1000,
        value: point[1]
      }))
    });
  }

  series.push({
    seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Events in %s', environmentLabel),
    data: environmentStats[statsPeriod].map(point => ({
      name: point[0] * 1000,
      value: point[1]
    }))
  });

  if (release && releaseStats) {
    series.push({
      seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Events in release %s', (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_5__.formatVersion)(release.version)),
      data: releaseStats[statsPeriod].map(point => ({
        name: point[0] * 1000,
        value: point[1]
      }))
    });
  }

  const totalSeries = environment && environmentStats ? environmentStats[statsPeriod] : stats;
  const totalEvents = totalSeries.reduce((acc, current) => acc + current[1], 0);
  series[0].markPoint = getGroupReleaseChartMarkers(theme, stats, firstSeen, lastSeen);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(_sidebarSection__WEBPACK_IMPORTED_MODULE_6__["default"], {
    secondary: true,
    title: title,
    className: className,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("div", {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_2__["default"], {
        value: totalEvents
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_charts_miniBarChart__WEBPACK_IMPORTED_MODULE_1__["default"], {
      isGroupedByDate: true,
      showTimeInTooltip: true,
      showMarkLineLabel: true,
      height: 42,
      colors: environment ? undefined : [theme.purple300, theme.purple300],
      series: series,
      grid: {
        top: 6,
        bottom: 4,
        left: 4,
        right: 4
      }
    })]
  });
}

GroupReleaseChart.displayName = "GroupReleaseChart";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GroupReleaseChart);

/***/ }),

/***/ "./app/components/group/releaseStats.tsx":
/*!***********************************************!*\
  !*** ./app/components/group/releaseStats.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_alertLink__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/alertLink */ "./app/components/alertLink.tsx");
/* harmony import */ var sentry_components_group_releaseChart__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/group/releaseChart */ "./app/components/group/releaseChart.tsx");
/* harmony import */ var sentry_components_group_seenInfo__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/group/seenInfo */ "./app/components/group/seenInfo.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var _sidebarSection__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./sidebarSection */ "./app/components/group/sidebarSection.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
















const GroupReleaseStats = _ref => {
  let {
    organization,
    project,
    environments,
    allEnvironments,
    group,
    currentRelease
  } = _ref;
  const environment = environments.length > 0 ? environments.map(env => env.displayName).join(', ') : undefined;
  const environmentLabel = environment ? environment : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('All Environments');
  const shortEnvironmentLabel = environments.length > 1 ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('selected environments') : environments.length === 1 ? environments[0].displayName : undefined;
  const projectId = project.id;
  const projectSlug = project.slug;
  const hasRelease = new Set(project.features).has('releases');
  const releaseTrackingUrl = `/settings/${organization.slug}/projects/${project.slug}/release-tracking/`;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("div", {
    children: !group || !allEnvironments ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_6__["default"], {
      height: "288px"
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(GraphContainer, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_group_releaseChart__WEBPACK_IMPORTED_MODULE_4__["default"], {
          group: allEnvironments,
          environment: environment,
          environmentLabel: environmentLabel,
          environmentStats: group.stats,
          release: currentRelease === null || currentRelease === void 0 ? void 0 : currentRelease.release,
          releaseStats: currentRelease === null || currentRelease === void 0 ? void 0 : currentRelease.stats,
          statsPeriod: "24h",
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Last 24 Hours'),
          firstSeen: group.firstSeen,
          lastSeen: group.lastSeen
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(GraphContainer, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_group_releaseChart__WEBPACK_IMPORTED_MODULE_4__["default"], {
          group: allEnvironments,
          environment: environment,
          environmentLabel: environmentLabel,
          environmentStats: group.stats,
          release: currentRelease === null || currentRelease === void 0 ? void 0 : currentRelease.release,
          releaseStats: currentRelease === null || currentRelease === void 0 ? void 0 : currentRelease.stats,
          statsPeriod: "30d",
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Last 30 Days'),
          className: "bar-chart-small",
          firstSeen: group.firstSeen,
          lastSeen: group.lastSeen
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(_sidebarSection__WEBPACK_IMPORTED_MODULE_12__["default"], {
        secondary: true,
        title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Last seen'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(TooltipWrapper, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_7__["default"], {
              title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('When the most recent event in this issue was captured.'),
              disableForVisualTest: true,
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_8__.IconQuestion, {
                size: "xs",
                color: "gray200"
              })
            })
          })]
        }),
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_group_seenInfo__WEBPACK_IMPORTED_MODULE_5__["default"], {
          organization: organization,
          projectId: projectId,
          projectSlug: projectSlug,
          date: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_11__["default"])({
            value: group.lastSeen,
            fixed: '2016-01-13T03:08:25Z'
          }),
          dateGlobal: allEnvironments.lastSeen,
          hasRelease: hasRelease,
          environment: shortEnvironmentLabel,
          release: group.lastRelease || null,
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Last seen')
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(_sidebarSection__WEBPACK_IMPORTED_MODULE_12__["default"], {
        secondary: true,
        title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('First seen'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(TooltipWrapper, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_7__["default"], {
              title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('When the first event in this issue was captured.'),
              disableForVisualTest: true,
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_8__.IconQuestion, {
                size: "xs",
                color: "gray200"
              })
            })
          })]
        }),
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_group_seenInfo__WEBPACK_IMPORTED_MODULE_5__["default"], {
          organization: organization,
          projectId: projectId,
          projectSlug: projectSlug,
          date: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_11__["default"])({
            value: group.firstSeen,
            fixed: '2015-08-13T03:08:25Z'
          }),
          dateGlobal: allEnvironments.firstSeen,
          hasRelease: hasRelease,
          environment: shortEnvironmentLabel,
          release: group.firstRelease || null,
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('First seen')
        })
      }), !hasRelease ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(_sidebarSection__WEBPACK_IMPORTED_MODULE_12__["default"], {
        secondary: true,
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Releases'),
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_alertLink__WEBPACK_IMPORTED_MODULE_3__["default"], {
          priority: "muted",
          size: "small",
          to: releaseTrackingUrl,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('See which release caused this issue ')
        })
      }) : null]
    })
  });
};

GroupReleaseStats.displayName = "GroupReleaseStats";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (/*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_2__.memo)(GroupReleaseStats));

const TooltipWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1ey6wx71"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(0.5), ";" + ( true ? "" : 0));

const GraphContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1ey6wx70"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(3), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/group/seenInfo.tsx":
/*!*******************************************!*\
  !*** ./app/components/group/seenInfo.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/hovercard */ "./app/components/hovercard.tsx");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_components_version__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/version */ "./app/components/version.tsx");
/* harmony import */ var sentry_components_versionHoverCard__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/versionHoverCard */ "./app/components/versionHoverCard.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }














class SeenInfo extends react__WEBPACK_IMPORTED_MODULE_1__.Component {
  shouldComponentUpdate(nextProps) {
    var _nextProps$release;

    const {
      date,
      release
    } = this.props;
    return (release === null || release === void 0 ? void 0 : release.version) !== ((_nextProps$release = nextProps.release) === null || _nextProps$release === void 0 ? void 0 : _nextProps$release.version) || date !== nextProps.date;
  }

  render() {
    const {
      date,
      dateGlobal,
      environment,
      release,
      organization,
      projectSlug,
      projectId
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(HovercardWrapper, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(StyledHovercard, {
        showUnderline: true,
        header: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)("div", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(TimeSinceWrapper, {
            children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Any Environment'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_4__["default"], {
              date: dateGlobal,
              disabledAbsoluteTooltip: true
            })]
          }), environment && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(TimeSinceWrapper, {
            children: [(0,sentry_utils__WEBPACK_IMPORTED_MODULE_9__.toTitleCase)(environment), date ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_4__["default"], {
              date: date,
              disabledAbsoluteTooltip: true
            }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("span", {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('N/A')
            })]
          })]
        }),
        body: date ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(StyledDateTime, {
          date: date
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(NoEnvironment, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)(`N/A for ${environment}`)
        }),
        position: "top",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(DateWrapper, {
          children: date ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(TooltipWrapper, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(StyledTimeSince, {
              date: date,
              disabledAbsoluteTooltip: true
            })
          }) : dateGlobal && environment === '' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_4__["default"], {
              date: dateGlobal,
              disabledAbsoluteTooltip: true
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(StyledTimeSince, {
              date: dateGlobal,
              disabledAbsoluteTooltip: true
            })]
          }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(NoDateTime, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('N/A')
          })
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(DateWrapper, {
        children: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_9__.defined)(release) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('in release '), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_versionHoverCard__WEBPACK_IMPORTED_MODULE_6__["default"], {
            organization: organization,
            projectSlug: projectSlug,
            releaseVersion: release.version,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("span", {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_version__WEBPACK_IMPORTED_MODULE_5__["default"], {
                version: release.version,
                projectId: projectId
              })
            })
          })]
        }) : null
      })]
    });
  }

}

SeenInfo.displayName = "SeenInfo";

const dateTimeCss = p => /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_11__.css)("color:", p.theme.gray300, ";font-size:", p.theme.fontSizeMedium, ";display:flex;justify-content:center;" + ( true ? "" : 0),  true ? "" : 0);

const HovercardWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1rgwh4r8"
} : 0)( true ? {
  name: "gl2qrx",
  styles: "display:flex;align-items:baseline"
} : 0);

const DateWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1rgwh4r7"
} : 0)("margin-bottom:0;", p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

const StyledDateTime = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_2__["default"],  true ? {
  target: "e1rgwh4r6"
} : 0)(dateTimeCss, ";" + ( true ? "" : 0));

const NoEnvironment = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1rgwh4r5"
} : 0)(dateTimeCss, ";" + ( true ? "" : 0));

const NoDateTime = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1rgwh4r4"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(0.5), ";" + ( true ? "" : 0));

const TooltipWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1rgwh4r3"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(0.25), ";svg{margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(0.5), ";position:relative;top:1px;}" + ( true ? "" : 0));

const TimeSinceWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1rgwh4r2"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(0.5), ";display:flex;justify-content:space-between;" + ( true ? "" : 0));

const StyledTimeSince = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "e1rgwh4r1"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";line-height:1.2;" + ( true ? "" : 0));

const StyledHovercard = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_3__.Hovercard,  true ? {
  target: "e1rgwh4r0"
} : 0)("width:250px;", sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_3__.Header, "{font-weight:normal;border-bottom:1px solid ", p => p.theme.innerBorder, ";}", sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_3__.Body, "{padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1.5), ";}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SeenInfo);

/***/ }),

/***/ "./app/components/group/sentryAppExternalIssueActions.tsx":
/*!****************************************************************!*\
  !*** ./app/components/group/sentryAppExternalIssueActions.tsx ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_actionCreators_platformExternalIssues__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/platformExternalIssues */ "./app/actionCreators/platformExternalIssues.tsx");
/* harmony import */ var sentry_components_issueSyncListElement__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/issueSyncListElement */ "./app/components/issueSyncListElement.tsx");
/* harmony import */ var sentry_components_sentryAppComponentIcon__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/sentryAppComponentIcon */ "./app/components/sentryAppComponentIcon.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_recordSentryAppInteraction__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/recordSentryAppInteraction */ "./app/utils/recordSentryAppInteraction.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _sentryAppExternalIssueModal__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./sentryAppExternalIssueModal */ "./app/components/group/sentryAppExternalIssueModal.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

















class SentryAppExternalIssueActions extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      action: 'create',
      externalIssue: this.props.externalIssue
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "doOpenModal", e => {
      // Only show the modal when we don't have a linked issue
      if (this.state.externalIssue) {
        return;
      }

      const {
        group,
        event,
        sentryAppComponent,
        sentryAppInstallation
      } = this.props;
      (0,sentry_utils_recordSentryAppInteraction__WEBPACK_IMPORTED_MODULE_13__.recordInteraction)(sentryAppComponent.sentryApp.slug, 'sentry_app_component_interacted', {
        componentType: 'issue-link'
      });
      e === null || e === void 0 ? void 0 : e.preventDefault();
      (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_5__.openModal)(deps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_sentryAppExternalIssueModal__WEBPACK_IMPORTED_MODULE_15__["default"], { ...deps,
        group,
        event,
        sentryAppComponent,
        sentryAppInstallation,
        onSubmitSuccess: this.onSubmitSuccess
      }), {
        allowClickClose: false
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "deleteIssue", () => {
      const {
        api,
        group
      } = this.props;
      const {
        externalIssue
      } = this.state;
      externalIssue && (0,sentry_actionCreators_platformExternalIssues__WEBPACK_IMPORTED_MODULE_6__.deleteExternalIssue)(api, group.id, externalIssue.id).then(_data => {
        this.setState({
          externalIssue: undefined
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Successfully unlinked issue.'));
      }).catch(_error => {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Unable to unlink issue.'));
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onAddRemoveClick", () => {
      const {
        externalIssue
      } = this.state;

      if (!externalIssue) {
        this.doOpenModal();
      } else {
        this.deleteIssue();
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onSubmitSuccess", externalIssue => {
      this.setState({
        externalIssue
      });
    });
  }

  componentDidUpdate(prevProps) {
    if (this.props.externalIssue !== prevProps.externalIssue) {
      this.updateExternalIssue(this.props.externalIssue);
    }
  }

  updateExternalIssue(externalIssue) {
    this.setState({
      externalIssue
    });
  }

  render() {
    const {
      sentryAppComponent,
      disabled
    } = this.props;
    const {
      externalIssue
    } = this.state;
    const name = sentryAppComponent.sentryApp.name;
    let url = '#';
    let displayName = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.tct)('[name] Issue', {
      name
    });

    if (externalIssue) {
      url = externalIssue.webUrl;
      displayName = externalIssue.displayName;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(IssueLinkContainer, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(IssueLink, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledSentryAppComponentIcon, {
          sentryAppComponent: sentryAppComponent
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_9__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.tct)('Unable to connect to [provider].', {
            provider: sentryAppComponent.sentryApp.name
          }),
          disabled: !disabled,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledIntegrationLink, {
            onClick: e => disabled ? e.preventDefault() : this.doOpenModal(),
            href: url,
            disabled: disabled,
            children: displayName
          })
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledIcon, {
        disabled: disabled,
        onClick: () => !disabled && this.onAddRemoveClick(),
        children: !!externalIssue ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconClose, {}) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconAdd, {})
      })]
    });
  }

}

SentryAppExternalIssueActions.displayName = "SentryAppExternalIssueActions";

const StyledSentryAppComponentIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_sentryAppComponentIcon__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "e1txsdtz4"
} : 0)("color:", p => p.theme.textColor, ";width:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(3), ";height:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(3), ";cursor:pointer;flex-shrink:0;" + ( true ? "" : 0));

const IssueLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1txsdtz3"
} : 0)( true ? {
  name: "p2fe58",
  styles: "display:flex;align-items:center;min-width:0"
} : 0);

const StyledIntegrationLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_issueSyncListElement__WEBPACK_IMPORTED_MODULE_7__.IntegrationLink,  true ? {
  target: "e1txsdtz2"
} : 0)("color:", _ref => {
  let {
    disabled,
    theme
  } = _ref;
  return disabled ? theme.disabled : theme.textColor;
}, ";" + ( true ? "" : 0));

const IssueLinkContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1txsdtz1"
} : 0)( true ? {
  name: "1ctrpvd",
  styles: "line-height:0;display:flex;align-items:center;justify-content:space-between;margin-bottom:16px"
} : 0);

const StyledIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e1txsdtz0"
} : 0)("color:", _ref2 => {
  let {
    disabled,
    theme
  } = _ref2;
  return disabled ? theme.disabled : theme.textColor;
}, ";cursor:pointer;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_14__["default"])(SentryAppExternalIssueActions));

/***/ }),

/***/ "./app/components/group/sentryAppExternalIssueForm.tsx":
/*!*************************************************************!*\
  !*** ./app/components/group/sentryAppExternalIssueForm.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SentryAppExternalIssueForm": () => (/* binding */ SentryAppExternalIssueForm),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_externalIssueStore__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/stores/externalIssueStore */ "./app/stores/externalIssueStore.tsx");
/* harmony import */ var sentry_utils_getStacktraceBody__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/getStacktraceBody */ "./app/utils/getStacktraceBody.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_views_organizationIntegrations_sentryAppExternalForm__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/views/organizationIntegrations/sentryAppExternalForm */ "./app/views/organizationIntegrations/sentryAppExternalForm.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









class SentryAppExternalIssueForm extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onSubmitSuccess", issue => {
      sentry_stores_externalIssueStore__WEBPACK_IMPORTED_MODULE_4__["default"].add(issue);
      this.props.onSubmitSuccess(issue);
    });
  }

  getStacktrace() {
    const evt = this.props.event;
    const contentArr = (0,sentry_utils_getStacktraceBody__WEBPACK_IMPORTED_MODULE_5__["default"])(evt);

    if (contentArr && contentArr.length > 0) {
      return '\n\n```\n' + contentArr[0] + '\n```';
    }

    return '';
  }

  getFieldDefault(field) {
    const {
      group,
      appName
    } = this.props;

    if (field.type === 'textarea') {
      field.maxRows = 10;
      field.autosize = true;
    }

    switch (field.default) {
      case 'issue.title':
        return group.title;

      case 'issue.description':
        const stacktrace = this.getStacktrace();
        const queryParams = {
          referrer: appName
        };
        const url = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_6__.addQueryParamsToExistingUrl)(group.permalink, queryParams);
        const shortId = group.shortId;
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Sentry Issue: [%s](%s)%s', shortId, url, stacktrace);

      default:
        return '';
    }
  }

  render() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_views_organizationIntegrations_sentryAppExternalForm__WEBPACK_IMPORTED_MODULE_7__["default"], {
      sentryAppInstallationUuid: this.props.sentryAppInstallation.uuid,
      appName: this.props.appName,
      config: this.props.config,
      action: this.props.action,
      element: "issue-link",
      extraFields: {
        groupId: this.props.group.id
      },
      extraRequestBody: {
        projectId: this.props.group.project.id
      },
      onSubmitSuccess: this.onSubmitSuccess // Needs to bind to access this.props
      ,
      getFieldDefault: field => this.getFieldDefault(field)
    });
  }

}
SentryAppExternalIssueForm.displayName = "SentryAppExternalIssueForm";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SentryAppExternalIssueForm);

/***/ }),

/***/ "./app/components/group/sentryAppExternalIssueModal.tsx":
/*!**************************************************************!*\
  !*** ./app/components/group/sentryAppExternalIssueModal.tsx ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_group_sentryAppExternalIssueForm__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/group/sentryAppExternalIssueForm */ "./app/components/group/sentryAppExternalIssueForm.tsx");
/* harmony import */ var sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/navTabs */ "./app/components/navTabs.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










class SentryAppExternalIssueModal extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      action: 'create'
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "showLink", () => {
      this.setState({
        action: 'link'
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "showCreate", () => {
      this.setState({
        action: 'create'
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onSubmitSuccess", externalIssue => {
      this.props.onSubmitSuccess(externalIssue);
      this.props.closeModal();
    });
  }

  render() {
    const {
      Header,
      Body,
      sentryAppComponent,
      sentryAppInstallation,
      group
    } = this.props;
    const {
      action
    } = this.state;
    const name = sentryAppComponent.sentryApp.name;
    const config = sentryAppComponent.schema[action];
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Header, {
        closeButton: true,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.tct)('[name] Issue', {
          name
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_4__["default"], {
        underlined: true,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("li", {
          className: action === 'create' ? 'active create' : 'create',
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("a", {
            onClick: this.showCreate,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Create')
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("li", {
          className: action === 'link' ? 'active link' : 'link',
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("a", {
            onClick: this.showLink,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Link')
          })
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Body, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_group_sentryAppExternalIssueForm__WEBPACK_IMPORTED_MODULE_3__["default"], {
          group: group,
          sentryAppInstallation: sentryAppInstallation,
          appName: name,
          config: config,
          action: action,
          onSubmitSuccess: this.onSubmitSuccess,
          event: this.props.event
        })
      })]
    });
  }

}

SentryAppExternalIssueModal.displayName = "SentryAppExternalIssueModal";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_6__["default"])(SentryAppExternalIssueModal));

/***/ }),

/***/ "./app/components/group/sidebar.tsx":
/*!******************************************!*\
  !*** ./app/components/group/sidebar.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var lodash_isObject__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/isObject */ "../node_modules/lodash/isObject.js");
/* harmony import */ var lodash_isObject__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_isObject__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var lodash_keyBy__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/keyBy */ "../node_modules/lodash/keyBy.js");
/* harmony import */ var lodash_keyBy__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_keyBy__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var lodash_pickBy__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! lodash/pickBy */ "../node_modules/lodash/pickBy.js");
/* harmony import */ var lodash_pickBy__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(lodash_pickBy__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/environmentPageFilter */ "./app/components/environmentPageFilter.tsx");
/* harmony import */ var sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/errorBoundary */ "./app/components/errorBoundary.tsx");
/* harmony import */ var sentry_components_group_externalIssuesList__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/group/externalIssuesList */ "./app/components/group/externalIssuesList.tsx");
/* harmony import */ var sentry_components_group_participants__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/group/participants */ "./app/components/group/participants.tsx");
/* harmony import */ var sentry_components_group_releaseStats__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/group/releaseStats */ "./app/components/group/releaseStats.tsx");
/* harmony import */ var sentry_components_group_suggestedOwners_suggestedOwners__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/group/suggestedOwners/suggestedOwners */ "./app/components/group/suggestedOwners/suggestedOwners.tsx");
/* harmony import */ var sentry_components_group_tagDistributionMeter__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/group/tagDistributionMeter */ "./app/components/group/tagDistributionMeter.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _sidebarSection__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ./sidebarSection */ "./app/components/group/sidebarSection.tsx");
/* harmony import */ var _suspectReleases__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ./suspectReleases */ "./app/components/group/suspectReleases.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


























class BaseGroupSidebar extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      participants: [],
      environments: this.props.environments
    });
  }

  componentDidMount() {
    this.fetchAllEnvironmentsGroupData();
    this.fetchCurrentRelease();
    this.fetchParticipants();
    this.fetchTagData();
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (!lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default()(nextProps.environments, this.props.environments)) {
      this.setState({
        environments: nextProps.environments
      }, this.fetchTagData);
    }
  }

  async fetchAllEnvironmentsGroupData() {
    const {
      group,
      api
    } = this.props; // Fetch group data for all environments since the one passed in props is filtered for the selected environment
    // The charts rely on having all environment data as well as the data for the selected env

    try {
      const query = {
        collapse: 'release'
      };
      const allEnvironmentsGroupData = await api.requestPromise(`/issues/${group.id}/`, {
        query
      }); // eslint-disable-next-line react/no-did-mount-set-state

      this.setState({
        allEnvironmentsGroupData
      });
    } catch {
      // eslint-disable-next-line react/no-did-mount-set-state
      this.setState({
        error: true
      });
    }
  }

  async fetchCurrentRelease() {
    const {
      group,
      api
    } = this.props;

    try {
      const {
        currentRelease
      } = await api.requestPromise(`/issues/${group.id}/current-release/`);
      this.setState({
        currentRelease
      });
    } catch {
      this.setState({
        error: true
      });
    }
  }

  async fetchParticipants() {
    const {
      group,
      api
    } = this.props;

    try {
      const participants = await api.requestPromise(`/issues/${group.id}/participants/`);
      this.setState({
        participants,
        error: false
      });
      return participants;
    } catch {
      this.setState({
        error: true
      });
      return [];
    }
  }

  async fetchTagData() {
    const {
      api,
      group
    } = this.props;

    try {
      // Fetch the top values for the current group's top tags.
      const data = await api.requestPromise(`/issues/${group.id}/tags/`, {
        query: lodash_pickBy__WEBPACK_IMPORTED_MODULE_7___default()({
          key: group.tags.map(tag => tag.key),
          environment: this.state.environments.map(env => env.name)
        })
      });
      this.setState({
        tagsWithTopValues: lodash_keyBy__WEBPACK_IMPORTED_MODULE_6___default()(data, 'key')
      });
    } catch {
      this.setState({
        tagsWithTopValues: {},
        error: true
      });
    }
  }

  renderPluginIssue() {
    const issues = [];
    (this.props.group.pluginIssues || []).forEach(plugin => {
      const issue = plugin.issue; // # TODO(dcramer): remove plugin.title check in Sentry 8.22+

      if (issue) {
        issues.push((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)("span", {
            children: `${plugin.shortName || plugin.name || plugin.title}: `
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)("a", {
            href: issue.url,
            children: lodash_isObject__WEBPACK_IMPORTED_MODULE_5___default()(issue.label) ? issue.label.id : issue.label
          })]
        }, plugin.slug));
      }
    });

    if (!issues.length) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(_sidebarSection__WEBPACK_IMPORTED_MODULE_21__["default"], {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('External Issues'),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(ExternalIssues, {
        children: issues
      })
    });
  }

  renderParticipantData() {
    const {
      error,
      participants = []
    } = this.state;

    if (error) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_16__["default"], {
        message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('There was an error while trying to load participants.')
      });
    }

    return participants.length !== 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_group_participants__WEBPACK_IMPORTED_MODULE_12__["default"], {
      participants: participants
    });
  }

  render() {
    const {
      event,
      group,
      organization,
      project,
      environments
    } = this.props;
    const {
      allEnvironmentsGroupData,
      currentRelease,
      tagsWithTopValues
    } = this.state;
    const projectId = project.slug;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(Container, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(PageFiltersContainer, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_9__["default"], {
          alignDropdown: "right"
        })
      }), event && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_group_suggestedOwners_suggestedOwners__WEBPACK_IMPORTED_MODULE_14__["default"], {
        project: project,
        group: group,
        event: event
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_group_releaseStats__WEBPACK_IMPORTED_MODULE_13__["default"], {
        organization: organization,
        project: project,
        environments: environments,
        allEnvironments: allEnvironmentsGroupData,
        group: group,
        currentRelease: currentRelease
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_8__["default"], {
        organization: organization,
        features: ['active-release-monitor-alpha'],
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(_suspectReleases__WEBPACK_IMPORTED_MODULE_22__["default"], {
          group: group
        })
      }), event && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_10__["default"], {
        mini: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_group_externalIssuesList__WEBPACK_IMPORTED_MODULE_11__["default"], {
          project: project,
          group: group,
          event: event
        })
      }), this.renderPluginIssue(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(_sidebarSection__WEBPACK_IMPORTED_MODULE_21__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Tags'),
        children: [!tagsWithTopValues ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(TagPlaceholders, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_17__["default"], {
            height: "40px"
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_17__["default"], {
            height: "40px"
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_17__["default"], {
            height: "40px"
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_17__["default"], {
            height: "40px"
          })]
        }) : group.tags.map(tag => {
          const tagWithTopValues = tagsWithTopValues[tag.key];
          const topValues = tagWithTopValues ? tagWithTopValues.topValues : [];
          const topValuesTotal = tagWithTopValues ? tagWithTopValues.totalValues : 0;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_group_tagDistributionMeter__WEBPACK_IMPORTED_MODULE_15__["default"], {
            tag: tag.key,
            totalValues: topValuesTotal,
            topValues: topValues,
            name: tag.name,
            organization: organization,
            projectId: projectId,
            group: group
          }, tag.key);
        }), group.tags.length === 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)("p", {
          "data-test-id": "no-tags",
          children: environments.length ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('No tags found in the selected environments') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('No tags found')
        })]
      }), this.renderParticipantData()]
    });
  }

}

BaseGroupSidebar.displayName = "BaseGroupSidebar";

const PageFiltersContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eofpip33"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_19__["default"])(2), ";" + ( true ? "" : 0));

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eofpip32"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

const TagPlaceholders = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eofpip31"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_19__["default"])(1), ";grid-auto-flow:row;" + ( true ? "" : 0));

const ExternalIssues = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eofpip30"
} : 0)("display:grid;grid-template-columns:auto max-content;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_19__["default"])(2), ";" + ( true ? "" : 0));

const GroupSidebar = (0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_20__["default"])(BaseGroupSidebar);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GroupSidebar);

/***/ }),

/***/ "./app/components/group/sidebarSection.tsx":
/*!*************************************************!*\
  !*** ./app/components/group/sidebarSection.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






const Heading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('h5',  true ? {
  target: "e1skh4nt2"
} : 0)("display:flex;align-items:center;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(2), ";font-size:", p => p.theme.fontSizeMedium, ";line-height:1;&:after{flex:1;display:block;content:'';border-top:1px solid ", p => p.theme.innerBorder, ";margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), ";}" + ( true ? "" : 0));

const Subheading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('h6',  true ? {
  target: "e1skh4nt1"
} : 0)("color:", p => p.theme.gray300, ";display:flex;align-items:center;font-size:", p => p.theme.fontSizeExtraSmall, ";text-transform:uppercase;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), ";line-height:1;" + ( true ? "" : 0));

/**
 * Used to add a new section in Issue Details' sidebar.
 */
function SidebarSection(_ref) {
  let {
    title,
    children,
    secondary,
    ...props
  } = _ref;
  const HeaderComponent = secondary ? Subheading : Heading;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(HeaderComponent, { ...props,
      children: title
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(SectionContent, {
      children: children
    })]
  });
}

SidebarSection.displayName = "SidebarSection";

const SectionContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1skh4nt0"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(4), ";line-height:1;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SidebarSection);

/***/ }),

/***/ "./app/components/group/suggestedOwnerHovercard.tsx":
/*!**********************************************************!*\
  !*** ./app/components/group/suggestedOwnerHovercard.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_avatar_actorAvatar__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/avatar/actorAvatar */ "./app/components/avatar/actorAvatar.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_commitLink__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/commitLink */ "./app/components/commitLink.tsx");
/* harmony import */ var sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/hovercard */ "./app/components/hovercard.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_version__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/version */ "./app/components/version.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }



















class SuggestedOwnerHovercard extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      commitsExpanded: false,
      rulesExpanded: false
    });
  }

  render() {
    const {
      organization,
      actor,
      commits,
      rules,
      release,
      projectId,
      ...props
    } = this.props;
    const {
      commitsExpanded,
      rulesExpanded
    } = this.state;
    const modalData = {
      initialData: [{
        emails: actor.email ? new Set([actor.email]) : new Set([])
      }],
      source: 'suggested_assignees'
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(StyledHovercard, {
      header: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(HovercardHeader, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_avatar_actorAvatar__WEBPACK_IMPORTED_MODULE_7__["default"], {
            size: 20,
            hasTooltip: false,
            actor: actor
          }), actor.name || actor.email]
        }), actor.id === undefined && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(EmailAlert, {
          type: "warning",
          showIcon: true,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.tct)('The email [actorEmail] is not a member of your organization. [inviteUser:Invite] them or link additional emails in [accountSettings:account settings].', {
            actorEmail: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("strong", {
              children: actor.email
            }),
            accountSettings: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_11__["default"], {
              to: "/settings/account/emails/"
            }),
            inviteUser: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("a", {
              onClick: () => (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_5__.openInviteMembersModal)(modalData)
            })
          })
        })]
      }),
      body: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(HovercardBody, {
        children: [commits !== undefined && !release && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_10__.Divider, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("h6", {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Commits')
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("div", {
            children: commits.slice(0, commitsExpanded ? commits.length : 3).map((_ref, i) => {
              let {
                message,
                dateCreated
              } = _ref;
              return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(CommitReasonItem, {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(CommitIcon, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(CommitMessage, {
                  message: message !== null && message !== void 0 ? message : undefined,
                  date: dateCreated
                })]
              }, i);
            })
          }), commits.length > 3 && !commitsExpanded ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(ViewMoreButton, {
            priority: "link",
            size: "zero",
            onClick: () => this.setState({
              commitsExpanded: true
            }),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('View more')
          }) : null]
        }), commits !== undefined && release && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_10__.Divider, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("h6", {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Suspect Release')
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("div", {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(CommitReasonItem, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(OwnershipTag, {
                tagType: "release"
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(ReleaseValue, {
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.tct)('[actor] [verb] [commits] in [release]', {
                  actor: actor.name,
                  verb: commits.length > 1 ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('made') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('last committed'),
                  commits: commits.length > 1 ? // Link to release commits
                  (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_11__["default"], {
                    to: {
                      pathname: `/organizations/${organization === null || organization === void 0 ? void 0 : organization.slug}/releases/${encodeURIComponent(release.version)}/commits/`,
                      query: {
                        project: projectId
                      }
                    },
                    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('%s commits', commits.length)
                  }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_commitLink__WEBPACK_IMPORTED_MODULE_9__["default"], {
                    inline: true,
                    showIcon: false,
                    commitId: commits[0].id,
                    repository: commits[0].repository
                  }),
                  release: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_version__WEBPACK_IMPORTED_MODULE_12__["default"], {
                    version: release.version,
                    projectId: projectId
                  })
                })
              })]
            })
          })]
        }), (0,sentry_utils__WEBPACK_IMPORTED_MODULE_16__.defined)(rules) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_10__.Divider, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("h6", {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Matching Ownership Rules')
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("div", {
            children: rules.slice(0, rulesExpanded ? rules.length : 3).map((_ref2, i) => {
              let [type, matched] = _ref2;
              return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(RuleReasonItem, {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(OwnershipTag, {
                  tagType: type
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(OwnershipValue, {
                  children: matched
                })]
              }, i);
            })
          }), rules.length > 3 && !rulesExpanded ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(ViewMoreButton, {
            priority: "link",
            size: "zero",
            onClick: () => this.setState({
              rulesExpanded: true
            }),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('View more')
          }) : null]
        })]
      }),
      ...props
    });
  }

}

SuggestedOwnerHovercard.displayName = "SuggestedOwnerHovercard";
const tagColors = {
  url: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_17__["default"].green200,
  path: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_17__["default"].purple300,
  tag: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_17__["default"].blue300,
  codeowners: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_17__["default"].pink300,
  release: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_17__["default"].pink200
};

const StyledHovercard = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_10__.Hovercard,  true ? {
  target: "e1qc9wyy12"
} : 0)( true ? {
  name: "3s4yqf",
  styles: "width:400px"
} : 0);

const CommitIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_13__.IconCommit,  true ? {
  target: "e1qc9wyy11"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(0.5), ";flex-shrink:0;" + ( true ? "" : 0));

const CommitMessage = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(_ref3 => {
  let {
    message = '',
    date,
    ...props
  } = _ref3;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)("div", { ...props,
    children: [message.split('\n')[0], (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(CommitDate, {
      date: date
    })]
  });
},  true ? {
  target: "e1qc9wyy10"
} : 0)("color:", p => p.theme.textColor, ";font-size:", p => p.theme.fontSizeExtraSmall, ";margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(0.25), ";hyphens:auto;" + ( true ? "" : 0));

const CommitDate = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(_ref4 => {
  let {
    date,
    ...props
  } = _ref4;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("div", { ...props,
    children: moment__WEBPACK_IMPORTED_MODULE_4___default()(date).fromNow()
  });
},  true ? {
  target: "e1qc9wyy9"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(0.5), ";color:", p => p.theme.gray300, ";" + ( true ? "" : 0));

const CommitReasonItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1qc9wyy8"
} : 0)("display:flex;align-items:flex-start;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1), ";" + ( true ? "" : 0));

const RuleReasonItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1qc9wyy7"
} : 0)("display:flex;align-items:flex-start;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1), ";" + ( true ? "" : 0));

const OwnershipTag = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(_ref5 => {
  let {
    tagType,
    ...props
  } = _ref5;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("div", { ...props,
    children: tagType
  });
},  true ? {
  target: "e1qc9wyy6"
} : 0)("background:", p => tagColors[p.tagType.indexOf('tags') === -1 ? p.tagType : 'tag'], ";color:", p => p.theme.white, ";font-size:", p => p.theme.fontSizeExtraSmall, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(0.25), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(0.5), ";margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(0.25), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(0.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(0.25), " 0;border-radius:2px;font-weight:bold;text-align:center;" + ( true ? "" : 0));

const ViewMoreButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "e1qc9wyy5"
} : 0)("border:none;color:", p => p.theme.gray300, ";font-size:", p => p.theme.fontSizeExtraSmall, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(0.25), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(0.5), ";margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(0.25), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(0.25), " 0;width:100%;min-width:34px;" + ( true ? "" : 0));

const OwnershipValue = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('code',  true ? {
  target: "e1qc9wyy4"
} : 0)("word-break:break-all;font-size:", p => p.theme.fontSizeExtraSmall, ";margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(0.25), ";" + ( true ? "" : 0));

const ReleaseValue = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1qc9wyy3"
} : 0)("font-size:", p => p.theme.fontSizeSmall, ";margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(0.5), ";" + ( true ? "" : 0));

const EmailAlert = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_alert__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e1qc9wyy2"
} : 0)("margin:10px -13px -13px;border-radius:0;border-color:#ece0b0;font-size:", p => p.theme.fontSizeSmall, ";font-weight:normal;box-shadow:none;" + ( true ? "" : 0));

const HovercardHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1qc9wyy1"
} : 0)("display:flex;align-items:center;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1), ";" + ( true ? "" : 0));

const HovercardBody = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1qc9wyy0"
} : 0)("margin-top:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(2), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SuggestedOwnerHovercard);

/***/ }),

/***/ "./app/components/group/suggestedOwners/findMatchedRules.tsx":
/*!*******************************************************************!*\
  !*** ./app/components/group/suggestedOwners/findMatchedRules.tsx ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "findMatchedRules": () => (/* binding */ findMatchedRules)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);


// TODO(ts): add the correct type

/**
 * Given a list of rule objects returned from the API, locate the matching
 * rules for a specific owner.
 */
function findMatchedRules(rules, owner) {
  if (!rules) {
    return undefined;
  }

  const matchOwner = (actorType, key) => actorType === 'user' && key === owner.email || actorType === 'team' && key === owner.name;

  const actorHasOwner = _ref => {
    let [actorType, key] = _ref;
    return actorType === owner.type && matchOwner(actorType, key);
  };

  return rules.filter(_ref2 => {
    let [_, ruleActors] = _ref2;
    return ruleActors.find(actorHasOwner);
  }).map(_ref3 => {
    let [rule] = _ref3;
    return rule;
  });
}



/***/ }),

/***/ "./app/components/group/suggestedOwners/ownershipRules.tsx":
/*!*****************************************************************!*\
  !*** ./app/components/group/suggestedOwners/ownershipRules.tsx ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "OwnershipRules": () => (/* binding */ OwnershipRules)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/assistant/guideAnchor */ "./app/components/assistant/guideAnchor.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_hookOrDefault__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/hookOrDefault */ "./app/components/hookOrDefault.tsx");
/* harmony import */ var sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/hovercard */ "./app/components/hovercard.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var _sidebarSection__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ../sidebarSection */ "./app/components/group/sidebarSection.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


















const CodeOwnersCTA = (0,sentry_components_hookOrDefault__WEBPACK_IMPORTED_MODULE_7__["default"])({
  hookName: 'component:codeowners-cta',
  defaultComponent: _ref => {
    let {
      organization,
      project
    } = _ref;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(SetupButton, {
      size: "xs",
      priority: "primary",
      to: `/settings/${organization.slug}/projects/${project.slug}/ownership/`,
      onClick: () => (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_13__.trackIntegrationAnalytics)('integrations.code_owners_cta_setup_clicked', {
        view: 'stacktrace_issue_details',
        project_id: project.id,
        organization
      }),
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Setup')
    });
  }
});

const OwnershipRules = _ref2 => {
  let {
    project,
    organization,
    issueId,
    codeowners,
    isDismissed,
    handleCTAClose
  } = _ref2;

  const handleOpenCreateOwnershipRule = () => {
    (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_2__.openCreateOwnershipRule)({
      project,
      organization,
      issueId
    });
  };

  const showCTA = !codeowners.length && !isDismissed;

  const createRuleButton = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_3__["default"], {
    access: ['project:write'],
    children: _ref3 => {
      let {
        hasAccess
      } = _ref3;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_4__["default"], {
        target: "owners",
        position: "bottom",
        offset: 20,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
          onClick: handleOpenCreateOwnershipRule,
          size: "sm",
          disabled: !hasAccess,
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)("You don't have permission to create ownership rules."),
          tooltipProps: {
            disabled: hasAccess
          },
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Create Ownership Rule')
        })
      });
    }
  });

  const codeOwnersCTA = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(Container, {
    dashedBorder: true,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(HeaderContainer, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(Header, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Codeowners sync')
      }), ' ', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(DismissButton, {
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconClose, {
          size: "xs"
        }),
        priority: "link",
        onClick: () => handleCTAClose(),
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Close')
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(Content, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Import GitHub or GitLab CODEOWNERS files to automatically assign issues to the right people.')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_6__["default"], {
      gap: 1,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(CodeOwnersCTA, {
        organization: organization,
        project: project
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
        size: "xs",
        external: true,
        href: "https://docs.sentry.io/product/issues/issue-owners/#code-owners",
        onClick: () => (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_13__.trackIntegrationAnalytics)('integrations.code_owners_cta_docs_clicked', {
          view: 'stacktrace_issue_details',
          project_id: project.id,
          organization
        }),
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Read Docs')
      })]
    })]
  });

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_sidebarSection__WEBPACK_IMPORTED_MODULE_14__["default"], {
    title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Ownership Rules'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_emotion_react__WEBPACK_IMPORTED_MODULE_16__.ClassNames, {
        children: _ref4 => {
          let {
            css
          } = _ref4;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_8__.Hovercard, {
            body: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(HelpfulBody, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("p", {
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Ownership rules allow you to associate file paths and URLs to specific teams or users, so alerts can be routed to the right people.')
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
                external: true,
                href: "https://docs.sentry.io/workflow/issue-owners/",
                priority: "primary",
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Learn more')
              })]
            }),
            containerClassName: css`
                  display: flex;
                  align-items: center;
                `,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(StyledIconQuestion, {
              size: "xs",
              color: "gray200"
            })
          });
        }
      })]
    }),
    children: showCTA ? codeOwnersCTA : createRuleButton
  });
};

OwnershipRules.displayName = "OwnershipRules";


const StyledIconQuestion = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconQuestion,  true ? {
  target: "e196vw9g7"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(0.5), ";" + ( true ? "" : 0));

const HelpfulBody = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e196vw9g6"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";text-align:center;" + ( true ? "" : 0));

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.Panel,  true ? {
  target: "e196vw9g5"
} : 0)("background:none;display:flex;flex-direction:column;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(2), ";" + ( true ? "" : 0));

const HeaderContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e196vw9g4"
} : 0)( true ? {
  name: "xhrh7k",
  styles: "display:grid;grid-template-columns:max-content max-content 1fr;align-items:flex-start"
} : 0);

const Header = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('h6',  true ? {
  target: "e196vw9g3"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";text-transform:uppercase;font-weight:bold;color:", p => p.theme.gray300, ";font-size:", p => p.theme.fontSizeExtraSmall, ";" + ( true ? "" : 0));

const Content = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e196vw9g2"
} : 0)("color:", p => p.theme.textColor, ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(2), ";" + ( true ? "" : 0));

const SetupButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e196vw9g1"
} : 0)("&:focus{color:", p => p.theme.white, ";}" + ( true ? "" : 0));

const DismissButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e196vw9g0"
} : 0)("position:absolute;top:0;right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";color:", p => p.theme.gray400, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/group/suggestedOwners/suggestedAssignees.tsx":
/*!*********************************************************************!*\
  !*** ./app/components/group/suggestedOwners/suggestedAssignees.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SuggestedAssignees": () => (/* binding */ SuggestedAssignees)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_avatar_actorAvatar__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/avatar/actorAvatar */ "./app/components/avatar/actorAvatar.tsx");
/* harmony import */ var sentry_components_group_suggestedOwnerHovercard__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/group/suggestedOwnerHovercard */ "./app/components/group/suggestedOwnerHovercard.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _sidebarSection__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../sidebarSection */ "./app/components/group/sidebarSection.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }











var _ref =  true ? {
  name: "e0dnmk",
  styles: "cursor:pointer"
} : 0;

const SuggestedAssignees = _ref2 => {
  let {
    owners,
    projectId,
    organization,
    onAssign
  } = _ref2;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(_sidebarSection__WEBPACK_IMPORTED_MODULE_6__["default"], {
    title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Suggested Assignees'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Subheading, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Click to assign')
      })]
    }),
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Content, {
      children: owners.map((owner, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_group_suggestedOwnerHovercard__WEBPACK_IMPORTED_MODULE_3__["default"], {
        projectId: projectId,
        organization: organization,
        ...owner,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_avatar_actorAvatar__WEBPACK_IMPORTED_MODULE_2__["default"], {
          css: _ref,
          onClick: onAssign(owner.actor),
          hasTooltip: false,
          actor: owner.actor,
          "data-test-id": "suggested-assignee"
        })
      }, `${owner.actor.id}:${owner.actor.email}:${owner.actor.name}:${i}`))
    })
  });
};

SuggestedAssignees.displayName = "SuggestedAssignees";


const Subheading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('small',  true ? {
  target: "e1lhkh1d1"
} : 0)("font-size:", p => p.theme.fontSizeExtraSmall, ";color:", p => p.theme.gray300, ";line-height:100%;font-weight:400;margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(0.5), ";" + ( true ? "" : 0));

const Content = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1lhkh1d0"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), ";grid-template-columns:repeat(auto-fill, 20px);" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/group/suggestedOwners/suggestedOwners.tsx":
/*!******************************************************************!*\
  !*** ./app/components/group/suggestedOwners/suggestedOwners.tsx ***!
  \******************************************************************/
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
/* harmony import */ var sentry_actionCreators_group__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/group */ "./app/actionCreators/group.tsx");
/* harmony import */ var sentry_actionCreators_prompts__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/prompts */ "./app/actionCreators/prompts.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var sentry_utils_promptIsDismissed__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/promptIsDismissed */ "./app/utils/promptIsDismissed.tsx");
/* harmony import */ var sentry_utils_useCommitters__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/useCommitters */ "./app/utils/useCommitters.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var _findMatchedRules__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./findMatchedRules */ "./app/components/group/suggestedOwners/findMatchedRules.tsx");
/* harmony import */ var _ownershipRules__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./ownershipRules */ "./app/components/group/suggestedOwners/ownershipRules.tsx");
/* harmony import */ var _suggestedAssignees__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./suggestedAssignees */ "./app/components/group/suggestedOwners/suggestedAssignees.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");

















class SuggestedOwners extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_6__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleCTAClose", () => {
      const {
        organization,
        project
      } = this.props;
      (0,sentry_actionCreators_prompts__WEBPACK_IMPORTED_MODULE_5__.promptsUpdate)(this.api, {
        organizationId: organization.id,
        projectId: project.id,
        feature: 'code_owners',
        status: 'dismissed'
      });
      this.setState({
        isDismissed: true
      }, () => (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_7__.trackIntegrationAnalytics)('integrations.dismissed_code_owners_prompt', {
        view: 'stacktrace_issue_details',
        project_id: project.id,
        organization
      }));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleAssign", actor => () => {
      if (actor.id === undefined) {
        return;
      }

      const {
        event
      } = this.props;

      if (actor.type === 'user') {
        // TODO(ts): `event` here may not be 100% correct
        // in this case groupID should always exist on event
        // since this is only used in Issue Details
        (0,sentry_actionCreators_group__WEBPACK_IMPORTED_MODULE_4__.assignToUser)({
          id: event.groupID,
          user: actor,
          assignedBy: 'suggested_assignee'
        });
      }

      if (actor.type === 'team') {
        (0,sentry_actionCreators_group__WEBPACK_IMPORTED_MODULE_4__.assignToActor)({
          id: event.groupID,
          actor,
          assignedBy: 'suggested_assignee'
        });
      }
    });
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      event: {
        rules: [],
        owners: []
      },
      codeowners: [],
      isDismissed: true
    };
  }

  getEndpoints() {
    const {
      project,
      organization,
      event
    } = this.props;
    const endpoints = [['eventOwners', `/projects/${organization.slug}/${project.slug}/events/${event.id}/owners/`]];

    if (organization.features.includes('integrations-codeowners')) {
      endpoints.push([`codeowners`, `/projects/${organization.slug}/${project.slug}/codeowners/`]);
    }

    return endpoints;
  }

  async onLoadAllEndpointsSuccess() {
    await this.checkCodeOwnersPrompt();
  }

  componentDidUpdate(prevProps) {
    if (this.props.event && prevProps.event) {
      if (this.props.event.id !== prevProps.event.id) {
        // two events, with different IDs
        this.reloadData();
      }

      return;
    }

    if (this.props.event) {
      // going from having no event to having an event
      this.reloadData();
    }
  }

  async checkCodeOwnersPrompt() {
    const {
      organization,
      project
    } = this.props;
    this.setState({
      loading: true
    }); // check our prompt backend

    const promptData = await (0,sentry_actionCreators_prompts__WEBPACK_IMPORTED_MODULE_5__.promptsCheck)(this.api, {
      organizationId: organization.id,
      projectId: project.id,
      feature: 'code_owners'
    });
    const isDismissed = (0,sentry_utils_promptIsDismissed__WEBPACK_IMPORTED_MODULE_8__.promptIsDismissed)(promptData, 30);
    this.setState({
      isDismissed,
      loading: false
    }, () => {
      if (!isDismissed) {
        // now record the results
        (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_7__.trackIntegrationAnalytics)('integrations.show_code_owners_prompt', {
          view: 'stacktrace_issue_details',
          project_id: project.id,
          organization
        }, {
          startSession: true
        });
      }
    });
  }

  /**
   * Combine the committer and ownership data into a single array, merging
   * users who are both owners based on having commits, and owners matching
   * project ownership rules into one array.
   *
   * The return array will include objects of the format:
   *
   * {
   *   actor: <
   *    type,              # Either user or team
   *    SentryTypes.User,  # API expanded user object
   *    {email, id, name}  # Sentry user which is *not* expanded
   *    {email, name}      # Unidentified user (from commits)
   *    {id, name},        # Sentry team (check `type`)
   *   >,
   *
   *   # One or both of commits and rules will be present
   *
   *   commits: [...]  # List of commits made by this owner
   *   rules:   [...]  # Project rules matched for this owner
   * }
   */
  getOwnerList() {
    var _this$props$committer, _this$props$releaseCo;

    const committers = (_this$props$committer = this.props.committers) !== null && _this$props$committer !== void 0 ? _this$props$committer : [];
    const releaseCommitters = (_this$props$releaseCo = this.props.releaseCommitters) !== null && _this$props$releaseCo !== void 0 ? _this$props$releaseCo : [];
    const owners = [...committers, ...releaseCommitters].map(commiter => ({
      actor: { ...commiter.author,
        type: 'user'
      },
      commits: commiter.commits,
      release: commiter.release
    }));
    this.state.eventOwners.owners.forEach(owner => {
      const normalizedOwner = {
        actor: owner,
        rules: (0,_findMatchedRules__WEBPACK_IMPORTED_MODULE_11__.findMatchedRules)(this.state.eventOwners.rules || [], owner)
      };
      const existingIdx = committers.length > 0 && owner.email && owner.type === 'user' ? owners.findIndex(o => o.actor.email === owner.email) : -1;

      if (existingIdx > -1) {
        owners[existingIdx] = { ...normalizedOwner,
          ...owners[existingIdx]
        };
        return;
      }

      owners.push(normalizedOwner);
    });
    return owners;
  }

  renderBody() {
    const {
      organization,
      project,
      group
    } = this.props;
    const {
      codeowners,
      isDismissed
    } = this.state;
    const owners = this.getOwnerList();
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [owners.length > 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(_suggestedAssignees__WEBPACK_IMPORTED_MODULE_13__.SuggestedAssignees, {
        organization: organization,
        owners: owners,
        projectId: group.project.id,
        onAssign: this.handleAssign
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(_ownershipRules__WEBPACK_IMPORTED_MODULE_12__.OwnershipRules, {
        issueId: group.id,
        project: project,
        organization: organization,
        codeowners: codeowners,
        isDismissed: isDismissed,
        handleCTAClose: this.handleCTAClose
      })]
    });
  }

}

function SuggestedOwnersWrapper(props) {
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_10__["default"])();
  const {
    committers,
    releaseCommitters
  } = (0,sentry_utils_useCommitters__WEBPACK_IMPORTED_MODULE_9__["default"])({
    group: props.group,
    eventId: props.event.id,
    projectSlug: props.project.slug
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(SuggestedOwners, {
    organization: organization,
    committers: committers,
    releaseCommitters: releaseCommitters,
    ...props
  });
}

SuggestedOwnersWrapper.displayName = "SuggestedOwnersWrapper";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SuggestedOwnersWrapper);

/***/ }),

/***/ "./app/components/group/suspectReleases.tsx":
/*!**************************************************!*\
  !*** ./app/components/group/suspectReleases.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_components_version__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/version */ "./app/components/version.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _avatar_avatarList__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../avatar/avatarList */ "./app/components/avatar/avatarList.tsx");
/* harmony import */ var _timeSince__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var _sidebarSection__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./sidebarSection */ "./app/components/group/sidebarSection.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












class SuspectReleases extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_1__["default"] {
  getEndpoints() {
    const {
      group
    } = this.props;
    return [['suspectReleases', `/issues/${group.id}/suspect-releases/`]];
  }

  renderLoading() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_sidebarSection__WEBPACK_IMPORTED_MODULE_8__["default"], {
      "data-test-id": "linked-issues",
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Linked Issues'),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_2__["default"], {
        height: "60px"
      })
    });
  }

  renderBody() {
    var _this$state$suspectRe, _this$state$suspectRe2;

    if (!((_this$state$suspectRe = this.state.suspectReleases) !== null && _this$state$suspectRe !== void 0 && _this$state$suspectRe.length)) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_sidebarSection__WEBPACK_IMPORTED_MODULE_8__["default"], {
      secondary: true,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Suspect Releases'),
      children: (_this$state$suspectRe2 = this.state.suspectReleases) === null || _this$state$suspectRe2 === void 0 ? void 0 : _this$state$suspectRe2.map(release => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(SuspectReleaseWrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)("div", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(StyledVersion, {
            version: release.version
          }), release.lastDeploy && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(ReleaseDeployedDate, {
            children: [release.lastDeploy.environment ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Deployed to %s ', release.lastDeploy.environment) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Deployed '), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_timeSince__WEBPACK_IMPORTED_MODULE_7__["default"], {
              date: release.lastDeploy.dateFinished
            })]
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_avatar_avatarList__WEBPACK_IMPORTED_MODULE_6__["default"], {
          users: release.authors,
          avatarSize: 25,
          tooltipOptions: {
            container: 'body'
          },
          typeMembers: "authors"
        })]
      }, release.version))
    });
  }

}

const SuspectReleaseWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1u3urjq2"
} : 0)("display:flex;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), ";justify-content:space-between;align-items:center;line-height:1.2;margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1.5), " 0;" + ( true ? "" : 0));

const StyledVersion = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_version__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e1u3urjq1"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(0.75), ";" + ( true ? "" : 0));

const ReleaseDeployedDate = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1u3urjq0"
} : 0)("font-size:", p => p.theme.fontSizeSmall, ";color:", p => p.theme.subText, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SuspectReleases);

/***/ }),

/***/ "./app/components/group/tagDistributionMeter.tsx":
/*!*******************************************************!*\
  !*** ./app/components/group/tagDistributionMeter.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_deviceName__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/deviceName */ "./app/components/deviceName.tsx");
/* harmony import */ var sentry_components_tagDistributionMeter__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/tagDistributionMeter */ "./app/components/tagDistributionMeter.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





class GroupTagDistributionMeter extends react__WEBPACK_IMPORTED_MODULE_0__.Component {
  shouldComponentUpdate(nextProps) {
    return this.props.tag !== nextProps.tag || this.props.name !== nextProps.name || this.props.totalValues !== nextProps.totalValues || this.props.topValues !== nextProps.topValues;
  }

  render() {
    const {
      organization,
      group,
      tag,
      totalValues,
      topValues
    } = this.props;
    const url = `/organizations/${organization.slug}/issues/${group.id}/tags/${tag}/`;
    const segments = topValues ? topValues.map(value => ({ ...value,
      name: (0,sentry_components_deviceName__WEBPACK_IMPORTED_MODULE_1__.deviceNameMapper)(value.name || '') || value.name,
      url
    })) : [];
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_tagDistributionMeter__WEBPACK_IMPORTED_MODULE_2__["default"], {
      title: tag,
      totalValues: totalValues,
      isLoading: false,
      hasError: false,
      segments: segments
    });
  }

}

GroupTagDistributionMeter.displayName = "GroupTagDistributionMeter";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GroupTagDistributionMeter);

/***/ }),

/***/ "./app/components/issueSyncListElement.tsx":
/*!*************************************************!*\
  !*** ./app/components/issueSyncListElement.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "IntegrationLink": () => (/* binding */ IntegrationLink),
/* harmony export */   "IssueSyncListElementContainer": () => (/* binding */ IssueSyncListElementContainer),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var lodash_capitalize__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/capitalize */ "../node_modules/lodash/capitalize.js");
/* harmony import */ var lodash_capitalize__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_capitalize__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/hovercard */ "./app/components/hovercard.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/callIfFunction */ "./app/utils/callIfFunction.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");















class IssueSyncListElement extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDelete", () => {
      (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_9__.callIfFunction)(this.props.onClose, this.props.externalIssueId);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleIconClick", () => {
      if (this.isLinked()) {
        this.handleDelete();
      } else if (this.props.onOpen) {
        this.props.onOpen();
      }
    });
  }

  isLinked() {
    return !!(this.props.externalIssueLink && this.props.externalIssueId);
  }

  getIcon() {
    return (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_10__.getIntegrationIcon)(this.props.integrationType);
  }

  getPrettyName() {
    const type = this.props.integrationType;

    switch (type) {
      case 'gitlab':
        return 'GitLab';

      case 'github':
        return 'GitHub';

      case 'github_enterprise':
        return 'GitHub Enterprise';

      case 'vsts':
        return 'Azure DevOps';

      case 'jira_server':
        return 'Jira Server';

      default:
        return lodash_capitalize__WEBPACK_IMPORTED_MODULE_4___default()(type);
    }
  }

  getLink() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(IntegrationLink, {
      href: this.props.externalIssueLink || undefined,
      onClick: !this.isLinked() ? this.props.onOpen : undefined,
      disabled: this.props.disabled,
      children: this.getText()
    });
  }

  getText() {
    if (this.props.children) {
      return this.props.children;
    }

    if (this.props.externalIssueDisplayName) {
      return this.props.externalIssueDisplayName;
    }

    if (this.props.externalIssueKey) {
      return this.props.externalIssueKey;
    }

    return `${this.getPrettyName()} Issue`;
  }

  render() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(IssueSyncListElementContainer, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_emotion_react__WEBPACK_IMPORTED_MODULE_12__.ClassNames, {
        children: _ref => {
          let {
            css
          } = _ref;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(StyledHovercard, {
            containerClassName: css`
                display: flex;
                align-items: center;
                min-width: 0; /* flex-box overflow workaround */

                svg {
                  flex-shrink: 0;
                }
              `,
            header: this.props.hoverCardHeader,
            body: this.props.hoverCardBody,
            bodyClassName: "issue-list-body",
            forceVisible: this.props.showHoverCard,
            children: [this.getIcon(), this.getLink()]
          });
        }
      }), (this.props.onClose || this.props.onOpen) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(StyledIcon, {
        role: "button",
        "aria-label": this.isLinked() ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Close') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Add'),
        onClick: this.handleIconClick,
        children: this.isLinked() ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_6__.IconClose, {}) : this.props.onOpen ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_6__.IconAdd, {}) : null
      })]
    });
  }

}

IssueSyncListElement.displayName = "IssueSyncListElement";
const IssueSyncListElementContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ea4nvig3"
} : 0)("line-height:0;display:flex;align-items:center;justify-content:space-between;&:not(:last-child){margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(2), ";}" + ( true ? "" : 0));
const IntegrationLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('a',  true ? {
  target: "ea4nvig2"
} : 0)("text-decoration:none;margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";color:", p => p.theme.textColor, ";cursor:pointer;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;&:hover{color:", _ref2 => {
  let {
    disabled,
    theme
  } = _ref2;
  return disabled ? theme.disabled : theme.blue300;
}, ";}" + ( true ? "" : 0));

const StyledHovercard = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_5__.Hovercard,  true ? {
  target: "ea4nvig1"
} : 0)(sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_5__.Body, "{max-height:300px;overflow-y:auto;}" + ( true ? "" : 0));

const StyledIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "ea4nvig0"
} : 0)("color:", p => p.theme.textColor, ";cursor:pointer;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (IssueSyncListElement);

/***/ }),

/***/ "./app/components/mutedBox.tsx":
/*!*************************************!*\
  !*** ./app/components/mutedBox.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_duration__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/duration */ "./app/components/duration.tsx");
/* harmony import */ var sentry_components_events_styles__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/events/styles */ "./app/components/events/styles.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








function MutedBox(_ref) {
  let {
    statusDetails
  } = _ref;

  function renderReason() {
    const {
      ignoreUntil,
      ignoreCount,
      ignoreWindow,
      ignoreUserCount,
      ignoreUserWindow
    } = statusDetails;

    if (ignoreUntil) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('This issue has been ignored until %s', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("strong", {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_0__["default"], {
          date: ignoreUntil
        })
      }));
    }

    if (ignoreCount && ignoreWindow) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('This issue has been ignored until it occurs %s time(s) in %s', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("strong", {
        children: ignoreCount.toLocaleString()
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("strong", {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_duration__WEBPACK_IMPORTED_MODULE_1__["default"], {
          seconds: ignoreWindow * 60
        })
      }));
    }

    if (ignoreCount) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('This issue has been ignored until it occurs %s more time(s)', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("strong", {
        children: ignoreCount.toLocaleString()
      }));
    }

    if (ignoreUserCount && ignoreUserWindow) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('This issue has been ignored until it affects %s user(s) in %s', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("strong", {
        children: ignoreUserCount.toLocaleString()
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("strong", {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_duration__WEBPACK_IMPORTED_MODULE_1__["default"], {
          seconds: ignoreUserWindow * 60
        })
      }));
    }

    if (ignoreUserCount) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('This issue has been ignored until it affects %s more user(s)', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("strong", {
        children: ignoreUserCount.toLocaleString()
      }));
    }

    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('This issue has been ignored');
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_events_styles__WEBPACK_IMPORTED_MODULE_2__.BannerContainer, {
    priority: "default",
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(sentry_components_events_styles__WEBPACK_IMPORTED_MODULE_2__.BannerSummary, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconMute, {
        color: "red300",
        size: "sm"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("span", {
        children: [renderReason(), "\xA0\u2014\xA0", (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('You will not be notified of any changes and it will not show up by default in feeds.')]
      })]
    })
  });
}

MutedBox.displayName = "MutedBox";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MutedBox);

/***/ }),

/***/ "./app/components/navigationButtonGroup.tsx":
/*!**************************************************!*\
  !*** ./app/components/navigationButtonGroup.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







const NavigationButtonGroup = _ref => {
  let {
    links,
    hasNext = false,
    hasPrevious = false,
    className,
    size,
    onOldestClick,
    onOlderClick,
    onNewerClick,
    onNewestClick
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_1__["default"], {
    className: className,
    merged: true,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_0__["default"], {
      size: size,
      to: links[0],
      disabled: !hasPrevious,
      "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Oldest'),
      icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_2__.IconPrevious, {
        size: "xs"
      }),
      onClick: onOldestClick
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_0__["default"], {
      size: size,
      to: links[1],
      disabled: !hasPrevious,
      onClick: onOlderClick,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Older')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_0__["default"], {
      size: size,
      to: links[2],
      disabled: !hasNext,
      onClick: onNewerClick,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Newer')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_0__["default"], {
      size: size,
      to: links[3],
      disabled: !hasNext,
      "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Newest'),
      icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_2__.IconNext, {
        size: "xs"
      }),
      onClick: onNewestClick
    })]
  });
};

NavigationButtonGroup.displayName = "NavigationButtonGroup";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (NavigationButtonGroup);

/***/ }),

/***/ "./app/components/projects/appStoreConnectContext.tsx":
/*!************************************************************!*\
  !*** ./app/components/projects/appStoreConnectContext.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Provider": () => (/* binding */ Provider),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_utils_appStoreValidationErrorMessage__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/appStoreValidationErrorMessage */ "./app/utils/appStoreValidationErrorMessage.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





const AppStoreConnectContext = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.createContext)(undefined);

const Provider = _ref => {
  let {
    children,
    project,
    organization
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_3__["default"])();
  const [projectDetails, setProjectDetails] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)();
  const [appStoreConnectStatusData, setAppStoreConnectStatusData] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(undefined);
  const appStoreConnectSymbolSources = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    return (projectDetails !== null && projectDetails !== void 0 && projectDetails.symbolSources ? JSON.parse(projectDetails.symbolSources) : []).reduce((acc, _ref2) => {
      let {
        type,
        id,
        ...symbolSource
      } = _ref2;

      if (type.toLowerCase() === 'appstoreconnect') {
        acc[id] = {
          type,
          ...symbolSource
        };
      }

      return acc;
    }, {});
  }, [projectDetails === null || projectDetails === void 0 ? void 0 : projectDetails.symbolSources]);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    if (!project || projectDetails) {
      return undefined;
    }

    if (project.symbolSources) {
      setProjectDetails(project);
      return undefined;
    }

    let unmounted = false;
    api.requestPromise(`/projects/${organization.slug}/${project.slug}/`).then(responseProjectDetails => {
      if (unmounted) {
        return;
      }

      setProjectDetails(responseProjectDetails);
    }).catch(() => {// We do not care about the error
    });
    return () => {
      unmounted = true;
    };
  }, [project, organization, api]);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    if (!projectDetails) {
      return undefined;
    }

    if (!Object.keys(appStoreConnectSymbolSources).length) {
      return undefined;
    }

    let unmounted = false;
    api.requestPromise(`/projects/${organization.slug}/${projectDetails.slug}/appstoreconnect/status/`).then(appStoreConnectStatus => {
      if (unmounted) {
        return;
      }

      setAppStoreConnectStatusData(appStoreConnectStatus);
    }).catch(() => {// We do not care about the error
    });
    return () => {
      unmounted = true;
    };
  }, [projectDetails, organization, appStoreConnectSymbolSources, api]);

  function getUpdateAlertMessage(respository, credentials) {
    if ((credentials === null || credentials === void 0 ? void 0 : credentials.status) === 'valid') {
      return undefined;
    }

    return (0,sentry_utils_appStoreValidationErrorMessage__WEBPACK_IMPORTED_MODULE_2__.getAppStoreValidationErrorMessage)(credentials, respository);
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(AppStoreConnectContext.Provider, {
    value: appStoreConnectStatusData && project ? Object.keys(appStoreConnectStatusData).reduce((acc, key) => {
      const appStoreConnect = appStoreConnectStatusData[key];
      return { ...acc,
        [key]: { ...appStoreConnect,
          updateAlertMessage: getUpdateAlertMessage({
            name: appStoreConnectSymbolSources[key].name,
            link: `/settings/${organization.slug}/projects/${project.slug}/debug-symbols/?customRepository=${key}`
          }, appStoreConnect.credentials)
        }
      };
    }, {}) : undefined,
    children: children
  });
};

Provider.displayName = "Provider";

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AppStoreConnectContext);

/***/ }),

/***/ "./app/components/reprocessedBox.tsx":
/*!*******************************************!*\
  !*** ./app/components/reprocessedBox.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_events_styles__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/events/styles */ "./app/components/events/styles.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/localStorage */ "./app/utils/localStorage.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }











class ReprocessedBox extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      isBannerHidden: sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_9__["default"].getItem(this.getBannerUniqueId()) === 'true'
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleBannerDismiss", () => {
      sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_9__["default"].setItem(this.getBannerUniqueId(), 'true');
      this.setState({
        isBannerHidden: true
      });
    });
  }

  getBannerUniqueId() {
    const {
      reprocessActivity
    } = this.props;
    const {
      id
    } = reprocessActivity;
    return `reprocessed-activity-${id}-banner-dismissed`;
  }

  renderMessage() {
    const {
      orgSlug,
      reprocessActivity,
      groupCount,
      groupId
    } = this.props;
    const {
      data
    } = reprocessActivity;
    const {
      eventCount,
      oldGroupId,
      newGroupId
    } = data;
    const reprocessedEventsRoute = `/organizations/${orgSlug}/issues/?query=reprocessing.original_issue_id:${oldGroupId}`;

    if (groupCount === 0) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.tct)('All events in this issue were moved during reprocessing. [link]', {
        link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__["default"], {
          to: reprocessedEventsRoute,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.tn)('See %s new event', 'See %s new events', eventCount)
        })
      });
    }

    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.tct)('Events in this issue were successfully reprocessed. [link]', {
      link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__["default"], {
        to: reprocessedEventsRoute,
        children: newGroupId === Number(groupId) ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.tn)('See %s reprocessed event', 'See %s reprocessed events', eventCount) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.tn)('See %s new event', 'See %s new events', eventCount)
      })
    });
  }

  render() {
    const {
      isBannerHidden
    } = this.state;

    if (isBannerHidden) {
      return null;
    }

    const {
      className
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_events_styles__WEBPACK_IMPORTED_MODULE_4__.BannerContainer, {
      priority: "success",
      className: className,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(StyledBannerSummary, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_6__.IconCheckmark, {
          color: "green300",
          isCircled: true
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("span", {
          children: this.renderMessage()
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(StyledIconClose, {
          color: "green300",
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Dismiss'),
          isCircled: true,
          onClick: this.handleBannerDismiss
        })]
      })
    });
  }

}

ReprocessedBox.displayName = "ReprocessedBox";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReprocessedBox);

const StyledBannerSummary = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_events_styles__WEBPACK_IMPORTED_MODULE_4__.BannerSummary,  true ? {
  target: "e17keqf51"
} : 0)("&>svg:last-child{margin-right:0;margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";}" + ( true ? "" : 0));

const StyledIconClose = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_6__.IconClose,  true ? {
  target: "e17keqf50"
} : 0)( true ? {
  name: "e0dnmk",
  styles: "cursor:pointer"
} : 0);

/***/ }),

/***/ "./app/components/resolutionBox.tsx":
/*!******************************************!*\
  !*** ./app/components/resolutionBox.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/avatar/userAvatar */ "./app/components/avatar/userAvatar.tsx");
/* harmony import */ var sentry_components_commitLink__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/commitLink */ "./app/components/commitLink.tsx");
/* harmony import */ var sentry_components_events_styles__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/events/styles */ "./app/components/events/styles.tsx");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_components_version__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/version */ "./app/components/version.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");














function renderReason(statusDetails, projectId, activities) {
  const actor = statusDetails.actor ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)("strong", {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_2__["default"], {
      user: statusDetails.actor,
      size: 20,
      className: "avatar"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)("span", {
      style: {
        marginLeft: 5
      },
      children: statusDetails.actor.name
    })]
  }) : null;
  const relevantActivity = activities.find(activity => activity.type === sentry_types__WEBPACK_IMPORTED_MODULE_10__.GroupActivityType.SET_RESOLVED_IN_RELEASE);
  const currentReleaseVersion = relevantActivity === null || relevantActivity === void 0 ? void 0 : relevantActivity.data.current_release_version;

  if (statusDetails.inNextRelease && statusDetails.actor) {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[actor] marked this issue as resolved in the upcoming release.', {
      actor
    });
  }

  if (statusDetails.inNextRelease) {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('This issue has been marked as resolved in the upcoming release.');
  }

  if (statusDetails.inRelease && statusDetails.actor) {
    return currentReleaseVersion ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[actor] marked this issue as resolved in versions greater than [version].', {
      actor,
      version: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_version__WEBPACK_IMPORTED_MODULE_6__["default"], {
        version: currentReleaseVersion,
        projectId: projectId,
        tooltipRawVersion: true
      })
    }) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[actor] marked this issue as resolved in version [version].', {
      actor,
      version: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_version__WEBPACK_IMPORTED_MODULE_6__["default"], {
        version: statusDetails.inRelease,
        projectId: projectId,
        tooltipRawVersion: true
      })
    });
  }

  if (statusDetails.inRelease) {
    return currentReleaseVersion ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('This issue has been marked as resolved in versions greater than [version].', {
      version: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_version__WEBPACK_IMPORTED_MODULE_6__["default"], {
        version: currentReleaseVersion,
        projectId: projectId,
        tooltipRawVersion: true
      })
    }) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('This issue has been marked as resolved in version [version].', {
      version: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_version__WEBPACK_IMPORTED_MODULE_6__["default"], {
        version: statusDetails.inRelease,
        projectId: projectId,
        tooltipRawVersion: true
      })
    });
  }

  if (!!statusDetails.inCommit) {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('This issue has been marked as resolved by [commit]', {
      commit: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_commitLink__WEBPACK_IMPORTED_MODULE_3__["default"], {
          commitId: statusDetails.inCommit.id,
          repository: statusDetails.inCommit.repository
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(StyledTimeSince, {
          date: statusDetails.inCommit.dateCreated
        })]
      })
    });
  }

  return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('This issue has been marked as resolved.');
}

function ResolutionBox(_ref) {
  let {
    statusDetails,
    projectId,
    activities = []
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_events_styles__WEBPACK_IMPORTED_MODULE_4__.BannerContainer, {
    priority: "default",
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(sentry_components_events_styles__WEBPACK_IMPORTED_MODULE_4__.BannerSummary, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(StyledIconCheckmark, {
        color: "green300"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)("span", {
        children: renderReason(statusDetails, projectId, activities)
      })]
    })
  });
}

ResolutionBox.displayName = "ResolutionBox";

const StyledTimeSince = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "eusmyo21"
} : 0)("color:", p => p.theme.gray300, ";margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(0.5), ";font-size:", p => p.theme.fontSizeSmall, ";" + ( true ? "" : 0));

const StyledIconCheckmark = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconCheckmark,  true ? {
  target: "eusmyo20"
} : 0)("margin-top:0!important;align-self:center;@media (max-width: ", p => p.theme.breakpoints.small, "){margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(0.5), "!important;align-self:flex-start;}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ResolutionBox);

/***/ }),

/***/ "./app/stores/externalIssueStore.tsx":
/*!*******************************************!*\
  !*** ./app/stores/externalIssueStore.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/makeSafeRefluxStore */ "./app/utils/makeSafeRefluxStore.ts");


const storeConfig = {
  init() {
    this.items = [];
  },

  getInitialState() {
    return this.items;
  },

  load(items) {
    this.items = items;
    this.trigger(items);
  },

  get(id) {
    return this.items.find(item => item.id === id);
  },

  getAll() {
    return this.items;
  },

  add(issue) {
    if (!this.items.some(i => i.id === issue.id)) {
      this.items = this.items.concat([issue]);
      this.trigger(this.items);
    }
  }

};
const ExternalIssueStore = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createStore)((0,sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_1__.makeSafeRefluxStore)(storeConfig));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ExternalIssueStore);

/***/ }),

/***/ "./app/stores/organizationEnvironmentsStore.tsx":
/*!******************************************************!*\
  !*** ./app/stores/organizationEnvironmentsStore.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_actions_environmentActions__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actions/environmentActions */ "./app/actions/environmentActions.tsx");
/* harmony import */ var sentry_utils_environment__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/environment */ "./app/utils/environment.tsx");
/* harmony import */ var sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/makeSafeRefluxStore */ "./app/utils/makeSafeRefluxStore.ts");




const storeConfig = {
  unsubscribeListeners: [],
  state: {
    environments: null,
    error: null
  },

  init() {
    this.state = {
      environments: null,
      error: null
    };
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_environmentActions__WEBPACK_IMPORTED_MODULE_1__["default"].fetchEnvironments, this.onFetchEnvironments));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_environmentActions__WEBPACK_IMPORTED_MODULE_1__["default"].fetchEnvironmentsSuccess, this.onFetchEnvironmentsSuccess));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_environmentActions__WEBPACK_IMPORTED_MODULE_1__["default"].fetchEnvironmentsError, this.onFetchEnvironmentsError));
  },

  makeEnvironment(item) {
    return {
      id: item.id,
      name: item.name,

      get displayName() {
        return (0,sentry_utils_environment__WEBPACK_IMPORTED_MODULE_2__.getDisplayName)(item);
      },

      get urlRoutingName() {
        return (0,sentry_utils_environment__WEBPACK_IMPORTED_MODULE_2__.getUrlRoutingName)(item);
      }

    };
  },

  onFetchEnvironments() {
    this.state = {
      environments: null,
      error: null
    };
    this.trigger(this.state);
  },

  onFetchEnvironmentsSuccess(environments) {
    this.state = {
      error: null,
      environments: environments.map(this.makeEnvironment)
    };
    this.trigger(this.state);
  },

  onFetchEnvironmentsError(error) {
    this.state = {
      error,
      environments: null
    };
    this.trigger(this.state);
  },

  getState() {
    return this.state;
  }

};
const OrganizationEnvironmentsStore = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createStore)((0,sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_3__.makeSafeRefluxStore)(storeConfig));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OrganizationEnvironmentsStore);

/***/ }),

/***/ "./app/stores/sentryAppInstallationsStore.tsx":
/*!****************************************************!*\
  !*** ./app/stores/sentryAppInstallationsStore.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/makeSafeRefluxStore */ "./app/utils/makeSafeRefluxStore.ts");


const storeConfig = {
  init() {
    this.items = [];
  },

  getInitialState() {
    return this.items;
  },

  load(items) {
    this.items = items;
    this.trigger(items);
  },

  get(uuid) {
    const items = this.items;
    return items.find(item => item.uuid === uuid);
  },

  getAll() {
    return this.items;
  }

};
const SentryAppInstallationStore = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createStore)((0,sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_1__.makeSafeRefluxStore)(storeConfig));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SentryAppInstallationStore);

/***/ }),

/***/ "./app/utils/appStoreValidationErrorMessage.tsx":
/*!******************************************************!*\
  !*** ./app/utils/appStoreValidationErrorMessage.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getAppStoreValidationErrorMessage": () => (/* binding */ getAppStoreValidationErrorMessage),
/* harmony export */   "unexpectedErrorMessage": () => (/* binding */ unexpectedErrorMessage)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





const unexpectedErrorMessage = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('An unexpected error occurred while configuring the App Store Connect integration');
function getAppStoreValidationErrorMessage(error, repo) {
  switch (error.code) {
    case 'app-connect-authentication-error':
      return repo ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.tct)('App Store Connect credentials are invalid or missing. [linkToCustomRepository]', {
        linkToCustomRepository: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_1__["default"], {
          to: repo.link,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.tct)("Make sure the credentials of the '[customRepositoryName]' repository are correct and exist.", {
            customRepositoryName: repo.name
          })
        })
      }) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('The supplied App Store Connect credentials are invalid or missing.');

    case 'app-connect-forbidden-error':
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('The supplied API key does not have sufficient permissions.');

    case 'app-connect-multiple-sources-error':
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Only one App Store Connect application is allowed in this project.');

    default:
      {
        // this shall not happen
        _sentry_react__WEBPACK_IMPORTED_MODULE_4__.captureException(new Error('Unknown app store connect error.'));
        return unexpectedErrorMessage;
      }
  }
}

/***/ }),

/***/ "./app/utils/fetchSentryAppInstallations.tsx":
/*!***************************************************!*\
  !*** ./app/utils/fetchSentryAppInstallations.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_stores_sentryAppInstallationsStore__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/stores/sentryAppInstallationsStore */ "./app/stores/sentryAppInstallationsStore.tsx");


const fetchSentryAppInstallations = async (api, orgSlug) => {
  const installsUri = `/organizations/${orgSlug}/sentry-app-installations/`;
  const installs = await api.requestPromise(installsUri);
  sentry_stores_sentryAppInstallationsStore__WEBPACK_IMPORTED_MODULE_0__["default"].load(installs);
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (fetchSentryAppInstallations);

/***/ }),

/***/ "./app/utils/getStacktraceBody.tsx":
/*!*****************************************!*\
  !*** ./app/utils/getStacktraceBody.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ getStacktraceBody)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_components_events_interfaces_crashContent_stackTrace_rawContent__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/events/interfaces/crashContent/stackTrace/rawContent */ "./app/components/events/interfaces/crashContent/stackTrace/rawContent.tsx");


function getStacktraceBody(event) {
  if (!event || !event.entries) {
    return [];
  } // TODO(billyvg): This only accounts for the first exception, will need navigation to be able to
  // diff multiple exceptions
  //
  // See: https://github.com/getsentry/sentry/issues/6055


  const exc = event.entries.find(_ref => {
    let {
      type
    } = _ref;
    return type === 'exception';
  });

  if (!exc) {
    var _msg$data;

    // Look for a message if not an exception
    const msg = event.entries.find(_ref2 => {
      let {
        type
      } = _ref2;
      return type === 'message';
    });

    if (!msg) {
      return [];
    }

    return (msg === null || msg === void 0 ? void 0 : (_msg$data = msg.data) === null || _msg$data === void 0 ? void 0 : _msg$data.formatted) && [msg.data.formatted];
  }

  if (!exc.data) {
    return [];
  } // TODO(ts): This should be verified when EntryData has the correct type


  return exc.data.values.filter(value => !!value.stacktrace).map(value => (0,sentry_components_events_interfaces_crashContent_stackTrace_rawContent__WEBPACK_IMPORTED_MODULE_1__["default"])(value.stacktrace, event.platform, value)).reduce((acc, value) => acc.concat(value), []);
}

/***/ }),

/***/ "./app/utils/performance/histogram/utils.tsx":
/*!***************************************************!*\
  !*** ./app/utils/performance/histogram/utils.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "computeBuckets": () => (/* binding */ computeBuckets),
/* harmony export */   "formatHistogramData": () => (/* binding */ formatHistogramData),
/* harmony export */   "getBucketWidth": () => (/* binding */ getBucketWidth)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");


function getBucketWidth(data) {
  // We can assume that all buckets are of equal width, use the first two
  // buckets to get the width. The value of each histogram function indicates
  // the beginning of the bucket.
  return data.length >= 2 ? data[1].bin - data[0].bin : 0;
}
function computeBuckets(data) {
  const width = getBucketWidth(data);
  return data.map(item => {
    const bucket = item.bin;
    return {
      start: bucket,
      end: bucket + width
    };
  });
}
function formatHistogramData(data) {
  let {
    precision,
    type,
    additionalFieldsFn
  } = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  const formatter = value => {
    switch (type) {
      case 'duration':
        const decimalPlaces = precision !== null && precision !== void 0 ? precision : value < 1000 ? 0 : 3;
        return (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_1__.getDuration)(value / 1000, decimalPlaces, true);

      case 'number':
        // This is trying to avoid some of potential rounding errors that cause bins
        // have the same label, if the number of bins doesn't visually match what is
        // expected, check that this rounding is correct. If this issue persists,
        // consider formatting the bin as a string in the response
        const factor = 10 ** (precision !== null && precision !== void 0 ? precision : 0);
        return (Math.round((value + Number.EPSILON) * factor) / factor).toLocaleString();

      default:
        throw new Error(`Unable to format type: ${type}`);
    }
  };

  return data.map(item => {
    var _additionalFieldsFn;

    return {
      value: item.count,
      name: formatter(item.bin),
      ...((_additionalFieldsFn = additionalFieldsFn === null || additionalFieldsFn === void 0 ? void 0 : additionalFieldsFn(item.bin)) !== null && _additionalFieldsFn !== void 0 ? _additionalFieldsFn : {})
    };
  });
}

/***/ }),

/***/ "./app/utils/performance/quickTrace/quickTraceQuery.tsx":
/*!**************************************************************!*\
  !*** ./app/utils/performance/quickTrace/quickTraceQuery.tsx ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ QuickTraceQuery)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_utils_performance_quickTrace_traceFullQuery__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/performance/quickTrace/traceFullQuery */ "./app/utils/performance/quickTrace/traceFullQuery.tsx");
/* harmony import */ var sentry_utils_performance_quickTrace_traceLiteQuery__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/performance/quickTrace/traceLiteQuery */ "./app/utils/performance/quickTrace/traceLiteQuery.tsx");
/* harmony import */ var sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/performance/quickTrace/utils */ "./app/utils/performance/quickTrace/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function QuickTraceQuery(_ref) {
  var _event$contexts, _event$contexts$trace;

  let {
    children,
    event,
    ...props
  } = _ref;

  const renderEmpty = () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: children({
      isLoading: false,
      error: null,
      trace: [],
      type: 'empty',
      currentEvent: null
    })
  });

  if (!event) {
    return renderEmpty();
  }

  const traceId = (_event$contexts = event.contexts) === null || _event$contexts === void 0 ? void 0 : (_event$contexts$trace = _event$contexts.trace) === null || _event$contexts$trace === void 0 ? void 0 : _event$contexts$trace.trace_id;

  if (!traceId) {
    return renderEmpty();
  }

  const {
    start,
    end
  } = (0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_4__.getTraceTimeRangeFromEvent)(event);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_utils_performance_quickTrace_traceLiteQuery__WEBPACK_IMPORTED_MODULE_3__["default"], {
    eventId: event.id,
    traceId: traceId,
    start: start,
    end: end,
    ...props,
    children: traceLiteResults => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_utils_performance_quickTrace_traceFullQuery__WEBPACK_IMPORTED_MODULE_2__.TraceFullQuery, {
      eventId: event.id,
      traceId: traceId,
      start: start,
      end: end,
      ...props,
      children: traceFullResults => {
        var _traceFullResults$tra;

        if (!traceFullResults.isLoading && traceFullResults.error === null && traceFullResults.traces !== null) {
          for (const subtrace of traceFullResults.traces) {
            try {
              var _trace$find;

              const trace = (0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_4__.flattenRelevantPaths)(event, subtrace);
              return children({ ...traceFullResults,
                trace,
                currentEvent: (_trace$find = trace.find(e => (0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_4__.isCurrentEvent)(e, event))) !== null && _trace$find !== void 0 ? _trace$find : null
              });
            } catch {// let this fall through and check the next subtrace
              // or use the trace lite results
            }
          }
        }

        if (!traceLiteResults.isLoading && traceLiteResults.error === null && traceLiteResults.trace !== null) {
          var _trace$find2;

          const {
            trace
          } = traceLiteResults;
          return children({ ...traceLiteResults,
            currentEvent: (_trace$find2 = trace.find(e => (0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_4__.isCurrentEvent)(e, event))) !== null && _trace$find2 !== void 0 ? _trace$find2 : null
          });
        }

        return children({
          // only use the light results loading state if it didn't error
          // if it did, we should rely on the full results
          isLoading: traceLiteResults.error ? traceFullResults.isLoading : traceLiteResults.isLoading || traceFullResults.isLoading,
          // swallow any errors from the light results because we
          // should rely on the full results in this situations
          error: traceFullResults.error,
          trace: [],
          // if we reach this point but there were some traces in the full results,
          // that means there were other transactions in the trace, but the current
          // event could not be found
          type: (_traceFullResults$tra = traceFullResults.traces) !== null && _traceFullResults$tra !== void 0 && _traceFullResults$tra.length ? 'missing' : 'empty',
          currentEvent: null
        });
      }
    })
  });
}
QuickTraceQuery.displayName = "QuickTraceQuery";

/***/ }),

/***/ "./app/utils/performance/quickTrace/traceFullQuery.tsx":
/*!*************************************************************!*\
  !*** ./app/utils/performance/quickTrace/traceFullQuery.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TraceFullDetailedQuery": () => (/* binding */ TraceFullDetailedQuery),
/* harmony export */   "TraceFullQuery": () => (/* binding */ TraceFullQuery)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/discover/genericDiscoverQuery */ "./app/utils/discover/genericDiscoverQuery.tsx");
/* harmony import */ var sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/performance/quickTrace/utils */ "./app/utils/performance/quickTrace/utils.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function getTraceFullRequestPayload(_ref) {
  let {
    detailed,
    eventId,
    ...props
  } = _ref;
  const additionalApiPayload = (0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_2__.getTraceRequestPayload)(props);
  additionalApiPayload.detailed = detailed ? '1' : '0';

  if (eventId) {
    additionalApiPayload.event_id = eventId;
  }

  return additionalApiPayload;
}

function EmptyTrace(_ref2) {
  let {
    children
  } = _ref2;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: children({
      isLoading: false,
      error: null,
      traces: null,
      type: 'full'
    })
  });
}

EmptyTrace.displayName = "EmptyTrace";

function GenericTraceFullQuery(_ref3) {
  let {
    traceId,
    start,
    end,
    statsPeriod,
    children,
    ...props
  } = _ref3;

  if (!traceId) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(EmptyTrace, {
      children: children
    });
  }

  const eventView = (0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_2__.makeEventView)({
    start,
    end,
    statsPeriod
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_1__["default"], {
    route: `events-trace/${traceId}`,
    getRequestPayload: getTraceFullRequestPayload,
    eventView: eventView,
    ...props,
    children: _ref4 => {
      let {
        tableData,
        ...rest
      } = _ref4;
      return children({
        // This is using '||` instead of '??` here because
        // the client returns a empty string when the response
        // is 204. And we want the empty string, undefined and
        // null to be converted to null.
        traces: tableData || null,
        type: 'full',
        ...rest
      });
    }
  });
}

GenericTraceFullQuery.displayName = "GenericTraceFullQuery";
const TraceFullQuery = (0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_3__["default"])(props => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(GenericTraceFullQuery, { ...props,
  detailed: false
}));
const TraceFullDetailedQuery = (0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_3__["default"])(props => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(GenericTraceFullQuery, { ...props,
  detailed: true
}));

/***/ }),

/***/ "./app/utils/performance/quickTrace/traceLiteQuery.tsx":
/*!*************************************************************!*\
  !*** ./app/utils/performance/quickTrace/traceLiteQuery.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/discover/genericDiscoverQuery */ "./app/utils/discover/genericDiscoverQuery.tsx");
/* harmony import */ var sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/performance/quickTrace/utils */ "./app/utils/performance/quickTrace/utils.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function getTraceLiteRequestPayload(_ref) {
  let {
    eventId,
    ...props
  } = _ref;
  const additionalApiPayload = (0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_2__.getTraceRequestPayload)(props);
  return Object.assign({
    event_id: eventId
  }, additionalApiPayload);
}

function EmptyTrace(_ref2) {
  let {
    children
  } = _ref2;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: children({
      isLoading: false,
      error: null,
      trace: null,
      type: 'partial'
    })
  });
}

EmptyTrace.displayName = "EmptyTrace";

function TraceLiteQuery(_ref3) {
  let {
    traceId,
    start,
    end,
    statsPeriod,
    children,
    ...props
  } = _ref3;

  if (!traceId) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(EmptyTrace, {
      children: children
    });
  }

  const eventView = (0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_2__.makeEventView)({
    start,
    end,
    statsPeriod
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_1__["default"], {
    route: `events-trace-light/${traceId}`,
    getRequestPayload: getTraceLiteRequestPayload,
    eventView: eventView,
    ...props,
    children: _ref4 => {
      let {
        tableData,
        ...rest
      } = _ref4;
      return children({
        // This is using '||` instead of '??` here because
        // the client returns a empty string when the response
        // is 204. And we want the empty string, undefined and
        // null to be converted to null.
        trace: tableData || null,
        type: 'partial',
        ...rest
      });
    }
  });
}

TraceLiteQuery.displayName = "TraceLiteQuery";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_3__["default"])(TraceLiteQuery));

/***/ }),

/***/ "./app/utils/performance/urls.ts":
/*!***************************************!*\
  !*** ./app/utils/performance/urls.ts ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getTransactionDetailsUrl": () => (/* binding */ getTransactionDetailsUrl)
/* harmony export */ });
/* harmony import */ var sentry_components_events_interfaces_spans_utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/events/interfaces/spans/utils */ "./app/components/events/interfaces/spans/utils.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");


function getTransactionDetailsUrl(orgSlug, eventSlug, transaction, query, spanId) {
  const locationQuery = { ...(query || {}),
    transaction
  };

  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(locationQuery.transaction)) {
    delete locationQuery.transaction;
  }

  const target = {
    pathname: `/organizations/${orgSlug}/performance/${eventSlug}/`,
    query: locationQuery,
    hash: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(spanId) ? (0,sentry_components_events_interfaces_spans_utils__WEBPACK_IMPORTED_MODULE_0__.spanTargetHash)(spanId) : undefined
  };

  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(target.hash)) {
    delete target.hash;
  }

  return target;
}

/***/ }),

/***/ "./app/views/organizationGroupDetails/eventToolbar.tsx":
/*!*************************************************************!*\
  !*** ./app/views/organizationGroupDetails/eventToolbar.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var moment_timezone__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! moment-timezone */ "../node_modules/moment-timezone/index.js");
/* harmony import */ var moment_timezone__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(moment_timezone__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_events_styles__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/events/styles */ "./app/components/events/styles.tsx");
/* harmony import */ var sentry_components_fileSize__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/fileSize */ "./app/components/fileSize.tsx");
/* harmony import */ var sentry_components_globalAppStoreConnectUpdateAlert__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/globalAppStoreConnectUpdateAlert */ "./app/components/globalAppStoreConnectUpdateAlert/index.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_navigationButtonGroup__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/navigationButtonGroup */ "./app/components/navigationButtonGroup.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var _quickTrace__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ./quickTrace */ "./app/views/organizationGroupDetails/quickTrace/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






















const formatDateDelta = (reference, observed) => {
  const duration = moment_timezone__WEBPACK_IMPORTED_MODULE_2___default().duration(Math.abs(+observed - +reference));
  const hours = Math.floor(+duration / (60 * 60 * 1000));
  const minutes = duration.minutes();
  const results = [];

  if (hours) {
    results.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  }

  if (minutes) {
    results.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  }

  if (results.length === 0) {
    results.push('a few seconds');
  }

  return results.join(', ');
};

class GroupEventToolbar extends react__WEBPACK_IMPORTED_MODULE_1__.Component {
  shouldComponentUpdate(nextProps) {
    return this.props.event.id !== nextProps.event.id;
  }

  handleNavigationClick(button) {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_15__["default"])('issue_details.event_navigation_clicked', {
      organization: this.props.organization,
      project_id: parseInt(this.props.project.id, 10),
      button
    });
  }

  getDateTooltip() {
    var _user$options;

    const evt = this.props.event;
    const user = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_13__["default"].get('user');
    const options = (_user$options = user === null || user === void 0 ? void 0 : user.options) !== null && _user$options !== void 0 ? _user$options : {};
    const format = options.clock24Hours ? 'HH:mm:ss z' : 'LTS z';
    const dateCreated = moment_timezone__WEBPACK_IMPORTED_MODULE_2___default()(evt.dateCreated);
    const dateReceived = evt.dateReceived ? moment_timezone__WEBPACK_IMPORTED_MODULE_2___default()(evt.dateReceived) : null;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(DescriptionList, {
      className: "flat",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)("dt", {
        children: "Occurred"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)("dd", {
        children: [dateCreated.format('ll'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)("br", {}), dateCreated.format(format)]
      }), dateReceived && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)("dt", {
          children: "Received"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)("dd", {
          children: [dateReceived.format('ll'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)("br", {}), dateReceived.format(format)]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)("dt", {
          children: "Latency"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)("dd", {
          children: formatDateDelta(dateCreated, dateReceived)
        })]
      })]
    });
  }

  render() {
    var _evt$contexts;

    const is24Hours = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_16__.shouldUse24Hours)();
    const evt = this.props.event;
    const {
      group,
      organization,
      location,
      project
    } = this.props;
    const groupId = group.id;
    const baseEventsPath = `/organizations/${organization.slug}/issues/${groupId}/events/`; // TODO: possible to define this as a route in react-router, but without a corresponding
    //       React component?

    const jsonUrl = `/organizations/${organization.slug}/issues/${groupId}/events/${evt.id}/json/`;
    const latencyThreshold = 30 * 60 * 1000; // 30 minutes

    const isOverLatencyThreshold = evt.dateReceived && Math.abs(+moment_timezone__WEBPACK_IMPORTED_MODULE_2___default()(evt.dateReceived) - +moment_timezone__WEBPACK_IMPORTED_MODULE_2___default()(evt.dateCreated)) > latencyThreshold;
    const isPerformanceIssue = !!((_evt$contexts = evt.contexts) !== null && _evt$contexts !== void 0 && _evt$contexts.performance_issue);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(StyledDataSection, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(StyledNavigationButtonGroup, {
        hasPrevious: !!evt.previousEventID,
        hasNext: !!evt.nextEventID,
        links: [{
          pathname: `${baseEventsPath}oldest/`,
          query: location.query
        }, {
          pathname: `${baseEventsPath}${evt.previousEventID}/`,
          query: location.query
        }, {
          pathname: `${baseEventsPath}${evt.nextEventID}/`,
          query: location.query
        }, {
          pathname: `${baseEventsPath}latest/`,
          query: location.query
        }],
        onOldestClick: () => this.handleNavigationClick('oldest'),
        onOlderClick: () => this.handleNavigationClick('older'),
        onNewerClick: () => this.handleNavigationClick('newer'),
        onNewestClick: () => this.handleNavigationClick('newest'),
        size: "sm"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(Heading, {
        children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Event'), ' ', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(EventIdLink, {
          to: `${baseEventsPath}${evt.id}/`,
          children: evt.eventID
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(LinkContainer, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_7__["default"], {
            href: jsonUrl,
            onClick: () => (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_15__["default"])('issue_details.event_json_clicked', {
              organization,
              group_id: parseInt(`${evt.groupID}`, 10)
            }),
            children: ['JSON', " (", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_fileSize__WEBPACK_IMPORTED_MODULE_5__["default"], {
              bytes: evt.size
            }), ")"]
          })
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_10__["default"], {
        title: this.getDateTooltip(),
        showUnderline: true,
        disableForVisualTest: true,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(StyledDateTime, {
          format: is24Hours ? 'MMM D, YYYY HH:mm:ss zz' : 'll LTS z',
          date: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_17__["default"])({
            value: evt.dateCreated,
            fixed: 'Dummy timestamp'
          })
        }), isOverLatencyThreshold && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(StyledIconWarning, {
          color: "yellow300"
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(StyledGlobalAppStoreConnectUpdateAlert, {
        project: project,
        organization: organization
      }), !isPerformanceIssue && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(_quickTrace__WEBPACK_IMPORTED_MODULE_18__["default"], {
        event: evt,
        group: group,
        organization: organization,
        location: location
      })]
    });
  }

}

GroupEventToolbar.displayName = "GroupEventToolbar";

const StyledDataSection = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_events_styles__WEBPACK_IMPORTED_MODULE_4__.DataSection,  true ? {
  target: "ekd58v68"
} : 0)( true ? {
  name: "1eibo7e",
  styles: "position:relative;display:block;border-top:0;z-index:3;@media (max-width: 767px){display:none;}"
} : 0);

const EventIdLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "ekd58v67"
} : 0)( true ? {
  name: "lugakg",
  styles: "font-weight:normal"
} : 0);

const Heading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('h4',  true ? {
  target: "ekd58v66"
} : 0)("line-height:1.3;margin:0;font-size:", p => p.theme.fontSizeLarge, ";" + ( true ? "" : 0));

const StyledNavigationButtonGroup = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_navigationButtonGroup__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "ekd58v65"
} : 0)( true ? {
  name: "tjo4qw",
  styles: "float:right"
} : 0);

const StyledIconWarning = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconWarning,  true ? {
  target: "ekd58v64"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(0.5), ";position:relative;top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(0.25), ";" + ( true ? "" : 0));

const StyledDateTime = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "ekd58v63"
} : 0)("color:", p => p.theme.subText, ";" + ( true ? "" : 0));

const StyledGlobalAppStoreConnectUpdateAlert = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_globalAppStoreConnectUpdateAlert__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "ekd58v62"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(0.5), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), ";" + ( true ? "" : 0));

const LinkContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "ekd58v61"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), ";padding-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), ";position:relative;font-weight:normal;&:before{display:block;position:absolute;content:'';left:0;top:2px;height:14px;border-left:1px solid ", p => p.theme.border, ";}" + ( true ? "" : 0));

const DescriptionList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('dl',  true ? {
  target: "ekd58v60"
} : 0)( true ? {
  name: "95wzfp",
  styles: "text-align:left;margin:0;min-width:200px;max-width:250px"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GroupEventToolbar);

/***/ }),

/***/ "./app/views/organizationGroupDetails/groupEventDetails/groupEventDetails.tsx":
/*!************************************************************************************!*\
  !*** ./app/views/organizationGroupDetails/groupEventDetails/groupEventDetails.tsx ***!
  \************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var sentry_actionCreators_sentryAppComponents__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/actionCreators/sentryAppComponents */ "./app/actionCreators/sentryAppComponents.tsx");
/* harmony import */ var sentry_components_errors_groupEventDetailsLoadingError__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/errors/groupEventDetailsLoadingError */ "./app/components/errors/groupEventDetailsLoadingError.tsx");
/* harmony import */ var sentry_components_events_eventEntries__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/events/eventEntries */ "./app/components/events/eventEntries.tsx");
/* harmony import */ var sentry_components_events_meta_metaProxy__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/events/meta/metaProxy */ "./app/components/events/meta/metaProxy.tsx");
/* harmony import */ var sentry_components_group_sidebar__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/group/sidebar */ "./app/components/group/sidebar.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_mutedBox__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/mutedBox */ "./app/components/mutedBox.tsx");
/* harmony import */ var sentry_components_reprocessedBox__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/reprocessedBox */ "./app/components/reprocessedBox.tsx");
/* harmony import */ var sentry_components_resolutionBox__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/resolutionBox */ "./app/components/resolutionBox.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_fetchSentryAppInstallations__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/fetchSentryAppInstallations */ "./app/utils/fetchSentryAppInstallations.tsx");
/* harmony import */ var sentry_utils_performance_quickTrace_quickTraceContext__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/performance/quickTrace/quickTraceContext */ "./app/utils/performance/quickTrace/quickTraceContext.tsx");
/* harmony import */ var sentry_utils_performance_quickTrace_quickTraceQuery__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/performance/quickTrace/quickTraceQuery */ "./app/utils/performance/quickTrace/quickTraceQuery.tsx");
/* harmony import */ var _eventToolbar__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ../eventToolbar */ "./app/views/organizationGroupDetails/eventToolbar.tsx");
/* harmony import */ var _reprocessingProgress__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ../reprocessingProgress */ "./app/views/organizationGroupDetails/reprocessingProgress.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! ../utils */ "./app/views/organizationGroupDetails/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

























class GroupEventDetails extends react__WEBPACK_IMPORTED_MODULE_5__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      eventNavLinks: '',
      releasesCompletion: null
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchData", async () => {
      const {
        api,
        project,
        organization
      } = this.props;
      const orgSlug = organization.slug;
      const projSlug = project.slug;
      const projectId = project.id;
      /**
       * Perform below requests in parallel
       */

      const releasesCompletionPromise = api.requestPromise(`/projects/${orgSlug}/${projSlug}/releases/completion/`);
      (0,sentry_utils_fetchSentryAppInstallations__WEBPACK_IMPORTED_MODULE_19__["default"])(api, orgSlug); // TODO(marcos): Sometimes PageFiltersStore cannot pick a project.

      if (projectId) {
        (0,sentry_actionCreators_sentryAppComponents__WEBPACK_IMPORTED_MODULE_8__.fetchSentryAppComponents)(api, orgSlug, projectId);
      } else {
        _sentry_react__WEBPACK_IMPORTED_MODULE_25__.withScope(scope => {
          scope.setExtra('props', this.props);
          scope.setExtra('state', this.state);
          _sentry_react__WEBPACK_IMPORTED_MODULE_25__.captureMessage('Project ID was not set');
        });
      }

      const releasesCompletion = await releasesCompletionPromise;
      this.setState({
        releasesCompletion
      });
    });
  }

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    const {
      environments,
      params,
      location,
      organization,
      project
    } = this.props;
    const environmentsHaveChanged = !lodash_isEqual__WEBPACK_IMPORTED_MODULE_7___default()(prevProps.environments, environments); // If environments are being actively changed and will no longer contain the
    // current event's environment, redirect to latest

    if (environmentsHaveChanged && prevProps.event && params.eventId && !['latest', 'oldest'].includes(params.eventId)) {
      const shouldRedirect = environments.length > 0 && !environments.find(env => env.name === (0,_utils__WEBPACK_IMPORTED_MODULE_24__.getEventEnvironment)(prevProps.event));

      if (shouldRedirect) {
        react_router__WEBPACK_IMPORTED_MODULE_6__.browserHistory.replace({
          pathname: `/organizations/${params.orgId}/issues/${params.groupId}/`,
          query: location.query
        });
        return;
      }
    }

    if (prevProps.organization.slug !== organization.slug || prevProps.project.slug !== project.slug) {
      this.fetchData();
    }
  }

  componentWillUnmount() {
    this.props.api.clear();
  }

  get showExampleCommit() {
    var _this$props$project, _this$props$project2, _this$state$releasesC;

    return ((_this$props$project = this.props.project) === null || _this$props$project === void 0 ? void 0 : _this$props$project.isMember) && ((_this$props$project2 = this.props.project) === null || _this$props$project2 === void 0 ? void 0 : _this$props$project2.firstEvent) && ((_this$state$releasesC = this.state.releasesCompletion) === null || _this$state$releasesC === void 0 ? void 0 : _this$state$releasesC.some(_ref => {
      let {
        step,
        complete
      } = _ref;
      return step === 'commit' && !complete;
    }));
  }

  renderContent(eventWithMeta) {
    const {
      group,
      project,
      organization,
      environments,
      location,
      loadingEvent,
      onRetry,
      eventError,
      router,
      route
    } = this.props;

    if (loadingEvent) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_14__["default"], {});
    }

    if (eventError) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_errors_groupEventDetailsLoadingError__WEBPACK_IMPORTED_MODULE_9__["default"], {
        environments: environments,
        onRetry: onRetry
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_events_eventEntries__WEBPACK_IMPORTED_MODULE_10__["default"], {
      group: group,
      event: eventWithMeta,
      organization: organization,
      project: project,
      location: location,
      showExampleCommit: this.showExampleCommit,
      router: router,
      route: route
    });
  }

  renderReprocessedBox(reprocessStatus, mostRecentActivity) {
    if (reprocessStatus !== _utils__WEBPACK_IMPORTED_MODULE_24__.ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT && reprocessStatus !== _utils__WEBPACK_IMPORTED_MODULE_24__.ReprocessingStatus.REPROCESSED_AND_HAS_EVENT) {
      return null;
    }

    const {
      group,
      organization
    } = this.props;
    const {
      count,
      id: groupId
    } = group;
    const groupCount = Number(count);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_reprocessedBox__WEBPACK_IMPORTED_MODULE_16__["default"], {
      reprocessActivity: mostRecentActivity,
      groupCount: groupCount,
      groupId: groupId,
      orgSlug: organization.slug
    });
  }

  render() {
    var _organization$feature;

    const {
      className,
      group,
      project,
      organization,
      environments,
      location,
      event,
      groupReprocessingStatus
    } = this.props;
    const eventWithMeta = (0,sentry_components_events_meta_metaProxy__WEBPACK_IMPORTED_MODULE_11__.withMeta)(event); // Reprocessing

    const hasReprocessingV2Feature = (_organization$feature = organization.features) === null || _organization$feature === void 0 ? void 0 : _organization$feature.includes('reprocessing-v2');
    const {
      activity: activities
    } = group;
    const mostRecentActivity = (0,_utils__WEBPACK_IMPORTED_MODULE_24__.getGroupMostRecentActivity)(activities);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)("div", {
      className: className,
      "data-test-id": "group-event-details",
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(StyledLayoutBody, {
        children: hasReprocessingV2Feature && groupReprocessingStatus === _utils__WEBPACK_IMPORTED_MODULE_24__.ReprocessingStatus.REPROCESSING ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(_reprocessingProgress__WEBPACK_IMPORTED_MODULE_23__["default"], {
          totalEvents: mostRecentActivity.data.eventCount,
          pendingEvents: group.statusDetails.pendingEvents
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(react__WEBPACK_IMPORTED_MODULE_5__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_utils_performance_quickTrace_quickTraceQuery__WEBPACK_IMPORTED_MODULE_21__["default"], {
            event: eventWithMeta,
            location: location,
            orgSlug: organization.slug,
            children: results => {
              return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(StyledLayoutMain, {
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(sentry_utils_performance_quickTrace_quickTraceContext__WEBPACK_IMPORTED_MODULE_20__.QuickTraceContext.Provider, {
                  value: results,
                  children: [eventWithMeta && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(_eventToolbar__WEBPACK_IMPORTED_MODULE_22__["default"], {
                    group: group,
                    event: eventWithMeta,
                    organization: organization,
                    location: location,
                    project: project
                  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(Wrapper, {
                    children: [group.status === 'ignored' && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_mutedBox__WEBPACK_IMPORTED_MODULE_15__["default"], {
                      statusDetails: group.statusDetails
                    }), group.status === 'resolved' && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_resolutionBox__WEBPACK_IMPORTED_MODULE_17__["default"], {
                      statusDetails: group.statusDetails,
                      activities: activities,
                      projectId: project.id
                    }), this.renderReprocessedBox(groupReprocessingStatus, mostRecentActivity)]
                  }), this.renderContent(eventWithMeta)]
                })
              });
            }
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(StyledLayoutSide, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_group_sidebar__WEBPACK_IMPORTED_MODULE_12__["default"], {
              organization: organization,
              project: project,
              group: group,
              event: eventWithMeta,
              environments: environments
            })
          })]
        })
      })
    });
  }

}

GroupEventDetails.displayName = "GroupEventDetails";

const StyledLayoutBody = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_13__.Body,  true ? {
  target: "e150o94r4"
} : 0)( true ? {
  name: "ivydhp",
  styles: "padding:0!important"
} : 0);

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e150o94r3"
} : 0)( true ? {
  name: "t2vw58",
  styles: "margin-bottom:-1px"
} : 0);

const StyledLayoutMain = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_13__.Main,  true ? {
  target: "e150o94r2"
} : 0)("@media (min-width: ", p => p.theme.breakpoints.large, "){border-right:1px solid ", p => p.theme.border, ";padding-right:0;}" + ( true ? "" : 0));

const StyledLayoutSide = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_13__.Side,  true ? {
  target: "e150o94r1"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(3), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(3), ";@media (min-width: ", p => p.theme.breakpoints.large, "){padding-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(4), ";padding-left:0;}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (/*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(GroupEventDetails, {
  target: "e150o94r0"
})( true ? {
  name: "1k8t52o",
  styles: "display:flex;flex:1;flex-direction:column"
} : 0));

/***/ }),

/***/ "./app/views/organizationGroupDetails/groupEventDetails/index.tsx":
/*!************************************************************************!*\
  !*** ./app/views/organizationGroupDetails/groupEventDetails/index.tsx ***!
  \************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "GroupEventDetailsContainer": () => (/* binding */ GroupEventDetailsContainer),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_environments__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/environments */ "./app/actionCreators/environments.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_organizationEnvironmentsStore__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/stores/organizationEnvironmentsStore */ "./app/stores/organizationEnvironmentsStore.tsx");
/* harmony import */ var sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/stores/useLegacyStore */ "./app/stores/useLegacyStore.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/withPageFilters */ "./app/utils/withPageFilters.tsx");
/* harmony import */ var _groupEventDetails__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./groupEventDetails */ "./app/views/organizationGroupDetails/groupEventDetails/groupEventDetails.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













function GroupEventDetailsContainer(props) {
  const state = (0,sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_7__.useLegacyStore)(sentry_stores_organizationEnvironmentsStore__WEBPACK_IMPORTED_MODULE_6__["default"]);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    if (!state.environments && !state.error) {
      (0,sentry_actionCreators_environments__WEBPACK_IMPORTED_MODULE_2__.fetchOrganizationEnvironments)(props.api, props.organization.slug);
    } // XXX: Missing dependencies, but it reflects the old of componentDidMount

  }, [props.api]);

  if (state.error) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_3__["default"], {
      message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)("There was an error loading your organization's environments")
    });
  } // null implies loading state


  if (!state.environments) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_4__["default"], {});
  }

  const {
    selection,
    ...otherProps
  } = props;
  const environments = state.environments.filter(env => selection.environments.includes(env.name));
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(_groupEventDetails__WEBPACK_IMPORTED_MODULE_11__["default"], { ...otherProps,
    environments: environments
  });
}
GroupEventDetailsContainer.displayName = "GroupEventDetailsContainer";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_8__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_9__["default"])((0,sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_10__["default"])(GroupEventDetailsContainer))));

/***/ }),

/***/ "./app/views/organizationGroupDetails/quickTrace/configureDistributedTracing.tsx":
/*!***************************************************************************************!*\
  !*** ./app/views/organizationGroupDetails/quickTrace/configureDistributedTracing.tsx ***!
  \***************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_images_spot_performance_quick_trace_svg__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry-images/spot/performance-quick-trace.svg */ "./images/spot/performance-quick-trace.svg");
/* harmony import */ var sentry_actionCreators_prompts__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/prompts */ "./app/actionCreators/prompts.tsx");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/acl/featureDisabled */ "./app/components/acl/featureDisabled.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/hovercard */ "./app/components/hovercard.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_docs__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/docs */ "./app/utils/docs.tsx");
/* harmony import */ var sentry_utils_promptIsDismissed__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/promptIsDismissed */ "./app/utils/promptIsDismissed.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


















const DISTRIBUTED_TRACING_FEATURE = 'distributed_tracing';

class ConfigureDistributedTracing extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      shouldShow: null
    });
  }

  componentDidMount() {
    this.fetchData();
  }

  async fetchData() {
    const {
      api,
      event,
      project,
      organization
    } = this.props;

    if (!(0,sentry_utils_promptIsDismissed__WEBPACK_IMPORTED_MODULE_16__.promptCanShow)(DISTRIBUTED_TRACING_FEATURE, event.eventID)) {
      this.setState({
        shouldShow: false
      });
      return;
    }

    const data = await (0,sentry_actionCreators_prompts__WEBPACK_IMPORTED_MODULE_5__.promptsCheck)(api, {
      projectId: project.id,
      organizationId: organization.id,
      feature: DISTRIBUTED_TRACING_FEATURE
    });
    this.setState({
      shouldShow: !(0,sentry_utils_promptIsDismissed__WEBPACK_IMPORTED_MODULE_16__.promptIsDismissed)(data !== null && data !== void 0 ? data : {}, 30)
    });
  }

  trackAnalytics(_ref) {
    let {
      eventKey,
      eventName
    } = _ref;
    const {
      project,
      organization
    } = this.props;
    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_14__.trackAnalyticsEvent)({
      eventKey,
      eventName,
      organization_id: parseInt(organization.id, 10),
      project_id: parseInt(project.id, 10),
      platform: project.platform
    });
  }

  handleClick(_ref2) {
    let {
      action,
      eventKey,
      eventName
    } = _ref2;
    const {
      api,
      project,
      organization
    } = this.props;
    const data = {
      projectId: project.id,
      organizationId: organization.id,
      feature: DISTRIBUTED_TRACING_FEATURE,
      status: action
    };
    (0,sentry_actionCreators_prompts__WEBPACK_IMPORTED_MODULE_5__.promptsUpdate)(api, data).then(() => this.setState({
      shouldShow: false
    }));
    this.trackAnalytics({
      eventKey,
      eventName
    });
  }

  renderActionButton(docsLink) {
    const features = ['organizations:performance-view'];
    const noFeatureMessage = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Requires performance monitoring.');

    const renderDisabled = p => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_10__.Hovercard, {
      body: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_7__["default"], {
        features: features,
        hideHelpToggle: true,
        message: noFeatureMessage,
        featureName: noFeatureMessage
      }),
      children: p.children(p)
    });

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_6__["default"], {
      hookName: "feature-disabled:configure-distributed-tracing",
      features: features,
      renderDisabled: renderDisabled,
      children: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"], {
        size: "sm",
        priority: "primary",
        href: docsLink,
        onClick: () => this.trackAnalytics({
          eventKey: 'quick_trace.missing_instrumentation.docs',
          eventName: 'Quick Trace: Missing Instrumentation Docs'
        }),
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Read the docs')
      })
    });
  }

  render() {
    const {
      project
    } = this.props;
    const {
      shouldShow
    } = this.state;

    if (!shouldShow) {
      return null;
    }

    const docsLink = (0,sentry_utils_docs__WEBPACK_IMPORTED_MODULE_15__.getConfigureTracingDocsLink)(project); // if the platform does not support performance, do not show this prompt

    if (docsLink === null) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(ExampleQuickTracePanel, {
      dashedBorder: true,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)("div", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(Header, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Configure Distributed Tracing')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(Description, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('See what happened right before and after this error')
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(Image, {
        src: sentry_images_spot_performance_quick_trace_svg__WEBPACK_IMPORTED_MODULE_4__,
        alt: "configure distributed tracing"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(ActionButtons, {
        children: [this.renderActionButton(docsLink), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_9__["default"], {
          merged: true,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"], {
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Remind me next month'),
            size: "sm",
            onClick: () => this.handleClick({
              action: 'snoozed',
              eventKey: 'quick_trace.missing_instrumentation.snoozed',
              eventName: 'Quick Trace: Missing Instrumentation Snoozed'
            }),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Snooze')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"], {
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Dismiss for this project'),
            size: "sm",
            onClick: () => this.handleClick({
              action: 'dismissed',
              eventKey: 'quick_trace.missing_instrumentation.dismissed',
              eventName: 'Quick Trace: Missing Instrumentation Dismissed'
            }),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Dismiss')
          })]
        })]
      })]
    });
  }

}

ConfigureDistributedTracing.displayName = "ConfigureDistributedTracing";

const ExampleQuickTracePanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__.Panel,  true ? {
  target: "ez3lron4"
} : 0)("display:grid;grid-template-columns:1.5fr 1fr;grid-template-rows:auto max-content;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1), ";background:none;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(2), ";margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(2), " 0;" + ( true ? "" : 0));

const Header = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('h3',  true ? {
  target: "ez3lron3"
} : 0)("font-size:", p => p.theme.fontSizeSmall, ";text-transform:uppercase;color:", p => p.theme.gray300, ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1), ";" + ( true ? "" : 0));

const Description = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ez3lron2"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

const Image = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('img',  true ? {
  target: "ez3lron1"
} : 0)( true ? {
  name: "1kr7pps",
  styles: "grid-row:1/3;grid-column:2/3;justify-self:end"
} : 0);

const ActionButtons = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ez3lron0"
} : 0)("display:grid;grid-template-columns:max-content auto;justify-items:start;align-items:end;grid-column-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_17__["default"])(ConfigureDistributedTracing));

/***/ }),

/***/ "./app/views/organizationGroupDetails/quickTrace/index.tsx":
/*!*****************************************************************!*\
  !*** ./app/views/organizationGroupDetails/quickTrace/index.tsx ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_utils_performance_quickTrace_quickTraceContext__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/performance/quickTrace/quickTraceContext */ "./app/utils/performance/quickTrace/quickTraceContext.tsx");
/* harmony import */ var _configureDistributedTracing__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./configureDistributedTracing */ "./app/views/organizationGroupDetails/quickTrace/configureDistributedTracing.tsx");
/* harmony import */ var _issueQuickTrace__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./issueQuickTrace */ "./app/views/organizationGroupDetails/quickTrace/issueQuickTrace.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








function QuickTrace(_ref) {
  var _event$contexts, _event$contexts$trace;

  let {
    event,
    group,
    organization,
    location,
    isPerformanceIssue
  } = _ref;
  const hasPerformanceView = organization.features.includes('performance-view');
  const hasTraceContext = Boolean((_event$contexts = event.contexts) === null || _event$contexts === void 0 ? void 0 : (_event$contexts$trace = _event$contexts.trace) === null || _event$contexts$trace === void 0 ? void 0 : _event$contexts$trace.trace_id);
  const quickTrace = (0,react__WEBPACK_IMPORTED_MODULE_1__.useContext)(sentry_utils_performance_quickTrace_quickTraceContext__WEBPACK_IMPORTED_MODULE_2__.QuickTraceContext);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [!hasTraceContext && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(_configureDistributedTracing__WEBPACK_IMPORTED_MODULE_3__["default"], {
      event: event,
      project: group.project,
      organization: organization
    }), hasPerformanceView && hasTraceContext && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(_issueQuickTrace__WEBPACK_IMPORTED_MODULE_4__["default"], {
      organization: organization,
      event: event,
      location: location,
      isPerformanceIssue: isPerformanceIssue,
      quickTrace: quickTrace
    })]
  });
}

QuickTrace.displayName = "QuickTrace";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (QuickTrace);

/***/ }),

/***/ "./app/views/organizationGroupDetails/quickTrace/issueQuickTrace.tsx":
/*!***************************************************************************!*\
  !*** ./app/views/organizationGroupDetails/quickTrace/issueQuickTrace.tsx ***!
  \***************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_prompts__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/prompts */ "./app/actionCreators/prompts.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/errorBoundary */ "./app/components/errorBoundary.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_components_quickTrace__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/quickTrace */ "./app/components/quickTrace/index.tsx");
/* harmony import */ var sentry_components_quickTrace_utils__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/quickTrace/utils */ "./app/components/quickTrace/utils.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_promptIsDismissed__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/promptIsDismissed */ "./app/utils/promptIsDismissed.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }





















class IssueQuickTrace extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      shouldShow: null
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "snoozePrompt", () => {
      const {
        api,
        event,
        organization
      } = this.props;
      const data = {
        projectId: event.projectID,
        organizationId: organization.id,
        feature: 'quick_trace_missing',
        status: 'snoozed'
      };
      (0,sentry_actionCreators_prompts__WEBPACK_IMPORTED_MODULE_4__.promptsUpdate)(api, data).then(() => this.setState({
        shouldShow: false
      }));
    });
  }

  componentDidMount() {
    this.promptsCheck();
  }

  shouldComponentUpdate(nextProps, nextState) {
    return this.props.event !== nextProps.event || this.state.shouldShow !== nextState.shouldShow || this.props.quickTrace !== nextProps.quickTrace;
  }

  async promptsCheck() {
    const {
      api,
      event,
      organization
    } = this.props;
    const data = await (0,sentry_actionCreators_prompts__WEBPACK_IMPORTED_MODULE_4__.promptsCheck)(api, {
      organizationId: organization.id,
      projectId: event.projectID,
      feature: 'quick_trace_missing'
    });
    this.setState({
      shouldShow: !(0,sentry_utils_promptIsDismissed__WEBPACK_IMPORTED_MODULE_18__.promptIsDismissed)(data !== null && data !== void 0 ? data : {}, 30)
    });
  }

  handleTraceLink(organization) {
    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_16__.trackAnalyticsEvent)({
      eventKey: 'quick_trace.trace_id.clicked',
      eventName: 'Quick Trace: Trace ID clicked',
      organization_id: parseInt(organization.id, 10),
      source: 'issues'
    });
  }

  renderTraceLink(_ref) {
    let {
      isLoading,
      error,
      trace,
      type
    } = _ref;
    const {
      event,
      organization
    } = this.props;

    if (isLoading || error !== null || trace === null || type === 'empty') {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(LinkContainer, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_9__["default"], {
        to: (0,sentry_components_quickTrace_utils__WEBPACK_IMPORTED_MODULE_12__.generateTraceTarget)(event, organization),
        onClick: () => this.handleTraceLink(organization),
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('View Full Trace')
      })
    });
  }

  renderQuickTrace(results) {
    const {
      event,
      location,
      organization,
      isPerformanceIssue
    } = this.props;
    const {
      shouldShow
    } = this.state;
    const {
      isLoading,
      error,
      trace,
      type
    } = results;

    if (isLoading) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_10__["default"], {
        height: "24px"
      });
    }

    if (error || trace === null || trace.length === 0) {
      if (!shouldShow) {
        return null;
      }

      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_17__["default"])('issue.quick_trace_status', {
        organization,
        status: type === 'missing' ? 'transaction missing' : 'trace missing',
        is_performance_issue: isPerformanceIssue !== null && isPerformanceIssue !== void 0 ? isPerformanceIssue : false
      });
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(StyledAlert, {
        type: "info",
        showIcon: true,
        trailingItems: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
          priority: "link",
          size: "zero",
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Dismiss for a month'),
          onClick: this.snoozePrompt,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_13__.IconClose, {})
        }),
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.tct)('The [type] for this event cannot be found. [link]', {
          type: type === 'missing' ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('transaction') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('trace'),
          link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_8__["default"], {
            href: "https://docs.sentry.io/product/sentry-basics/tracing/trace-view/#troubleshooting",
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Read the docs to understand why.')
          })
        })
      });
    }

    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_17__["default"])('issue.quick_trace_status', {
      organization,
      status: 'success',
      is_performance_issue: isPerformanceIssue !== null && isPerformanceIssue !== void 0 ? isPerformanceIssue : false
    });
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [this.renderTraceLink(results), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(QuickTraceWrapper, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_quickTrace__WEBPACK_IMPORTED_MODULE_11__["default"], {
          event: event,
          quickTrace: results,
          location: location,
          organization: organization,
          anchor: "left",
          errorDest: "issue",
          transactionDest: "performance"
        })
      })]
    });
  }

  render() {
    const {
      quickTrace
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_7__["default"], {
      mini: true,
      children: this.renderQuickTrace(quickTrace)
    });
  }

}

IssueQuickTrace.displayName = "IssueQuickTrace";

const LinkContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e12j2to72"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1), ";padding-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1), ";position:relative;&:before{display:block;position:absolute;content:'';left:0;top:2px;height:14px;border-left:1px solid ", p => p.theme.border, ";}" + ( true ? "" : 0));

const QuickTraceWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e12j2to71"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(0.5), ";" + ( true ? "" : 0));

const StyledAlert = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_alert__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e12j2to70"
} : 0)( true ? {
  name: "ti75j2",
  styles: "margin:0"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_19__["default"])(IssueQuickTrace));

/***/ }),

/***/ "./app/views/organizationGroupDetails/reprocessingProgress.tsx":
/*!*********************************************************************!*\
  !*** ./app/views/organizationGroupDetails/reprocessingProgress.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_progressBar__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/progressBar */ "./app/components/progressBar.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








function ReprocessingProgress(_ref) {
  let {
    totalEvents,
    pendingEvents
  } = _ref;
  const remainingEventsToReprocess = totalEvents - pendingEvents;
  const remainingEventsToReprocessPercent = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_4__.percent)(remainingEventsToReprocess, totalEvents);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Wrapper, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(Inner, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(Header, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Title, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Reprocessing\u2026')
        }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Once the events in this issue have been reprocessed, you’ll be able to make changes and view any new issues that may have been created.')]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(Content, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_progressBar__WEBPACK_IMPORTED_MODULE_1__["default"], {
          value: remainingEventsToReprocessPercent,
          variant: "large"
        }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.tct)('[remainingEventsToReprocess]/[totalEvents] [event] reprocessed', {
          remainingEventsToReprocess,
          totalEvents,
          event: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.tn)('event', 'events', totalEvents)
        })]
      })]
    })
  });
}

ReprocessingProgress.displayName = "ReprocessingProgress";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReprocessingProgress);

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ev0t3ja4"
} : 0)("margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(4), " 40px;flex:1;text-align:center;@media (min-width: ", p => p.theme.breakpoints.small, "){margin:40px;}" + ( true ? "" : 0));

const Content = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ev0t3ja3"
} : 0)("color:", p => p.theme.gray300, ";font-size:", p => p.theme.fontSizeMedium, ";display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(1.5), ";justify-items:center;max-width:402px;width:100%;" + ( true ? "" : 0));

const Inner = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ev0t3ja2"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(3), ";justify-items:center;" + ( true ? "" : 0));

const Header = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ev0t3ja1"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(1), ";color:", p => p.theme.textColor, ";max-width:557px;" + ( true ? "" : 0));

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('h3',  true ? {
  target: "ev0t3ja0"
} : 0)("font-size:", p => p.theme.headerFontSize, ";font-weight:600;margin-bottom:0;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/organizationGroupDetails/utils.tsx":
/*!******************************************************!*\
  !*** ./app/views/organizationGroupDetails/utils.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ReprocessingStatus": () => (/* binding */ ReprocessingStatus),
/* harmony export */   "fetchGroupEvent": () => (/* binding */ fetchGroupEvent),
/* harmony export */   "fetchGroupUserReports": () => (/* binding */ fetchGroupUserReports),
/* harmony export */   "getEventEnvironment": () => (/* binding */ getEventEnvironment),
/* harmony export */   "getGroupMostRecentActivity": () => (/* binding */ getGroupMostRecentActivity),
/* harmony export */   "getGroupReprocessingStatus": () => (/* binding */ getGroupReprocessingStatus),
/* harmony export */   "getSubscriptionReason": () => (/* binding */ getSubscriptionReason),
/* harmony export */   "markEventSeen": () => (/* binding */ markEventSeen)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var lodash_orderBy__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/orderBy */ "../node_modules/lodash/orderBy.js");
/* harmony import */ var lodash_orderBy__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_orderBy__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_actionCreators_group__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/group */ "./app/actionCreators/group.tsx");
/* harmony import */ var sentry_api__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/api */ "./app/api.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







/**
 * Fetches group data and mark as seen
 *
 * @param orgId organization slug
 * @param groupId groupId
 * @param eventId eventId or "latest" or "oldest"
 * @param envNames
 * @param projectId project slug required for eventId that is not latest or oldest
 */
async function fetchGroupEvent(api, orgId, groupId, eventId, envNames, projectId) {
  const url = eventId === 'latest' || eventId === 'oldest' ? `/issues/${groupId}/events/${eventId}/` : `/projects/${orgId}/${projectId}/events/${eventId}/`;
  const query = {};

  if (envNames.length !== 0) {
    query.environment = envNames;
  }

  const data = await api.requestPromise(url, {
    query
  });
  return data;
}
function markEventSeen(api, orgId, projectId, groupId) {
  (0,sentry_actionCreators_group__WEBPACK_IMPORTED_MODULE_2__.bulkUpdate)(api, {
    orgId,
    projectId,
    itemIds: [groupId],
    failSilently: true,
    data: {
      hasSeen: true
    }
  }, {});
}
function fetchGroupUserReports(groupId, query) {
  const api = new sentry_api__WEBPACK_IMPORTED_MODULE_3__.Client();
  return api.requestPromise(`/issues/${groupId}/user-reports/`, {
    includeAllArgs: true,
    query
  });
}
/**
 * Returns the environment name for an event or null
 *
 * @param event
 */

function getEventEnvironment(event) {
  const tag = event.tags.find(_ref => {
    let {
      key
    } = _ref;
    return key === 'environment';
  });
  return tag ? tag.value : null;
}
const SUBSCRIPTION_REASONS = {
  commented: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)("You're receiving workflow notifications because you have commented on this issue."),
  assigned: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)("You're receiving workflow notifications because you were assigned to this issue."),
  bookmarked: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)("You're receiving workflow notifications because you have bookmarked this issue."),
  changed_status: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)("You're receiving workflow notifications because you have changed the status of this issue."),
  mentioned: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)("You're receiving workflow notifications because you have been mentioned in this issue.")
};
/**
 * @param group
 * @param removeLinks add/remove links to subscription reasons text (default: false)
 * @returns Reason for subscription
 */

function getSubscriptionReason(group) {
  let removeLinks = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

  if (group.subscriptionDetails && group.subscriptionDetails.disabled) {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)('You have [link:disabled workflow notifications] for this project.', {
      link: removeLinks ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("span", {}) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("a", {
        href: "/account/settings/notifications/"
      })
    });
  }

  if (!group.isSubscribed) {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Subscribe to workflow notifications for this issue');
  }

  if (group.subscriptionDetails) {
    const {
      reason
    } = group.subscriptionDetails;

    if (reason === 'unknown') {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)("You're receiving workflow notifications because you are subscribed to this issue.");
    }

    if (reason && SUBSCRIPTION_REASONS.hasOwnProperty(reason)) {
      return SUBSCRIPTION_REASONS[reason];
    }
  }

  return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)("You're receiving updates because you are [link:subscribed to workflow notifications] for this project.", {
    link: removeLinks ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("span", {}) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("a", {
      href: "/account/settings/notifications/"
    })
  });
}
function getGroupMostRecentActivity(activities) {
  // Most recent activity
  return lodash_orderBy__WEBPACK_IMPORTED_MODULE_1___default()([...activities], _ref2 => {
    let {
      dateCreated
    } = _ref2;
    return new Date(dateCreated);
  }, ['desc'])[0];
}
let ReprocessingStatus; // Reprocessing Checks

(function (ReprocessingStatus) {
  ReprocessingStatus["REPROCESSED_AND_HASNT_EVENT"] = "reprocessed_and_hasnt_event";
  ReprocessingStatus["REPROCESSED_AND_HAS_EVENT"] = "reprocessed_and_has_event";
  ReprocessingStatus["REPROCESSING"] = "reprocessing";
  ReprocessingStatus["NO_STATUS"] = "no_status";
})(ReprocessingStatus || (ReprocessingStatus = {}));

function getGroupReprocessingStatus(group, mostRecentActivity) {
  const {
    status,
    count,
    activity: activities
  } = group;
  const groupCount = Number(count);

  switch (status) {
    case 'reprocessing':
      return ReprocessingStatus.REPROCESSING;

    case 'unresolved':
      {
        const groupMostRecentActivity = mostRecentActivity !== null && mostRecentActivity !== void 0 ? mostRecentActivity : getGroupMostRecentActivity(activities);

        if ((groupMostRecentActivity === null || groupMostRecentActivity === void 0 ? void 0 : groupMostRecentActivity.type) === 'reprocess') {
          if (groupCount === 0) {
            return ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT;
          }

          return ReprocessingStatus.REPROCESSED_AND_HAS_EVENT;
        }

        return ReprocessingStatus.NO_STATUS;
      }

    default:
      return ReprocessingStatus.NO_STATUS;
  }
}

/***/ }),

/***/ "./app/views/organizationIntegrations/integrationItem.tsx":
/*!****************************************************************!*\
  !*** ./app/views/organizationIntegrations/integrationItem.tsx ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ IntegrationItem)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_organizationIntegrations_integrationIcon__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/views/organizationIntegrations/integrationIcon */ "./app/views/organizationIntegrations/integrationIcon.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






class IntegrationItem extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  render() {
    const {
      integration,
      compact
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(Flex, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("div", {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_views_organizationIntegrations_integrationIcon__WEBPACK_IMPORTED_MODULE_4__["default"], {
          size: compact ? 22 : 32,
          integration: integration
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(Labels, {
        compact: compact,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(IntegrationName, {
          "data-test-id": "integration-name",
          children: integration.name
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(DomainName, {
          compact: compact,
          children: integration.domainName
        })]
      })]
    });
  }

}
IntegrationItem.displayName = "IntegrationItem";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(IntegrationItem, "defaultProps", {
  compact: false
});

const Flex = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1k6l1f03"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const Labels = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1k6l1f02"
} : 0)("box-sizing:border-box;display:flex;", p => p.compact ? 'align-items: center;' : '', ";flex-direction:", p => p.compact ? 'row' : 'column', ";padding-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(1), ";min-width:0;justify-content:center;" + ( true ? "" : 0));

const IntegrationName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1k6l1f01"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";font-weight:bold;" + ( true ? "" : 0)); // Not using the overflowEllipsis style import here
// as it sets width 100% which causes layout issues in the
// integration list.


const DomainName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1k6l1f00"
} : 0)("color:", p => p.theme.subText, ";margin-left:", p => p.compact ? (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(1) : 'inherit', ";margin-top:", p => !p.compact ? 0 : 'inherit', ";font-size:", p => p.theme.fontSizeSmall, ";overflow:hidden;text-overflow:ellipsis;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/performance/transactionSummary/utils.tsx":
/*!************************************************************!*\
  !*** ./app/views/performance/transactionSummary/utils.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SidebarSpacer": () => (/* binding */ SidebarSpacer),
/* harmony export */   "TransactionFilterOptions": () => (/* binding */ TransactionFilterOptions),
/* harmony export */   "generateTraceLink": () => (/* binding */ generateTraceLink),
/* harmony export */   "generateTransactionLink": () => (/* binding */ generateTransactionLink),
/* harmony export */   "generateTransactionSummaryRoute": () => (/* binding */ generateTransactionSummaryRoute),
/* harmony export */   "normalizeSearchConditions": () => (/* binding */ normalizeSearchConditions),
/* harmony export */   "normalizeSearchConditionsWithTransactionName": () => (/* binding */ normalizeSearchConditionsWithTransactionName),
/* harmony export */   "transactionSummaryRouteWithQuery": () => (/* binding */ transactionSummaryRouteWithQuery)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_discover_urls__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/discover/urls */ "./app/utils/discover/urls.tsx");
/* harmony import */ var sentry_utils_performance_urls__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/performance/urls */ "./app/utils/performance/urls.ts");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_views_performance_traceDetails_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/performance/traceDetails/utils */ "./app/views/performance/traceDetails/utils.tsx");






let TransactionFilterOptions;

(function (TransactionFilterOptions) {
  TransactionFilterOptions["FASTEST"] = "fastest";
  TransactionFilterOptions["SLOW"] = "slow";
  TransactionFilterOptions["OUTLIER"] = "outlier";
  TransactionFilterOptions["RECENT"] = "recent";
})(TransactionFilterOptions || (TransactionFilterOptions = {}));

function generateTransactionSummaryRoute(_ref) {
  let {
    orgSlug
  } = _ref;
  return `/organizations/${orgSlug}/performance/summary/`;
} // normalizes search conditions by removing any redundant search conditions before presenting them in:
// - query strings
// - search UI

function normalizeSearchConditions(query) {
  const filterParams = normalizeSearchConditionsWithTransactionName(query); // no need to include transaction as its already in the query params

  filterParams.removeFilter('transaction');
  return filterParams;
} // normalizes search conditions by removing any redundant search conditions, but retains any transaction name

function normalizeSearchConditionsWithTransactionName(query) {
  const filterParams = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_4__.MutableSearch(query); // remove any event.type queries since it is implied to apply to only transactions

  filterParams.removeFilter('event.type');
  return filterParams;
}
function transactionSummaryRouteWithQuery(_ref2) {
  let {
    orgSlug,
    transaction,
    projectID,
    query,
    unselectedSeries = 'p100()',
    display,
    trendFunction,
    trendColumn,
    showTransactions,
    additionalQuery
  } = _ref2;
  const pathname = generateTransactionSummaryRoute({
    orgSlug
  });
  let searchFilter;

  if (typeof query.query === 'string') {
    searchFilter = normalizeSearchConditions(query.query).formatString();
  } else {
    searchFilter = query.query;
  }

  return {
    pathname,
    query: {
      transaction,
      project: projectID,
      environment: query.environment,
      statsPeriod: query.statsPeriod,
      start: query.start,
      end: query.end,
      query: searchFilter,
      unselectedSeries,
      showTransactions,
      display,
      trendFunction,
      trendColumn,
      ...additionalQuery
    }
  };
}
function generateTraceLink(dateSelection) {
  return (organization, tableRow, _query) => {
    const traceId = `${tableRow.trace}`;

    if (!traceId) {
      return {};
    }

    return (0,sentry_views_performance_traceDetails_utils__WEBPACK_IMPORTED_MODULE_5__.getTraceDetailsUrl)(organization, traceId, dateSelection, {});
  };
}
function generateTransactionLink(transactionName) {
  return (organization, tableRow, query, spanId) => {
    const eventSlug = (0,sentry_utils_discover_urls__WEBPACK_IMPORTED_MODULE_2__.generateEventSlug)(tableRow);
    return (0,sentry_utils_performance_urls__WEBPACK_IMPORTED_MODULE_3__.getTransactionDetailsUrl)(organization.slug, eventSlug, transactionName, query, spanId);
  };
}
const SidebarSpacer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1radvp0"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(3), ";" + ( true ? "" : 0));

/***/ }),

/***/ "../node_modules/core-js/modules/es.reflect.to-string-tag.js":
/*!*******************************************************************!*\
  !*** ../node_modules/core-js/modules/es.reflect.to-string-tag.js ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, __unused_webpack_exports, __webpack_require__) => {

var $ = __webpack_require__(/*! ../internals/export */ "../node_modules/core-js/internals/export.js");
var global = __webpack_require__(/*! ../internals/global */ "../node_modules/core-js/internals/global.js");
var setToStringTag = __webpack_require__(/*! ../internals/set-to-string-tag */ "../node_modules/core-js/internals/set-to-string-tag.js");

$({ global: true }, { Reflect: {} });

// Reflect[@@toStringTag] property
// https://tc39.es/ecma262/#sec-reflect-@@tostringtag
setToStringTag(global.Reflect, 'Reflect', true);


/***/ }),

/***/ "../node_modules/lodash/_baseExtremum.js":
/*!***********************************************!*\
  !*** ../node_modules/lodash/_baseExtremum.js ***!
  \***********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var isSymbol = __webpack_require__(/*! ./isSymbol */ "../node_modules/lodash/isSymbol.js");

/**
 * The base implementation of methods like `_.max` and `_.min` which accepts a
 * `comparator` to determine the extremum value.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} iteratee The iteratee invoked per iteration.
 * @param {Function} comparator The comparator used to compare values.
 * @returns {*} Returns the extremum value.
 */
function baseExtremum(array, iteratee, comparator) {
  var index = -1,
      length = array.length;

  while (++index < length) {
    var value = array[index],
        current = iteratee(value);

    if (current != null && (computed === undefined
          ? (current === current && !isSymbol(current))
          : comparator(current, computed)
        )) {
      var computed = current,
          result = value;
    }
  }
  return result;
}

module.exports = baseExtremum;


/***/ }),

/***/ "../node_modules/lodash/_baseGt.js":
/*!*****************************************!*\
  !*** ../node_modules/lodash/_baseGt.js ***!
  \*****************************************/
/***/ ((module) => {

/**
 * The base implementation of `_.gt` which doesn't coerce arguments.
 *
 * @private
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if `value` is greater than `other`,
 *  else `false`.
 */
function baseGt(value, other) {
  return value > other;
}

module.exports = baseGt;


/***/ }),

/***/ "../node_modules/lodash/isNull.js":
/*!****************************************!*\
  !*** ../node_modules/lodash/isNull.js ***!
  \****************************************/
/***/ ((module) => {

/**
 * Checks if `value` is `null`.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is `null`, else `false`.
 * @example
 *
 * _.isNull(null);
 * // => true
 *
 * _.isNull(void 0);
 * // => false
 */
function isNull(value) {
  return value === null;
}

module.exports = isNull;


/***/ }),

/***/ "../node_modules/lodash/keyBy.js":
/*!***************************************!*\
  !*** ../node_modules/lodash/keyBy.js ***!
  \***************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseAssignValue = __webpack_require__(/*! ./_baseAssignValue */ "../node_modules/lodash/_baseAssignValue.js"),
    createAggregator = __webpack_require__(/*! ./_createAggregator */ "../node_modules/lodash/_createAggregator.js");

/**
 * Creates an object composed of keys generated from the results of running
 * each element of `collection` thru `iteratee`. The corresponding value of
 * each key is the last element responsible for generating the key. The
 * iteratee is invoked with one argument: (value).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Collection
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Function} [iteratee=_.identity] The iteratee to transform keys.
 * @returns {Object} Returns the composed aggregate object.
 * @example
 *
 * var array = [
 *   { 'dir': 'left', 'code': 97 },
 *   { 'dir': 'right', 'code': 100 }
 * ];
 *
 * _.keyBy(array, function(o) {
 *   return String.fromCharCode(o.code);
 * });
 * // => { 'a': { 'dir': 'left', 'code': 97 }, 'd': { 'dir': 'right', 'code': 100 } }
 *
 * _.keyBy(array, 'dir');
 * // => { 'left': { 'dir': 'left', 'code': 97 }, 'right': { 'dir': 'right', 'code': 100 } }
 */
var keyBy = createAggregator(function(result, value, key) {
  baseAssignValue(result, key, value);
});

module.exports = keyBy;


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


/***/ }),

/***/ "./images/spot/performance-quick-trace.svg":
/*!*************************************************!*\
  !*** ./images/spot/performance-quick-trace.svg ***!
  \*************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";
module.exports = __webpack_require__.p + "assets/performance-quick-trace.d1676f8ac80279ff3a75.svg";

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_utils_performance_histogram_utils_tsx-app_views_organizationGroupDetails_groupEventDetail-f1ee27.5f0967bca821925e38228f6c914e43c7.js.map