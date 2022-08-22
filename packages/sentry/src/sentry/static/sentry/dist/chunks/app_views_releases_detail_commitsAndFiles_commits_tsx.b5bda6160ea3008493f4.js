"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_releases_detail_commitsAndFiles_commits_tsx"],{

/***/ "./app/views/releases/detail/commitsAndFiles/commits.tsx":
/*!***************************************************************!*\
  !*** ./app/views/releases/detail/commitsAndFiles/commits.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_commitRow__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/commitRow */ "./app/components/commitRow.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/routeTitle */ "./app/utils/routeTitle.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ../utils */ "./app/views/releases/detail/utils.tsx");
/* harmony import */ var _emptyState__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./emptyState */ "./app/views/releases/detail/commitsAndFiles/emptyState.tsx");
/* harmony import */ var _repositorySwitcher__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./repositorySwitcher */ "./app/views/releases/detail/commitsAndFiles/repositorySwitcher.tsx");
/* harmony import */ var _withReleaseRepos__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./withReleaseRepos */ "./app/views/releases/detail/commitsAndFiles/withReleaseRepos.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");

















class Commits extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_9__["default"] {
  getTitle() {
    const {
      params,
      projectSlug
    } = this.props;
    const {
      orgId
    } = params;
    return (0,sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_8__["default"])((0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Commits - Release %s', (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_7__.formatVersion)(params.release)), orgId, false, projectSlug);
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      commits: []
    };
  }

  componentDidUpdate(prevProps, prevState) {
    var _prevProps$activeRele, _this$props$activeRel;

    if (((_prevProps$activeRele = prevProps.activeReleaseRepo) === null || _prevProps$activeRele === void 0 ? void 0 : _prevProps$activeRele.name) !== ((_this$props$activeRel = this.props.activeReleaseRepo) === null || _this$props$activeRel === void 0 ? void 0 : _this$props$activeRel.name)) {
      this.remountComponent();
      return;
    }

    super.componentDidUpdate(prevProps, prevState);
  }

  getEndpoints() {
    const {
      projectSlug,
      activeReleaseRepo: activeRepository,
      location,
      orgSlug,
      release
    } = this.props;
    const query = (0,_utils__WEBPACK_IMPORTED_MODULE_10__.getQuery)({
      location,
      activeRepository
    });
    return [['commits', `/projects/${orgSlug}/${projectSlug}/releases/${encodeURIComponent(release)}/commits/`, {
      query
    }]];
  }

  renderLoading() {
    return this.renderBody();
  }

  renderContent() {
    const {
      commits,
      commitsPageLinks,
      loading
    } = this.state;
    const {
      activeReleaseRepo
    } = this.props;

    if (loading) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_3__["default"], {});
    }

    if (!commits.length) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(_emptyState__WEBPACK_IMPORTED_MODULE_11__["default"], {
        children: !activeReleaseRepo ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('There are no commits associated with this release.') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('There are no commits associated with this release in the %s repository.', activeReleaseRepo.name)
      });
    }

    const commitsByRepository = (0,_utils__WEBPACK_IMPORTED_MODULE_10__.getCommitsByRepository)(commits);
    const reposToRender = (0,_utils__WEBPACK_IMPORTED_MODULE_10__.getReposToRender)(Object.keys(commitsByRepository));
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
      children: [reposToRender.map(repoName => {
        var _commitsByRepository$;

        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__.Panel, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__.PanelHeader, {
            children: repoName
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__.PanelBody, {
            children: (_commitsByRepository$ = commitsByRepository[repoName]) === null || _commitsByRepository$ === void 0 ? void 0 : _commitsByRepository$.map(commit => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_commitRow__WEBPACK_IMPORTED_MODULE_1__.CommitRow, {
              commit: commit
            }, commit.id))
          })]
        }, repoName);
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_4__["default"], {
        pageLinks: commitsPageLinks
      })]
    });
  }

  renderBody() {
    const {
      location,
      router,
      activeReleaseRepo,
      releaseRepos
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
      children: [releaseRepos.length > 1 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(_repositorySwitcher__WEBPACK_IMPORTED_MODULE_12__["default"], {
        repositories: releaseRepos,
        activeRepository: activeReleaseRepo,
        location: location,
        router: router
      }), this.renderContent()]
    });
  }

  renderComponent() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_2__.Body, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_2__.Main, {
        fullWidth: true,
        children: super.renderComponent()
      })
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,_withReleaseRepos__WEBPACK_IMPORTED_MODULE_13__["default"])(Commits));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_releases_detail_commitsAndFiles_commits_tsx.77b906987b32433be0b1d1f46b1847ff.js.map