(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_featureBadge_tsx-app_components_modals_helpSearchModal_tsx"],{

/***/ "./app/components/circleIndicator.tsx":
/*!********************************************!*\
  !*** ./app/components/circleIndicator.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");

const defaultProps = {
  enabled: true,
  size: 14
};

const getBackgroundColor = p => {
  if (p.color) {
    return `background: ${p.color};`;
  }

  return `background: ${p.enabled ? p.theme.success : p.theme.error};`;
};

const getSize = p => `
  height: ${p.size}px;
  width: ${p.size}px;
`;

const CircleIndicator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e13rus8i0"
} : 0)("display:inline-block;position:relative;border-radius:50%;", getSize, ";", getBackgroundColor, ";" + ( true ? "" : 0));

CircleIndicator.defaultProps = defaultProps;
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (CircleIndicator);

/***/ }),

/***/ "./app/components/featureBadge.tsx":
/*!*****************************************!*\
  !*** ./app/components/featureBadge.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_components_circleIndicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/circleIndicator */ "./app/components/circleIndicator.tsx");
/* harmony import */ var sentry_components_tagDeprecated__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/tagDeprecated */ "./app/components/tagDeprecated.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












const defaultTitles = {
  alpha: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('This feature is internal and available for QA purposes'),
  beta: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('This feature is available for early adopters and may change'),
  new: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('This feature is new! Try it out and let us know what you think')
};
const labels = {
  alpha: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('alpha'),
  beta: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('beta'),
  new: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('new')
};

function BaseFeatureBadge(_ref) {
  let {
    type,
    variant = 'badge',
    title,
    noTooltip,
    expiresAt,
    ...props
  } = _ref;
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_8__.a)();

  if (expiresAt && expiresAt.valueOf() < Date.now()) {
    // Only get 1% of events as we don't need many to know that a badge needs to be cleaned up.
    if (Math.random() < 0.01) {
      (0,_sentry_react__WEBPACK_IMPORTED_MODULE_9__.withScope)(scope => {
        scope.setTag('title', title);
        scope.setTag('type', type);
        scope.setLevel('warning');
        (0,_sentry_react__WEBPACK_IMPORTED_MODULE_9__.captureException)(new Error('Expired Feature Badge'));
      });
    }

    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("div", { ...props,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_5__["default"], {
      title: title !== null && title !== void 0 ? title : defaultTitles[type],
      disabled: noTooltip,
      position: "right",
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
        children: [variant === 'badge' && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(StyledTag, {
          priority: type,
          children: labels[type]
        }), variant === 'indicator' && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_circleIndicator__WEBPACK_IMPORTED_MODULE_3__["default"], {
          color: theme.badge[type].indicatorColor,
          size: 8
        })]
      })
    })
  });
}

BaseFeatureBadge.displayName = "BaseFeatureBadge";

const StyledTag = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_tagDeprecated__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "e1g6bd531"
} : 0)("padding:3px ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(0.75), ";" + ( true ? "" : 0));

const FeatureBadge = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(BaseFeatureBadge,  true ? {
  target: "e1g6bd530"
} : 0)("display:inline-flex;align-items:center;margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(0.75), ";position:relative;top:-1px;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (FeatureBadge);

/***/ }),

/***/ "./app/components/helpSearch.tsx":
/*!***************************************!*\
  !*** ./app/components/helpSearch.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_search__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/search */ "./app/components/search/index.tsx");
/* harmony import */ var sentry_components_search_searchResult__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/search/searchResult */ "./app/components/search/searchResult.tsx");
/* harmony import */ var sentry_components_search_searchResultWrapper__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/search/searchResultWrapper */ "./app/components/search/searchResultWrapper.tsx");
/* harmony import */ var sentry_components_search_sources_helpSource__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/search/sources/helpSource */ "./app/components/search/sources/helpSource.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












const renderResult = _ref => {
  var _item$sectionCount;

  let {
    item,
    matches,
    itemProps,
    highlighted
  } = _ref;
  const sectionHeading = item.sectionHeading !== undefined ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(SectionHeading, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_6__.IconWindow, {}), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('From %s', item.sectionHeading), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(Count, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.tn)('%s result', '%s results', (_item$sectionCount = item.sectionCount) !== null && _item$sectionCount !== void 0 ? _item$sectionCount : 0)
    })]
  }) : null;

  if (item.empty) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: [sectionHeading, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(Empty, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('No results from %s', item.sectionHeading)
      })]
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [sectionHeading, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_search_searchResultWrapper__WEBPACK_IMPORTED_MODULE_4__["default"], { ...itemProps,
      highlighted: highlighted,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_search_searchResult__WEBPACK_IMPORTED_MODULE_3__["default"], {
        highlighted: highlighted,
        item: item,
        matches: matches
      })
    })]
  });
};

renderResult.displayName = "renderResult";

// TODO(ts): Type based on Search props once that has types
const HelpSearch = props => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_search__WEBPACK_IMPORTED_MODULE_2__.Search, { ...props,
  sources: [sentry_components_search_sources_helpSource__WEBPACK_IMPORTED_MODULE_5__["default"]],
  minSearch: 3,
  closeOnSelect: false,
  renderItem: renderResult
});

HelpSearch.displayName = "HelpSearch";

const SectionHeading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1p43amg2"
} : 0)("display:grid;grid-template-columns:max-content 1fr max-content;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";align-items:center;background:", p => p.theme.backgroundSecondary, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(2), ";&:not(:first-of-type){border-top:1px solid ", p => p.theme.innerBorder, ";}" + ( true ? "" : 0));

const Count = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1p43amg1"
} : 0)("font-size:", p => p.theme.fontSizeSmall, ";color:", p => p.theme.gray300, ";" + ( true ? "" : 0));

const Empty = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1p43amg0"
} : 0)("display:flex;align-items:center;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(2), ";color:", p => p.theme.subText, ";font-size:", p => p.theme.fontSizeMedium, ";border-top:1px solid ", p => p.theme.innerBorder, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (HelpSearch);

/***/ }),

/***/ "./app/components/hook.tsx":
/*!*********************************!*\
  !*** ./app/components/hook.tsx ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_stores_hookStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/hookStore */ "./app/stores/hookStore.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






/**
 * Instead of accessing the HookStore directly, use this.
 *
 * If the hook slot needs to perform anything w/ the hooks, you can pass a
 * function as a child and you will receive an object with a `hooks` key
 *
 * Example:
 *
 *   <Hook name="my-hook">
 *     {({hooks}) => hooks.map(hook => (
 *       <Wrapper>{hook}</Wrapper>
 *     ))}
 *   </Hook>
 */
function Hook(_ref) {
  let {
    name,
    ...props
  } = _ref;

  class HookComponent extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
    constructor() {
      super(...arguments);

      (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
        hooks: sentry_stores_hookStore__WEBPACK_IMPORTED_MODULE_3__["default"].get(name).map(cb => cb(props))
      });

      (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "unsubscribe", sentry_stores_hookStore__WEBPACK_IMPORTED_MODULE_3__["default"].listen((hookName, hooks) => this.handleHooks(hookName, hooks), undefined));
    }

    componentWillUnmount() {
      this.unsubscribe();
    }

    handleHooks(hookName, hooks) {
      // Make sure that the incoming hook update matches this component's hook name
      if (hookName !== name) {
        return;
      }

      this.setState({
        hooks: hooks.map(cb => cb(props))
      });
    }

    render() {
      const {
        children
      } = props;

      if (!this.state.hooks || !this.state.hooks.length) {
        return null;
      }

      if (typeof children === 'function') {
        return children({
          hooks: this.state.hooks
        });
      }

      return this.state.hooks;
    }

  }

  HookComponent.displayName = "HookComponent";

  (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(HookComponent, "displayName", `Hook(${name})`);

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(HookComponent, {});
}

Hook.displayName = "Hook";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Hook);

/***/ }),

/***/ "./app/components/modals/helpSearchModal.tsx":
/*!***************************************************!*\
  !*** ./app/components/modals/helpSearchModal.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "modalCss": () => (/* binding */ modalCss)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_components_helpSearch__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/helpSearch */ "./app/components/helpSearch.tsx");
/* harmony import */ var sentry_components_hook__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/hook */ "./app/components/hook.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









function HelpSearchModal(_ref) {
  let {
    Body,
    closeModal,
    organization,
    placeholder = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Search for documentation, FAQs, blog posts...'),
    ...props
  } = _ref;
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_6__.a)();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Body, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(_emotion_react__WEBPACK_IMPORTED_MODULE_8__.ClassNames, {
      children: _ref2 => {
        let {
          css: injectedCss
        } = _ref2;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_helpSearch__WEBPACK_IMPORTED_MODULE_1__["default"], { ...props,
          entryPoint: "sidebar_help",
          dropdownClassName: injectedCss`
                width: 100%;
                border: transparent;
                border-top-left-radius: 0;
                border-top-right-radius: 0;
                position: initial;
                box-shadow: none;
                border-top: 1px solid ${theme.border};
              `,
          renderInput: _ref3 => {
            let {
              getInputProps
            } = _ref3;
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(InputWrapper, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Input, {
                autoFocus: true,
                ...getInputProps({
                  type: 'text',
                  placeholder
                })
              })
            });
          },
          resultFooter: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_hook__WEBPACK_IMPORTED_MODULE_2__["default"], {
            name: "help-modal:footer",
            organization,
            closeModal
          })
        });
      }
    })
  });
}

HelpSearchModal.displayName = "HelpSearchModal";

const InputWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eqc3qkw1"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(0.25), ";" + ( true ? "" : 0));

const Input = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('input',  true ? {
  target: "eqc3qkw0"
} : 0)("width:100%;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1), ";border:none;border-radius:8px;outline:none;&:focus{outline:none;}" + ( true ? "" : 0));

const modalCss =  true ? {
  name: "1cwzvuz",
  styles: "[role='document']{padding:0;}"
} : 0;
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_5__["default"])(HelpSearchModal));

/***/ }),

/***/ "./app/components/search/sources/helpSource.tsx":
/*!******************************************************!*\
  !*** ./app/components/search/sources/helpSource.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "HelpSource": () => (/* binding */ HelpSource),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _sentry_internal_global_search__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @sentry-internal/global-search */ "../node_modules/@sentry-internal/global-search/dist/index.js");
/* harmony import */ var _sentry_internal_global_search__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(_sentry_internal_global_search__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var dompurify__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! dompurify */ "../node_modules/dompurify/dist/purify.js");
/* harmony import */ var dompurify__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(dompurify__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var sentry_utils_parseHtmlMarks__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/parseHtmlMarks */ "./app/utils/parseHtmlMarks.tsx");
/* harmony import */ var sentry_utils_withLatestContext__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/withLatestContext */ "./app/utils/withLatestContext.tsx");


 // eslint-disable-next-line no-restricted-imports







const MARK_TAGS = {
  highlightPreTag: '<mark>',
  highlightPostTag: '</mark>'
};

class HelpSource extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      loading: false,
      results: []
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "search", new _sentry_internal_global_search__WEBPACK_IMPORTED_MODULE_4__.SentryGlobalSearch(['docs', 'help-center', 'develop', 'blog']));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "doSearch", lodash_debounce__WEBPACK_IMPORTED_MODULE_6___default()(this.unbouncedSearch, 300));
  }

  componentDidMount() {
    if (this.props.query !== undefined) {
      this.doSearch(this.props.query);
    }
  }

  componentDidUpdate(nextProps) {
    if (nextProps.query !== this.props.query) {
      this.doSearch(nextProps.query);
    }
  }

  async unbouncedSearch(query) {
    this.setState({
      loading: true
    });
    const {
      platforms = []
    } = this.props;
    const searchResults = await this.search.query(query, {
      platforms: platforms.map(platform => {
        var _standardSDKSlug;

        return (_standardSDKSlug = (0,_sentry_internal_global_search__WEBPACK_IMPORTED_MODULE_4__.standardSDKSlug)(platform)) === null || _standardSDKSlug === void 0 ? void 0 : _standardSDKSlug.slug;
      })
    });
    const results = mapSearchResults(searchResults);
    this.setState({
      loading: false,
      results
    });
  }

  render() {
    return this.props.children({
      isLoading: this.state.loading,
      results: this.state.results
    });
  }

}

HelpSource.displayName = "HelpSource";

function mapSearchResults(results) {
  const items = [];
  results.forEach(section => {
    const sectionItems = section.hits.map(hit => {
      var _hit$title, _hit$text, _hit$title2;

      const title = (0,sentry_utils_parseHtmlMarks__WEBPACK_IMPORTED_MODULE_7__["default"])({
        key: 'title',
        htmlString: (_hit$title = hit.title) !== null && _hit$title !== void 0 ? _hit$title : '',
        markTags: MARK_TAGS
      });
      const description = (0,sentry_utils_parseHtmlMarks__WEBPACK_IMPORTED_MODULE_7__["default"])({
        key: 'description',
        htmlString: (_hit$text = hit.text) !== null && _hit$text !== void 0 ? _hit$text : '',
        markTags: MARK_TAGS
      });
      const item = { ...hit,
        sourceType: 'help',
        resultType: `help-${hit.site}`,
        title: dompurify__WEBPACK_IMPORTED_MODULE_5___default().sanitize((_hit$title2 = hit.title) !== null && _hit$title2 !== void 0 ? _hit$title2 : ''),
        extra: hit.context.context1,
        description: hit.text ? dompurify__WEBPACK_IMPORTED_MODULE_5___default().sanitize(hit.text) : undefined,
        to: hit.url
      };
      return {
        item,
        matches: [title, description],
        score: 1,
        refIndex: 0
      };
    }); // The first element should indicate the section.

    if (sectionItems.length > 0) {
      sectionItems[0].item.sectionHeading = section.name;
      sectionItems[0].item.sectionCount = sectionItems.length;
      items.push(...sectionItems);
      return;
    } // If we didn't have any results for this section mark it as empty


    const emptyHeaderItem = {
      sourceType: 'help',
      resultType: `help-${section.site}`,
      title: `No results in ${section.name}`,
      sectionHeading: section.name,
      empty: true
    };
    items.push({
      item: emptyHeaderItem,
      score: 1,
      refIndex: 0
    });
  });
  return items;
}


/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withLatestContext__WEBPACK_IMPORTED_MODULE_8__["default"])((0,react_router__WEBPACK_IMPORTED_MODULE_3__.withRouter)(HelpSource)));

/***/ }),

/***/ "./app/components/tagDeprecated.tsx":
/*!******************************************!*\
  !*** ./app/components/tagDeprecated.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






/**
 * Get priority from alerts or badge styles
 */
const getPriority = p => {
  if (p.priority) {
    var _ref, _p$theme$alert$p$prio;

    return (_ref = (_p$theme$alert$p$prio = p.theme.alert[p.priority]) !== null && _p$theme$alert$p$prio !== void 0 ? _p$theme$alert$p$prio : p.theme.badge[p.priority]) !== null && _ref !== void 0 ? _ref : null;
  }

  return null;
};

const getMarginLeft = p => p.inline ? `margin-left: ${p.size === 'small' ? '0.25em' : '0.5em'};` : '';

const getBorder = p => {
  var _getPriority$border, _getPriority;

  return p.border ? `border: 1px solid ${(_getPriority$border = (_getPriority = getPriority(p)) === null || _getPriority === void 0 ? void 0 : _getPriority.border) !== null && _getPriority$border !== void 0 ? _getPriority$border : p.theme.border};` : '';
};

const Tag = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_ref2 => {
  let {
    children,
    icon,
    inline: _inline,
    priority: _priority,
    size: _size,
    border: _border,
    ...props
  } = _ref2;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", { ...props,
    children: [icon && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(IconWrapper, {
      children: /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.isValidElement)(icon) && /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.cloneElement)(icon, {
        size: 'xs'
      })
    }), children]
  });
},  true ? {
  target: "ewer3pn1"
} : 0)("display:inline-flex;box-sizing:border-box;padding:", p => p.size === 'small' ? '0.1em 0.4em 0.2em' : '0.35em 0.8em 0.4em', ";font-size:", p => p.theme.fontSizeExtraSmall, ";line-height:1;color:", p => p.priority ? p.theme.background : p.theme.textColor, ";text-align:center;white-space:nowrap;vertical-align:middle;align-items:center;border-radius:", p => p.size === 'small' ? '0.25em' : '2em', ";text-transform:lowercase;font-weight:", p => p.size === 'small' ? 'bold' : 'normal', ";background:", p => {
  var _getPriority$backgrou, _getPriority2;

  return (_getPriority$backgrou = (_getPriority2 = getPriority(p)) === null || _getPriority2 === void 0 ? void 0 : _getPriority2.background) !== null && _getPriority$backgrou !== void 0 ? _getPriority$backgrou : p.theme.gray100;
}, ";", p => getBorder(p), ";", p => getMarginLeft(p), ";" + ( true ? "" : 0));

const IconWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "ewer3pn0"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(0.5), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Tag);

/***/ }),

/***/ "./app/utils/parseHtmlMarks.tsx":
/*!**************************************!*\
  !*** ./app/utils/parseHtmlMarks.tsx ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ parseHtmlMarks)
/* harmony export */ });
/**
 * Parses the "marked" html strings into a {key, value, indices} (mimincing the
 * FuseResultMatch type) object, where the indices are a set of zero indexed
 * [start, end] indices for what should be highlighted.
 *
 * @param key The key of the field, this mimics the Fuse match object
 * @param htmlString The html string to parse
 * @param markTags.highlightPreTag The left tag
 * @param markTags.highlightPostTag The right tag
 */
function parseHtmlMarks(_ref) {
  let {
    key,
    htmlString,
    markTags
  } = _ref;
  const {
    highlightPreTag,
    highlightPostTag
  } = markTags;
  const indices = [];
  let value = htmlString; // eslint-disable-next-line no-constant-condition

  while (true) {
    const openIndex = value.indexOf(highlightPreTag);
    const openIndexEnd = openIndex + highlightPreTag.length;

    if (openIndex === -1 || value.indexOf(highlightPostTag) === -1) {
      break;
    }

    value = value.slice(0, openIndex) + value.slice(openIndexEnd);
    const closeIndex = value.indexOf(highlightPostTag);
    const closeIndexEnd = closeIndex + highlightPostTag.length;
    value = value.slice(0, closeIndex) + value.slice(closeIndexEnd);
    indices.push([openIndex, closeIndex - 1]);
  }

  return {
    key,
    value,
    indices
  };
}

/***/ }),

/***/ "?db25":
/*!**********************************!*\
  !*** ./WritableStream (ignored) ***!
  \**********************************/
/***/ (() => {

/* (ignored) */

/***/ }),

/***/ "?71ff":
/*!********************!*\
  !*** vm (ignored) ***!
  \********************/
/***/ (() => {

/* (ignored) */

/***/ }),

/***/ "?0699":
/*!************************!*\
  !*** buffer (ignored) ***!
  \************************/
/***/ (() => {

/* (ignored) */

/***/ }),

/***/ "?1357":
/*!************************!*\
  !*** crypto (ignored) ***!
  \************************/
/***/ (() => {

/* (ignored) */

/***/ }),

/***/ "?d941":
/*!************************!*\
  !*** stream (ignored) ***!
  \************************/
/***/ (() => {

/* (ignored) */

/***/ }),

/***/ "?94ca":
/*!************************!*\
  !*** stream (ignored) ***!
  \************************/
/***/ (() => {

/* (ignored) */

/***/ }),

/***/ "?3018":
/*!************************!*\
  !*** stream (ignored) ***!
  \************************/
/***/ (() => {

/* (ignored) */

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_featureBadge_tsx-app_components_modals_helpSearchModal_tsx.33f0b205a2512e1bdc43eab7e2848ee5.js.map