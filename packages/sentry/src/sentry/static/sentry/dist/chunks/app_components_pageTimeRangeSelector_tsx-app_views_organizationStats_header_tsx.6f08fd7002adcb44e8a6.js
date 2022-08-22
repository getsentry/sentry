"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_pageTimeRangeSelector_tsx-app_views_organizationStats_header_tsx"],{

/***/ "./app/components/featureFeedback/index.tsx":
/*!**************************************************!*\
  !*** ./app/components/featureFeedback/index.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FeatureFeedback": () => (/* binding */ FeatureFeedback)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






// Provides a button that, when clicked, opens a modal with a form that,
// when filled and submitted, will send feedback to Sentry (feedbacks project).
function FeatureFeedback(_ref) {
  let {
    feedbackTypes,
    featureName,
    buttonProps = {}
  } = _ref;

  async function handleClick() {
    const mod = await __webpack_require__.e(/*! import() */ "app_components_featureFeedback_feedbackModal_tsx").then(__webpack_require__.bind(__webpack_require__, /*! sentry/components/featureFeedback/feedbackModal */ "./app/components/featureFeedback/feedbackModal.tsx"));
    const {
      FeedbackModal,
      modalCss
    } = mod;
    (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_1__.openModal)(deps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(FeedbackModal, { ...deps,
      featureName: featureName,
      feedbackTypes: feedbackTypes
    }), {
      modalCss
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
    icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconMegaphone, {}),
    onClick: handleClick,
    ...buttonProps,
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Give Feedback')
  });
}
FeatureFeedback.displayName = "FeatureFeedback";

/***/ }),

/***/ "./app/components/pageTimeRangeSelector.tsx":
/*!**************************************************!*\
  !*** ./app/components/pageTimeRangeSelector.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_organizations_timeRangeSelector__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/organizations/timeRangeSelector */ "./app/components/organizations/timeRangeSelector/index.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







function PageTimeRangeSelector(_ref) {
  let {
    className,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(DropdownDate, {
    className: className,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_organizations_timeRangeSelector__WEBPACK_IMPORTED_MODULE_1__["default"], {
      label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(DropdownLabel, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Date Range:')
      }),
      detached: true,
      ...props
    }, `period:${props.relative}-start:${props.start}-end:${props.end}-utc:${props.utc}-defaultPeriod:${props.defaultPeriod}`)
  });
}

PageTimeRangeSelector.displayName = "PageTimeRangeSelector";

const DropdownDate = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.Panel,  true ? {
  target: "e1hsuxgy1"
} : 0)("padding:0;margin:0;display:flex;justify-content:center;align-items:center;height:42px;background:", p => p.theme.background, ";border:1px solid ", p => p.theme.border, ";border-radius:", p => p.theme.borderRadius, ";font-size:", p => p.theme.fontSizeMedium, ";color:", p => p.theme.textColor, ";>div{width:100%;align-self:stretch;}>div>div:first-child>div{padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(2), ";}>div>div:last-child:not(:first-child){min-width:calc(100% + 2px);transform:translateX(-1px);right:auto;}" + ( true ? "" : 0));

const DropdownLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1hsuxgy0"
} : 0)("text-align:left;font-weight:600;color:", p => p.theme.textColor, ";>span:last-child{font-weight:400;}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PageTimeRangeSelector);

/***/ }),

/***/ "./app/views/organizationStats/header.tsx":
/*!************************************************!*\
  !*** ./app/views/organizationStats/header.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_featureFeedback__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/featureFeedback */ "./app/components/featureFeedback/index.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









function StatsHeader(_ref) {
  let {
    organization,
    activeTab
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_2__.Header, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_2__.HeaderContent, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(StyledLayoutTitle, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Stats')
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_2__.HeaderActions, {
      children: activeTab !== 'stats' && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_featureFeedback__WEBPACK_IMPORTED_MODULE_1__.FeatureFeedback, {
        featureName: "team-stats"
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_2__.HeaderNavTabs, {
      underlined: true,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("li", {
        className: `${activeTab === 'stats' ? 'active' : ''}`,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_3__["default"], {
          to: `/organizations/${organization.slug}/stats/`,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Usage')
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("li", {
        className: `${activeTab === 'issues' ? 'active' : ''}`,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_3__["default"], {
          to: `/organizations/${organization.slug}/stats/issues/`,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Issues')
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("li", {
        className: `${activeTab === 'health' ? 'active' : ''}`,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_3__["default"], {
          to: `/organizations/${organization.slug}/stats/health/`,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Health')
        })
      })]
    })]
  });
}

StatsHeader.displayName = "StatsHeader";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (StatsHeader);

const StyledLayoutTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_2__.Title,  true ? {
  target: "e8yr0f60"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(0.5), ";" + ( true ? "" : 0));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_pageTimeRangeSelector_tsx-app_views_organizationStats_header_tsx.8aa276111fcd9ce0ad57a47ba5a6c9e6.js.map