"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_releases_detail_commitsAndFiles_filesChanged_tsx"],{

/***/ "./app/components/avatar/avatarList.tsx":
/*!**********************************************!*\
  !*** ./app/components/avatar/avatarList.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AvatarListWrapper": () => (/* binding */ AvatarListWrapper),
/* harmony export */   "default": () => (/* binding */ AvatarList)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/avatar/userAvatar */ "./app/components/avatar/userAvatar.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }







const defaultProps = {
  avatarSize: 28,
  maxVisibleAvatars: 5,
  typeMembers: 'users',
  tooltipOptions: {}
};
class AvatarList extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  render() {
    const {
      className,
      users,
      avatarSize,
      maxVisibleAvatars,
      renderTooltip,
      typeMembers,
      tooltipOptions
    } = this.props;
    const visibleUsers = users.slice(0, maxVisibleAvatars);
    const numCollapsedUsers = users.length - visibleUsers.length;

    if (!tooltipOptions.position) {
      tooltipOptions.position = 'top';
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(AvatarListWrapper, {
      className: className,
      children: [!!numCollapsedUsers && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_4__["default"], {
        title: `${numCollapsedUsers} other ${typeMembers}`,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(CollapsedUsers, {
          size: avatarSize,
          "data-test-id": "avatarList-collapsedusers",
          children: [numCollapsedUsers < 99 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Plus, {
            children: "+"
          }), numCollapsedUsers]
        })
      }), visibleUsers.map(user => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(StyledAvatar, {
        user: user,
        size: avatarSize,
        renderTooltip: renderTooltip,
        tooltipOptions: tooltipOptions,
        hasTooltip: true
      }, `${user.id}-${user.email}`))]
    });
  }

}
AvatarList.displayName = "AvatarList";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(AvatarList, "defaultProps", defaultProps);

// used in releases list page to do some alignment
const AvatarListWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e7y2scs3"
} : 0)( true ? {
  name: "4hray5",
  styles: "display:flex;flex-direction:row-reverse"
} : 0);

const Circle = p => /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_6__.css)("border-radius:50%;border:2px solid ", p.theme.background, ";margin-left:-8px;cursor:default;&:hover{z-index:1;}" + ( true ? "" : 0),  true ? "" : 0);

const StyledAvatar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e7y2scs2"
} : 0)("overflow:hidden;", Circle, ";" + ( true ? "" : 0));

const CollapsedUsers = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e7y2scs1"
} : 0)("display:flex;align-items:center;justify-content:center;position:relative;text-align:center;font-weight:600;background-color:", p => p.theme.gray200, ";color:", p => p.theme.gray300, ";font-size:", p => Math.floor(p.size / 2.3), "px;width:", p => p.size, "px;height:", p => p.size, "px;", Circle, ";" + ( true ? "" : 0));

const Plus = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e7y2scs0"
} : 0)( true ? {
  name: "1enq4bv",
  styles: "font-size:10px;margin-left:1px;margin-right:-1px"
} : 0);

/***/ }),

/***/ "./app/components/fileChange.tsx":
/*!***************************************!*\
  !*** ./app/components/fileChange.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_avatar_avatarList__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/avatar/avatarList */ "./app/components/avatar/avatarList.tsx");
/* harmony import */ var sentry_components_fileIcon__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/fileIcon */ "./app/components/fileIcon.tsx");
/* harmony import */ var sentry_components_listGroup__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/listGroup */ "./app/components/listGroup.tsx");
/* harmony import */ var sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/textOverflow */ "./app/components/textOverflow.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









const FileChange = _ref => {
  let {
    filename,
    authors,
    className
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(FileItem, {
    className: className,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(Filename, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(StyledFileIcon, {
        fileName: filename
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_4__["default"], {
        children: filename
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("div", {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_avatar_avatarList__WEBPACK_IMPORTED_MODULE_1__["default"], {
        users: authors,
        avatarSize: 25,
        typeMembers: "authors"
      })
    })]
  });
};

FileChange.displayName = "FileChange";

const FileItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_listGroup__WEBPACK_IMPORTED_MODULE_3__.ListGroupItem,  true ? {
  target: "eprmslz2"
} : 0)( true ? {
  name: "bcffy2",
  styles: "display:flex;align-items:center;justify-content:space-between"
} : 0);

const Filename = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eprmslz1"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), ";margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(3), ";align-items:center;grid-template-columns:max-content 1fr;" + ( true ? "" : 0));

const StyledFileIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_fileIcon__WEBPACK_IMPORTED_MODULE_2__["default"],  true ? {
  target: "eprmslz0"
} : 0)("color:", p => p.theme.gray200, ";border-radius:3px;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (FileChange);

/***/ }),

/***/ "./app/components/fileIcon.tsx":
/*!*************************************!*\
  !*** ./app/components/fileIcon.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_utils_fileExtension__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/fileExtension */ "./app/utils/fileExtension.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





const FileIcon = _ref => {
  var _theme$iconSizes$prov;

  let {
    fileName,
    size: providedSize = 'sm',
    className
  } = _ref;
  const fileExtension = (0,sentry_utils_fileExtension__WEBPACK_IMPORTED_MODULE_1__.getFileExtension)(fileName);
  const iconName = fileExtension ? (0,sentry_utils_fileExtension__WEBPACK_IMPORTED_MODULE_1__.fileExtensionToPlatform)(fileExtension) : null;
  const size = (_theme$iconSizes$prov = sentry_utils_theme__WEBPACK_IMPORTED_MODULE_2__["default"].iconSizes[providedSize]) !== null && _theme$iconSizes$prov !== void 0 ? _theme$iconSizes$prov : providedSize;

  if (!iconName) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_0__.IconFile, {
      size: size,
      className: className
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("img", {
    src: __webpack_require__("../node_modules/platformicons/svg sync recursive ^\\.\\/.*\\.svg$")(`./${iconName}.svg`),
    width: size,
    height: size,
    className: className
  });
};

FileIcon.displayName = "FileIcon";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (FileIcon);

/***/ }),

/***/ "./app/components/listGroup.tsx":
/*!**************************************!*\
  !*** ./app/components/listGroup.tsx ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ListGroup": () => (/* binding */ ListGroup),
/* harmony export */   "ListGroupItem": () => (/* binding */ ListGroupItem)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");



const ListGroupItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('li',  true ? {
  target: "erkx9p11"
} : 0)("position:relative;display:block;min-height:36px;border:1px solid ", p => p.theme.border, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(0.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1.5), ";margin-bottom:-1px;", p => p.centered ? 'text-align: center;' : '', " &:first-child{border-top-left-radius:", p => p.theme.borderRadius, ";border-top-right-radius:", p => p.theme.borderRadius, ";}&:last-child{border-bottom-left-radius:", p => p.theme.borderRadius, ";border-bottom-right-radius:", p => p.theme.borderRadius, ";}" + ( true ? "" : 0));

const ListGroup = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('ul',  true ? {
  target: "erkx9p10"
} : 0)("box-shadow:0 1px 0px rgba(0, 0, 0, 0.03);background:", p => p.theme.background, ";padding:0;margin:0;", p => p.striped ? `
    & > li:nth-child(odd) {
      background: ${p.theme.backgroundSecondary};
    }
  ` : '', ";" + ( true ? "" : 0));



/***/ }),

/***/ "./app/views/releases/detail/commitsAndFiles/filesChanged.tsx":
/*!********************************************************************!*\
  !*** ./app/views/releases/detail/commitsAndFiles/filesChanged.tsx ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_fileChange__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/fileChange */ "./app/components/fileChange.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/routeTitle */ "./app/utils/routeTitle.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ../utils */ "./app/views/releases/detail/utils.tsx");
/* harmony import */ var _emptyState__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./emptyState */ "./app/views/releases/detail/commitsAndFiles/emptyState.tsx");
/* harmony import */ var _repositorySwitcher__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./repositorySwitcher */ "./app/views/releases/detail/commitsAndFiles/repositorySwitcher.tsx");
/* harmony import */ var _withReleaseRepos__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./withReleaseRepos */ "./app/views/releases/detail/commitsAndFiles/withReleaseRepos.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


















class FilesChanged extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_10__["default"] {
  getTitle() {
    const {
      params,
      projectSlug
    } = this.props;
    const {
      orgId
    } = params;
    return (0,sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_9__["default"])((0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Files Changed - Release %s', (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_8__.formatVersion)(params.release)), orgId, false, projectSlug);
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      fileList: []
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
      activeReleaseRepo: activeRepository,
      location,
      release,
      orgSlug
    } = this.props;
    const query = (0,_utils__WEBPACK_IMPORTED_MODULE_11__.getQuery)({
      location,
      activeRepository
    });
    return [['fileList', `/organizations/${orgSlug}/releases/${encodeURIComponent(release)}/commitfiles/`, {
      query
    }]];
  }

  renderLoading() {
    return this.renderBody();
  }

  renderContent() {
    const {
      fileList,
      fileListPageLinks,
      loading
    } = this.state;
    const {
      activeReleaseRepo
    } = this.props;

    if (loading) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_4__["default"], {});
    }

    if (!fileList.length) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_emptyState__WEBPACK_IMPORTED_MODULE_12__["default"], {
        children: !activeReleaseRepo ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('There are no changed files associated with this release.') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('There are no changed files associated with this release in the %s repository.', activeReleaseRepo.name)
      });
    }

    const filesByRepository = (0,_utils__WEBPACK_IMPORTED_MODULE_11__.getFilesByRepository)(fileList);
    const reposToRender = (0,_utils__WEBPACK_IMPORTED_MODULE_11__.getReposToRender)(Object.keys(filesByRepository));
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: [reposToRender.map(repoName => {
        const repoData = filesByRepository[repoName];
        const files = Object.keys(repoData);
        const fileCount = files.length;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.Panel, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelHeader, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("span", {
              children: repoName
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("span", {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.tn)('%s file changed', '%s files changed', fileCount)
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelBody, {
            children: files.map(filename => {
              const {
                authors
              } = repoData[filename];
              return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(StyledFileChange, {
                filename: filename,
                authors: Object.values(authors)
              }, filename);
            })
          })]
        }, repoName);
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_5__["default"], {
        pageLinks: fileListPageLinks
      })]
    });
  }

  renderBody() {
    const {
      activeReleaseRepo,
      releaseRepos,
      router,
      location
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: [releaseRepos.length > 1 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_repositorySwitcher__WEBPACK_IMPORTED_MODULE_13__["default"], {
        repositories: releaseRepos,
        activeRepository: activeReleaseRepo,
        location: location,
        router: router
      }), this.renderContent()]
    });
  }

  renderComponent() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_3__.Body, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_3__.Main, {
        fullWidth: true,
        children: super.renderComponent()
      })
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,_withReleaseRepos__WEBPACK_IMPORTED_MODULE_14__["default"])(FilesChanged));

const StyledFileChange = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_fileChange__WEBPACK_IMPORTED_MODULE_2__["default"],  true ? {
  target: "e1ihgiqu0"
} : 0)( true ? {
  name: "d1zd91",
  styles: "border-radius:0;border-left:none;border-right:none;border-top:none;:last-child{border:none;border-radius:0;}"
} : 0);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_releases_detail_commitsAndFiles_filesChanged_tsx.664ccee1c9b1d9d439eb70fc0a783149.js.map