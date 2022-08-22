"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_events_userFeedback_tsx-app_views_userFeedback_userFeedbackEmpty_tsx"],{

/***/ "./app/components/events/userFeedback.tsx":
/*!************************************************!*\
  !*** ./app/components/events/userFeedback.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_activity_author__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/activity/author */ "./app/components/activity/author.tsx");
/* harmony import */ var sentry_components_activity_item__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/activity/item */ "./app/components/activity/item/index.tsx");
/* harmony import */ var sentry_components_clipboard__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/clipboard */ "./app/components/clipboard.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













class EventUserFeedback extends react__WEBPACK_IMPORTED_MODULE_1__.Component {
  getUrl() {
    const {
      report,
      orgId,
      issueId
    } = this.props;
    return `/organizations/${orgId}/issues/${issueId}/events/${report.eventID}/`;
  }

  render() {
    const {
      className,
      report
    } = this.props;
    const user = report.user || {
      name: report.name,
      email: report.email,
      id: '',
      username: '',
      ip_address: ''
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("div", {
      className: className,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_activity_item__WEBPACK_IMPORTED_MODULE_3__["default"], {
        date: report.dateCreated,
        author: {
          type: 'user',
          user
        },
        header: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)("div", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_activity_author__WEBPACK_IMPORTED_MODULE_2__["default"], {
            children: report.name
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_clipboard__WEBPACK_IMPORTED_MODULE_4__["default"], {
            value: report.email,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(Email, {
              children: [report.email, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(StyledIconCopy, {
                size: "xs"
              })]
            })
          }), report.eventID && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(ViewEventLink, {
            to: this.getUrl(),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('View event')
          })]
        }),
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("p", {
          dangerouslySetInnerHTML: {
            __html: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_9__.nl2br)((0,sentry_utils__WEBPACK_IMPORTED_MODULE_9__.escape)(report.comments))
          }
        })
      })
    });
  }

}

EventUserFeedback.displayName = "EventUserFeedback";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EventUserFeedback);

const Email = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "egopqsd2"
} : 0)("font-size:", p => p.theme.fontSizeSmall, ";font-weight:normal;cursor:pointer;margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";" + ( true ? "" : 0));

const ViewEventLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "egopqsd1"
} : 0)("font-weight:300;margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";font-size:0.9em;" + ( true ? "" : 0));

const StyledIconCopy = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_6__.IconCopy,  true ? {
  target: "egopqsd0"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/onboardingPanel.tsx":
/*!********************************************!*\
  !*** ./app/components/onboardingPanel.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function OnboardingPanel(_ref) {
  let {
    className,
    image,
    children
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__.Panel, {
    className: className,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(Container, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(IlloBox, {
        children: image
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(StyledBox, {
        children: children
      })]
    })
  });
}

OnboardingPanel.displayName = "OnboardingPanel";

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e19tujos2"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(3), ";position:relative;@media (min-width: ", p => p.theme.breakpoints.small, "){display:flex;align-items:center;flex-direction:row;justify-content:center;flex-wrap:wrap;min-height:300px;max-width:1000px;margin:0 auto;}@media (min-width: ", p => p.theme.breakpoints.medium, "){min-height:350px;}" + ( true ? "" : 0));

const StyledBox = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e19tujos1"
} : 0)("z-index:1;@media (min-width: ", p => p.theme.breakpoints.small, "){flex:2;}" + ( true ? "" : 0));

const IlloBox = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(StyledBox,  true ? {
  target: "e19tujos0"
} : 0)("position:relative;min-height:100px;max-width:300px;margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(2), " auto;@media (min-width: ", p => p.theme.breakpoints.small, "){flex:1;margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(3), ";max-width:auto;}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OnboardingPanel);

/***/ }),

/***/ "./app/views/userFeedback/userFeedbackEmpty.tsx":
/*!******************************************************!*\
  !*** ./app/views/userFeedback/userFeedbackEmpty.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "UserFeedbackEmpty": () => (/* binding */ UserFeedbackEmpty)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/browser/esm/sdk.js");
/* harmony import */ var sentry_images_spot_feedback_empty_state_svg__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry-images/spot/feedback-empty-state.svg */ "./images/spot/feedback-empty-state.svg");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/emptyStateWarning */ "./app/components/emptyStateWarning.tsx");
/* harmony import */ var sentry_components_onboardingPanel__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/onboardingPanel */ "./app/components/onboardingPanel.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/useProjects */ "./app/utils/useProjects.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }














function UserFeedbackEmpty(_ref) {
  let {
    projectIds
  } = _ref;
  const {
    projects,
    initiallyLoaded
  } = (0,sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_11__["default"])();
  const loadingProjects = !initiallyLoaded;
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_10__["default"])();
  const selectedProjects = projectIds && projectIds.length ? projects.filter(_ref2 => {
    let {
      id
    } = _ref2;
    return projectIds.includes(id);
  }) : projects;
  const hasAnyFeedback = selectedProjects.some(_ref3 => {
    let {
      hasUserReports
    } = _ref3;
    return hasUserReports;
  });
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    window.sentryEmbedCallback = function (embed) {
      // Mock the embed's submit xhr to always be successful
      // NOTE: this will not have errors if the form is empty
      embed.submit = function (_body) {
        this._submitInProgress = true;
        setTimeout(() => {
          this._submitInProgress = false;
          this.onSuccess();
        }, 500);
      };
    };

    if (hasAnyFeedback === false) {
      // send to reload only due to higher event volume
      (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_9__.trackAdhocEvent)({
        eventKey: 'user_feedback.viewed',
        org_id: parseInt(organization.id, 10),
        projects: projectIds
      });
    }

    return () => {
      window.sentryEmbedCallback = null;
    };
  }, [hasAnyFeedback, organization.id, projectIds]);

  function trackAnalytics(_ref4) {
    let {
      eventKey,
      eventName
    } = _ref4;
    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_9__.trackAnalyticsEvent)({
      eventKey,
      eventName,
      organization_id: organization.id,
      projects: projectIds
    });
  } // Show no user reports if waiting for projects to load or if there is no feedback


  if (loadingProjects || hasAnyFeedback !== false) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_6__["default"], {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Sorry, no user reports match your filters.')
      })
    });
  } // Show landing page after projects have loaded and it is confirmed no projects have feedback


  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(sentry_components_onboardingPanel__WEBPACK_IMPORTED_MODULE_7__["default"], {
    image: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("img", {
      src: sentry_images_spot_feedback_empty_state_svg__WEBPACK_IMPORTED_MODULE_3__
    }),
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("h3", {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('What do users think?')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("p", {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)(`You can't read minds. At least we hope not. Ask users for feedback on the impact of their crashes or bugs and you shall receive.`)
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(ButtonList, {
      gap: 1,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
        external: true,
        priority: "primary",
        onClick: () => trackAnalytics({
          eventKey: 'user_feedback.docs_clicked',
          eventName: 'User Feedback Docs Clicked'
        }),
        href: "https://docs.sentry.io/product/user-feedback/",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Read the docs')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
        onClick: () => {
          _sentry_react__WEBPACK_IMPORTED_MODULE_13__.showReportDialog({
            // should never make it to the Sentry API, but just in case, use throwaway id
            eventId: '00000000000000000000000000000000'
          });
          trackAnalytics({
            eventKey: 'user_feedback.dialog_opened',
            eventName: 'User Feedback Dialog Opened'
          });
        },
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('See an example')
      })]
    })]
  });
}
UserFeedbackEmpty.displayName = "UserFeedbackEmpty";

const ButtonList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "ew4c3g80"
} : 0)( true ? {
  name: "vpj881",
  styles: "grid-template-columns:repeat(auto-fit, minmax(130px, max-content))"
} : 0);

/***/ }),

/***/ "./images/spot/feedback-empty-state.svg":
/*!**********************************************!*\
  !*** ./images/spot/feedback-empty-state.svg ***!
  \**********************************************/
/***/ ((module) => {

module.exports = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNTkuNzEgMTcwLjEiPjxkZWZzPjxzdHlsZT4uY2xzLTF7ZmlsbDojYzhjMWRifS5jbHMtMntmaWxsOiNmNDgyNGV9LmNscy0ze2ZpbGw6I2E3NGY0M30uY2xzLTQsLmNscy01LC5jbHMtN3tmaWxsOm5vbmU7c3Ryb2tlOiMzZjJiNTY7c3Ryb2tlLWxpbmVjYXA6cm91bmQ7c3Ryb2tlLWxpbmVqb2luOnJvdW5kfS5jbHMtNHtzdHJva2Utd2lkdGg6LjVweH0uY2xzLTd7c3Ryb2tlLXdpZHRoOi43NXB4fTwvc3R5bGU+PC9kZWZzPjxnIGlkPSJMYXllcl8yIiBkYXRhLW5hbWU9IkxheWVyIDIiPjxnIGlkPSJGZWVkYmFja19BcnQiIGRhdGEtbmFtZT0iRmVlZGJhY2sgQXJ0Ij48cGF0aCBjbGFzcz0iY2xzLTEiIGQ9Ik0xMTguMjcgMzYuNTR2LTUuOTFsMS44Mi0uMDYgMy43Mi01LjguMzEtMi4xOWgyLjJsLjA2IDIuOTktMS4zNSAzLjA0IDUuNDktLjA2LS4xMiA3Ljg3LTEyLjEzLjEyeiIvPjxwYXRoIGNsYXNzPSJjbHMtMiIgZD0iTTEzMC41OSA0OS40NHY2LjIyaC0yLjY2bC0zLjAyIDQuM3YzLjM5bC0yLjY1LjA5LjI3LTUuNzdoLTIuODNsLS4yOC04LjU5IDExLjE3LjM2eiIvPjxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTEyMy43NSA3Ni4zN2wuMDcgMi42MkwxMjEgODQuM2wtMy0uMTkuMTIgNi40NyAxMi0uMzcuMzYtOC4zNS01LjM2LjE4czEuMjItMyAxLjM0LTMuNTRhMTIuMTUgMTIuMTUgMCAwMDAtMi4xM3pNNDAuMzYgMTYyLjk3bDIuMjIgNS40MyA1LjAxLTUuMjguMjEtMi4yNmg0LjkzbDIuMTEtMy4xMUgzNy44MmwyLjU2IDIuNTctMTEuMzQgOS43OGgxNy45M2wuMDctLjc2LTE0LjE2LjIgNy40OC02LjU3ek0yMS43MiAxMzYuODFsMjQuMzQtLjU1IDIuMS0yMC4xMy03LjUtLjI3IDUuNjcgNC4zOXptMjMuMDYtNi4yM2wtOS40My4yOCAxMC4xNi04eiIvPjxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTkxLjYxIDEzMnMtNi4yMiA2LjQtOS41MSA4LjY5LTIzLjg4IDEwLjI0LTIzLjg4IDEwLjI0bDYuNTktMTAuNTJoLTUuMTdsLTYuNTQgMTMuNzhoLTMuNjZsMi4zNC0xMy43LTExLjY1LjEgMy4zNyAxMy41NS0zLjExLjE0LTguMS0xMy42Mi04LjgzLjA4IDQuMDUgMy43Mi0xOC43OCAxLjQtLjY0LTE5Ljk0IDEzLjgyLTIuMS0uNzQtMi42Ni0xNi43NCA0LjEyTDUuODEgMTQ5bDIxLjEzLTIuMSAzLjU3IDQuOTQgMi41LTIuMjggNi41NSA2aDE3LjExczIxLjY0LTkuMDUgMjUuMTYtMTFDODUuNjcgMTQyLjQ4IDk1LjA5IDEzMiA5NS4wOSAxMzJ6Ii8+PHBhdGggY2xhc3M9ImNscy0yIiBkPSJNNjYgMTMyLjY5bC0xNS43My05LjQyYy0uMS4wOSA1Ljc2IDkuNTEgNS43NiA5LjUxek02MC4wNSAxMzkuNTVsLTguMDUtLjM3LS4yMiAxLjMxIDcuODYtLjA3LjQxLS44N3pNNTUuMiAxNjIuMzZsLjM3IDUuNjctNS45NC03LjA0LTIuMDQgMi4xMy0uNTUgNi4yMiAxNS42Ny0uMjEtNy41MS02Ljc3ek00Ni40MiAxMTEuMTlhMi44NiAyLjg2IDAgMDAtMi43NCAyLjJsNS42Ny4xOHMtLjU1LTIuNTctMi45My0yLjM4ek0zOS44OCAxMzkuNTlsLTguMjgtLjA5LjY5IDEuMTYgNy44NC0uMDctLjI1LTF6Ii8+PHBhdGggY2xhc3M9ImNscy0zIiBkPSJNNDIuNTggMTY4LjRsLTIuMjItNS40My03LjQ4IDYuNTcgMTQuMTYtLjIuNTUtNi4yMi01LjAxIDUuMjh6TTQ0Ljc4IDEzMC41OWwuNzMtNy42OS0xMC4xNiA3Ljk2IDkuNDMtLjI3ek01My4xIDE1NC4xOWw2LjU0LTEzLjc3LTcuODYuMDctMi4zNCAxMy43aDMuNjZ6TTQzLjUgMTU0LjE0bC0zLjM3LTEzLjU1LTcuODQuMDcgOC4wOSAxMy42MiAzLjEyLS4xNHoiLz48cGF0aCBjbGFzcz0iY2xzLTIiIGQ9Ik0xMTQuNDIgNi4zNWMyLjY5LTIuNSA1LjY4LS40MSA2IDIuNDRhMy43MiAzLjcyIDAgMDEtNS42NyAzLjU0Yy0yLjIyLTEuMzMtMS42NC00Ljc2LS4zMy01Ljk4eiIvPjxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTEzMi4xNyA4Ljc0Yy4zIDMuNDYtMyA0LjQ4LTUuMzEgM2EzLjUzIDMuNTMgMCAwMS42Ny02LjMxYzIuMzItLjc5IDQuNDcgMS41NyA0LjY0IDMuMzF6Ii8+PHBhdGggY2xhc3M9ImNscy00IiBkPSJNNTQuNTMgMTU1LjQxbDguNi0xNy41NyIvPjxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTc2LjYxIDUxLjM2bC0uMTgtNC4zOUwxMDkgMzYuNTRsLS4zNyAyLjAyLTMyLjAyIDEyLjh6TTI0MS4yOCA1MS45MWwxNSAyNS42Mi0yLjU2IDQuMzktMTIuOTktMjcuMDguNTUtMi45M3oiLz48cGF0aCBjbGFzcz0iY2xzLTUiIGQ9Ik0xMDcuODcgNzYuM2MuMDYgNC43MS4wOSA3LjYzLjA5IDcuNjNMOTEuMzcgODhsLTIuMDcgOC40OS0xNS4yNSAxLjM0IDIuODEgMTcuNjkgMTUuNjEgMS4zNC0uMjUgMTAuODZoMi41N2wzLjY1LTE0LjE1LTEzLTIuNjgtLjg1LTMuNDIgMTQuNjQtMi4xOS0uNzktNy4yOEgxMTNsMS0yLjY5aDEyMC41N2MyLjE5IDAgNC44OC0uNjEgNC44OC00LjUxIDAtLjY5IDAtMy44LjA2LTguNDdNMjM5LjU1IDc3LjQ2Yy4yLTI0LjA5LjYzLTcyLjI2LjYzLTczLjY3QzI0MC4xOCAyIDI0MC4wNi41IDIzNyAuNXMtMTI2LjYxIDEtMTI2LjYxIDFhMy43NyAzLjc3IDAgMDAtMy4wNSAzLjc4Yy0uMTcgMi40LjIgNDAuNDQuNDMgNjIuNzMiLz48cGF0aCBkPSJNMjM3IC41Yy0zIDAtMTI2LjYxIDEtMTI2LjYxIDFhMy43NyAzLjc3IDAgMDAtMy4wNSAzLjc4Yy0uMDYuNzgtLjA2IDUuMzEgMCAxMS44M2wxMzIuNzQtLjI0Yy4wNi03LjUyLjExLTEyLjYxLjExLTEzLjA2QzI0MC4xOCAyIDI0MC4wNi41IDIzNyAuNXpNMTE5LjEyIDExLjc3Yy0yLjU1Ljg2LTQuMjctLjEzLTQuODgtMmEzLjUgMy41IDAgMDExLjEzLTMuODcgMy43NSAzLjc1IDAgMDE1Ljc2IDEuNiAzLjUgMy41IDAgMDEtMi4wMSA0LjI3em0xMi44OC0uODRhMy41NiAzLjU2IDAgMDEtNS45LTEuNDkgMy4xNiAzLjE2IDAgMDExLjktMy44NSAzLjM5IDMuMzkgMCAwMTQuNiAxLjc5IDMuNTkgMy41OSAwIDAxLS42IDMuNTV6bTExLjczLjM5Yy0xLjg4IDEtNC43My41OS01LjI1LTIuMjRhMy40NSAzLjQ1IDAgMDEyLjIxLTMuODJjMi40NC0uODYgNC40Ny42MSA0LjU0IDMuMjNhMyAzIDAgMDEtMS41MSAyLjgzeiIgZmlsbD0iIzNmMmI1NiIvPjxwYXRoIGNsYXNzPSJjbHMtNCIgZD0iTTExNi4yMiA5LjkybDMuMjYtMi44M00xMTYuNDQgNy4wM2wyLjYyIDIuOThNMTI3Ljc4IDguNjFoMy40OE0xNDEuODcgNi42NnYzLjI5TTEzOS44NSA4LjI1aDMuOTciLz48cGF0aCBjbGFzcz0iY2xzLTciIGQ9Ik0xMTkuMTIgMzUuOTNsLjAzLTYuMzRoMi4wN2wxLjgtMy4xNyAxLjU5LTEuNzF2LTIuNzdoMi42MnYzLjE3bC0uODggMi40NGg1LjAzdjcuMDdoLS43M3YxLjAxbC0xMS41My4zeiIvPjxwYXRoIGNsYXNzPSJjbHMtNyIgZD0iTTEzMC42NSAzNC42MmwtMy45LS4wNi4wNi0yLjAxIDQuNTctLjIxTTEzMS4zOCAzMC4yNmgtNS4xbC4wNCAyLjMyLjQ5LS4wM00xMjYuMDQgMzAuMjZ2LTIuMDRsNS4zNC0uNjdNMTE5LjEyIDg5LjZsLjAzLTYuMzRoMi4wN2wxLjgtMy4xNyAxLjU5LTEuNzF2LTIuNzdoMi42MnYzLjE3bC0uODggMi40NGg1LjAzdjcuMDdoLS43M3YxLjAxbC0xMS41My4zeiIvPjxwYXRoIGNsYXNzPSJjbHMtNyIgZD0iTTEzMC42NSA4OC4yOWwtMy45LS4wNi4wNi0yLjAxIDQuNTctLjIyTTEzMS4zOCA4My45M2gtNS4xbC4wNCAyLjMyLjQ5LS4wM00xMjYuMDQgODMuOTN2LTIuMDRsNS4zNC0uNjdNMTMxLjM4IDQ4LjQ2bC0uMDMgNi4zNGgtMi4wOGwtMS44IDMuMTctMS41OCAxLjcxdjIuNzdoLTIuNjJ2LTMuMTdsLjg4LTIuNDRoLTUuMDN2LTcuMDdoLjczdi0xLjAxbDExLjUzLS4zeiIvPjxwYXRoIGNsYXNzPSJjbHMtNyIgZD0iTTExOS44NSA0OS43N2wzLjkuMDYtLjA2IDIuMDEtNC41Ny4yMU0xMTkuMTIgNTQuMTNoNS4wOWwtLjAzLTIuMzItLjQ5LjAzTTEyNC40NSA1NC4xM3YyLjA0bC01LjMzLjY3Ii8+PHBhdGggY2xhc3M9ImNscy00IiBkPSJNMTE5LjA2IDQyLjQ2SDIyN00xMTkuNDggNzAuMzloMTA1LjU3TTE3Ny45NyA3OC45M2gxOS44OE0xNDAuNTMgNzguOTNoMzIuOTNNMTYyLjYgNDguODJoNDguM00xMzkuODUgNDguODJoMTYuNjVNMTQwLjE2IDU2LjI0aDQ1Ljg2TTE4My4wOSAyMy41NWgyMi40NU0xNDAuMjggMjMuNTVoMzYuMzVNMjAxLjc2IDMwLjQ4aDExLjFNMTY0LjE5IDMwLjQ4aDMzLjU0TTE0MC40IDMwLjQ4aDE3LjQ1TTE0MC42NSAzNi44MkgxNzciLz48cGF0aCBjbGFzcz0iY2xzLTUiIGQ9Ik0yMzkuOCA1MC42M2wxNC44OSAyOS43Ni0zMi44MS02LjM0LTE2LjgzIDEuNzF2MS4zNGw2Ljk1LS4zNy03LjU2IDIuMi42MSAxLjM0IDcuODEtMS40Nk0yNTIuMTYgNjguMDZMMjM5LjggNDcuNyIvPjxwYXRoIGNsYXNzPSJjbHMtNSIgZD0iTTIwNi4wOSA4MC4wOGwuNDIgMS40NyAxMC4wMi0xLjE2LTQuMDcgMi45LjU5IDEuMTQgNi42NC0xLjk2IDIuMTktMi4zOSAzNi40NyA0LjU4Ljg1LTUtNS42Mi05LjI3TTIxMiA3Ni43M2wxLjM3IDIuNTNNMjE2LjUzIDgwLjM5bC0uMTgtMi4zOU0xMDcuNDkgMzcuNzNMNjkuNDggNTEuODFsMzAuNDYgMTEuNzJNMTAyLjA0IDY0LjExbDEwLjUyIDcuMXYxLjQ3bC02LjIyLTIuMjkgNi42OCA1LjIyLS42NCAxLjE4LTcuMzItNC40OCAxLjc0LTIuOTMiLz48cGF0aCBjbGFzcz0iY2xzLTUiIGQ9Ik0xMTEuNDIgNzYuMjFsLTEuMSAxLjMyLTkuMDUtNC41MyAzLjI0IDUuMDMtMS4xOSAxLjE0LTUuNTMtNS45OXYtNC4zOUw2Mi4wNyA1Mi4wNWwtLjU1LTIuMDYgNDUuOTUtMTMuODFNMTAxLjI3IDczbDEuMTQtMy4zNE03My4xMyAxMzcuNjRjMi42Ny0uMjUgNi45My0uNjkgOC4yNC0xIDEuOTUtLjQ5IDkuNjMtNy4wNyA5LjYzLTcuMDdoNC41MmE5Ni4wNiA5Ni4wNiAwIDAxLTExLjgzIDExLjgzYy02LjEgNC44OC0yOC40MiAxNC0yOC40MiAxNEg0MS42MWwtMTguNjctMTcuNTYgMjQuODktMTcuNTZMNjYgMTM0LjE1TTY4LjMxIDEzNS44OWwyLjU3IDEuOTVNNjUgMTQzLjU4bC0xLjg3IDEuODIiLz48cGF0aCBjbGFzcz0iY2xzLTUiIGQ9Ik0yMi45NCAxMzcuODRoNDcuOTRsLTQuMTIgNC4wMyIvPjxwYXRoIGNsYXNzPSJjbHMtNyIgZD0iTTMxLjc4IDEzMS42aDMwLjkxIi8+PHBhdGggY2xhc3M9ImNscy01IiBkPSJNNDIuMDkgMTYwLjA0bC0xMC4zMSA4Ljc4aDMzLjE4bC0xMC40My04Ljc4TTQxLjYgMTU1LjQxbC0yLjQgMi4zMSAyLjg5IDIuMzJoMTIuNDRsMi44MS0yLjE5LTIuMDctMi40NCIvPjxwYXRoIGNsYXNzPSJjbHMtNCIgZD0iTTQxLjQyIDEzNy44NGwzLjYgMTcuNTdNNTQuMDUgMTM3Ljg0bC0zLjYgMTcuNTdNMzEuNzggMTM3Ljg0bDkuODMgMTcuNTdNNDIuMDkgMTYwLjA0bC0uODUgOC43OCA3LjAzLTguNzggNi44NyA4Ljc4LS42MS04Ljc4Ii8+PHBhdGggY2xhc3M9ImNscy01IiBkPSJNNDcuODMgMTIwLjI4bC02LjQxLTYuMDcgMTMuMTEuNS02LjcgNS41N3oiLz48cGF0aCBjbGFzcz0iY2xzLTUiIGQ9Ik00NC41OSAxMTQuMjFhNCA0IDAgMDEzLjQxLTIuNTJjMi41MS0uMDkgMy4zMyAyLjkgMy4zMyAyLjkiLz48cGF0aCBjbGFzcz0iY2xzLTQiIGQ9Ik00Mi44OSAxMzEuNmw0Ljk0LTExLjMyIDUuMDYgMTEuMzIiLz48cGF0aCBjbGFzcz0iY2xzLTUiIGQ9Ik0yNy42NCAxMzQuNTNsLTQuMDktMTIuMy0xMy40OCAzLjExcy4yNSAxNy4yLjI1IDE3LjgxLjE4LjkxLjczIDEgMTcuNjctLjg0IDE3LjY3LS44NCIvPjxwYXRoIGNsYXNzPSJjbHMtNSIgZD0iTTMzLjM0IDE0Ny42M2wtMi40MSAyLjU5LTMuODQtNC44Mi0xNy40NCAyLjQxYy0xLjk1LjI4LTIuNDQtLjc2LTIuNjktMnMtMS4yOC0yMC4xOS0xLjI4LTIxLjE2LjE5LTEuNzcgMS4yMi0yLjE0IDE4LjA2LTMuNDcgMTktMy42NSAxLjM0LjI0IDEuNTMgMS4xNUwyOSAxMzAuMjJNMjA2LjIyIDE2OC44Mmg3LjI4TTE4NS4zNyAxNjguODJoMTcuNDRNLjUgMTY4LjgyaDE3OS43OSIvPjwvZz48L2c+PC9zdmc+";

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_events_userFeedback_tsx-app_views_userFeedback_userFeedbackEmpty_tsx.85d70a1f6d9c68a2ce23ef237ccce69a.js.map