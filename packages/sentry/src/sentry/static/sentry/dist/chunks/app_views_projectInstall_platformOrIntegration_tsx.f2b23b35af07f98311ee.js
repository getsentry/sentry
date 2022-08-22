"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_projectInstall_platformOrIntegration_tsx"],{

/***/ "./app/views/onboarding/components/firstEventFooter.tsx":
/*!**************************************************************!*\
  !*** ./app/views/onboarding/components/firstEventFooter.tsx ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ FirstEventFooter)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_onboarding_createSampleEventButton__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/views/onboarding/createSampleEventButton */ "./app/views/onboarding/createSampleEventButton.tsx");
/* harmony import */ var _firstEventIndicator__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./firstEventIndicator */ "./app/views/onboarding/components/firstEventIndicator.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }










function FirstEventFooter(_ref) {
  let {
    organization,
    project,
    docsLink,
    docsOnClick
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_firstEventIndicator__WEBPACK_IMPORTED_MODULE_7__["default"], {
      organization: organization,
      project: project,
      eventType: "error",
      children: _ref2 => {
        let {
          indicator,
          firstEventButton
        } = _ref2;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(CTAFooter, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(Actions, {
            gap: 2,
            children: [firstEventButton, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
              external: true,
              href: docsLink,
              onClick: docsOnClick,
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('View full documentation')
            })]
          }), indicator]
        });
      }
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(CTASecondary, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)('Just want to poke around before getting too cozy with the SDK? [sample:View a sample event for this SDK] or [skip:finish setup later].', {
        sample: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_views_onboarding_createSampleEventButton__WEBPACK_IMPORTED_MODULE_6__["default"], {
          "aria-label": "View a sample event",
          project: project,
          source: "onboarding",
          priority: "link"
        }),
        skip: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
          priority: "link",
          href: "/",
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Finish setup later')
        })
      })
    })]
  });
}
FirstEventFooter.displayName = "FirstEventFooter";

const CTAFooter = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1miw4d32"
} : 0)("display:flex;justify-content:space-between;margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(2), " 0;margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(4), ";" + ( true ? "" : 0));

const CTASecondary = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('p',  true ? {
  target: "e1miw4d31"
} : 0)("color:", p => p.theme.subText, ";font-size:", p => p.theme.fontSizeMedium, ";margin:0;max-width:500px;" + ( true ? "" : 0));

const Actions = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e1miw4d30"
} : 0)( true ? {
  name: "14dyr8n",
  styles: "display:inline-grid;justify-self:start"
} : 0);

/***/ }),

/***/ "./app/views/onboarding/components/firstEventIndicator.tsx":
/*!*****************************************************************!*\
  !*** ./app/views/onboarding/components/firstEventIndicator.tsx ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Indicator": () => (/* binding */ Indicator),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! framer-motion */ "../node_modules/framer-motion/dist/es/components/AnimatePresence/index.mjs");
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! framer-motion */ "../node_modules/framer-motion/dist/es/render/dom/motion.mjs");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_pulsingIndicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/pulsingIndicator */ "./app/styles/pulsingIndicator.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_eventWaiter__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/eventWaiter */ "./app/utils/eventWaiter.tsx");
/* harmony import */ var sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/testableTransition */ "./app/utils/testableTransition.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }













const FirstEventIndicator = _ref => {
  let {
    children,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_utils_eventWaiter__WEBPACK_IMPORTED_MODULE_7__["default"], { ...props,
    children: _ref2 => {
      let {
        firstIssue
      } = _ref2;
      return children({
        indicator: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(Indicator, {
          firstIssue: firstIssue,
          ...props
        }),
        firstEventButton: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)("You'll need to send your first error to continue"),
          tooltipProps: {
            disabled: !!firstIssue
          },
          disabled: !firstIssue,
          priority: "primary",
          onClick: () => (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_6__["default"])('growth.onboarding_take_to_error', {
            organization: props.organization
          }),
          to: `/organizations/${props.organization.slug}/issues/${firstIssue !== true && firstIssue !== null ? `${firstIssue.id}/` : ''}`,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Take me to my error')
        })
      });
    }
  });
};

FirstEventIndicator.displayName = "FirstEventIndicator";

const Indicator = _ref3 => {
  let {
    firstIssue
  } = _ref3;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(Container, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(framer_motion__WEBPACK_IMPORTED_MODULE_10__.AnimatePresence, {
      children: !firstIssue ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(Waiting, {}, "waiting") : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(Success, {}, "received")
    })
  });
};

Indicator.displayName = "Indicator";

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "edkqj54"
} : 0)( true ? {
  name: "qu0prw",
  styles: "display:grid;grid-template-columns:1fr;justify-content:right"
} : 0);

const StatusWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(framer_motion__WEBPACK_IMPORTED_MODULE_11__.motion.div,  true ? {
  target: "edkqj53"
} : 0)("display:grid;grid-template-columns:1fr max-content;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), ";align-items:center;font-size:", p => p.theme.fontSizeMedium, ";grid-column:1;grid-row:1;" + ( true ? "" : 0));

StatusWrapper.defaultProps = {
  initial: 'initial',
  animate: 'animate',
  exit: 'exit',
  variants: {
    initial: {
      opacity: 0,
      y: -10
    },
    animate: {
      opacity: 1,
      y: 0,
      transition: (0,sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_8__["default"])({
        when: 'beforeChildren',
        staggerChildren: 0.35
      })
    },
    exit: {
      opacity: 0,
      y: 10
    }
  }
};

const Waiting = props => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(StatusWrapper, { ...props,
  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(AnimatedText, {
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Waiting to receive first event to continue')
  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(WaitingIndicator, {})]
});

Waiting.displayName = "Waiting";

const Success = props => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(StatusWrapper, { ...props,
  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(AnimatedText, {
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Event was received!')
  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(ReceivedIndicator, {})]
});

Success.displayName = "Success";
const indicatorAnimation = {
  initial: {
    opacity: 0,
    y: -10
  },
  animate: {
    opacity: 1,
    y: 0
  },
  exit: {
    opacity: 0,
    y: 10
  }
};

const AnimatedText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(framer_motion__WEBPACK_IMPORTED_MODULE_11__.motion.div,  true ? {
  target: "edkqj52"
} : 0)( true ? "" : 0);

AnimatedText.defaultProps = {
  variants: indicatorAnimation,
  transition: (0,sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_8__["default"])()
};

const WaitingIndicator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(framer_motion__WEBPACK_IMPORTED_MODULE_11__.motion.div,  true ? {
  target: "edkqj51"
} : 0)("margin:0 6px;", sentry_styles_pulsingIndicator__WEBPACK_IMPORTED_MODULE_4__["default"], ";" + ( true ? "" : 0));

WaitingIndicator.defaultProps = {
  variants: indicatorAnimation,
  transition: (0,sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_8__["default"])()
};

const ReceivedIndicator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_2__.IconCheckmark,  true ? {
  target: "edkqj50"
} : 0)("color:#fff;background:", p => p.theme.green300, ";border-radius:50%;padding:3px;margin:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(0.25), ";" + ( true ? "" : 0));

ReceivedIndicator.defaultProps = {
  size: 'sm'
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (FirstEventIndicator);

/***/ }),

/***/ "./app/views/onboarding/components/integrations/addInstallationInstructions.tsx":
/*!**************************************************************************************!*\
  !*** ./app/views/onboarding/components/integrations/addInstallationInstructions.tsx ***!
  \**************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AddInstallationInstructions)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


 // TODO: Make dyanmic for other platforms/integrations



function AddInstallationInstructions() {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("p", {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.tct)('The automated AWS Lambda setup will instrument your Lambda functions with Sentry error and performance monitoring without any code changes. We use CloudFormation Stack ([learnMore]) to create the Sentry role which gives us access to your AWS account.', {
        learnMore: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_1__["default"], {
          href: "https://aws.amazon.com/cloudformation/",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Learn more about CloudFormation')
        })
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("p", {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.tct)('Just press the [addInstallation] button below and complete the steps in the popup that opens.', {
        addInstallation: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("strong", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Add Installation')
        })
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("p", {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.tct)('If you don’t want to add CloudFormation stack to your AWS environment, press the [manualSetup] button instead.', {
        manualSetup: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("strong", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Manual Setup')
        })
      })
    })]
  });
}
AddInstallationInstructions.displayName = "AddInstallationInstructions";

/***/ }),

/***/ "./app/views/onboarding/components/integrations/postInstallCodeSnippet.tsx":
/*!*********************************************************************************!*\
  !*** ./app/views/onboarding/components/integrations/postInstallCodeSnippet.tsx ***!
  \*********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ PostInstallCodeSnippet)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }





function PostInstallCodeSnippet(_ref) {
  let {
    provider,
    platform,
    isOnboarding
  } = _ref;
  // currently supporting both Python and Node
  const token_punctuation = platform === 'python-awslambda' ? '()' : '();';
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("p", {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)("Congrats, you just installed the %s integration! Now that it's is installed, the next time you trigger an error it will go to your Sentry.", provider.name)
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("p", {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('This snippet includes an intentional error, so you can test that everything is working as soon as you set it up:')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("div", {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(CodeWrapper, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("code", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(TokenFunction, {
            children: "myUndefinedFunction"
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(TokenPunctuation, {
            children: token_punctuation
          }), ")"]
        })
      })
    }), isOnboarding && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)("If you're new to Sentry, use the email alert to access your account and complete a product tour.")
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)("If you're an existing user and have disabled alerts, you won't receive this email.")
      })]
    })]
  });
}
PostInstallCodeSnippet.displayName = "PostInstallCodeSnippet";

const CodeWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('pre',  true ? {
  target: "ela6ric2"
} : 0)( true ? {
  name: "1cbwt16",
  styles: "padding:1em;overflow:auto;background:#251f3d;font-size:15px"
} : 0);

const TokenFunction = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "ela6ric1"
} : 0)( true ? {
  name: "abvjt",
  styles: "color:#7cc5c4"
} : 0);

const TokenPunctuation = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "ela6ric0"
} : 0)( true ? {
  name: "rybrai",
  styles: "color:#b3acc1"
} : 0);

/***/ }),

/***/ "./app/views/onboarding/createSampleEventButton.tsx":
/*!**********************************************************!*\
  !*** ./app/views/onboarding/createSampleEventButton.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













const EVENT_POLL_RETRIES = 30;
const EVENT_POLL_INTERVAL = 1000;

async function latestEventAvailable(api, groupID) {
  let retries = 0; // eslint-disable-next-line no-constant-condition

  while (true) {
    if (retries > EVENT_POLL_RETRIES) {
      return {
        eventCreated: false,
        retries: retries - 1
      };
    }

    await new Promise(resolve => window.setTimeout(resolve, EVENT_POLL_INTERVAL));

    try {
      await api.requestPromise(`/issues/${groupID}/events/latest/`);
      return {
        eventCreated: true,
        retries
      };
    } catch {
      ++retries;
    }
  }
}

class CreateSampleEventButton extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      creating: false
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "createSampleGroup", async () => {
      // TODO(dena): swap out for action creator
      const {
        api,
        organization,
        project
      } = this.props;
      let eventData;

      if (!project) {
        return;
      }

      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__["default"])('growth.onboarding_view_sample_event', {
        platform: project.platform,
        organization
      });
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Processing sample event...'), {
        duration: EVENT_POLL_RETRIES * EVENT_POLL_INTERVAL
      });
      this.setState({
        creating: true
      });

      try {
        const url = `/projects/${organization.slug}/${project.slug}/create-sample/`;
        eventData = await api.requestPromise(url, {
          method: 'POST'
        });
      } catch (error) {
        _sentry_react__WEBPACK_IMPORTED_MODULE_11__.withScope(scope => {
          scope.setExtra('error', error);
          _sentry_react__WEBPACK_IMPORTED_MODULE_11__.captureException(new Error('Failed to create sample event'));
        });
        this.setState({
          creating: false
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.clearIndicators)();
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Failed to create a new sample event'));
        return;
      } // Wait for the event to be fully processed and available on the group
      // before redirecting.


      const t0 = performance.now();
      const {
        eventCreated,
        retries
      } = await latestEventAvailable(api, eventData.groupID);
      const t1 = performance.now();
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.clearIndicators)();
      this.setState({
        creating: false
      });
      const duration = Math.ceil(t1 - t0);
      this.recordAnalytics({
        eventCreated,
        retries,
        duration
      });

      if (!eventCreated) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Failed to load sample event'));
        _sentry_react__WEBPACK_IMPORTED_MODULE_11__.withScope(scope => {
          scope.setTag('groupID', eventData.groupID);
          scope.setTag('platform', project.platform || '');
          scope.setTag('interval', EVENT_POLL_INTERVAL.toString());
          scope.setTag('retries', retries.toString());
          scope.setTag('duration', duration.toString());
          scope.setLevel('warning');
          _sentry_react__WEBPACK_IMPORTED_MODULE_11__.captureMessage('Failed to load sample event');
        });
        return;
      }

      react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.push(`/organizations/${organization.slug}/issues/${eventData.groupID}/?project=${project.id}`);
    });
  }

  componentDidMount() {
    const {
      organization,
      project,
      source
    } = this.props;

    if (!project) {
      return;
    }

    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__["default"])('sample_event.button_viewed', {
      organization,
      project_id: project.id,
      source
    });
  }

  recordAnalytics(_ref) {
    let {
      eventCreated,
      retries,
      duration
    } = _ref;
    const {
      organization,
      project,
      source
    } = this.props;

    if (!project) {
      return;
    }

    const eventKey = `sample_event.${eventCreated ? 'created' : 'failed'}`;
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__["default"])(eventKey, {
      organization,
      project_id: project.id,
      platform: project.platform || '',
      interval: EVENT_POLL_INTERVAL,
      retries,
      duration,
      source
    });
  }

  render() {
    const {
      api: _api,
      organization: _organization,
      project: _project,
      source: _source,
      ...props
    } = this.props;
    const {
      creating
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], { ...props,
      disabled: props.disabled || creating,
      onClick: this.createSampleGroup
    });
  }

}

CreateSampleEventButton.displayName = "CreateSampleEventButton";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_9__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_10__["default"])(CreateSampleEventButton)));

/***/ }),

/***/ "./app/views/organizationIntegrations/addIntegration.tsx":
/*!***************************************************************!*\
  !*** ./app/views/organizationIntegrations/addIntegration.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AddIntegration)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");







class AddIntegration extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "dialog", null);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "openDialog", urlParams => {
      const {
        account,
        analyticsParams,
        modalParams,
        organization,
        provider
      } = this.props;
      (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_6__.trackIntegrationAnalytics)('integrations.installation_start', {
        integration: provider.key,
        integration_type: 'first_party',
        organization,
        ...analyticsParams
      });
      const name = 'sentryAddIntegration';
      const {
        url,
        width,
        height
      } = provider.setupDialog;
      const {
        left,
        top
      } = this.computeCenteredWindow(width, height);
      let query = { ...urlParams
      };

      if (account) {
        query.account = account;
      }

      if (modalParams) {
        query = { ...query,
          ...modalParams
        };
      }

      const installUrl = `${url}?${query_string__WEBPACK_IMPORTED_MODULE_3__.stringify(query)}`;
      const opts = `scrollbars=yes,width=${width},height=${height},top=${top},left=${left}`;
      this.dialog = window.open(installUrl, name, opts);
      this.dialog && this.dialog.focus();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "didReceiveMessage", message => {
      const {
        analyticsParams,
        onInstall,
        organization,
        provider
      } = this.props;

      if (message.origin !== document.location.origin) {
        return;
      }

      if (message.source !== this.dialog) {
        return;
      }

      const {
        success,
        data
      } = message.data;
      this.dialog = null;

      if (!success) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)(data.error);
        return;
      }

      if (!data) {
        return;
      }

      (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_6__.trackIntegrationAnalytics)('integrations.installation_complete', {
        integration: provider.key,
        integration_type: 'first_party',
        organization,
        ...analyticsParams
      });
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('%s added', provider.name));
      onInstall(data);
    });
  }

  componentDidMount() {
    window.addEventListener('message', this.didReceiveMessage);
  }

  componentWillUnmount() {
    window.removeEventListener('message', this.didReceiveMessage);
    this.dialog && this.dialog.close();
  }

  computeCenteredWindow(width, height) {
    // Taken from: https://stackoverflow.com/questions/4068373/center-a-popup-window-on-screen
    const screenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
    const screenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;
    const innerWidth = window.innerWidth ? window.innerWidth : document.documentElement.clientWidth ? document.documentElement.clientWidth : screen.width;
    const innerHeight = window.innerHeight ? window.innerHeight : document.documentElement.clientHeight ? document.documentElement.clientHeight : screen.height;
    const left = innerWidth / 2 - width / 2 + screenLeft;
    const top = innerHeight / 2 - height / 2 + screenTop;
    return {
      left,
      top
    };
  }

  render() {
    const {
      children
    } = this.props;
    return children(this.openDialog);
  }

}
AddIntegration.displayName = "AddIntegration";

/***/ }),

/***/ "./app/views/organizationIntegrations/addIntegrationButton.tsx":
/*!*********************************************************************!*\
  !*** ./app/views/organizationIntegrations/addIntegrationButton.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AddIntegrationButton)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _addIntegration__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./addIntegration */ "./app/views/organizationIntegrations/addIntegration.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






class AddIntegrationButton extends react__WEBPACK_IMPORTED_MODULE_0__.Component {
  render() {
    const {
      provider,
      buttonText,
      onAddIntegration,
      organization,
      reinstall,
      analyticsParams,
      modalParams,
      ...buttonProps
    } = this.props;
    const label = buttonText || (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)(reinstall ? 'Enable' : 'Add %s', provider.metadata.noun);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_2__["default"], {
      disabled: provider.canAdd,
      title: `Integration cannot be added on Sentry. Enable this integration via the ${provider.name} instance.`,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(_addIntegration__WEBPACK_IMPORTED_MODULE_4__["default"], {
        provider: provider,
        onInstall: onAddIntegration,
        organization: organization,
        analyticsParams: analyticsParams,
        modalParams: modalParams,
        children: onClick => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"], {
          disabled: !provider.canAdd,
          ...buttonProps,
          onClick: () => onClick(),
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Add integration'),
          children: label
        })
      })
    });
  }

}
AddIntegrationButton.displayName = "AddIntegrationButton";

/***/ }),

/***/ "./app/views/projectInstall/components/platformHeaderButtonBar.tsx":
/*!*************************************************************************!*\
  !*** ./app/views/projectInstall/components/platformHeaderButtonBar.tsx ***!
  \*************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ PlatformHeaderButtonBar)
/* harmony export */ });
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function PlatformHeaderButtonBar(_ref) {
  let {
    gettingStartedLink,
    docsLink
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_1__["default"], {
    gap: 1,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_0__["default"], {
      size: "sm",
      to: gettingStartedLink,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('< Back')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_0__["default"], {
      size: "sm",
      href: docsLink,
      external: true,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Full Documentation')
    })]
  });
}
PlatformHeaderButtonBar.displayName = "PlatformHeaderButtonBar";

/***/ }),

/***/ "./app/views/projectInstall/platform.tsx":
/*!***********************************************!*\
  !*** ./app/views/projectInstall/platform.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ProjectInstallPlatform": () => (/* binding */ ProjectInstallPlatform),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var prism_sentry_index_css__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! prism-sentry/index.css */ "../node_modules/prism-sentry/index.css");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_actionCreators_projects__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/actionCreators/projects */ "./app/actionCreators/projects.tsx");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_errors_notFound__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/errors/notFound */ "./app/components/errors/notFound.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/data/platformCategories */ "./app/data/platformCategories.tsx");
/* harmony import */ var sentry_data_platforms__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/data/platforms */ "./app/data/platforms.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_organization__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/styles/organization */ "./app/styles/organization.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_projects__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/projects */ "./app/utils/projects.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



























class ProjectInstallPlatform extends react__WEBPACK_IMPORTED_MODULE_5__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      loading: true,
      error: false,
      html: ''
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchData", async () => {
      const {
        api,
        params
      } = this.props;
      const {
        orgId,
        projectId,
        platform
      } = params;
      this.setState({
        loading: true
      });

      try {
        const {
          html
        } = await (0,sentry_actionCreators_projects__WEBPACK_IMPORTED_MODULE_7__.loadDocs)(api, orgId, projectId, platform);
        this.setState({
          html
        });
      } catch (error) {
        this.setState({
          error
        });
      }

      this.setState({
        loading: false
      });
    });
  }

  componentDidMount() {
    this.fetchData();
    window.scrollTo(0, 0);
    const {
      platform
    } = this.props.params; // redirect if platform is not known.

    if (!platform || platform === 'other') {
      this.redirectToNeutralDocs();
    }
  }

  get isGettingStarted() {
    return window.location.href.indexOf('getting-started') > 0;
  }

  redirectToNeutralDocs() {
    const {
      orgId,
      projectId
    } = this.props.params;
    const url = `/organizations/${orgId}/projects/${projectId}/getting-started/`;
    react_router__WEBPACK_IMPORTED_MODULE_6__.browserHistory.push(url);
  }

  render() {
    var _platform$link;

    const {
      params
    } = this.props;
    const {
      orgId,
      projectId
    } = params;
    const platform = sentry_data_platforms__WEBPACK_IMPORTED_MODULE_17__["default"].find(p => p.id === params.platform);

    if (!platform) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_errors_notFound__WEBPACK_IMPORTED_MODULE_12__["default"], {});
    }

    const issueStreamLink = `/organizations/${orgId}/issues/`;
    const performanceOverviewLink = `/organizations/${orgId}/performance/`;
    const gettingStartedLink = `/organizations/${orgId}/projects/${projectId}/getting-started/`;
    const platformLink = (_platform$link = platform.link) !== null && _platform$link !== void 0 ? _platform$link : undefined;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(react__WEBPACK_IMPORTED_MODULE_5__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(StyledPageHeader, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)("h2", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Configure %(platform)s', {
            platform: platform.name
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_11__["default"], {
          gap: 1,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_10__["default"], {
            size: "sm",
            to: gettingStartedLink,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('< Back')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_10__["default"], {
            size: "sm",
            href: platformLink,
            external: true,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Full Documentation')
          })]
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)("div", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_9__["default"], {
          type: "info",
          showIcon: true,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.tct)(`
             This is a quick getting started guide. For in-depth instructions
             on integrating Sentry with [platform], view
             [docLink:our complete documentation].`, {
            platform: platform.name,
            docLink: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)("a", {
              href: platformLink
            })
          })
        }), this.state.loading ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_14__["default"], {}) : this.state.error ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_13__["default"], {
          onRetry: this.fetchData
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(react__WEBPACK_IMPORTED_MODULE_5__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_15__["default"], {
            title: `${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Configure')} ${platform.name}`,
            projectSlug: projectId
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(DocumentationWrapper, {
            dangerouslySetInnerHTML: {
              __html: this.state.html
            }
          })]
        }), this.isGettingStarted && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_utils_projects__WEBPACK_IMPORTED_MODULE_21__["default"], {
          orgId: orgId,
          slugs: [projectId],
          passthroughPlaceholderProject: false,
          children: _ref => {
            let {
              projects,
              initiallyLoaded,
              fetching,
              fetchError
            } = _ref;
            const projectsLoading = !initiallyLoaded && fetching;
            const projectFilter = !projectsLoading && !fetchError && projects.length ? {
              project: projects[0].id
            } : {};
            const showPerformancePrompt = sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_16__.performance.includes(platform.id);
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(react__WEBPACK_IMPORTED_MODULE_5__.Fragment, {
              children: [showPerformancePrompt && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_8__["default"], {
                features: ['performance-view'],
                hookName: "feature-disabled:performance-new-project",
                children: _ref2 => {
                  let {
                    hasFeature
                  } = _ref2;

                  if (hasFeature) {
                    return null;
                  }

                  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(StyledAlert, {
                    type: "info",
                    showIcon: true,
                    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)(`Your selected platform supports performance, but your organization does not have performance enabled.`)
                  });
                }
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(StyledButtonBar, {
                gap: 1,
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_10__["default"], {
                  priority: "primary",
                  busy: projectsLoading,
                  to: {
                    pathname: issueStreamLink,
                    query: projectFilter,
                    hash: '#welcome'
                  },
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Take me to Issues')
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_10__["default"], {
                  busy: projectsLoading,
                  to: {
                    pathname: performanceOverviewLink,
                    query: projectFilter
                  },
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Take me to Performance')
                })]
              })]
            });
          }
        }, `${orgId}-${projectId}`)]
      })]
    });
  }

}

ProjectInstallPlatform.displayName = "ProjectInstallPlatform";

const DocumentationWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "esjegue3"
} : 0)("line-height:1.5;.gatsby-highlight{margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(3), ";&:last-child{margin-bottom:0;}}.alert{margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(3), ";border-radius:", p => p.theme.borderRadius, ";}pre{word-break:break-all;white-space:pre-wrap;}blockquote{padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(1), ";margin-left:0;background:", p => p.theme.alert.info.backgroundLight, ";border-left:2px solid ", p => p.theme.alert.info.border, ";}blockquote>*:last-child{margin-bottom:0;}" + ( true ? "" : 0));

const StyledButtonBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_11__["default"],  true ? {
  target: "esjegue2"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(3), ";width:max-content;@media (max-width: ", p => p.theme.breakpoints.small, "){width:auto;grid-row-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(1), ";grid-auto-flow:row;}" + ( true ? "" : 0));

const StyledPageHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_19__.PageHeader,  true ? {
  target: "esjegue1"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(3), ";h2{margin:0;}@media (max-width: ", p => p.theme.breakpoints.small, "){flex-direction:column;align-items:flex-start;h2{margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(2), ";}}" + ( true ? "" : 0));

const StyledAlert = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_alert__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "esjegue0"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(2), ";" + ( true ? "" : 0));


/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_22__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_23__["default"])(ProjectInstallPlatform)));

/***/ }),

/***/ "./app/views/projectInstall/platformIntegrationSetup.tsx":
/*!***************************************************************!*\
  !*** ./app/views/projectInstall/platformIntegrationSetup.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var prism_sentry_index_css__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! prism-sentry/index.css */ "../node_modules/prism-sentry/index.css");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_data_platforms__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/data/platforms */ "./app/data/platforms.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_organization__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/styles/organization */ "./app/styles/organization.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_onboarding_components_firstEventFooter__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/views/onboarding/components/firstEventFooter */ "./app/views/onboarding/components/firstEventFooter.tsx");
/* harmony import */ var sentry_views_onboarding_components_integrations_addInstallationInstructions__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/views/onboarding/components/integrations/addInstallationInstructions */ "./app/views/onboarding/components/integrations/addInstallationInstructions.tsx");
/* harmony import */ var sentry_views_onboarding_components_integrations_postInstallCodeSnippet__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/views/onboarding/components/integrations/postInstallCodeSnippet */ "./app/views/onboarding/components/integrations/postInstallCodeSnippet.tsx");
/* harmony import */ var sentry_views_organizationIntegrations_addIntegrationButton__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/views/organizationIntegrations/addIntegrationButton */ "./app/views/organizationIntegrations/addIntegrationButton.tsx");
/* harmony import */ var _components_platformHeaderButtonBar__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ./components/platformHeaderButtonBar */ "./app/views/projectInstall/components/platformHeaderButtonBar.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






















class PlatformIntegrationSetup extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_6__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleFullDocsClick", () => {
      const {
        organization
      } = this.props;
      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_13__["default"])('growth.onboarding_view_full_docs', {
        organization
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleAddIntegration", () => {
      this.setState({
        installed: true
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "trackSwitchToManual", () => {
      const {
        organization,
        integrationSlug
      } = this.props;
      (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_14__.trackIntegrationAnalytics)('integrations.switch_manual_sdk_setup', {
        integration_type: 'first_party',
        integration: integrationSlug,
        view: 'project_creation',
        organization
      });
    });
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      installed: false,
      integrations: {
        providers: []
      },
      project: null
    };
  }

  componentDidMount() {
    window.scrollTo(0, 0);
    const {
      platform
    } = this.props.params; // redirect if platform is not known.

    if (!platform || platform === 'other') {
      this.redirectToNeutralDocs();
    }
  }

  get provider() {
    const {
      providers
    } = this.state.integrations;
    return providers.length ? providers[0] : null;
  }

  getEndpoints() {
    const {
      organization,
      integrationSlug,
      params
    } = this.props;

    if (!integrationSlug) {
      return [];
    }

    return [['integrations', `/organizations/${organization.slug}/config/integrations/?provider_key=${integrationSlug}`], ['project', `/projects/${organization.slug}/${params.projectId}/`]];
  }

  redirectToNeutralDocs() {
    const {
      orgId,
      projectId
    } = this.props.params;
    const url = `/organizations/${orgId}/projects/${projectId}/getting-started/`;
    react_router__WEBPACK_IMPORTED_MODULE_5__.browserHistory.push(url);
  }

  render() {
    const {
      organization,
      params
    } = this.props;
    const {
      installed,
      project
    } = this.state;
    const {
      projectId,
      orgId,
      platform
    } = params;
    const provider = this.provider;
    const platformIntegration = sentry_data_platforms__WEBPACK_IMPORTED_MODULE_9__["default"].find(p => p.id === platform);

    if (!provider || !platformIntegration || !project) {
      return null;
    }

    const gettingStartedLink = `/organizations/${orgId}/projects/${projectId}/getting-started/`; // TODO: make dynamic when adding more integrations

    const docsLink = 'https://docs.sentry.io/product/integrations/cloud-monitoring/aws-lambda/';
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(OuterWrapper, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(StyledPageHeader, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(StyledTitle, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Automatically instrument %s', platformIntegration.name)
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(_components_platformHeaderButtonBar__WEBPACK_IMPORTED_MODULE_20__["default"], {
          gettingStartedLink: gettingStartedLink,
          docsLink: docsLink
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(InnerWrapper, {
        children: !installed ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_views_onboarding_components_integrations_addInstallationInstructions__WEBPACK_IMPORTED_MODULE_17__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(StyledButtonBar, {
            gap: 1,
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_views_organizationIntegrations_addIntegrationButton__WEBPACK_IMPORTED_MODULE_19__["default"], {
              provider: provider,
              onAddIntegration: this.handleAddIntegration,
              organization: organization,
              priority: "primary",
              size: "sm",
              analyticsParams: {
                view: 'project_creation',
                already_installed: false
              },
              modalParams: {
                projectId: project.id
              },
              "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Add integration')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
              size: "sm",
              to: {
                pathname: window.location.pathname,
                query: {
                  manual: '1'
                }
              },
              onClick: this.trackSwitchToManual,
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Manual Setup')
            })]
          })]
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_views_onboarding_components_integrations_postInstallCodeSnippet__WEBPACK_IMPORTED_MODULE_18__["default"], {
            provider: provider
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_views_onboarding_components_firstEventFooter__WEBPACK_IMPORTED_MODULE_16__["default"], {
            project: project,
            organization: organization,
            docsLink: docsLink,
            docsOnClick: this.handleFullDocsClick
          })]
        })
      })]
    });
  }

}

PlatformIntegrationSetup.displayName = "PlatformIntegrationSetup";

const StyledButtonBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "e1ri928w4"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(3), ";width:max-content;@media (max-width: ", p => p.theme.breakpoints.small, "){width:auto;grid-row-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";grid-auto-flow:row;}" + ( true ? "" : 0));

const InnerWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1ri928w3"
} : 0)( true ? {
  name: "16ztbrs",
  styles: "width:850px"
} : 0);

const OuterWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1ri928w2"
} : 0)( true ? {
  name: "10ebfcx",
  styles: "display:flex;flex-direction:column;align-items:center;margin-top:50px"
} : 0);

const StyledPageHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_11__.PageHeader,  true ? {
  target: "e1ri928w1"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(3), ";" + ( true ? "" : 0));

const StyledTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('h2',  true ? {
  target: "e1ri928w0"
} : 0)("margin:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(3), " 0 0;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_15__["default"])(PlatformIntegrationSetup));

/***/ }),

/***/ "./app/views/projectInstall/platformOrIntegration.tsx":
/*!************************************************************!*\
  !*** ./app/views/projectInstall/platformOrIntegration.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var _platform__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./platform */ "./app/views/projectInstall/platform.tsx");
/* harmony import */ var _platformIntegrationSetup__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./platformIntegrationSetup */ "./app/views/projectInstall/platformIntegrationSetup.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






const PlatformOrIntegration = props => {
  const parsed = query_string__WEBPACK_IMPORTED_MODULE_0__.parse(window.location.search);
  const {
    platform
  } = props.params;
  const integrationSlug = platform && sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_1__.platformToIntegrationMap[platform]; // check for manual override query param

  if (integrationSlug && parsed.manual !== '1') {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_platformIntegrationSetup__WEBPACK_IMPORTED_MODULE_3__["default"], {
      integrationSlug: integrationSlug,
      ...props
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_platform__WEBPACK_IMPORTED_MODULE_2__["default"], { ...props
  });
};

PlatformOrIntegration.displayName = "PlatformOrIntegration";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PlatformOrIntegration);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_projectInstall_platformOrIntegration_tsx.0b55ca05f1b503a807e308ee6f474e14.js.map