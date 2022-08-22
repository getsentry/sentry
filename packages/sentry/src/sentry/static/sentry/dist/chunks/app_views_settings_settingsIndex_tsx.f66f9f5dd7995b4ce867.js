"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_settingsIndex_tsx"],{

/***/ "./app/views/settings/settingsIndex.tsx":
/*!**********************************************!*\
  !*** ./app/views/settings/settingsIndex.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_actionCreators_organizations__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/organizations */ "./app/actionCreators/organizations.tsx");
/* harmony import */ var sentry_components_acl_demoModeGate__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/acl/demoModeGate */ "./app/components/acl/demoModeGate.tsx");
/* harmony import */ var sentry_components_avatar_organizationAvatar__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/avatar/organizationAvatar */ "./app/components/avatar/organizationAvatar.tsx");
/* harmony import */ var sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/avatar/userAvatar */ "./app/components/avatar/userAvatar.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_withLatestContext__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/withLatestContext */ "./app/utils/withLatestContext.tsx");
/* harmony import */ var sentry_views_settings_components_settingsLayout__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/views/settings/components/settingsLayout */ "./app/views/settings/components/settingsLayout.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }




















const LINKS = {
  DOCUMENTATION: 'https://docs.sentry.io/',
  DOCUMENTATION_PLATFORMS: 'https://docs.sentry.io/clients/',
  DOCUMENTATION_QUICKSTART: 'https://docs.sentry.io/platform-redirect/?next=/',
  DOCUMENTATION_CLI: 'https://docs.sentry.io/product/cli/',
  DOCUMENTATION_API: 'https://docs.sentry.io/api/',
  API: '/settings/account/api/',
  MANAGE: '/manage/',
  FORUM: 'https://forum.sentry.io/',
  GITHUB_ISSUES: 'https://github.com/getsentry/sentry/issues',
  SERVICE_STATUS: 'https://status.sentry.io/'
};
const HOME_ICON_SIZE = 56;

function SettingsIndex(_ref) {
  let {
    organization,
    ...props
  } = _ref;
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    // if there is no org in context, SidebarDropdown uses an org from `withLatestContext`
    // (which queries the org index endpoint instead of org details)
    // and does not have `access` info
    if (organization && typeof organization.access === 'undefined') {
      (0,sentry_actionCreators_organizations__WEBPACK_IMPORTED_MODULE_2__.fetchOrganizationDetails)(organization.slug, {
        setActive: true,
        loadProjects: true
      });
    }
  }, [organization]);
  const user = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_13__["default"].get('user');
  const isSelfHosted = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_13__["default"].get('isSelfHosted');
  const organizationSettingsUrl = organization && `/settings/${organization.slug}/` || '';
  const supportLinkProps = {
    isSelfHosted,
    organizationSettingsUrl
  };

  const myAccount = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(GridPanel, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(HomePanelHeader, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(HomeLinkIcon, {
        to: "/settings/account/",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_5__["default"], {
          user: user,
          size: HOME_ICON_SIZE
        }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('My Account')]
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(HomePanelBody, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)("h3", {
        children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Quick links'), ":"]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)("ul", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("li", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(HomeLink, {
            to: "/settings/account/security/",
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Change my password')
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("li", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(HomeLink, {
            to: "/settings/account/notifications/",
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Notification Preferences')
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("li", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(HomeLink, {
            to: "/settings/account/",
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Change my avatar')
          })
        })]
      })]
    })]
  });

  const orgSettings = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(GridPanel, {
    children: [!organization && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_8__["default"], {
      overlay: true,
      hideSpinner: true
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(HomePanelHeader, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(HomeLinkIcon, {
        to: organizationSettingsUrl,
        children: [organization ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_avatar_organizationAvatar__WEBPACK_IMPORTED_MODULE_4__["default"], {
          organization: organization,
          size: HOME_ICON_SIZE
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(HomeIconContainer, {
          color: "green300",
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconStack, {
            size: "lg"
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(OrganizationName, {
          children: organization ? organization.slug : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('No Organization')
        })]
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(HomePanelBody, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)("h3", {
        children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Quick links'), ":"]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)("ul", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("li", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(HomeLink, {
            to: `${organizationSettingsUrl}projects/`,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Projects')
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("li", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(HomeLink, {
            to: `${organizationSettingsUrl}teams/`,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Teams')
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("li", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(HomeLink, {
            to: `${organizationSettingsUrl}members/`,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Members')
          })
        })]
      })]
    })]
  });

  const documentation = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(GridPanel, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(HomePanelHeader, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(ExternalHomeLinkIcon, {
        href: LINKS.DOCUMENTATION,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(HomeIconContainer, {
          color: "pink300",
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconDocs, {
            size: "lg"
          })
        }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Documentation')]
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(HomePanelBody, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)("h3", {
        children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Quick links'), ":"]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)("ul", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("li", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(ExternalHomeLink, {
            href: LINKS.DOCUMENTATION_QUICKSTART,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Quickstart Guide')
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("li", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(ExternalHomeLink, {
            href: LINKS.DOCUMENTATION_PLATFORMS,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Platforms & Frameworks')
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("li", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(ExternalHomeLink, {
            href: LINKS.DOCUMENTATION_CLI,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Sentry CLI')
          })
        })]
      })]
    })]
  });

  const support = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(GridPanel, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(HomePanelHeader, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(SupportLink, {
        icon: true,
        ...supportLinkProps,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(HomeIconContainer, {
          color: "purple300",
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconSupport, {
            size: "lg"
          })
        }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Support')]
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(HomePanelBody, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)("h3", {
        children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Quick links'), ":"]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)("ul", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("li", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(SupportLink, { ...supportLinkProps,
            children: isSelfHosted ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Community Forums') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Contact Support')
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("li", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(ExternalHomeLink, {
            href: LINKS.GITHUB_ISSUES,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Sentry on GitHub')
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("li", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(ExternalHomeLink, {
            href: LINKS.SERVICE_STATUS,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Service Status')
          })
        })]
      })]
    })]
  });

  const apiKeys = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(GridPanel, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(HomePanelHeader, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(HomeLinkIcon, {
        to: LINKS.API,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(HomeIconContainer, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconLock, {
            size: "lg",
            isSolid: true
          })
        }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('API Keys')]
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(HomePanelBody, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)("h3", {
        children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Quick links'), ":"]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)("ul", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("li", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(HomeLink, {
            to: LINKS.API,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Auth Tokens')
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("li", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(HomeLink, {
            to: `${organizationSettingsUrl}developer-settings/`,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Your Integrations')
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("li", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(ExternalHomeLink, {
            href: LINKS.DOCUMENTATION_API,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Documentation')
          })
        })]
      })]
    })]
  });

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_10__["default"], {
    title: organization ? `${organization.slug} Settings` : 'Settings',
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_settings_components_settingsLayout__WEBPACK_IMPORTED_MODULE_16__["default"], { ...props,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(GridLayout, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_acl_demoModeGate__WEBPACK_IMPORTED_MODULE_3__["default"], {
          children: myAccount
        }), orgSettings, documentation, support, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(sentry_components_acl_demoModeGate__WEBPACK_IMPORTED_MODULE_3__["default"], {
          children: [apiKeys, " "]
        })]
      })
    })
  });
}

SettingsIndex.displayName = "SettingsIndex";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withLatestContext__WEBPACK_IMPORTED_MODULE_15__["default"])(SettingsIndex));

const GridLayout = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ej14ybg9"
} : 0)("display:grid;grid-template-columns:1fr 1fr 1fr;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(2), ";" + ( true ? "" : 0));

const GridPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.Panel,  true ? {
  target: "ej14ybg8"
} : 0)( true ? {
  name: "1ykowef",
  styles: "margin-bottom:0"
} : 0);

const HomePanelHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.PanelHeader,  true ? {
  target: "ej14ybg7"
} : 0)("background:", p => p.theme.background, ";font-size:", p => p.theme.fontSizeExtraLarge, ";align-items:center;text-transform:unset;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(4), ";" + ( true ? "" : 0));

const HomePanelBody = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.PanelBody,  true ? {
  target: "ej14ybg6"
} : 0)("padding:30px;h3{font-size:14px;}ul{margin:0;li{line-height:1.6;color:", p => p.theme.gray200, ";}}" + ( true ? "" : 0));

const HomeIconContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ej14ybg5"
} : 0)("background:", p => p.theme[p.color || 'gray300'], ";color:", p => p.theme.white, ";width:", HOME_ICON_SIZE, "px;height:", HOME_ICON_SIZE, "px;border-radius:", HOME_ICON_SIZE, "px;display:flex;justify-content:center;align-items:center;" + ( true ? "" : 0));

const linkCss = _ref2 => {
  let {
    theme
  } = _ref2;
  return /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_18__.css)("color:", theme.purple300, ";&:hover{color:", theme.purple300, ";}" + ( true ? "" : 0),  true ? "" : 0);
};

const linkIconCss = /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_18__.css)("overflow:hidden;width:100%;display:grid;grid-template-rows:max-content max-content;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1.5), ";align-items:center;justify-items:center;justify-content:center;" + ( true ? "" : 0),  true ? "" : 0);

const HomeLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "ej14ybg4"
} : 0)(linkCss, ";" + ( true ? "" : 0));

const ExternalHomeLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "ej14ybg3"
} : 0)(linkCss, ";" + ( true ? "" : 0));

const HomeLinkIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(HomeLink,  true ? {
  target: "ej14ybg2"
} : 0)(linkIconCss, ";" + ( true ? "" : 0));

const ExternalHomeLinkIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "ej14ybg1"
} : 0)(linkIconCss, ";" + ( true ? "" : 0));

function SupportLink(_ref3) {
  let {
    isSelfHosted,
    icon,
    organizationSettingsUrl,
    ...props
  } = _ref3;

  if (isSelfHosted) {
    const SelfHostedLink = icon ? ExternalHomeLinkIcon : ExternalHomeLink;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(SelfHostedLink, {
      href: LINKS.FORUM,
      ...props
    });
  }

  const SelfHostedLink = icon ? HomeLinkIcon : HomeLink;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(SelfHostedLink, {
    to: `${organizationSettingsUrl}support`,
    ...props
  });
}

SupportLink.displayName = "SupportLink";

const OrganizationName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ej14ybg0"
} : 0)("line-height:1.1em;", p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_settingsIndex_tsx.643529e35488adbe8cc0a1ae22e802a7.js.map