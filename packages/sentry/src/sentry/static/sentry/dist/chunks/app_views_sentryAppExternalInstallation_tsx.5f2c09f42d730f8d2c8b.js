(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_sentryAppExternalInstallation_tsx"],{

/***/ "./app/actionCreators/sentryAppInstallations.tsx":
/*!*******************************************************!*\
  !*** ./app/actionCreators/sentryAppInstallations.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "installSentryApp": () => (/* binding */ installSentryApp),
/* harmony export */   "uninstallSentryApp": () => (/* binding */ uninstallSentryApp)
/* harmony export */ });
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");



/**
 * Install a sentry application
 *
 * @param {Object} client ApiClient
 * @param {String} orgId Organization Slug
 * @param {Object} app SentryApp
 */
function installSentryApp(client, orgId, app) {
  (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addLoadingMessage)();
  const promise = client.requestPromise(`/organizations/${orgId}/sentry-app-installations/`, {
    method: 'POST',
    data: {
      slug: app.slug
    }
  });
  promise.then(() => (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.clearIndicators)(), () => (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)(`Unable to install ${app.name}`)));
  return promise;
}
/**
 * Uninstall a sentry application
 *
 * @param {Object} client ApiClient
 * @param {Object} install SentryAppInstallation
 */

function uninstallSentryApp(client, install) {
  (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addLoadingMessage)();
  const promise = client.requestPromise(`/sentry-app-installations/${install.uuid}/`, {
    method: 'DELETE'
  });
  const capitalizedAppSlug = install.app.slug.charAt(0).toUpperCase() + install.app.slug.slice(1);
  promise.then(() => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)(`${capitalizedAppSlug} successfully uninstalled.`));
  }, () => (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.clearIndicators)());
  return promise;
}

/***/ }),

/***/ "./app/components/modals/sentryAppDetailsModal.tsx":
/*!*********************************************************!*\
  !*** ./app/components/modals/sentryAppDetailsModal.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ SentryAppDetailsModal)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_circleIndicator__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/circleIndicator */ "./app/components/circleIndicator.tsx");
/* harmony import */ var sentry_components_sentryAppIcon__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/sentryAppIcon */ "./app/components/sentryAppIcon.tsx");
/* harmony import */ var sentry_components_tag__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/tag */ "./app/components/tag.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_consolidatedScopes__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/consolidatedScopes */ "./app/utils/consolidatedScopes.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var sentry_utils_marked__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/marked */ "./app/utils/marked.tsx");
/* harmony import */ var sentry_utils_recordSentryAppInteraction__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/recordSentryAppInteraction */ "./app/utils/recordSentryAppInteraction.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

















// No longer a modal anymore but yea :)
class SentryAppDetailsModal extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_4__["default"] {
  componentDidUpdate(prevProps) {
    // if the user changes org, count this as a fresh event to track
    if (this.props.organization.id !== prevProps.organization.id) {
      this.trackOpened();
    }
  }

  componentDidMount() {
    this.trackOpened();
  }

  trackOpened() {
    const {
      sentryApp,
      organization,
      isInstalled
    } = this.props;
    (0,sentry_utils_recordSentryAppInteraction__WEBPACK_IMPORTED_MODULE_15__.recordInteraction)(sentryApp.slug, 'sentry_app_viewed');
    (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_13__.trackIntegrationAnalytics)('integrations.install_modal_opened', {
      integration_type: 'sentry_app',
      integration: sentryApp.slug,
      already_installed: isInstalled,
      view: 'external_install',
      integration_status: sentryApp.status,
      organization
    }, {
      startSession: true
    });
  }

  getEndpoints() {
    const {
      sentryApp
    } = this.props;
    return [['featureData', `/sentry-apps/${sentryApp.slug}/features/`]];
  }

  featureTags(features) {
    return features.map(feature => {
      const feat = feature.featureGate.replace(/integrations/g, '');
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledTag, {
        children: feat.replace(/-/g, ' ')
      }, feat);
    });
  }

  get permissions() {
    return (0,sentry_utils_consolidatedScopes__WEBPACK_IMPORTED_MODULE_12__.toPermissions)(this.props.sentryApp.scopes);
  }

  async onInstall() {
    const {
      onInstall
    } = this.props; // we want to make sure install finishes before we close the modal
    // and we should close the modal if there is an error as well

    try {
      await onInstall();
    } catch (_err) {
      /* stylelint-disable-next-line no-empty-block */
    }
  }

  renderPermissions() {
    const permissions = this.permissions;

    if (Object.keys(permissions).filter(scope => permissions[scope].length > 0).length === 0) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Title, {
        children: "Permissions"
      }), permissions.read.length > 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(Permission, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Indicator, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Text, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.tct)('[read] access to [resources] resources', {
            read: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("strong", {
              children: "Read"
            }),
            resources: permissions.read.join(', ')
          })
        }, "read")]
      }), permissions.write.length > 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(Permission, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Indicator, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Text, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.tct)('[read] and [write] access to [resources] resources', {
            read: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("strong", {
              children: "Read"
            }),
            write: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("strong", {
              children: "Write"
            }),
            resources: permissions.write.join(', ')
          })
        }, "write")]
      }), permissions.admin.length > 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(Permission, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Indicator, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Text, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.tct)('[admin] access to [resources] resources', {
            admin: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("strong", {
              children: "Admin"
            }),
            resources: permissions.admin.join(', ')
          })
        }, "admin")]
      })]
    });
  }

  renderBody() {
    const {
      sentryApp,
      closeModal,
      isInstalled,
      organization
    } = this.props;
    const {
      featureData
    } = this.state; // Prepare the features list

    const features = (featureData || []).map(f => ({
      featureGate: f.featureGate,
      description: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("span", {
        dangerouslySetInnerHTML: {
          __html: (0,sentry_utils_marked__WEBPACK_IMPORTED_MODULE_14__.singleLineRenderer)(f.description)
        }
      })
    }));
    const {
      FeatureList,
      IntegrationFeatures
    } = (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_13__.getIntegrationFeatureGate)();
    const overview = sentryApp.overview || '';
    const featureProps = {
      organization,
      features
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(Heading, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_sentryAppIcon__WEBPACK_IMPORTED_MODULE_7__["default"], {
          sentryApp: sentryApp,
          size: 50
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(HeadingInfo, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Name, {
            children: sentryApp.name
          }), !!features.length && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Features, {
            children: this.featureTags(features)
          })]
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Description, {
        dangerouslySetInnerHTML: {
          __html: (0,sentry_utils_marked__WEBPACK_IMPORTED_MODULE_14__["default"])(overview)
        }
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(FeatureList, { ...featureProps,
        provider: { ...sentryApp,
          key: sentryApp.slug
        }
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(IntegrationFeatures, { ...featureProps,
        children: _ref => {
          let {
            disabled,
            disabledReason
          } = _ref;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
            children: [!disabled && this.renderPermissions(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(Footer, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Author, {
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Authored By %s', sentryApp.author)
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)("div", {
                children: [disabled && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(DisabledNotice, {
                  reason: disabledReason
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
                  size: "sm",
                  onClick: closeModal,
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Cancel')
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_3__["default"], {
                  organization: organization,
                  access: ['org:integrations'],
                  children: _ref2 => {
                    let {
                      hasAccess
                    } = _ref2;
                    return hasAccess && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
                      size: "sm",
                      priority: "primary",
                      disabled: isInstalled || disabled,
                      onClick: () => this.onInstall(),
                      style: {
                        marginLeft: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(1)
                      },
                      "data-test-id": "install",
                      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Accept & Install')
                    });
                  }
                })]
              })]
            })]
          });
        }
      })]
    });
  }

}

const Heading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1hor01j12"
} : 0)("display:grid;grid-template-columns:max-content 1fr;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(1), ";align-items:center;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(2), ";" + ( true ? "" : 0));

const HeadingInfo = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1hor01j11"
} : 0)( true ? {
  name: "4runny",
  styles: "display:grid;grid-template-rows:max-content max-content;align-items:start"
} : 0);

const Name = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1hor01j10"
} : 0)( true ? {
  name: "1k5apmu",
  styles: "font-weight:bold;font-size:1.4em"
} : 0);

const Description = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1hor01j9"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(2), ";li{margin-bottom:6px;}" + ( true ? "" : 0));

const Author = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1hor01j8"
} : 0)("color:", p => p.theme.gray300, ";" + ( true ? "" : 0));

const DisabledNotice = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_ref3 => {
  let {
    reason,
    ...p
  } = _ref3;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)("div", { ...p,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconFlag, {
      color: "red300",
      size: "1.5em"
    }), reason]
  });
},  true ? {
  target: "e1hor01j7"
} : 0)("display:grid;align-items:center;flex:1;grid-template-columns:max-content 1fr;color:", p => p.theme.red300, ";font-size:0.9em;" + ( true ? "" : 0));

const Text = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('p',  true ? {
  target: "e1hor01j6"
} : 0)( true ? {
  name: "1x9ekz7",
  styles: "margin:0px 6px"
} : 0);

const Permission = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1hor01j5"
} : 0)( true ? {
  name: "zjik7",
  styles: "display:flex"
} : 0);

const Footer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1hor01j4"
} : 0)( true ? {
  name: "1348q18",
  styles: "display:flex;padding:20px 30px;border-top:1px solid #e2dee6;margin:20px -30px -30px;justify-content:space-between"
} : 0);

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('p',  true ? {
  target: "e1hor01j3"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(1), ";font-weight:bold;" + ( true ? "" : 0));

const Indicator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(p => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_circleIndicator__WEBPACK_IMPORTED_MODULE_6__["default"], {
  size: 7,
  ...p
}),  true ? {
  target: "e1hor01j2"
} : 0)("margin-top:7px;color:", p => p.theme.success, ";" + ( true ? "" : 0));

const Features = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1hor01j1"
} : 0)("margin:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(0.5), ";" + ( true ? "" : 0));

const StyledTag = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_tag__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "e1hor01j0"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(0.5), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/narrowLayout.tsx":
/*!*****************************************!*\
  !*** ./app/components/narrowLayout.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_account__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/account */ "./app/actionCreators/account.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









function NarrowLayout(_ref) {
  let {
    maxWidth,
    showLogout,
    children
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_5__["default"])();
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    document.body.classList.add('narrow');
    return () => document.body.classList.remove('narrow');
  }, []);

  async function handleLogout() {
    await (0,sentry_actionCreators_account__WEBPACK_IMPORTED_MODULE_2__.logout)(api);
    window.location.assign('/auth/login');
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("div", {
    className: "app",
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("div", {
      className: "pattern-bg"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("div", {
      className: "container",
      style: {
        maxWidth
      },
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("div", {
        className: "box box-modal",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("div", {
          className: "box-header",
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("a", {
            href: "/",
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconSentry, {
              size: "lg"
            })
          }), showLogout && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("a", {
            className: "logout pull-right",
            onClick: handleLogout,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Logout, {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Sign out')
            })
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("div", {
          className: "box-content with-padding",
          children: children
        })]
      })
    })]
  });
}

NarrowLayout.displayName = "NarrowLayout";

const Logout = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "eaq1ri90"
} : 0)("font-size:", p => p.theme.fontSizeLarge, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (NarrowLayout);

/***/ }),

/***/ "./app/components/sentryAppIcon.tsx":
/*!******************************************!*\
  !*** ./app/components/sentryAppIcon.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_avatar_sentryAppAvatar__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/avatar/sentryAppAvatar */ "./app/components/avatar/sentryAppAvatar.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



const SentryAppIcon = _ref => {
  let {
    sentryApp,
    size
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)(sentry_components_avatar_sentryAppAvatar__WEBPACK_IMPORTED_MODULE_0__["default"], {
    sentryApp: sentryApp,
    size: size,
    isColor: true
  });
};

SentryAppIcon.displayName = "SentryAppIcon";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SentryAppIcon);

/***/ }),

/***/ "./app/utils/consolidatedScopes.tsx":
/*!******************************************!*\
  !*** ./app/utils/consolidatedScopes.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "toPermissions": () => (/* binding */ toPermissions),
/* harmony export */   "toResourcePermissions": () => (/* binding */ toResourcePermissions)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var lodash_groupBy__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/groupBy */ "../node_modules/lodash/groupBy.js");
/* harmony import */ var lodash_groupBy__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_groupBy__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var lodash_invertBy__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/invertBy */ "../node_modules/lodash/invertBy.js");
/* harmony import */ var lodash_invertBy__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_invertBy__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_4__);





const PERMISSION_LEVELS = {
  read: 0,
  write: 1,
  admin: 2
};
const HUMAN_RESOURCE_NAMES = {
  project: 'Project',
  team: 'Team',
  release: 'Release',
  event: 'Event',
  org: 'Organization',
  member: 'Member'
};
const DEFAULT_RESOURCE_PERMISSIONS = {
  Project: 'no-access',
  Team: 'no-access',
  Release: 'no-access',
  Event: 'no-access',
  Organization: 'no-access',
  Member: 'no-access'
};
const PROJECT_RELEASES = 'project:releases';

/**
 * Numerical value of the scope where Admin is higher than Write,
 * which is higher than Read. Used to sort scopes by access.
 */
const permissionLevel = scope => {
  const permission = scope.split(':')[1];
  return PERMISSION_LEVELS[permission];
};

const compareScopes = (a, b) => permissionLevel(a) - permissionLevel(b);
/**
 * Return the most permissive scope for each resource.
 *
 * Example:
 *    Given the full list of scopes:
 *      ['project:read', 'project:write', 'team:read', 'team:write', 'team:admin']
 *
 *    this would return:
 *      ['project:write', 'team:admin']
 */


function topScopes(scopeList) {
  return Object.values(lodash_groupBy__WEBPACK_IMPORTED_MODULE_2___default()(scopeList, scope => scope.split(':')[0])).map(scopes => scopes.sort(compareScopes)).map(scopes => scopes.pop());
}
/**
 * Convert into a list of Permissions, grouped by resource.
 *
 * This is used in the new/edit Sentry App form. That page displays permissions
 * in a per-Resource manner, meaning one row for Project, one for Organization, etc.
 *
 * This exposes scopes in a way that works for that UI.
 *
 * Example:
 *    {
 *      'Project': 'read',
 *      'Organization': 'write',
 *      'Team': 'no-access',
 *      ...
 *    }
 */


function toResourcePermissions(scopes) {
  const permissions = { ...DEFAULT_RESOURCE_PERMISSIONS
  };
  let filteredScopes = [...scopes]; // The scope for releases is `project:releases`, but instead of displaying
  // it as a permission of Project, we want to separate it out into its own
  // row for Releases.

  if (scopes.includes(PROJECT_RELEASES)) {
    permissions.Release = 'admin';
    filteredScopes = scopes.filter(scope => scope !== PROJECT_RELEASES); // remove project:releases
  }

  topScopes(filteredScopes).forEach(scope => {
    if (scope) {
      const [resource, permission] = scope.split(':');
      permissions[HUMAN_RESOURCE_NAMES[resource]] = permission;
    }
  });
  return permissions;
}
/**
 * Convert into a list of Permissions, grouped by access and including a
 * list of resources per access level.
 *
 * This is used in the Permissions Modal when installing an App. It displays
 * scopes in a per-Permission way, meaning one row for Read, one for Write,
 * and one for Admin.
 *
 * This exposes scopes in a way that works for that UI.
 *
 * Example:
 *    {
 *      read:  ['Project', 'Organization'],
 *      write: ['Member'],
 *      admin: ['Release']
 *    }
 */


function toPermissions(scopes) {
  const defaultPermissions = {
    read: [],
    write: [],
    admin: []
  };
  const resourcePermissions = toResourcePermissions(scopes); // Filter out the 'no-access' permissions

  const permissions = lodash_pick__WEBPACK_IMPORTED_MODULE_4___default()(lodash_invertBy__WEBPACK_IMPORTED_MODULE_3___default()(resourcePermissions), ['read', 'write', 'admin']);
  return { ...defaultPermissions,
    ...permissions
  };
}



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

/***/ "./app/views/sentryAppExternalInstallation.tsx":
/*!*****************************************************!*\
  !*** ./app/views/sentryAppExternalInstallation.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ SentryAppExternalInstallation)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_sentryAppInstallations__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/sentryAppInstallations */ "./app/actionCreators/sentryAppInstallations.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_avatar_organizationAvatar__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/avatar/organizationAvatar */ "./app/components/avatar/organizationAvatar.tsx");
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_components_modals_sentryAppDetailsModal__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/modals/sentryAppDetailsModal */ "./app/components/modals/sentryAppDetailsModal.tsx");
/* harmony import */ var sentry_components_narrowLayout__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/narrowLayout */ "./app/components/narrowLayout.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }















class SentryAppExternalInstallation extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_15__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "disableErrorReport", false);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "hasAccess", org => org.access.includes('org:integrations'));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onClose", () => {
      // if we came from somewhere, go back there. Otherwise, back to the integrations page
      const {
        selectedOrgSlug
      } = this.state;
      const newUrl = document.referrer || `/settings/${selectedOrgSlug}/integrations/`;
      window.location.assign(newUrl);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onInstall", async () => {
      const {
        organization,
        sentryApp
      } = this.state;

      if (!organization || !sentryApp) {
        return undefined;
      }

      (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_13__.trackIntegrationAnalytics)('integrations.installation_start', {
        integration_type: 'sentry_app',
        integration: sentryApp.slug,
        view: 'external_install',
        integration_status: sentryApp.status,
        organization
      });
      const install = await (0,sentry_actionCreators_sentryAppInstallations__WEBPACK_IMPORTED_MODULE_5__.installSentryApp)(this.api, organization.slug, sentryApp); // installation is complete if the status is installed

      if (install.status === 'installed') {
        (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_13__.trackIntegrationAnalytics)('integrations.installation_complete', {
          integration_type: 'sentry_app',
          integration: sentryApp.slug,
          view: 'external_install',
          integration_status: sentryApp.status,
          organization
        });
      }

      if (sentryApp.redirectUrl) {
        const queryParams = {
          installationId: install.uuid,
          code: install.code,
          orgSlug: organization.slug
        };
        const redirectUrl = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_14__.addQueryParamsToExistingUrl)(sentryApp.redirectUrl, queryParams);
        return window.location.assign(redirectUrl);
      }

      return this.onClose();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onSelectOrg", async orgSlug => {
      this.setState({
        selectedOrgSlug: orgSlug,
        reloading: true
      });

      try {
        const [organization, installations] = await Promise.all([this.api.requestPromise(`/organizations/${orgSlug}/`), this.api.requestPromise(`/organizations/${orgSlug}/sentry-app-installations/`)]);
        const isInstalled = installations.map(install => install.app.slug).includes(this.sentryAppSlug); // all state fields should be set at the same time so analytics in SentryAppDetailsModal works properly

        this.setState({
          organization,
          isInstalled,
          reloading: false
        });
      } catch (err) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Failed to retrieve organization or integration details'));
        this.setState({
          reloading: false
        });
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onRequestSuccess", _ref => {
      let {
        stateKey,
        data
      } = _ref;

      // if only one org, we can immediately update our selected org
      if (stateKey === 'organizations' && data.length === 1) {
        this.onSelectOrg(data[0].slug);
      }
    });
  }

  getDefaultState() {
    const state = super.getDefaultState();
    return { ...state,
      selectedOrgSlug: null,
      organization: null,
      organizations: [],
      reloading: false
    };
  }

  getEndpoints() {
    return [['organizations', '/organizations/'], ['sentryApp', `/sentry-apps/${this.sentryAppSlug}/`]];
  }

  getTitle() {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Choose Installation Organization');
  }

  get sentryAppSlug() {
    return this.props.params.sentryAppSlug;
  }

  get isSingleOrg() {
    return this.state.organizations.length === 1;
  }

  get isSentryAppInternal() {
    const {
      sentryApp
    } = this.state;
    return sentryApp && sentryApp.status === 'internal';
  }

  get isSentryAppUnavailableForOrg() {
    var _sentryApp$owner;

    const {
      sentryApp,
      selectedOrgSlug
    } = this.state; // if the app is unpublished for a different org

    return selectedOrgSlug && (sentryApp === null || sentryApp === void 0 ? void 0 : (_sentryApp$owner = sentryApp.owner) === null || _sentryApp$owner === void 0 ? void 0 : _sentryApp$owner.slug) !== selectedOrgSlug && sentryApp.status === 'unpublished';
  }

  get disableInstall() {
    const {
      reloading,
      isInstalled
    } = this.state;
    return isInstalled || reloading || this.isSentryAppUnavailableForOrg;
  }

  getOptions() {
    return this.state.organizations.map(org => ({
      value: org.slug,
      label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)("div", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_avatar_organizationAvatar__WEBPACK_IMPORTED_MODULE_7__["default"], {
          organization: org
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(OrgNameHolder, {
          children: org.slug
        })]
      }, org.slug)
    }));
  }

  renderInternalAppError() {
    const {
      sentryApp
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_6__["default"], {
      type: "error",
      showIcon: true,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('Integration [sentryAppName] is an internal integration. Internal integrations are automatically installed', {
        sentryAppName: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("strong", {
          children: sentryApp.name
        })
      })
    });
  }

  checkAndRenderError() {
    const {
      organization,
      selectedOrgSlug,
      isInstalled,
      sentryApp
    } = this.state;

    if (selectedOrgSlug && organization && !this.hasAccess(organization)) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_6__["default"], {
        type: "error",
        showIcon: true,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("p", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)(`You do not have permission to install integrations in
          [organization]. Ask an organization owner or manager to
          visit this page to finish installing this integration.`, {
            organization: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("strong", {
              children: organization.slug
            })
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(InstallLink, {
          children: window.location.href
        })]
      });
    }

    if (isInstalled && organization) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_6__["default"], {
        type: "error",
        showIcon: true,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('Integration [sentryAppName] already installed for [organization]', {
          organization: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("strong", {
            children: organization.name
          }),
          sentryAppName: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("strong", {
            children: sentryApp.name
          })
        })
      });
    }

    if (this.isSentryAppUnavailableForOrg) {
      var _sentryApp$owner$slug, _sentryApp$owner2;

      // use the slug of the owner if we have it, otherwise use 'another organization'
      const ownerSlug = (_sentryApp$owner$slug = sentryApp === null || sentryApp === void 0 ? void 0 : (_sentryApp$owner2 = sentryApp.owner) === null || _sentryApp$owner2 === void 0 ? void 0 : _sentryApp$owner2.slug) !== null && _sentryApp$owner$slug !== void 0 ? _sentryApp$owner$slug : 'another organization';
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_6__["default"], {
        type: "error",
        showIcon: true,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('Integration [sentryAppName] is an unpublished integration for [otherOrg]. An unpublished integration can only be installed on the organization which created it.', {
          sentryAppName: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("strong", {
            children: sentryApp.name
          }),
          otherOrg: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("strong", {
            children: ownerSlug
          })
        })
      });
    }

    return null;
  }

  renderMultiOrgView() {
    const {
      selectedOrgSlug,
      sentryApp
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('Please pick a specific [organization:organization] to install [sentryAppName]', {
          organization: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("strong", {}),
          sentryAppName: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("strong", {
            children: sentryApp.name
          })
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_8__["default"], {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Organization'),
        inline: false,
        stacked: true,
        required: true,
        children: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_9__["default"], {
          onChange: _ref2 => {
            let {
              value
            } = _ref2;
            return this.onSelectOrg(value);
          },
          value: selectedOrgSlug,
          placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Select an organization'),
          options: this.getOptions()
        })
      })]
    });
  }

  renderSingleOrgView() {
    const {
      organizations,
      sentryApp
    } = this.state; // pull the name out of organizations since state.organization won't be loaded initially

    const organizationName = organizations[0].name;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("div", {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('You are installing [sentryAppName] for organization [organization]', {
          organization: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("strong", {
            children: organizationName
          }),
          sentryAppName: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("strong", {
            children: sentryApp.name
          })
        })
      })
    });
  }

  renderMainContent() {
    const {
      organization,
      sentryApp
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(OrgViewHolder, {
        children: this.isSingleOrg ? this.renderSingleOrgView() : this.renderMultiOrgView()
      }), this.checkAndRenderError(), organization && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_modals_sentryAppDetailsModal__WEBPACK_IMPORTED_MODULE_10__["default"], {
        sentryApp: sentryApp,
        organization: organization,
        onInstall: this.onInstall,
        closeModal: this.onClose,
        isInstalled: this.disableInstall
      })]
    });
  }

  renderBody() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_narrowLayout__WEBPACK_IMPORTED_MODULE_11__["default"], {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(Content, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("h3", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Finish integration installation')
        }), this.isSentryAppInternal ? this.renderInternalAppError() : this.renderMainContent()]
      })
    });
  }

}

const InstallLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('pre',  true ? {
  target: "e14lyx9n3"
} : 0)( true ? {
  name: "1iee5id",
  styles: "margin-bottom:0;background:#fbe3e1"
} : 0);

const OrgNameHolder = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e14lyx9n2"
} : 0)( true ? {
  name: "1qkltea",
  styles: "margin-left:5px"
} : 0);

const Content = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e14lyx9n1"
} : 0)( true ? {
  name: "qkomnt",
  styles: "margin-bottom:40px"
} : 0);

const OrgViewHolder = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e14lyx9n0"
} : 0)( true ? {
  name: "1azpx8r",
  styles: "margin-bottom:20px"
} : 0);

/***/ }),

/***/ "../node_modules/lodash/invertBy.js":
/*!******************************************!*\
  !*** ../node_modules/lodash/invertBy.js ***!
  \******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseIteratee = __webpack_require__(/*! ./_baseIteratee */ "../node_modules/lodash/_baseIteratee.js"),
    createInverter = __webpack_require__(/*! ./_createInverter */ "../node_modules/lodash/_createInverter.js");

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString = objectProto.toString;

/**
 * This method is like `_.invert` except that the inverted object is generated
 * from the results of running each element of `object` thru `iteratee`. The
 * corresponding inverted value of each inverted key is an array of keys
 * responsible for generating the inverted value. The iteratee is invoked
 * with one argument: (value).
 *
 * @static
 * @memberOf _
 * @since 4.1.0
 * @category Object
 * @param {Object} object The object to invert.
 * @param {Function} [iteratee=_.identity] The iteratee invoked per element.
 * @returns {Object} Returns the new inverted object.
 * @example
 *
 * var object = { 'a': 1, 'b': 2, 'c': 1 };
 *
 * _.invertBy(object);
 * // => { '1': ['a', 'c'], '2': ['b'] }
 *
 * _.invertBy(object, function(value) {
 *   return 'group' + value;
 * });
 * // => { 'group1': ['a', 'c'], 'group2': ['b'] }
 */
var invertBy = createInverter(function(result, value, key) {
  if (value != null &&
      typeof value.toString != 'function') {
    value = nativeObjectToString.call(value);
  }

  if (hasOwnProperty.call(result, value)) {
    result[value].push(key);
  } else {
    result[value] = [key];
  }
}, baseIteratee);

module.exports = invertBy;


/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_sentryAppExternalInstallation_tsx.90a16bdb00910b2d3156b4cc4def8e09.js.map