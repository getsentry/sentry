"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_project_projectSettingsLayout_tsx"],{

/***/ "./app/components/projects/appStoreConnectContext.tsx":
/*!************************************************************!*\
  !*** ./app/components/projects/appStoreConnectContext.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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

/***/ "./app/utils/appStoreValidationErrorMessage.tsx":
/*!******************************************************!*\
  !*** ./app/utils/appStoreValidationErrorMessage.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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

/***/ "./app/views/projects/projectContext.tsx":
/*!***********************************************!*\
  !*** ./app/views/projects/projectContext.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ProjectContext": () => (/* binding */ ProjectContext),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_document_title__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-document-title */ "../node_modules/react-document-title/index.js");
/* harmony import */ var react_document_title__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(react_document_title__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_actionCreators_members__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/members */ "./app/actionCreators/members.tsx");
/* harmony import */ var sentry_actionCreators_projects__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/projects */ "./app/actionCreators/projects.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_projects_missingProjectMembership__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/projects/missingProjectMembership */ "./app/components/projects/missingProjectMembership.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_sentryTypes__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/sentryTypes */ "./app/sentryTypes.tsx");
/* harmony import */ var sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/stores/memberListStore */ "./app/stores/memberListStore.tsx");
/* harmony import */ var sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/stores/projectsStore */ "./app/stores/projectsStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



















var ErrorTypes;

(function (ErrorTypes) {
  ErrorTypes["MISSING_MEMBERSHIP"] = "MISSING_MEMBERSHIP";
  ErrorTypes["PROJECT_NOT_FOUND"] = "PROJECT_NOT_FOUND";
  ErrorTypes["UNKNOWN"] = "UNKNOWN";
})(ErrorTypes || (ErrorTypes = {}));

/**
 * Higher-order component that sets `project` as a child context
 * value to be accessed by child elements.
 *
 * Additionally delays rendering of children until project XHR has finished
 * and context is populated.
 */
class ProjectContext extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", this.getInitialState());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "docTitleRef", /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_3__.createRef)());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "unsubscribeProjects", sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_13__["default"].listen(projectIds => this.onProjectChange(projectIds), undefined));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "unsubscribeMembers", sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_12__["default"].listen(memberList => this.setState({
      memberList
    }), undefined));
  }

  getInitialState() {
    return {
      loading: true,
      error: false,
      errorType: null,
      memberList: [],
      project: null
    };
  }

  getChildContext() {
    return {
      project: this.state.project
    };
  }

  componentDidMount() {
    // Wait for withProjects to fetch projects before making request
    // Once loaded we can fetchData in componentDidUpdate
    const {
      loadingProjects
    } = this.props;

    if (!loadingProjects) {
      this.fetchData();
    }
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.projectId === this.props.projectId) {
      return;
    }

    if (!nextProps.skipReload) {
      this.remountComponent();
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevProps.projectId !== this.props.projectId) {
      this.fetchData();
    } // Project list has changed. Likely indicating that a new project has been
    // added. Re-fetch project details in case that the new project is the active
    // project.
    //
    // For now, only compare lengths. It is possible that project slugs within
    // the list could change, but it doesn't seem to be broken anywhere else at
    // the moment that would require deeper checks.


    if (prevProps.projects.length !== this.props.projects.length) {
      this.fetchData();
    } // Call forceUpdate() on <DocumentTitle/> if either project or organization
    // state has changed. This is because <DocumentTitle/>'s shouldComponentUpdate()
    // returns false unless props differ; meaning context changes for project/org
    // do NOT trigger renders for <DocumentTitle/> OR any subchildren. The end result
    // being that child elements that listen for context changes on project/org will
    // NOT update (without this hack).
    // See: https://github.com/gaearon/react-document-title/issues/35
    // intentionally shallow comparing references


    if (prevState.project !== this.state.project) {
      const docTitle = this.docTitleRef.current;

      if (!docTitle) {
        return;
      }

      docTitle.forceUpdate();
    }
  }

  componentWillUnmount() {
    this.unsubscribeMembers();
    this.unsubscribeProjects();
  }

  remountComponent() {
    this.setState(this.getInitialState());
  }

  getTitle() {
    var _this$state$project$s, _this$state$project;

    return (_this$state$project$s = (_this$state$project = this.state.project) === null || _this$state$project === void 0 ? void 0 : _this$state$project.slug) !== null && _this$state$project$s !== void 0 ? _this$state$project$s : 'Sentry';
  }

  onProjectChange(projectIds) {
    if (!this.state.project) {
      return;
    }

    if (!projectIds.has(this.state.project.id)) {
      return;
    }

    this.setState({
      project: { ...sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_13__["default"].getById(this.state.project.id)
      }
    });
  }

  identifyProject() {
    const {
      projects,
      projectId
    } = this.props;
    const projectSlug = projectId;
    return projects.find(_ref => {
      let {
        slug
      } = _ref;
      return slug === projectSlug;
    }) || null;
  }

  async fetchData() {
    const {
      orgId,
      projectId,
      skipReload
    } = this.props; // we fetch core access/information from the global organization data

    const activeProject = this.identifyProject();
    const hasAccess = activeProject && activeProject.hasAccess;
    this.setState(state => ({
      // if `skipReload` is true, then don't change loading state
      loading: skipReload ? state.loading : true,
      // we bind project initially, but it'll rebind
      project: activeProject
    }));

    if (activeProject && hasAccess) {
      (0,sentry_actionCreators_projects__WEBPACK_IMPORTED_MODULE_6__.setActiveProject)(null);
      const projectRequest = this.props.api.requestPromise(`/projects/${orgId}/${projectId}/`);

      try {
        const project = await projectRequest;
        this.setState({
          loading: false,
          project,
          error: false,
          errorType: null
        }); // assuming here that this means the project is considered the active project

        (0,sentry_actionCreators_projects__WEBPACK_IMPORTED_MODULE_6__.setActiveProject)(project);
      } catch (error) {
        this.setState({
          loading: false,
          error: false,
          errorType: ErrorTypes.UNKNOWN
        });
      }

      (0,sentry_actionCreators_members__WEBPACK_IMPORTED_MODULE_5__.fetchOrgMembers)(this.props.api, orgId, [activeProject.id]);
      return;
    } // User is not a memberof the active project


    if (activeProject && !activeProject.isMember) {
      this.setState({
        loading: false,
        error: true,
        errorType: ErrorTypes.MISSING_MEMBERSHIP
      });
      return;
    } // There is no active project. This likely indicates either the project
    // *does not exist* or the project has not yet been added to the store.
    // Either way, make a request to check for existence of the project.


    try {
      await this.props.api.requestPromise(`/projects/${orgId}/${projectId}/`);
    } catch (error) {
      this.setState({
        loading: false,
        error: true,
        errorType: ErrorTypes.PROJECT_NOT_FOUND
      });
    }
  }

  renderBody() {
    const {
      children,
      organization
    } = this.props;
    const {
      error,
      errorType,
      loading,
      project
    } = this.state;

    if (loading) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("div", {
        className: "loading-full-layout",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_8__["default"], {})
      });
    }

    if (!error && project) {
      return typeof children === 'function' ? children({
        project
      }) : children;
    }

    switch (errorType) {
      case ErrorTypes.PROJECT_NOT_FOUND:
        // TODO(chrissy): use scale for margin values
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("div", {
          className: "container",
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("div", {
            className: "alert alert-block",
            style: {
              margin: '30px 0 10px'
            },
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('The project you were looking for was not found.')
          })
        });

      case ErrorTypes.MISSING_MEMBERSHIP:
        // TODO(dcramer): add various controls to improve this flow and break it
        // out into a reusable missing access error component
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(ErrorWrapper, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_projects_missingProjectMembership__WEBPACK_IMPORTED_MODULE_9__["default"], {
            organization: organization,
            project: project
          })
        });

      default:
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_7__["default"], {
          onRetry: this.remountComponent
        });
    }
  }

  render() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)((react_document_title__WEBPACK_IMPORTED_MODULE_4___default()), {
      ref: this.docTitleRef,
      title: this.getTitle(),
      children: this.renderBody()
    });
  }

}

ProjectContext.displayName = "ProjectContext";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(ProjectContext, "childContextTypes", {
  project: sentry_sentryTypes__WEBPACK_IMPORTED_MODULE_11__["default"].Project
});


/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_15__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_16__["default"])((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_17__["default"])(ProjectContext))));

const ErrorWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1ekcf660"
} : 0)("width:100%;margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(4), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/project/projectSettingsLayout.tsx":
/*!**************************************************************!*\
  !*** ./app/views/settings/project/projectSettingsLayout.tsx ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_projects_appStoreConnectContext__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/projects/appStoreConnectContext */ "./app/components/projects/appStoreConnectContext.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_projects_projectContext__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/views/projects/projectContext */ "./app/views/projects/projectContext.tsx");
/* harmony import */ var sentry_views_settings_components_settingsLayout__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/views/settings/components/settingsLayout */ "./app/views/settings/components/settingsLayout.tsx");
/* harmony import */ var sentry_views_settings_project_projectSettingsNavigation__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/settings/project/projectSettingsNavigation */ "./app/views/settings/project/projectSettingsNavigation.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








function ProjectSettingsLayout(_ref) {
  let {
    params,
    organization,
    children,
    routes,
    ...props
  } = _ref;
  const {
    orgId,
    projectId
  } = params;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_views_projects_projectContext__WEBPACK_IMPORTED_MODULE_3__["default"], {
    orgId: orgId,
    projectId: projectId,
    children: _ref2 => {
      let {
        project
      } = _ref2;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_projects_appStoreConnectContext__WEBPACK_IMPORTED_MODULE_1__.Provider, {
        project: project,
        organization: organization,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_views_settings_components_settingsLayout__WEBPACK_IMPORTED_MODULE_4__["default"], {
          params: params,
          routes: routes,
          ...props,
          renderNavigation: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_views_settings_project_projectSettingsNavigation__WEBPACK_IMPORTED_MODULE_5__["default"], {
            organization: organization
          }),
          children: children && /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_0__.isValidElement)(children) ? /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_0__.cloneElement)(children, {
            organization,
            project
          }) : children
        })
      });
    }
  });
}

ProjectSettingsLayout.displayName = "ProjectSettingsLayout";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_2__["default"])(ProjectSettingsLayout));

/***/ }),

/***/ "./app/views/settings/project/projectSettingsNavigation.tsx":
/*!******************************************************************!*\
  !*** ./app/views/settings/project/projectSettingsNavigation.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_projects_appStoreConnectContext__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/projects/appStoreConnectContext */ "./app/components/projects/appStoreConnectContext.tsx");
/* harmony import */ var sentry_utils_withProject__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/withProject */ "./app/utils/withProject.tsx");
/* harmony import */ var sentry_views_settings_components_settingsNavigation__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/views/settings/components/settingsNavigation */ "./app/views/settings/components/settingsNavigation.tsx");
/* harmony import */ var sentry_views_settings_project_navigationConfiguration__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/settings/project/navigationConfiguration */ "./app/views/settings/project/navigationConfiguration.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








const ProjectSettingsNavigation = _ref => {
  let {
    organization,
    project
  } = _ref;
  const appStoreConnectContext = (0,react__WEBPACK_IMPORTED_MODULE_1__.useContext)(sentry_components_projects_appStoreConnectContext__WEBPACK_IMPORTED_MODULE_2__["default"]);
  const debugFilesNeedsReview = appStoreConnectContext ? Object.keys(appStoreConnectContext).some(key => appStoreConnectContext[key].credentials.status === 'invalid') : false;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_views_settings_components_settingsNavigation__WEBPACK_IMPORTED_MODULE_4__["default"], {
    navigationObjects: (0,sentry_views_settings_project_navigationConfiguration__WEBPACK_IMPORTED_MODULE_5__["default"])({
      project,
      organization,
      debugFilesNeedsReview
    }),
    access: new Set(organization.access),
    features: new Set(organization.features),
    organization: organization,
    project: project
  });
};

ProjectSettingsNavigation.displayName = "ProjectSettingsNavigation";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withProject__WEBPACK_IMPORTED_MODULE_3__["default"])(ProjectSettingsNavigation));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_project_projectSettingsLayout_tsx.624cca33036c7e6bf8ef01fe0a44a2e9.js.map