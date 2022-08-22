"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_commitRow_tsx"],{

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

/***/ "./app/components/commitRow.tsx":
/*!**************************************!*\
  !*** ./app/components/commitRow.tsx ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CommitRow": () => (/* binding */ StyledCommitRow)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/avatar/userAvatar */ "./app/components/avatar/userAvatar.tsx");
/* harmony import */ var sentry_components_commitLink__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/commitLink */ "./app/components/commitLink.tsx");
/* harmony import */ var sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/hovercard */ "./app/components/hovercard.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/textOverflow */ "./app/components/textOverflow.tsx");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

















function formatCommitMessage(message) {
  if (!message) {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('No message provided');
  }

  return message.split(/\n/)[0];
}

function CommitRow(_ref) {
  var _commit$author$name, _commit$author2;

  let {
    commit,
    customAvatar,
    className
  } = _ref;
  const handleInviteClick = (0,react__WEBPACK_IMPORTED_MODULE_3__.useCallback)(() => {
    var _commit$author;

    if (!((_commit$author = commit.author) !== null && _commit$author !== void 0 && _commit$author.email)) {
      _sentry_react__WEBPACK_IMPORTED_MODULE_15__.captureException(new Error(`Commit author has no email or id, invite flow is broken.`));
      return;
    }

    (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_4__.openInviteMembersModal)({
      initialData: [{
        emails: new Set([commit.author.email])
      }],
      source: 'suspect_commit'
    });
  }, [commit.author]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.PanelItem, {
    className: className,
    "data-test-id": "commit-row",
    children: [customAvatar ? customAvatar : commit.author && commit.author.id === undefined ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(AvatarWrapper, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_7__.Hovercard, {
        body: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(EmailWarning, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.tct)('The email [actorEmail] is not a member of your organization. [inviteUser:Invite] them or link additional emails in [accountSettings:account settings].', {
            actorEmail: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("strong", {
              children: commit.author.email
            }),
            accountSettings: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledLink, {
              to: "/settings/account/emails/"
            }),
            inviteUser: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledLink, {
              to: "",
              onClick: handleInviteClick
            })
          })
        }),
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_5__["default"], {
          size: 36,
          user: commit.author
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(EmailWarningIcon, {
          "data-test-id": "email-warning",
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_12__.IconWarning, {
            size: "xs"
          })
        })]
      })
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(AvatarWrapper, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_5__["default"], {
        size: 36,
        user: commit.author
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(CommitMessage, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Message, {
        children: formatCommitMessage(commit.message)
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Meta, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.tct)('[author] committed [timeago]', {
          author: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("strong", {
            children: (_commit$author$name = (_commit$author2 = commit.author) === null || _commit$author2 === void 0 ? void 0 : _commit$author2.name) !== null && _commit$author$name !== void 0 ? _commit$author$name : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Unknown author')
          }),
          timeago: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_11__["default"], {
            date: commit.dateCreated
          })
        })
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("div", {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_commitLink__WEBPACK_IMPORTED_MODULE_6__["default"], {
        commitId: commit.id,
        repository: commit.repository
      })
    })]
  }, commit.id);
}

CommitRow.displayName = "CommitRow";

const AvatarWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e207kgc7"
} : 0)("position:relative;align-self:flex-start;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(2), ";" + ( true ? "" : 0));

const EmailWarning = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e207kgc6"
} : 0)("font-size:", p => p.theme.fontSizeSmall, ";line-height:1.4;margin:-4px;" + ( true ? "" : 0));

const StyledLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "e207kgc5"
} : 0)("color:", p => p.theme.textColor, ";border-bottom:1px dotted ", p => p.theme.textColor, ";&:hover{color:", p => p.theme.textColor, ";}" + ( true ? "" : 0));

const EmailWarningIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e207kgc4"
} : 0)("position:absolute;bottom:-6px;right:-7px;line-height:12px;border-radius:50%;border:1px solid ", p => p.theme.background, ";background:", p => p.theme.yellow200, ";padding:1px 2px 3px 2px;" + ( true ? "" : 0));

const CommitMessage = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e207kgc3"
} : 0)("flex:1;flex-direction:column;min-width:0;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(2), ";" + ( true ? "" : 0));

const Message = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "e207kgc2"
} : 0)( true ? {
  name: "alss30",
  styles: "font-size:15px;line-height:1.1;font-weight:bold"
} : 0);

const Meta = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "e207kgc1"
} : 0)("font-size:13px;line-height:1.5;margin:0;color:", p => p.theme.subText, ";" + ( true ? "" : 0));

const StyledCommitRow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(CommitRow,  true ? {
  target: "e207kgc0"
} : 0)( true ? {
  name: "1h3rtzg",
  styles: "align-items:center"
} : 0);



/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_commitRow_tsx.b92b51d28263e05da6fe85167f657771.js.map