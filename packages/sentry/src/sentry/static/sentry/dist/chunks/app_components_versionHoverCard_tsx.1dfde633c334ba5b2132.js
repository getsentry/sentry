"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_versionHoverCard_tsx"],{

/***/ "./app/actionCreators/repositories.tsx":
/*!*********************************************!*\
  !*** ./app/actionCreators/repositories.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getRepositories": () => (/* binding */ getRepositories)
/* harmony export */ });
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_actions_repositoryActions__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/actions/repositoryActions */ "./app/actions/repositoryActions.tsx");
/* harmony import */ var sentry_stores_repositoryStore__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/stores/repositoryStore */ "./app/stores/repositoryStore.tsx");



function getRepositories(api, params) {
  const {
    orgSlug
  } = params;
  const path = `/organizations/${orgSlug}/repos/`; // HACK(leedongwei): Actions fired by the ActionCreators are queued to
  // the back of the event loop, allowing another getRepo for the same
  // repo to be fired before the loading state is updated in store.
  // This hack short-circuits that and update the state immediately.

  sentry_stores_repositoryStore__WEBPACK_IMPORTED_MODULE_1__["default"].state.repositoriesLoading = true;
  sentry_actions_repositoryActions__WEBPACK_IMPORTED_MODULE_0__["default"].loadRepositories(orgSlug);
  return api.requestPromise(path, {
    method: 'GET'
  }).then(res => {
    sentry_actions_repositoryActions__WEBPACK_IMPORTED_MODULE_0__["default"].loadRepositoriesSuccess(res);
  }).catch(err => {
    sentry_actions_repositoryActions__WEBPACK_IMPORTED_MODULE_0__["default"].loadRepositoriesError(err);
    _sentry_react__WEBPACK_IMPORTED_MODULE_2__.withScope(scope => {
      scope.setLevel('warning');
      scope.setFingerprint(['getRepositories-action-creator']);
      _sentry_react__WEBPACK_IMPORTED_MODULE_2__.captureException(err);
    });
  });
}

/***/ }),

/***/ "./app/actions/repositoryActions.tsx":
/*!*******************************************!*\
  !*** ./app/actions/repositoryActions.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);

const RepositoryActions = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createActions)(['resetRepositories', 'loadRepositories', 'loadRepositoriesError', 'loadRepositoriesSuccess']);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (RepositoryActions);

/***/ }),

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

/***/ "./app/components/lastCommit.tsx":
/*!***************************************!*\
  !*** ./app/components/lastCommit.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/avatar/userAvatar */ "./app/components/avatar/userAvatar.tsx");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







const unknownUser = {
  id: '',
  name: '',
  username: '??',
  email: '',
  avatarUrl: '',
  avatar: {
    avatarUuid: '',
    avatarType: 'letter_avatar'
  },
  ip_address: ''
};

function LastCommit(_ref) {
  let {
    commit,
    className
  } = _ref;

  function renderMessage(message) {
    if (!message) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('No message provided');
    }

    const firstLine = message.split(/\n/)[0];

    if (firstLine.length > 100) {
      let truncated = firstLine.substr(0, 90);
      const words = truncated.split(/ /); // try to not have ellipsis mid-word

      if (words.length > 1) {
        words.pop();
        truncated = words.join(' ');
      }

      return `${truncated}\u2026`;
    }

    return firstLine;
  }

  const commitAuthor = commit === null || commit === void 0 ? void 0 : commit.author;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
    className: className,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("h6", {
      children: "Last commit"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(InnerWrap, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_1__["default"], {
        user: commitAuthor || unknownUser
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Message, {
          children: renderMessage(commit.message)
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(Meta, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("strong", {
            children: (commitAuthor === null || commitAuthor === void 0 ? void 0 : commitAuthor.name) || (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Unknown Author')
          }), "\xA0", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_2__["default"], {
            date: commit.dateCreated
          })]
        })]
      })]
    })]
  });
}

LastCommit.displayName = "LastCommit";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (LastCommit);

const InnerWrap = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1dtiphv2"
} : 0)("display:grid;grid-template-columns:max-content minmax(0, 1fr);gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1), ";margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1), ";" + ( true ? "" : 0));

const Message = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1dtiphv1"
} : 0)(p => p.theme.overflowEllipsis, " margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(0.5), ";" + ( true ? "" : 0));

const Meta = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1dtiphv0"
} : 0)("font-size:", p => p.theme.fontSizeSmall, ";color:", p => p.theme.subText, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/repoLabel.tsx":
/*!**************************************!*\
  !*** ./app/components/repoLabel.tsx ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");


const RepoLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "eut5h770"
} : 0)("font-weight:700;color:", p => p.theme.white, ";text-align:center;white-space:nowrap;border-radius:0.25em;", p => p.theme.overflowEllipsis, ";display:inline-block;vertical-align:text-bottom;line-height:1;background:", p => p.theme.gray200, ";padding:3px;max-width:86px;font-size:", p => p.theme.fontSizeSmall, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (RepoLabel);

/***/ }),

/***/ "./app/components/versionHoverCard.tsx":
/*!*********************************************!*\
  !*** ./app/components/versionHoverCard.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "VersionHoverCard": () => (/* binding */ VersionHoverCard),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_avatar_avatarList__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/avatar/avatarList */ "./app/components/avatar/avatarList.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_clipboard__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/clipboard */ "./app/components/clipboard.tsx");
/* harmony import */ var sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/hovercard */ "./app/components/hovercard.tsx");
/* harmony import */ var sentry_components_lastCommit__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/lastCommit */ "./app/components/lastCommit.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_repoLabel__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/repoLabel */ "./app/components/repoLabel.tsx");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_components_version__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/version */ "./app/components/version.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withRelease__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/withRelease */ "./app/utils/withRelease.tsx");
/* harmony import */ var sentry_utils_withRepositories__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/withRepositories */ "./app/utils/withRepositories.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






















class VersionHoverCard extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      visible: false
    });
  }

  toggleHovercard() {
    this.setState({
      visible: true
    });
  }

  getRepoLink() {
    const {
      organization
    } = this.props;
    const orgSlug = organization.slug;
    return {
      header: null,
      body: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(ConnectRepo, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)("h5", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Releases are better with commit data!')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)("p", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Connect a repository to see commit info, files changed, and authors involved in future releases.')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
          href: `/organizations/${orgSlug}/repos/`,
          priority: "primary",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Connect a repository')
        })]
      })
    };
  }

  getBody() {
    const {
      releaseVersion,
      release,
      deploys
    } = this.props;

    if (release === undefined || !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_17__.defined)(deploys)) {
      return {
        header: null,
        body: null
      };
    }

    const {
      lastCommit
    } = release;
    const recentDeploysByEnvironment = deploys.reduce(function (dbe, deploy) {
      const {
        dateFinished,
        environment
      } = deploy;

      if (!dbe.hasOwnProperty(environment)) {
        dbe[environment] = dateFinished;
      }

      return dbe;
    }, {});
    let mostRecentDeploySlice = Object.keys(recentDeploysByEnvironment);

    if (Object.keys(recentDeploysByEnvironment).length > 3) {
      mostRecentDeploySlice = Object.keys(recentDeploysByEnvironment).slice(0, 3);
    }

    return {
      header: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(HeaderWrapper, {
        children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Release'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(VersionWrapper, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(StyledVersion, {
            version: releaseVersion,
            truncate: true,
            anchor: false
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_clipboard__WEBPACK_IMPORTED_MODULE_6__["default"], {
            value: releaseVersion,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(ClipboardIconWrapper, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconCopy, {
                size: "xs"
              })
            })
          })]
        })]
      }),
      body: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)("div", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)("div", {
          className: "row",
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)("div", {
            className: "col-xs-4",
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)("h6", {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('New Issues')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(CountSince, {
              children: release.newGroups
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)("div", {
            className: "col-xs-8",
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)("h6", {
              style: {
                textAlign: 'right'
              },
              children: [release.commitCount, ' ', release.commitCount !== 1 ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('commits ') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('commit '), " ", (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('by '), ' ', release.authors.length, ' ', release.authors.length !== 1 ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('authors') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('author'), ' ']
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_avatar_avatarList__WEBPACK_IMPORTED_MODULE_4__["default"], {
              users: release.authors,
              avatarSize: 25,
              tooltipOptions: {
                container: 'body'
              },
              typeMembers: "authors"
            })]
          })]
        }), lastCommit && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(StyledLastCommit, {
          commit: lastCommit
        }), deploys.length > 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)("div", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_7__.Divider, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)("h6", {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Deploys')
            })
          }), mostRecentDeploySlice.map((env, idx) => {
            const dateFinished = recentDeploysByEnvironment[env];
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(DeployWrap, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(VersionRepoLabel, {
                children: env
              }), dateFinished && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(StyledTimeSince, {
                date: dateFinished
              })]
            }, idx);
          })]
        })]
      })
    };
  }

  render() {
    var _ref;

    const {
      deploysLoading,
      deploysError,
      release,
      releaseLoading,
      releaseError,
      repositories,
      repositoriesLoading,
      repositoriesError
    } = this.props;
    let header = null;
    let body = null;
    const loading = !!(deploysLoading || releaseLoading || repositoriesLoading);
    const error = (_ref = deploysError !== null && deploysError !== void 0 ? deploysError : releaseError) !== null && _ref !== void 0 ? _ref : repositoriesError;
    const hasRepos = repositories && repositories.length > 0;

    if (loading) {
      body = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_10__["default"], {
        mini: true
      });
    } else if (error) {
      body = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_9__["default"], {});
    } else {
      const renderObj = hasRepos && release ? this.getBody() : this.getRepoLink();
      header = renderObj.header;
      body = renderObj.body;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_7__.Hovercard, { ...this.props,
      header: header,
      body: body,
      children: this.props.children
    });
  }

}

VersionHoverCard.displayName = "VersionHoverCard";

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_18__["default"])((0,sentry_utils_withRelease__WEBPACK_IMPORTED_MODULE_19__["default"])((0,sentry_utils_withRepositories__WEBPACK_IMPORTED_MODULE_20__["default"])(VersionHoverCard))));

const ConnectRepo = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ejgji4u9"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(2), ";text-align:center;" + ( true ? "" : 0));

const VersionRepoLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_repoLabel__WEBPACK_IMPORTED_MODULE_11__["default"],  true ? {
  target: "ejgji4u8"
} : 0)( true ? {
  name: "1uxsuq0",
  styles: "width:86px"
} : 0);

const StyledTimeSince = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_12__["default"],  true ? {
  target: "ejgji4u7"
} : 0)("color:", p => p.theme.gray300, ";font-size:", p => p.theme.fontSizeSmall, ";" + ( true ? "" : 0));

const HeaderWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ejgji4u6"
} : 0)( true ? {
  name: "bcffy2",
  styles: "display:flex;align-items:center;justify-content:space-between"
} : 0);

const VersionWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ejgji4u5"
} : 0)( true ? {
  name: "8nnmo9",
  styles: "display:flex;flex:1;align-items:center;justify-content:flex-end"
} : 0);

const StyledVersion = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_version__WEBPACK_IMPORTED_MODULE_13__["default"],  true ? {
  target: "ejgji4u4"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(0.5), ";max-width:190px;" + ( true ? "" : 0));

const ClipboardIconWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "ejgji4u3"
} : 0)( true ? {
  name: "1p3qk0r",
  styles: "&:hover{cursor:pointer;}"
} : 0);

const CountSince = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ejgji4u2"
} : 0)("color:", p => p.theme.headingColor, ";font-size:", p => p.theme.headerFontSize, ";" + ( true ? "" : 0));

const StyledLastCommit = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_lastCommit__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "ejgji4u1"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(2), ";" + ( true ? "" : 0));

const DeployWrap = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ejgji4u0"
} : 0)("display:grid;grid-template-columns:max-content minmax(0, 1fr);gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1), ";justify-items:start;align-items:center;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/stores/repositoryStore.tsx":
/*!****************************************!*\
  !*** ./app/stores/repositoryStore.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_actions_repositoryActions__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actions/repositoryActions */ "./app/actions/repositoryActions.tsx");
/* harmony import */ var sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/makeSafeRefluxStore */ "./app/utils/makeSafeRefluxStore.ts");



const storeConfig = {
  listenables: sentry_actions_repositoryActions__WEBPACK_IMPORTED_MODULE_1__["default"],
  state: {
    orgSlug: undefined,
    repositories: undefined,
    repositoriesLoading: undefined,
    repositoriesError: undefined
  },

  init() {
    this.resetRepositories();
  },

  resetRepositories() {
    this.state = {
      orgSlug: undefined,
      repositories: undefined,
      repositoriesLoading: undefined,
      repositoriesError: undefined
    };
    this.trigger(this.state);
  },

  loadRepositories(orgSlug) {
    this.state = {
      orgSlug,
      repositories: orgSlug === this.state.orgSlug ? this.state.repositories : undefined,
      repositoriesLoading: true,
      repositoriesError: undefined
    };
    this.trigger(this.state);
  },

  loadRepositoriesError(err) {
    this.state = { ...this.state,
      repositories: undefined,
      repositoriesLoading: false,
      repositoriesError: err
    };
    this.trigger(this.state);
  },

  loadRepositoriesSuccess(data) {
    this.state = { ...this.state,
      repositories: data,
      repositoriesLoading: false,
      repositoriesError: undefined
    };
    this.trigger(this.state);
  },

  get() {
    return { ...this.state
    };
  }

};
const RepositoryStore = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createStore)((0,sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_2__.makeSafeRefluxStore)(storeConfig));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (RepositoryStore);

/***/ }),

/***/ "./app/utils/withRelease.tsx":
/*!***********************************!*\
  !*** ./app/utils/withRelease.tsx ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_release__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/release */ "./app/actionCreators/release.tsx");
/* harmony import */ var sentry_stores_releaseStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/releaseStore */ "./app/stores/releaseStore.tsx");
/* harmony import */ var sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/getDisplayName */ "./app/utils/getDisplayName.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







function withRelease(WrappedComponent) {
  class WithRelease extends react__WEBPACK_IMPORTED_MODULE_1__.Component {
    constructor(props, context) {
      super(props, context);

      (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "unsubscribe", sentry_stores_releaseStore__WEBPACK_IMPORTED_MODULE_3__["default"].listen(() => this.onStoreUpdate(), undefined));

      const {
        projectSlug,
        releaseVersion
      } = this.props;
      const releaseData = sentry_stores_releaseStore__WEBPACK_IMPORTED_MODULE_3__["default"].get(projectSlug, releaseVersion);
      this.state = { ...releaseData
      };
    }

    componentDidMount() {
      this.fetchRelease();
      this.fetchDeploys();
    }

    componentWillUnmount() {
      this.unsubscribe();
    }

    fetchRelease() {
      const {
        api,
        organization,
        projectSlug,
        releaseVersion
      } = this.props;
      const releaseData = sentry_stores_releaseStore__WEBPACK_IMPORTED_MODULE_3__["default"].get(projectSlug, releaseVersion);
      const orgSlug = organization.slug;

      if (!releaseData.release && !releaseData.releaseLoading || releaseData.releaseError) {
        (0,sentry_actionCreators_release__WEBPACK_IMPORTED_MODULE_2__.getProjectRelease)(api, {
          orgSlug,
          projectSlug,
          releaseVersion
        });
      }
    }

    fetchDeploys() {
      const {
        api,
        organization,
        projectSlug,
        releaseVersion
      } = this.props;
      const releaseData = sentry_stores_releaseStore__WEBPACK_IMPORTED_MODULE_3__["default"].get(projectSlug, releaseVersion);
      const orgSlug = organization.slug;

      if (!releaseData.deploys && !releaseData.deploysLoading || releaseData.deploysError) {
        (0,sentry_actionCreators_release__WEBPACK_IMPORTED_MODULE_2__.getReleaseDeploys)(api, {
          orgSlug,
          projectSlug,
          releaseVersion
        });
      }
    }

    onStoreUpdate() {
      const {
        projectSlug,
        releaseVersion
      } = this.props;
      const releaseData = sentry_stores_releaseStore__WEBPACK_IMPORTED_MODULE_3__["default"].get(projectSlug, releaseVersion);
      this.setState({ ...releaseData
      });
    }

    render() {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(WrappedComponent, { ...this.props,
        ...this.state
      });
    }

  }

  WithRelease.displayName = "WithRelease";

  (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(WithRelease, "displayName", `withRelease(${(0,sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_4__["default"])(WrappedComponent)})`);

  return WithRelease;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (withRelease);

/***/ }),

/***/ "./app/utils/withRepositories.tsx":
/*!****************************************!*\
  !*** ./app/utils/withRepositories.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_repositories__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/repositories */ "./app/actionCreators/repositories.tsx");
/* harmony import */ var sentry_actions_repositoryActions__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actions/repositoryActions */ "./app/actions/repositoryActions.tsx");
/* harmony import */ var sentry_stores_repositoryStore__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/stores/repositoryStore */ "./app/stores/repositoryStore.tsx");
/* harmony import */ var sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/getDisplayName */ "./app/utils/getDisplayName.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







const INITIAL_STATE = {
  repositories: undefined,
  repositoriesLoading: undefined,
  repositoriesError: undefined
};

function withRepositories(WrappedComponent) {
  class WithRepositories extends react__WEBPACK_IMPORTED_MODULE_1__.Component {
    constructor(props, context) {
      super(props, context);

      (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "unsubscribe", sentry_stores_repositoryStore__WEBPACK_IMPORTED_MODULE_4__["default"].listen(() => this.onStoreUpdate(), undefined));

      const {
        organization
      } = this.props;
      const orgSlug = organization.slug;
      const repoData = sentry_stores_repositoryStore__WEBPACK_IMPORTED_MODULE_4__["default"].get();

      if (repoData.orgSlug !== orgSlug) {
        sentry_actions_repositoryActions__WEBPACK_IMPORTED_MODULE_3__["default"].resetRepositories();
      }

      this.state = repoData.orgSlug === orgSlug ? { ...INITIAL_STATE,
        ...repoData
      } : { ...INITIAL_STATE
      };
    }

    componentDidMount() {
      // XXX(leedongwei): Do not move this function call unless you modify the
      // unit test named "prevents repeated calls"
      this.fetchRepositories();
    }

    componentWillUnmount() {
      this.unsubscribe();
    }

    fetchRepositories() {
      const {
        api,
        organization
      } = this.props;
      const orgSlug = organization.slug;
      const repoData = sentry_stores_repositoryStore__WEBPACK_IMPORTED_MODULE_4__["default"].get(); // XXX(leedongwei): Do not check the orgSlug here. It would have been
      // verified at `getInitialState`. The short-circuit hack in actionCreator
      // does not update the orgSlug in the store.

      if (!repoData.repositories && !repoData.repositoriesLoading || repoData.repositoriesError) {
        (0,sentry_actionCreators_repositories__WEBPACK_IMPORTED_MODULE_2__.getRepositories)(api, {
          orgSlug
        });
      }
    }

    onStoreUpdate() {
      const repoData = sentry_stores_repositoryStore__WEBPACK_IMPORTED_MODULE_4__["default"].get();
      this.setState({ ...repoData
      });
    }

    render() {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(WrappedComponent, { ...this.props,
        ...this.state
      });
    }

  }

  WithRepositories.displayName = "WithRepositories";

  (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(WithRepositories, "displayName", `withRepositories(${(0,sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_5__["default"])(WrappedComponent)})`);

  return WithRepositories;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (withRepositories);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_versionHoverCard_tsx.546c18a16b2bc0417d144c8028d0db28.js.map