"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_actionCreators_navigation_tsx-app_components_eventOrGroupHeader_tsx-app_components_layout-58d688"],{

/***/ "./app/actionCreators/navigation.tsx":
/*!*******************************************!*\
  !*** ./app/actionCreators/navigation.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "navigateTo": () => (/* binding */ navigateTo)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_contextPickerModal__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/contextPickerModal */ "./app/components/contextPickerModal.tsx");
/* harmony import */ var sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/projectsStore */ "./app/stores/projectsStore.tsx");
/* harmony import */ var sentry_utils_replaceRouterParams__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/replaceRouterParams */ "./app/utils/replaceRouterParams.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




 // TODO(ts): figure out better typing for react-router here


function navigateTo(to, router, configUrl) {
  var _router$location, _router$location$quer;

  // Check for placeholder params
  const needOrg = to.includes(':orgId');
  const needProject = to.includes(':projectId') || to.includes(':project');
  const comingFromProjectId = router === null || router === void 0 ? void 0 : (_router$location = router.location) === null || _router$location === void 0 ? void 0 : (_router$location$quer = _router$location.query) === null || _router$location$quer === void 0 ? void 0 : _router$location$quer.project;
  const needProjectId = !comingFromProjectId || Array.isArray(comingFromProjectId);
  const projectById = sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_3__["default"].getById(comingFromProjectId);

  if (needOrg || needProject && (needProjectId || !projectById) || configUrl) {
    (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_1__.openModal)(modalProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_contextPickerModal__WEBPACK_IMPORTED_MODULE_2__["default"], { ...modalProps,
      nextPath: to,
      needOrg: needOrg,
      needProject: needProject,
      configUrl: configUrl,
      comingFromProjectId: Array.isArray(comingFromProjectId) ? '' : comingFromProjectId || '',
      onFinish: path => {
        modalProps.closeModal();
        return window.setTimeout(() => router.push(path), 0);
      }
    }), {});
  } else {
    if (projectById) {
      to = (0,sentry_utils_replaceRouterParams__WEBPACK_IMPORTED_MODULE_4__["default"])(to, {
        projectId: projectById.slug,
        project: projectById.id
      });
    }

    router.push(to);
  }
}

/***/ }),

/***/ "./app/actionCreators/prompts.tsx":
/*!****************************************!*\
  !*** ./app/actionCreators/prompts.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "batchedPromptsCheck": () => (/* binding */ batchedPromptsCheck),
/* harmony export */   "promptsCheck": () => (/* binding */ promptsCheck),
/* harmony export */   "promptsUpdate": () => (/* binding */ promptsUpdate)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);


/**
 * Update the status of a prompt
 */
function promptsUpdate(api, params) {
  return api.requestPromise('/prompts-activity/', {
    method: 'PUT',
    data: {
      organization_id: params.organizationId,
      project_id: params.projectId,
      feature: params.feature,
      status: params.status
    }
  });
}

/**
 * Get the status of a prompt
 */
async function promptsCheck(api, params) {
  const query = {
    feature: params.feature,
    organization_id: params.organizationId,
    ...(params.projectId === undefined ? {} : {
      project_id: params.projectId
    })
  };
  const response = await api.requestPromise('/prompts-activity/', {
    query
  });

  if (response !== null && response !== void 0 && response.data) {
    return {
      dismissedTime: response.data.dismissed_ts,
      snoozedTime: response.data.snoozed_ts
    };
  }

  return null;
}
/**
 * Get the status of many prompt
 */

async function batchedPromptsCheck(api, features, params) {
  const query = {
    feature: features,
    organization_id: params.organizationId,
    ...(params.projectId === undefined ? {} : {
      project_id: params.projectId
    })
  };
  const response = await api.requestPromise('/prompts-activity/', {
    query
  });
  const responseFeatures = response === null || response === void 0 ? void 0 : response.features;
  const result = {};

  if (!responseFeatures) {
    return result;
  }

  for (const featureName of features) {
    const item = responseFeatures[featureName];

    if (item) {
      result[featureName] = {
        dismissedTime: item.dismissed_ts,
        snoozedTime: item.snoozed_ts
      };
    } else {
      result[featureName] = null;
    }
  }

  return result;
}

/***/ }),

/***/ "./app/components/clippedBox.tsx":
/*!***************************************!*\
  !*** ./app/components/clippedBox.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_dom__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-dom */ "../node_modules/react-dom/profiling.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var color__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! color */ "../node_modules/color/index.js");
/* harmony import */ var color__WEBPACK_IMPORTED_MODULE_10___default = /*#__PURE__*/__webpack_require__.n(color__WEBPACK_IMPORTED_MODULE_10__);
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }











class ClippedBox extends react__WEBPACK_IMPORTED_MODULE_3__.PureComponent {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      isClipped: !!this.props.defaultClipped,
      isRevealed: false,
      // True once user has clicked "Show More" button
      renderedHeight: this.props.renderedHeight
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "reveal", () => {
      const {
        onReveal
      } = this.props;
      this.setState({
        isClipped: false,
        isRevealed: true
      });

      if (onReveal) {
        onReveal();
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleClickReveal", event => {
      event.stopPropagation();
      this.reveal();
    });
  }

  componentDidMount() {
    var _this$props$onSetRend, _this$props;

    // eslint-disable-next-line react/no-find-dom-node
    const renderedHeight = (0,react_dom__WEBPACK_IMPORTED_MODULE_4__.findDOMNode)(this).offsetHeight;
    (_this$props$onSetRend = (_this$props = this.props).onSetRenderedHeight) === null || _this$props$onSetRend === void 0 ? void 0 : _this$props$onSetRend.call(_this$props, renderedHeight);
    this.calcHeight(renderedHeight);
  }

  componentDidUpdate(_prevProps, prevState) {
    if (prevState.renderedHeight !== this.props.renderedHeight) {
      this.setRenderedHeight();
    }

    if (prevState.renderedHeight !== this.state.renderedHeight) {
      this.calcHeight(this.state.renderedHeight);
    }

    if (this.state.isRevealed || !this.state.isClipped) {
      return;
    }

    if (!this.props.renderedHeight) {
      // eslint-disable-next-line react/no-find-dom-node
      const renderedHeight = (0,react_dom__WEBPACK_IMPORTED_MODULE_4__.findDOMNode)(this).offsetHeight;

      if (renderedHeight < this.props.clipHeight) {
        this.reveal();
      }
    }
  }

  setRenderedHeight() {
    this.setState({
      renderedHeight: this.props.renderedHeight
    });
  }

  calcHeight(renderedHeight) {
    if (!renderedHeight) {
      return;
    }

    if (!this.state.isClipped && renderedHeight > this.props.clipHeight) {
      /* eslint react/no-did-mount-set-state:0 */
      // okay if this causes re-render; cannot determine until
      // rendered first anyways
      this.setState({
        isClipped: true
      });
    }
  }

  render() {
    var _clipFade;

    const {
      isClipped,
      isRevealed
    } = this.state;
    const {
      title,
      children,
      clipHeight,
      btnText,
      className,
      clipFade
    } = this.props;

    const showMoreButton = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
      onClick: this.reveal,
      priority: "primary",
      size: "xs",
      "aria-label": btnText !== null && btnText !== void 0 ? btnText : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Show More'),
      children: btnText
    });

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(Wrapper, {
      clipHeight: clipHeight,
      isClipped: isClipped,
      isRevealed: isRevealed,
      className: className,
      children: [title && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(Title, {
        children: title
      }), children, isClipped && ((_clipFade = clipFade === null || clipFade === void 0 ? void 0 : clipFade({
        showMoreButton
      })) !== null && _clipFade !== void 0 ? _clipFade : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(ClipFade, {
        children: showMoreButton
      }))]
    });
  }

}

ClippedBox.displayName = "ClippedBox";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(ClippedBox, "defaultProps", {
  defaultClipped: false,
  clipHeight: 200,
  btnText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Show More')
});

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ClippedBox);

var _ref =  true ? {
  name: "wdu9dr",
  styles: "transition:all 5s ease-in-out;max-height:50000px"
} : 0;

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  shouldForwardProp: prop => prop !== 'clipHeight' && prop !== 'isClipped' && prop !== 'isRevealed',
  target: "easm7v12"
} : 0)("position:relative;border-top:1px solid ", p => p.theme.backgroundSecondary, ";margin-left:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(3), ";margin-right:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(3), ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(3), " 0;:first-of-type{margin-top:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(2), ";border:0;}", p => p.isRevealed && _ref, ";", p => p.isClipped && /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_9__.css)("max-height:", p.clipHeight, "px;overflow:hidden;" + ( true ? "" : 0),  true ? "" : 0), ";" + ( true ? "" : 0));

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('h5',  true ? {
  target: "easm7v11"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(2), ";" + ( true ? "" : 0));

const ClipFade = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "easm7v10"
} : 0)("position:absolute;left:0;right:0;bottom:0;padding:40px 0 0;background-image:linear-gradient(\n    180deg,\n    ", p => color__WEBPACK_IMPORTED_MODULE_10___default()(p.theme.background).alpha(0.15).string(), ",\n    ", p => p.theme.background, "\n  );text-align:center;border-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1.5), " solid ", p => p.theme.background, ";pointer-events:none;>*{pointer-events:auto;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/contextData/index.tsx":
/*!**********************************************!*\
  !*** ./app/components/contextData/index.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_isArray__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/isArray */ "../node_modules/lodash/isArray.js");
/* harmony import */ var lodash_isArray__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_isArray__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var lodash_isNumber__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/isNumber */ "../node_modules/lodash/isNumber.js");
/* harmony import */ var lodash_isNumber__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_isNumber__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var lodash_isString__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/isString */ "../node_modules/lodash/isString.js");
/* harmony import */ var lodash_isString__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_isString__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_events_meta_annotatedText__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/events/meta/annotatedText */ "./app/components/events/meta/annotatedText/index.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _toggle__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./toggle */ "./app/components/contextData/toggle.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./utils */ "./app/components/contextData/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }















function walk(_ref) {
  let {
    depth,
    value = null,
    maxDefaultDepth: maxDepth = 2,
    preserveQuotes,
    withAnnotatedText,
    jsonConsts,
    meta
  } = _ref;
  let i = 0;
  const children = [];

  if (value === null) {
    var _meta$;

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("span", {
      className: "val-null",
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_events_meta_annotatedText__WEBPACK_IMPORTED_MODULE_5__["default"], {
        value: jsonConsts ? 'null' : 'None',
        meta: (_meta$ = meta === null || meta === void 0 ? void 0 : meta['']) !== null && _meta$ !== void 0 ? _meta$ : meta
      })
    });
  }

  if (value === true || value === false) {
    var _meta$2;

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("span", {
      className: "val-bool",
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_events_meta_annotatedText__WEBPACK_IMPORTED_MODULE_5__["default"], {
        value: jsonConsts ? value ? 'true' : 'false' : value ? 'True' : 'False',
        meta: (_meta$2 = meta === null || meta === void 0 ? void 0 : meta['']) !== null && _meta$2 !== void 0 ? _meta$2 : meta
      })
    });
  }

  if (lodash_isString__WEBPACK_IMPORTED_MODULE_4___default()(value)) {
    var _meta$3;

    const valueInfo = (0,_utils__WEBPACK_IMPORTED_MODULE_11__.analyzeStringForRepr)(value);
    const valueToBeReturned = withAnnotatedText ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_events_meta_annotatedText__WEBPACK_IMPORTED_MODULE_5__["default"], {
      value: valueInfo.repr,
      meta: (_meta$3 = meta === null || meta === void 0 ? void 0 : meta['']) !== null && _meta$3 !== void 0 ? _meta$3 : meta
    }) : valueInfo.repr;
    const out = [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("span", {
      className: (valueInfo.isString ? 'val-string' : '') + (valueInfo.isStripped ? ' val-stripped' : '') + (valueInfo.isMultiLine ? ' val-string-multiline' : ''),
      children: preserveQuotes ? `"${valueToBeReturned}"` : valueToBeReturned
    }, "value")];

    if (valueInfo.isString && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_9__.isUrl)(value)) {
      out.push((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_6__["default"], {
        href: value,
        className: "external-icon",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(StyledIconOpen, {
          size: "xs",
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Open link')
        })
      }, "external"));
    }

    return out;
  }

  if (lodash_isNumber__WEBPACK_IMPORTED_MODULE_3___default()(value)) {
    var _meta$4;

    const valueToBeReturned = withAnnotatedText && meta ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_events_meta_annotatedText__WEBPACK_IMPORTED_MODULE_5__["default"], {
      value: value,
      meta: (_meta$4 = meta === null || meta === void 0 ? void 0 : meta['']) !== null && _meta$4 !== void 0 ? _meta$4 : meta
    }) : value;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("span", {
      children: valueToBeReturned
    });
  }

  if (lodash_isArray__WEBPACK_IMPORTED_MODULE_2___default()(value)) {
    for (i = 0; i < value.length; i++) {
      var _ref2, _ref3, _meta$i$, _meta$i;

      children.push((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)("span", {
        className: "val-array-item",
        children: [walk({
          value: value[i],
          depth: depth + 1,
          preserveQuotes,
          withAnnotatedText,
          jsonConsts,
          meta: (_ref2 = (_ref3 = (_meta$i$ = meta === null || meta === void 0 ? void 0 : (_meta$i = meta[i]) === null || _meta$i === void 0 ? void 0 : _meta$i['']) !== null && _meta$i$ !== void 0 ? _meta$i$ : meta === null || meta === void 0 ? void 0 : meta[i]) !== null && _ref3 !== void 0 ? _ref3 : meta === null || meta === void 0 ? void 0 : meta['']) !== null && _ref2 !== void 0 ? _ref2 : meta
        }), i < value.length - 1 ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("span", {
          className: "val-array-sep",
          children: ', '
        }) : null]
      }, i));
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)("span", {
      className: "val-array",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("span", {
        className: "val-array-marker",
        children: '['
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(_toggle__WEBPACK_IMPORTED_MODULE_10__["default"], {
        highUp: depth <= maxDepth,
        wrapClassName: "val-array-items",
        children: children
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("span", {
        className: "val-array-marker",
        children: ']'
      })]
    });
  }

  if ( /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.isValidElement)(value)) {
    return value;
  }

  const keys = Object.keys(value);
  keys.sort(_utils__WEBPACK_IMPORTED_MODULE_11__.naturalCaseInsensitiveSort);

  for (i = 0; i < keys.length; i++) {
    var _ref4, _ref5, _meta$key$, _meta$key;

    const key = keys[i];
    children.push((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)("span", {
      className: "val-dict-pair",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("span", {
        className: "val-dict-key",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("span", {
          className: "val-string",
          children: preserveQuotes ? `"${key}"` : key
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("span", {
        className: "val-dict-col",
        children: ': '
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)("span", {
        className: "val-dict-value",
        children: [walk({
          value: value[key],
          depth: depth + 1,
          preserveQuotes,
          withAnnotatedText,
          jsonConsts,
          meta: (_ref4 = (_ref5 = (_meta$key$ = meta === null || meta === void 0 ? void 0 : (_meta$key = meta[key]) === null || _meta$key === void 0 ? void 0 : _meta$key['']) !== null && _meta$key$ !== void 0 ? _meta$key$ : meta === null || meta === void 0 ? void 0 : meta[key]) !== null && _ref5 !== void 0 ? _ref5 : meta === null || meta === void 0 ? void 0 : meta['']) !== null && _ref4 !== void 0 ? _ref4 : meta
        }), i < keys.length - 1 ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("span", {
          className: "val-dict-sep",
          children: ', '
        }) : null]
      })]
    }, key));
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)("span", {
    className: "val-dict",
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("span", {
      className: "val-dict-marker",
      children: '{'
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(_toggle__WEBPACK_IMPORTED_MODULE_10__["default"], {
      highUp: depth <= maxDepth - 1,
      wrapClassName: "val-dict-items",
      children: children
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("span", {
      className: "val-dict-marker",
      children: '}'
    })]
  });
}

walk.displayName = "walk";

function ContextData(_ref6) {
  let {
    children,
    meta,
    jsonConsts,
    maxDefaultDepth,
    data = null,
    preserveQuotes = false,
    withAnnotatedText = false,
    ...props
  } = _ref6;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)("pre", { ...props,
    children: [walk({
      value: data,
      depth: 0,
      maxDefaultDepth,
      meta,
      jsonConsts,
      withAnnotatedText,
      preserveQuotes
    }), children]
  });
}

ContextData.displayName = "ContextData";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ContextData);

const StyledIconOpen = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconOpen,  true ? {
  target: "e14tlc9l0"
} : 0)( true ? {
  name: "1w4n49d",
  styles: "position:relative;top:1px"
} : 0);

/***/ }),

/***/ "./app/components/contextData/toggle.tsx":
/*!***********************************************!*\
  !*** ./app/components/contextData/toggle.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








function Toggle(_ref) {
  let {
    highUp,
    wrapClassName,
    children
  } = _ref;
  const [isExpanded, setIsExpanded] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(false);

  if (react__WEBPACK_IMPORTED_MODULE_2__.Children.count(children) === 0) {
    return null;
  }

  const wrappedChildren = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("span", {
    className: wrapClassName,
    children: children
  });

  if (highUp) {
    return wrappedChildren;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("span", {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(IconWrapper, {
      "aria-label": isExpanded ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Collapse') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Expand'),
      isExpanded: isExpanded,
      onClick: evt => {
        setIsExpanded(!isExpanded);
        evt.preventDefault();
      },
      children: isExpanded ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconSubtract, {
        size: "9px",
        color: "white"
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconAdd, {
        size: "9px",
        color: "white"
      })
    }), isExpanded && wrappedChildren]
  });
}

Toggle.displayName = "Toggle";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Toggle);

const IconWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "exjkl3t0"
} : 0)("border-radius:2px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;", p => p.isExpanded ? `
          background: ${p.theme.gray300};
          border: 1px solid ${p.theme.gray300};
          &:hover {
            background: ${p.theme.gray400};
          }
        ` : `
          background: ${p.theme.blue300};
          border: 1px solid ${p.theme.blue300};
          &:hover {
            background: ${p.theme.blue200};
          }
        `, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/contextData/utils.tsx":
/*!**********************************************!*\
  !*** ./app/components/contextData/utils.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "analyzeStringForRepr": () => (/* binding */ analyzeStringForRepr),
/* harmony export */   "looksLikeMultiLineString": () => (/* binding */ looksLikeMultiLineString),
/* harmony export */   "looksLikeObjectRepr": () => (/* binding */ looksLikeObjectRepr),
/* harmony export */   "naturalCaseInsensitiveSort": () => (/* binding */ naturalCaseInsensitiveSort),
/* harmony export */   "padNumbersInString": () => (/* binding */ padNumbersInString)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__);

function looksLikeObjectRepr(value) {
  const a = value[0];
  const z = value[value.length - 1];

  if (a === '<' && z === '>') {
    return true;
  }

  if (a === '[' && z === ']') {
    return true;
  }

  if (a === '(' && z === ')') {
    return true;
  }

  if (z === ')' && value.match(/^[\w\d._-]+\(/)) {
    return true;
  }

  return false;
}
function looksLikeMultiLineString(value) {
  return !!value.match(/[\r\n]/);
}
function padNumbersInString(string) {
  return string.replace(/(\d+)/g, num => {
    let isNegative = false;
    let realNum = parseInt(num, 10);

    if (realNum < 0) {
      realNum *= -1;
      isNegative = true;
    }

    let s = '0000000000000' + realNum;
    s = s.substr(s.length - (isNegative ? 11 : 12));

    if (isNegative) {
      s = '-' + s;
    }

    return s;
  });
}
function naturalCaseInsensitiveSort(a, b) {
  a = padNumbersInString(a).toLowerCase();
  b = padNumbersInString(b).toLowerCase();
  return a === b ? 0 : a < b ? -1 : 1;
}
function analyzeStringForRepr(value) {
  const rv = {
    repr: value,
    isString: true,
    isMultiLine: false,
    isStripped: false
  }; // stripped for security reasons

  if (value.match(/^['"]?\*{8,}['"]?$/)) {
    rv.isStripped = true;
    return rv;
  }

  if (looksLikeObjectRepr(value)) {
    rv.isString = false;
    return rv;
  }

  rv.isMultiLine = looksLikeMultiLineString(value);
  return rv;
}

/***/ }),

/***/ "./app/components/contextPickerModal.tsx":
/*!***********************************************!*\
  !*** ./app/components/contextPickerModal.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_dom__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-dom */ "../node_modules/react-dom/profiling.js");
/* harmony import */ var react_select__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! react-select */ "../node_modules/react-select/dist/index-4322c0ed.browser.esm.js");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/idBadge */ "./app/components/idBadge/index.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_stores_organizationsStore__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/stores/organizationsStore */ "./app/stores/organizationsStore.tsx");
/* harmony import */ var sentry_stores_organizationStore__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/stores/organizationStore */ "./app/stores/organizationStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_projects__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/projects */ "./app/utils/projects.tsx");
/* harmony import */ var sentry_utils_replaceRouterParams__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/replaceRouterParams */ "./app/utils/replaceRouterParams.tsx");
/* harmony import */ var sentry_views_organizationIntegrations_integrationIcon__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/views/organizationIntegrations/integrationIcon */ "./app/views/organizationIntegrations/integrationIcon.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }



















const selectStyles = {
  menu: provided => ({ ...provided,
    position: 'initial',
    boxShadow: 'none',
    marginBottom: 0
  }),
  option: (provided, state) => ({ ...provided,
    opacity: state.isDisabled ? 0.6 : 1,
    cursor: state.isDisabled ? 'not-allowed' : 'pointer',
    pointerEvents: state.isDisabled ? 'none' : 'auto'
  })
};

class ContextPickerModal extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    var _this;

    super(...arguments);
    _this = this;

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onFinishTimeout", undefined);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "orgSelect", null);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "projectSelect", null);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "configSelect", null);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "navigateIfFinish", function (organizations, projects) {
      var _onFinish2, _this$props$projects$;

      let latestOrg = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : _this.props.organization;
      const {
        needProject,
        onFinish,
        nextPath,
        integrationConfigs
      } = _this.props;
      const {
        isSuperuser
      } = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_11__["default"].get('user') || {}; // If no project is needed and theres only 1 org OR
      // if we need a project and there's only 1 project
      // then return because we can't navigate anywhere yet

      if (!needProject && organizations.length !== 1 || needProject && projects.length !== 1 || integrationConfigs.length && isSuperuser) {
        return;
      }

      window.clearTimeout(_this.onFinishTimeout); // If there is only one org and we don't need a project slug, then call finish callback

      if (!needProject) {
        var _onFinish;

        _this.onFinishTimeout = (_onFinish = onFinish((0,sentry_utils_replaceRouterParams__WEBPACK_IMPORTED_MODULE_16__["default"])(nextPath, {
          orgId: organizations[0].slug
        }))) !== null && _onFinish !== void 0 ? _onFinish : undefined;
        return;
      } // Use latest org or if only 1 org, use that


      let org = latestOrg;

      if (!org && organizations.length === 1) {
        org = organizations[0].slug;
      }

      _this.onFinishTimeout = (_onFinish2 = onFinish((0,sentry_utils_replaceRouterParams__WEBPACK_IMPORTED_MODULE_16__["default"])(nextPath, {
        orgId: org,
        projectId: projects[0].slug,
        project: (_this$props$projects$ = _this.props.projects.find(p => p.slug === projects[0].slug)) === null || _this$props$projects$ === void 0 ? void 0 : _this$props$projects$.id
      }))) !== null && _onFinish2 !== void 0 ? _onFinish2 : undefined;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "doFocus", ref => {
      if (!ref || this.props.loading) {
        return;
      } // eslint-disable-next-line react/no-find-dom-node


      const el = (0,react_dom__WEBPACK_IMPORTED_MODULE_4__.findDOMNode)(ref);

      if (el !== null) {
        const input = el.querySelector('input');
        input && input.focus();
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSelectOrganization", _ref => {
      let {
        value
      } = _ref;

      // If we do not need to select a project, we can early return after selecting an org
      // No need to fetch org details
      if (!this.props.needProject) {
        this.navigateIfFinish([{
          slug: value
        }], []);
        return;
      }

      this.props.onSelectOrganization(value);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSelectProject", _ref2 => {
      let {
        value
      } = _ref2;
      const {
        organization
      } = this.props;

      if (!value || !organization) {
        return;
      }

      this.navigateIfFinish([{
        slug: organization
      }], [{
        slug: value
      }]);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSelectConfiguration", _ref3 => {
      let {
        value
      } = _ref3;
      const {
        onFinish,
        nextPath
      } = this.props;

      if (!value) {
        return;
      }

      onFinish(`${nextPath}${value}/`);
      return;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getMemberProjects", () => {
      const {
        projects
      } = this.props;
      const nonMemberProjects = [];
      const memberProjects = [];
      projects.forEach(project => project.isMember ? memberProjects.push(project) : nonMemberProjects.push(project));
      return [memberProjects, nonMemberProjects];
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onMenuOpen", function (ref, listItems, valueKey) {
      let currentSelected = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : '';
      // Hacky way to pre-focus to an item with newer versions of react select
      // See https://github.com/JedWatson/react-select/issues/3648
      setTimeout(() => {
        if (ref) {
          const choices = ref.select.state.menuOptions.focusable;
          const toBeFocused = listItems.find(_ref4 => {
            let {
              id
            } = _ref4;
            return id === currentSelected;
          });
          const selectedIndex = toBeFocused ? choices.findIndex(option => option.value === toBeFocused[valueKey]) : 0;

          if (selectedIndex >= 0 && toBeFocused) {
            // Focusing selected option only if it exists
            ref.select.scrollToFocusedOptionOnUpdate = true;
            ref.select.inputIsHiddenAfterUpdate = false;
            ref.select.setState({
              focusedValue: null,
              focusedOption: choices[selectedIndex]
            });
          }
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "customOptionProject", _ref5 => {
      let {
        label,
        ...props
      } = _ref5;
      const project = this.props.projects.find(_ref6 => {
        let {
          slug
        } = _ref6;
        return props.value === slug;
      });

      if (!project) {
        return null;
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(react_select__WEBPACK_IMPORTED_MODULE_19__.y.Option, {
        label: label,
        ...props,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(ProjectBadgeOption, {
          project: project,
          avatarSize: 20,
          displayName: label,
          avatarProps: {
            consistentWidth: true
          }
        })
      });
    });
  }

  componentDidMount() {
    const {
      organization,
      projects,
      organizations
    } = this.props; // Don't make any assumptions if there are multiple organizations

    if (organizations.length !== 1) {
      return;
    } // If there is an org in context (and there's only 1 org available),
    // attempt to see if we need more info from user and redirect otherwise


    if (organization) {
      // This will handle if we can intelligently move the user forward
      this.navigateIfFinish([{
        slug: organization
      }], projects);
      return;
    }
  }

  componentDidUpdate(prevProps) {
    // Component may be mounted before projects is fetched, check if we can finish when
    // component is updated with projects
    if (JSON.stringify(prevProps.projects) !== JSON.stringify(this.props.projects)) {
      this.navigateIfFinish(this.props.organizations, this.props.projects);
    }
  }

  componentWillUnmount() {
    window.clearTimeout(this.onFinishTimeout);
  }

  get headerText() {
    const {
      needOrg,
      needProject,
      integrationConfigs
    } = this.props;

    if (needOrg && needProject) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Select an organization and a project to continue');
    }

    if (needOrg) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Select an organization to continue');
    }

    if (needProject) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Select a project to continue');
    }

    if (integrationConfigs.length) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Select a configuration to continue');
    } // if neither project nor org needs to be selected, nothing will render anyways


    return '';
  }

  renderProjectSelectOrMessage() {
    const {
      organization,
      projects,
      comingFromProjectId
    } = this.props;
    const [memberProjects, nonMemberProjects] = this.getMemberProjects();
    const {
      isSuperuser
    } = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_11__["default"].get('user') || {};
    const projectOptions = [{
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('My Projects'),
      options: memberProjects.map(p => ({
        value: p.slug,
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)(`${p.slug}`),
        disabled: false
      }))
    }, {
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('All Projects'),
      options: nonMemberProjects.map(p => ({
        value: p.slug,
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)(`${p.slug}`),
        disabled: isSuperuser ? false : true
      }))
    }];

    if (!projects.length) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("div", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.tct)('You have no projects. Click [link] to make one.', {
          link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__["default"], {
            to: `/organizations/${organization}/projects/new/`,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('here')
          })
        })
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(StyledSelectControl, {
      ref: ref => {
        this.projectSelect = ref;
        this.doFocus(this.projectSelect);
      },
      placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Select a Project to continue'),
      name: "project",
      options: projectOptions,
      onChange: this.handleSelectProject,
      onMenuOpen: () => this.onMenuOpen(this.projectSelect, projects, 'slug', comingFromProjectId),
      components: {
        Option: this.customOptionProject,
        DropdownIndicator: null
      },
      styles: selectStyles,
      menuIsOpen: true
    });
  }

  renderIntegrationConfigs() {
    const {
      integrationConfigs
    } = this.props;
    const {
      isSuperuser
    } = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_11__["default"].get('user') || {};
    const options = [{
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.tct)('[providerName] Configurations', {
        providerName: integrationConfigs[0].provider.name
      }),
      options: integrationConfigs.map(config => ({
        value: config.id,
        label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(StyledIntegrationItem, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_views_organizationIntegrations_integrationIcon__WEBPACK_IMPORTED_MODULE_17__["default"], {
            size: 22,
            integration: config
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("span", {
            children: config.domainName
          })]
        }),
        disabled: isSuperuser ? false : true
      }))
    }];
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(StyledSelectControl, {
      ref: ref => {
        this.configSelect = ref;
        this.doFocus(this.configSelect);
      },
      placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Select a configuration to continue'),
      name: "configurations",
      options: options,
      onChange: this.handleSelectConfiguration,
      onMenuOpen: () => this.onMenuOpen(this.configSelect, integrationConfigs, 'id'),
      components: {
        DropdownIndicator: null
      },
      styles: selectStyles,
      menuIsOpen: true
    });
  }

  render() {
    const {
      needOrg,
      needProject,
      organization,
      organizations,
      loading,
      Header,
      Body,
      integrationConfigs
    } = this.props;
    const {
      isSuperuser
    } = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_11__["default"].get('user') || {};
    const shouldShowProjectSelector = organization && needProject && !loading;
    const shouldShowConfigSelector = integrationConfigs.length > 0 && isSuperuser;
    const orgChoices = organizations.filter(_ref7 => {
      let {
        status
      } = _ref7;
      return status.id !== 'pending_deletion';
    }).map(_ref8 => {
      let {
        slug
      } = _ref8;
      return {
        label: slug,
        value: slug
      };
    });
    const shouldShowPicker = needOrg || needProject || shouldShowConfigSelector;

    if (!shouldShowPicker) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(Header, {
        closeButton: true,
        children: this.headerText
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(Body, {
        children: [loading && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(StyledLoadingIndicator, {
          overlay: true
        }), needOrg && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(StyledSelectControl, {
          ref: ref => {
            this.orgSelect = ref;

            if (shouldShowProjectSelector) {
              return;
            }

            this.doFocus(this.orgSelect);
          },
          placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Select an Organization'),
          name: "organization",
          options: orgChoices,
          value: organization,
          onChange: this.handleSelectOrganization,
          components: {
            DropdownIndicator: null
          },
          styles: selectStyles,
          menuIsOpen: true
        }), shouldShowProjectSelector && this.renderProjectSelectOrMessage(), shouldShowConfigSelector && this.renderIntegrationConfigs()]
      })]
    });
  }

}

ContextPickerModal.displayName = "ContextPickerModal";

class ContextPickerModalContainer extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_5__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "unlistener", sentry_stores_organizationsStore__WEBPACK_IMPORTED_MODULE_12__["default"].listen(organizations => this.setState({
      organizations
    }), undefined));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSelectOrganization", organizationSlug => {
      this.setState({
        selectedOrganization: organizationSlug
      });
    });
  }

  getDefaultState() {
    var _storeState$organizat;

    const storeState = sentry_stores_organizationStore__WEBPACK_IMPORTED_MODULE_13__["default"].get();
    return { ...super.getDefaultState(),
      organizations: sentry_stores_organizationsStore__WEBPACK_IMPORTED_MODULE_12__["default"].getAll(),
      selectedOrganization: (_storeState$organizat = storeState.organization) === null || _storeState$organizat === void 0 ? void 0 : _storeState$organizat.slug
    };
  }

  getEndpoints() {
    const {
      configUrl
    } = this.props;

    if (configUrl) {
      return [['integrationConfigs', configUrl]];
    }

    return [];
  }

  componentWillUnmount() {
    var _this$unlistener;

    (_this$unlistener = this.unlistener) === null || _this$unlistener === void 0 ? void 0 : _this$unlistener.call(this);
  }

  renderModal(_ref9) {
    let {
      projects,
      initiallyLoaded,
      integrationConfigs
    } = _ref9;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(ContextPickerModal, { ...this.props,
      projects: projects || [],
      loading: !initiallyLoaded,
      organizations: this.state.organizations,
      organization: this.state.selectedOrganization,
      onSelectOrganization: this.handleSelectOrganization,
      integrationConfigs: integrationConfigs || []
    });
  }

  render() {
    var _this$state$integrati;

    const {
      projectSlugs,
      configUrl
    } = this.props;

    if (configUrl && this.state.loading) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_9__["default"], {});
    }

    if ((_this$state$integrati = this.state.integrationConfigs) !== null && _this$state$integrati !== void 0 && _this$state$integrati.length) {
      return this.renderModal({
        integrationConfigs: this.state.integrationConfigs,
        initiallyLoaded: !this.state.loading
      });
    }

    if (this.state.selectedOrganization) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_utils_projects__WEBPACK_IMPORTED_MODULE_15__["default"], {
        orgId: this.state.selectedOrganization,
        allProjects: !(projectSlugs !== null && projectSlugs !== void 0 && projectSlugs.length),
        slugs: projectSlugs,
        children: _ref10 => {
          let {
            projects,
            initiallyLoaded
          } = _ref10;
          return this.renderModal({
            projects: projects,
            initiallyLoaded
          });
        }
      });
    }

    return this.renderModal({});
  }

}

ContextPickerModalContainer.displayName = "ContextPickerModalContainer";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ContextPickerModalContainer);

const StyledSelectControl = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "exrcese3"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), ";" + ( true ? "" : 0));

const ProjectBadgeOption = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "exrcese2"
} : 0)("margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), ";" + ( true ? "" : 0));

const StyledLoadingIndicator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "exrcese1"
} : 0)( true ? {
  name: "1739oy8",
  styles: "z-index:1"
} : 0);

const StyledIntegrationItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "exrcese0"
} : 0)("display:grid;grid-template-columns:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(4), " auto;grid-template-rows:1fr;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/eventOrGroupHeader.tsx":
/*!***********************************************!*\
  !*** ./app/components/eventOrGroupHeader.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var lodash_capitalize__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/capitalize */ "../node_modules/lodash/capitalize.js");
/* harmony import */ var lodash_capitalize__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_capitalize__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/errorBoundary */ "./app/components/errorBoundary.tsx");
/* harmony import */ var sentry_components_eventOrGroupTitle__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/eventOrGroupTitle */ "./app/components/eventOrGroupTitle.tsx");
/* harmony import */ var sentry_components_globalSelectionLink__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/globalSelectionLink */ "./app/components/globalSelectionLink.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_events__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/events */ "./app/utils/events.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_organizationGroupDetails_unhandledTag__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/organizationGroupDetails/unhandledTag */ "./app/views/organizationGroupDetails/unhandledTag.tsx");
/* harmony import */ var _eventTitleError__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./eventTitleError */ "./app/components/eventTitleError.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

 // eslint-disable-next-line no-restricted-imports


















/**
 * Displays an event or group/issue title (i.e. in Stream)
 */
function EventOrGroupHeader(_ref) {
  var _organization$feature;

  let {
    data,
    index,
    organization,
    params,
    query,
    onClick,
    className,
    hideIcons,
    hideLevel,
    includeLink = true,
    size = 'normal',
    grouping = false,
    ...props
  } = _ref;
  const hasGroupingTreeUI = !!((_organization$feature = organization.features) !== null && _organization$feature !== void 0 && _organization$feature.includes('grouping-tree-ui'));

  function getTitleChildren() {
    const {
      level,
      status,
      isBookmarked,
      hasSeen
    } = data;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [!hideLevel && level && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(GroupLevel, {
        level: level,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_8__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.tct)('Error level: [level]', {
            level: lodash_capitalize__WEBPACK_IMPORTED_MODULE_4___default()(level)
          }),
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("span", {})
        })
      }), !hideIcons && status === 'ignored' && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(IconWrapper, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconMute, {
          color: "red300"
        })
      }), !hideIcons && isBookmarked && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(IconWrapper, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconStar, {
          isSolid: true,
          color: "yellow300"
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_5__["default"], {
        customComponent: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_eventTitleError__WEBPACK_IMPORTED_MODULE_15__["default"], {}),
        mini: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledEventOrGroupTitle, {
          data: data,
          organization: organization,
          hasSeen: hasGroupingTreeUI && hasSeen === undefined ? true : hasSeen,
          withStackTracePreview: true,
          hasGuideAnchor: index === 0,
          grouping: grouping
        })
      })]
    });
  }

  function getTitle() {
    const orgId = params === null || params === void 0 ? void 0 : params.orgId;
    const {
      id,
      status
    } = data;
    const {
      eventID,
      groupID
    } = data;
    const {
      location
    } = props;
    const commonEleProps = {
      'data-test-id': status === 'resolved' ? 'resolved-issue' : null,
      style: status === 'resolved' ? {
        textDecoration: 'line-through'
      } : undefined
    };

    if (includeLink) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_globalSelectionLink__WEBPACK_IMPORTED_MODULE_7__["default"], { ...commonEleProps,
        to: {
          pathname: `/organizations/${orgId}/issues/${eventID ? groupID : id}/${eventID ? `events/${eventID}/` : ''}`,
          query: {
            query,
            // This adds sort to the query if one was selected from the
            // issues list page
            ...(location.query.sort !== undefined ? {
              sort: location.query.sort
            } : {}),
            // This appends _allp to the URL parameters if they have no
            // project selected ("all" projects included in results). This is
            // so that when we enter the issue details page and lock them to
            // a project, we can properly take them back to the issue list
            // page with no project selected (and not the locked project
            // selected)
            ...(location.query.project !== undefined ? {} : {
              _allp: 1
            })
          }
        },
        onClick: onClick,
        children: getTitleChildren()
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("span", { ...commonEleProps,
      children: getTitleChildren()
    });
  }

  const location = (0,sentry_utils_events__WEBPACK_IMPORTED_MODULE_12__.getLocation)(data);
  const message = (0,sentry_utils_events__WEBPACK_IMPORTED_MODULE_12__.getMessage)(data);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)("div", {
    className: className,
    "data-test-id": "event-issue-header",
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Title, {
      size: size,
      hasGroupingTreeUI: hasGroupingTreeUI,
      children: getTitle()
    }), location && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Location, {
      size: size,
      children: location
    }), message && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledTagAndMessageWrapper, {
      size: size,
      children: message && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Message, {
        children: message
      })
    })]
  });
}

EventOrGroupHeader.displayName = "EventOrGroupHeader";
const truncateStyles =  true ? {
  name: "c9isw4",
  styles: "overflow:hidden;max-width:100%;text-overflow:ellipsis;white-space:nowrap"
} : 0;

const getMargin = _ref2 => {
  let {
    size
  } = _ref2;

  if (size === 'small') {
    return 'margin: 0;';
  }

  return 'margin: 0 0 5px';
};

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1weinmj6"
} : 0)("line-height:1;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(0.25), ";& em{font-size:", p => p.theme.fontSizeMedium, ";font-style:normal;font-weight:300;color:", p => p.theme.subText, ";}", p => !p.hasGroupingTreeUI ? /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_17__.css)(truncateStyles, ";" + ( true ? "" : 0),  true ? "" : 0) : /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_17__.css)(">a:first-child{display:flex;min-height:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(3), ";}" + ( true ? "" : 0),  true ? "" : 0), ";" + ( true ? "" : 0));

const LocationWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1weinmj5"
} : 0)(truncateStyles, ";", getMargin, ";direction:rtl;text-align:left;font-size:", p => p.theme.fontSizeMedium, ";color:", p => p.theme.subText, ";span{direction:ltr;}" + ( true ? "" : 0));

function Location(props) {
  const {
    children,
    ...rest
  } = props;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(LocationWrapper, { ...rest,
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.tct)('in [location]', {
      location: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("span", {
        children: children
      })
    })
  });
}

Location.displayName = "Location";

const StyledTagAndMessageWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_views_organizationGroupDetails_unhandledTag__WEBPACK_IMPORTED_MODULE_14__.TagAndMessageWrapper,  true ? {
  target: "e1weinmj4"
} : 0)(getMargin, ";line-height:1.2;" + ( true ? "" : 0));

const Message = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1weinmj3"
} : 0)(truncateStyles, ";font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

const IconWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1weinmj2"
} : 0)( true ? {
  name: "vqevil",
  styles: "position:relative;display:flex;margin-right:5px"
} : 0);

const GroupLevel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1weinmj1"
} : 0)("position:absolute;left:-1px;width:9px;height:15px;border-radius:0 3px 3px 0;background-color:", p => {
  var _p$theme$level$p$leve;

  return (_p$theme$level$p$leve = p.theme.level[p.level]) !== null && _p$theme$level$p$leve !== void 0 ? _p$theme$level$p$leve : p.theme.level.default;
}, ";& span{display:block;width:9px;height:15px;}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_3__.withRouter)((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_13__["default"])(EventOrGroupHeader)));

const StyledEventOrGroupTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_eventOrGroupTitle__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e1weinmj0"
} : 0)("font-weight:", p => p.hasSeen ? 400 : 600, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/eventOrGroupTitle.tsx":
/*!**********************************************!*\
  !*** ./app/components/eventOrGroupTitle.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/projectsStore */ "./app/stores/projectsStore.tsx");
/* harmony import */ var sentry_utils_events__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/events */ "./app/utils/events.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _eventTitleTreeLabel__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./eventTitleTreeLabel */ "./app/components/eventTitleTreeLabel.tsx");
/* harmony import */ var _stacktracePreview__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./stacktracePreview */ "./app/components/stacktracePreview.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












function EventOrGroupTitle(_ref) {
  var _metadata, _ProjectsStore$getByI;

  let {
    organization,
    data,
    withStackTracePreview,
    grouping = false,
    className
  } = _ref;
  const event = data;
  const groupingCurrentLevel = (_metadata = data.metadata) === null || _metadata === void 0 ? void 0 : _metadata.current_level;
  const hasGroupingTreeUI = !!(organization !== null && organization !== void 0 && organization.features.includes('grouping-tree-ui'));
  const hasGroupingStacktraceUI = !!(organization !== null && organization !== void 0 && organization.features.includes('grouping-stacktrace-ui'));
  const {
    id,
    eventID,
    groupID,
    projectID
  } = event;
  const {
    title,
    subtitle,
    treeLabel
  } = (0,sentry_utils_events__WEBPACK_IMPORTED_MODULE_4__.getTitle)(event, organization === null || organization === void 0 ? void 0 : organization.features, grouping);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(Wrapper, {
    className: className,
    hasGroupingTreeUI: hasGroupingTreeUI,
    children: [withStackTracePreview ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(StyledStacktracePreview, {
      organization: organization,
      issueId: groupID ? groupID : id,
      groupingCurrentLevel: groupingCurrentLevel // we need eventId and projectSlug only when hovering over Event, not Group
      // (different API call is made to get the stack trace then)
      ,
      eventId: eventID,
      projectSlug: eventID ? (_ProjectsStore$getByI = sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_3__["default"].getById(projectID)) === null || _ProjectsStore$getByI === void 0 ? void 0 : _ProjectsStore$getByI.slug : undefined,
      hasGroupingStacktraceUI: hasGroupingStacktraceUI,
      children: treeLabel ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_eventTitleTreeLabel__WEBPACK_IMPORTED_MODULE_6__["default"], {
        treeLabel: treeLabel
      }) : title
    }) : treeLabel ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_eventTitleTreeLabel__WEBPACK_IMPORTED_MODULE_6__["default"], {
      treeLabel: treeLabel
    }) : title, subtitle && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(Spacer, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(Subtitle, {
        title: subtitle,
        children: subtitle
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("br", {})]
    })]
  });
}

EventOrGroupTitle.displayName = "EventOrGroupTitle";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_5__["default"])(EventOrGroupTitle));
/**
 * &nbsp; is used instead of margin/padding to split title and subtitle
 * into 2 separate text nodes on the HTML AST. This allows the
 * title to be highlighted without spilling over to the subtitle.
 */

const Spacer = () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("span", {
  style: {
    display: 'inline-block',
    width: 10
  },
  children: "\xA0"
});

Spacer.displayName = "Spacer";

const Subtitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('em',  true ? {
  target: "ejrtwu52"
} : 0)("color:", p => p.theme.gray300, ";font-style:normal;" + ( true ? "" : 0));

const StyledStacktracePreview = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_stacktracePreview__WEBPACK_IMPORTED_MODULE_7__.StackTracePreview,  true ? {
  target: "ejrtwu51"
} : 0)("font-size:", p => p.theme.fontSizeLarge, ";", p => p.hasGroupingStacktraceUI && /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_9__.css)("display:inline-flex;overflow:hidden;height:100%;>span:first-child{", p.theme.overflowEllipsis, ";}" + ( true ? "" : 0),  true ? "" : 0), ";" + ( true ? "" : 0));

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "ejrtwu50"
} : 0)(p => p.hasGroupingTreeUI && /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_9__.css)("display:inline-grid;grid-template-columns:auto max-content 1fr max-content;align-items:baseline;", Subtitle, "{", p.theme.overflowEllipsis, ";display:inline-block;height:100%;}" + ( true ? "" : 0),  true ? "" : 0), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/eventTitleError.tsx":
/*!********************************************!*\
  !*** ./app/components/eventTitleError.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






function EventTitleError() {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(Wrapper, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Title, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('<unknown>')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(ErrorMessage, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('There was an error rendering the title')
    })]
  });
}

EventTitleError.displayName = "EventTitleError";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EventTitleError);

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e12t64kh2"
} : 0)( true ? {
  name: "5kov97",
  styles: "display:flex;flex-wrap:wrap"
} : 0);

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e12t64kh1"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(0.5), ";" + ( true ? "" : 0));

const ErrorMessage = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e12t64kh0"
} : 0)("color:", p => p.theme.alert.error.iconColor, ";background:", p => p.theme.alert.error.backgroundLight, ";font-size:", p => p.theme.fontSizeMedium, ";padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(0.5), ";border-radius:", p => p.theme.borderRadius, ";display:flex;align-items:center;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/eventTitleTreeLabel.tsx":
/*!************************************************!*\
  !*** ./app/components/eventTitleTreeLabel.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Divider": () => (/* binding */ Divider),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_events__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/events */ "./app/utils/events.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }







function EventTitleTreeLabel(_ref) {
  let {
    treeLabel
  } = _ref;
  const firstFourParts = treeLabel.slice(0, 4);
  const remainingParts = treeLabel.slice(firstFourParts.length);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(Wrapper, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(FirstFourParts, {
      children: firstFourParts.map((part, index) => {
        const label = (0,sentry_utils_events__WEBPACK_IMPORTED_MODULE_3__.getTreeLabelPartDetails)(part);

        if (index !== firstFourParts.length - 1) {
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(PriorityLabel, {
              children: label
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(Divider, {
              children: '|'
            })]
          }, index);
        }

        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(PriorityLabel, {
          children: label
        }, index);
      })
    }), !!remainingParts.length && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(RemainingLabels, {
      children: remainingParts.map((part, index) => {
        const label = (0,sentry_utils_events__WEBPACK_IMPORTED_MODULE_3__.getTreeLabelPartDetails)(part);
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(Divider, {
            children: '|'
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(Label, {
            children: label
          })]
        }, index);
      })
    })]
  });
}

EventTitleTreeLabel.displayName = "EventTitleTreeLabel";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EventTitleTreeLabel);

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "elmi27a5"
} : 0)( true ? {
  name: "povk8l",
  styles: "display:inline-grid;grid-template-columns:auto 1fr;align-items:center"
} : 0);

const FirstFourParts = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "elmi27a4"
} : 0)( true ? {
  name: "ww2cfn",
  styles: "display:inline-grid;grid-auto-flow:column;align-items:center"
} : 0);

const Label = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "elmi27a3"
} : 0)( true ? {
  name: "1r5gb7q",
  styles: "display:inline-block"
} : 0);

const PriorityLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Label,  true ? {
  target: "elmi27a2"
} : 0)(p => p.theme.overflowEllipsis, " display:inline-block;" + ( true ? "" : 0));

const RemainingLabels = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "elmi27a1"
} : 0)(p => p.theme.overflowEllipsis, " display:inline-block;min-width:50px;" + ( true ? "" : 0));

const Divider = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "elmi27a0"
} : 0)("color:", p => p.theme.gray200, ";display:inline-block;padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/events/eventDataSection.tsx":
/*!****************************************************!*\
  !*** ./app/components/events/eventDataSection.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SectionContents": () => (/* binding */ SectionContents),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_events_styles__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/events/styles */ "./app/components/events/styles.tsx");
/* harmony import */ var sentry_components_links_anchor__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/links/anchor */ "./app/components/links/anchor.tsx");
/* harmony import */ var sentry_icons_iconAnchor__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/icons/iconAnchor */ "./app/icons/iconAnchor.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/callIfFunction */ "./app/utils/callIfFunction.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }













function scrollToSection(element) {
  if (window.location.hash && element) {
    const [, hash] = window.location.hash.split('#');

    try {
      const anchorElement = hash && element.querySelector('div#' + hash);

      if (anchorElement) {
        anchorElement.scrollIntoView();
      }
    } catch {// Since we're blindly taking the hash from the url and shoving
      // it into a querySelector, it's possible that this may
      // raise an exception if the input is invalid. So let's just ignore
      // this instead of blowing up.
      // e.g. `document.querySelector('div#=')`
      // > Uncaught DOMException: Failed to execute 'querySelector' on 'Document': 'div#=' is not a valid selector.
    }
  }
}

function EventDataSection(_ref) {
  let {
    children,
    className,
    type,
    title,
    toggleRaw,
    raw = false,
    wrapTitle = true,
    actions,
    isCentered = false,
    showPermalink = true,
    ...props
  } = _ref;
  const titleNode = wrapTitle ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("h3", {
    children: title
  }) : title;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(sentry_components_events_styles__WEBPACK_IMPORTED_MODULE_4__.DataSection, {
    ref: scrollToSection,
    className: className || '',
    ...props,
    children: [title && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(SectionHeader, {
      id: type,
      isCentered: isCentered,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(Title, {
        children: showPermalink ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(Permalink, {
          className: "permalink",
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(PermalinkAnchor, {
            href: `#${type}`,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(StyledIconAnchor, {
              size: "xs",
              color: "subText"
            })
          }), titleNode]
        }) : titleNode
      }), type === 'extra' && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_3__["default"], {
        merged: true,
        active: raw ? 'raw' : 'formatted',
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
          barId: "formatted",
          size: "xs",
          onClick: () => (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_9__.callIfFunction)(toggleRaw, false),
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Formatted')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
          barId: "raw",
          size: "xs",
          onClick: () => (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_9__.callIfFunction)(toggleRaw, true),
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Raw')
        })]
      }), actions && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(ActionContainer, {
        children: actions
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(SectionContents, {
      children: children
    })]
  });
}

EventDataSection.displayName = "EventDataSection";

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e11dlz2y6"
} : 0)( true ? {
  name: "zjik7",
  styles: "display:flex"
} : 0);

const Permalink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e11dlz2y5"
} : 0)( true ? {
  name: "n48rgu",
  styles: "width:100%;position:relative"
} : 0);

const StyledIconAnchor = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons_iconAnchor__WEBPACK_IMPORTED_MODULE_6__.IconAnchor,  true ? {
  target: "e11dlz2y4"
} : 0)( true ? {
  name: "h7d4wa",
  styles: "opacity:0;transform:translateY(-1px);transition:opacity 100ms"
} : 0);

const PermalinkAnchor = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_anchor__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e11dlz2y3"
} : 0)("display:flex;align-items:center;position:absolute;top:0;left:0;width:calc(100% + ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(3), ");height:100%;padding-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(0.5), ";transform:translateX(-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(3), ");:hover ", StyledIconAnchor, ",:focus ", StyledIconAnchor, "{opacity:1;}" + ( true ? "" : 0));

const SectionHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e11dlz2y2"
} : 0)("display:flex;flex-wrap:wrap;align-items:center;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";>*{margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(0.5), ";}& h3,& h3 a{font-size:14px;font-weight:600;line-height:1.2;color:", p => p.theme.gray300, ";}& h3{font-size:14px;font-weight:600;line-height:1.2;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(0.75), " 0;margin-bottom:0;text-transform:uppercase;}& small{color:", p => p.theme.textColor, ";font-size:", p => p.theme.fontSizeMedium, ";margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(0.5), ";margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(0.5), ";text-transform:none;}& small>span{color:", p => p.theme.textColor, ";font-weight:normal;}@media (min-width: ", props => props.theme.breakpoints.large, "){&>small{margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";display:inline-block;}}", p => p.isCentered && /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_11__.css)("align-items:center;@media (max-width: ", p.theme.breakpoints.small, "){display:block;}" + ( true ? "" : 0),  true ? "" : 0), ">*:first-child{position:relative;flex-grow:1;}" + ( true ? "" : 0));

const SectionContents = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e11dlz2y1"
} : 0)( true ? {
  name: "bjn8wh",
  styles: "position:relative"
} : 0);

const ActionContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e11dlz2y0"
} : 0)( true ? {
  name: "1bzjrcw",
  styles: "flex-shrink:0;max-width:100%"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EventDataSection);

/***/ }),

/***/ "./app/components/events/interfaces/crashContent/stackTrace/content.tsx":
/*!******************************************************************************!*\
  !*** ./app/components/events/interfaces/crashContent/stackTrace/content.tsx ***!
  \******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var platformicons__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! platformicons */ "../node_modules/platformicons/build/index.js");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _frame_line__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../../frame/line */ "./app/components/events/interfaces/frame/line.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../../utils */ "./app/components/events/interfaces/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









const defaultProps = {
  includeSystemFrames: true,
  expandFirstFrame: true
};

class Content extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      showingAbsoluteAddresses: false,
      showCompleteFunctionName: false
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderOmittedFrames", (firstFrameOmitted, lastFrameOmitted) => {
      const props = {
        className: 'frame frames-omitted',
        key: 'omitted'
      };
      const text = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Frames %d until %d were omitted and not available.', firstFrameOmitted, lastFrameOmitted);
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("li", { ...props,
        children: text
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "frameIsVisible", (frame, nextFrame) => {
      const {
        includeSystemFrames
      } = this.props;
      return includeSystemFrames || frame.inApp || nextFrame && nextFrame.inApp || // the last non-app frame
      !frame.inApp && !nextFrame;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleToggleAddresses", event => {
      event.stopPropagation(); // to prevent collapsing if collapsible

      this.setState(prevState => ({
        showingAbsoluteAddresses: !prevState.showingAbsoluteAddresses
      }));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleToggleFunctionName", event => {
      event.stopPropagation(); // to prevent collapsing if collapsible

      this.setState(prevState => ({
        showCompleteFunctionName: !prevState.showCompleteFunctionName
      }));
    });
  }

  isFrameAfterLastNonApp() {
    var _data$frames;

    const {
      data
    } = this.props;
    const frames = (_data$frames = data.frames) !== null && _data$frames !== void 0 ? _data$frames : [];

    if (!frames.length || frames.length < 2) {
      return false;
    }

    const lastFrame = frames[frames.length - 1];
    const penultimateFrame = frames[frames.length - 2];
    return penultimateFrame.inApp && !lastFrame.inApp;
  }

  findImageForAddress(address, addrMode) {
    var _this$props$event$ent, _this$props$event$ent2;

    const images = (_this$props$event$ent = this.props.event.entries.find(entry => entry.type === 'debugmeta')) === null || _this$props$event$ent === void 0 ? void 0 : (_this$props$event$ent2 = _this$props$event$ent.data) === null || _this$props$event$ent2 === void 0 ? void 0 : _this$props$event$ent2.images;
    return images && address ? images.find((img, idx) => {
      if (!addrMode || addrMode === 'abs') {
        const [startAddress, endAddress] = (0,_utils__WEBPACK_IMPORTED_MODULE_8__.getImageRange)(img);
        return address >= startAddress && address < endAddress;
      }

      return addrMode === `rel:${idx}`;
    }) : null;
  }

  getClassName() {
    const {
      className = '',
      includeSystemFrames
    } = this.props;

    if (includeSystemFrames) {
      return `${className} traceback full-traceback`;
    }

    return `${className} traceback in-app-traceback`;
  }

  render() {
    var _data$frames2, _data$frames4, _data$frames5, _data$frames9;

    const {
      data,
      event,
      newestFirst,
      expandFirstFrame,
      platform,
      includeSystemFrames,
      isHoverPreviewed,
      meta
    } = this.props;
    const {
      showingAbsoluteAddresses,
      showCompleteFunctionName
    } = this.state;
    let firstFrameOmitted = null;
    let lastFrameOmitted = null;

    if (data.framesOmitted) {
      firstFrameOmitted = data.framesOmitted[0];
      lastFrameOmitted = data.framesOmitted[1];
    }

    let lastFrameIdx = null;
    ((_data$frames2 = data.frames) !== null && _data$frames2 !== void 0 ? _data$frames2 : []).forEach((frame, frameIdx) => {
      if (frame.inApp) {
        lastFrameIdx = frameIdx;
      }
    });

    if (lastFrameIdx === null) {
      var _data$frames3;

      lastFrameIdx = ((_data$frames3 = data.frames) !== null && _data$frames3 !== void 0 ? _data$frames3 : []).length - 1;
    }

    const frames = [];
    let nRepeats = 0;
    const maxLengthOfAllRelativeAddresses = ((_data$frames4 = data.frames) !== null && _data$frames4 !== void 0 ? _data$frames4 : []).reduce((maxLengthUntilThisPoint, frame) => {
      const correspondingImage = this.findImageForAddress(frame.instructionAddr, frame.addrMode);

      try {
        const relativeAddress = ((0,_utils__WEBPACK_IMPORTED_MODULE_8__.parseAddress)(frame.instructionAddr) - (0,_utils__WEBPACK_IMPORTED_MODULE_8__.parseAddress)(correspondingImage.image_addr)).toString(16);
        return maxLengthUntilThisPoint > relativeAddress.length ? maxLengthUntilThisPoint : relativeAddress.length;
      } catch {
        return maxLengthUntilThisPoint;
      }
    }, 0);
    const isFrameAfterLastNonApp = this.isFrameAfterLastNonApp();
    ((_data$frames5 = data.frames) !== null && _data$frames5 !== void 0 ? _data$frames5 : []).forEach((frame, frameIdx) => {
      var _data$frames6, _data$frames7;

      const prevFrame = ((_data$frames6 = data.frames) !== null && _data$frames6 !== void 0 ? _data$frames6 : [])[frameIdx - 1];
      const nextFrame = ((_data$frames7 = data.frames) !== null && _data$frames7 !== void 0 ? _data$frames7 : [])[frameIdx + 1];
      const repeatedFrame = nextFrame && frame.lineNo === nextFrame.lineNo && frame.instructionAddr === nextFrame.instructionAddr && frame.package === nextFrame.package && frame.module === nextFrame.module && frame.function === nextFrame.function;

      if (repeatedFrame) {
        nRepeats++;
      }

      if (this.frameIsVisible(frame, nextFrame) && !repeatedFrame) {
        var _data$frames8, _meta$frames;

        const image = this.findImageForAddress(frame.instructionAddr, frame.addrMode);
        frames.push((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_frame_line__WEBPACK_IMPORTED_MODULE_7__["default"], {
          event: event,
          data: frame,
          isExpanded: expandFirstFrame && lastFrameIdx === frameIdx,
          emptySourceNotation: lastFrameIdx === frameIdx && frameIdx === 0,
          isOnlyFrame: ((_data$frames8 = data.frames) !== null && _data$frames8 !== void 0 ? _data$frames8 : []).length === 1,
          nextFrame: nextFrame,
          prevFrame: prevFrame,
          platform: platform,
          timesRepeated: nRepeats,
          showingAbsoluteAddress: showingAbsoluteAddresses,
          onAddressToggle: this.handleToggleAddresses,
          image: image,
          maxLengthOfRelativeAddress: maxLengthOfAllRelativeAddresses,
          registers: {} // TODO: Fix registers
          ,
          isFrameAfterLastNonApp: isFrameAfterLastNonApp,
          includeSystemFrames: includeSystemFrames,
          onFunctionNameToggle: this.handleToggleFunctionName,
          showCompleteFunctionName: showCompleteFunctionName,
          isHoverPreviewed: isHoverPreviewed,
          isFirst: newestFirst ? frameIdx === lastFrameIdx : frameIdx === 0,
          frameMeta: meta === null || meta === void 0 ? void 0 : (_meta$frames = meta.frames) === null || _meta$frames === void 0 ? void 0 : _meta$frames[frameIdx],
          registersMeta: meta === null || meta === void 0 ? void 0 : meta.registers
        }, frameIdx));
      }

      if (!repeatedFrame) {
        nRepeats = 0;
      }

      if (frameIdx === firstFrameOmitted) {
        frames.push(this.renderOmittedFrames(firstFrameOmitted, lastFrameOmitted));
      }
    });

    if (frames.length > 0 && data.registers) {
      const lastFrame = frames.length - 1;
      frames[lastFrame] = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_3__.cloneElement)(frames[lastFrame], {
        registers: data.registers
      });
    }

    if (newestFirst) {
      frames.reverse();
    }

    const className = this.getClassName();
    const platformIcon = (0,_utils__WEBPACK_IMPORTED_MODULE_8__.stackTracePlatformIcon)(platform, (_data$frames9 = data.frames) !== null && _data$frames9 !== void 0 ? _data$frames9 : []);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(Wrapper, {
      className: className,
      "data-test-id": "stack-trace-content",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(StyledPlatformIcon, {
        platform: platformIcon,
        size: "20px",
        style: {
          borderRadius: '3px 0 0 3px'
        },
        "data-test-id": `platform-icon-${platformIcon}`
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(StyledList, {
        "data-test-id": "frames",
        children: frames
      })]
    });
  }

}

Content.displayName = "Content";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(Content, "defaultProps", {
  includeSystemFrames: true,
  expandFirstFrame: true
});

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_6__["default"])(Content));

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "es17bp52"
} : 0)( true ? {
  name: "bjn8wh",
  styles: "position:relative"
} : 0);

const StyledPlatformIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(platformicons__WEBPACK_IMPORTED_MODULE_4__.PlatformIcon,  true ? {
  target: "es17bp51"
} : 0)( true ? {
  name: "uo26hz",
  styles: "position:absolute;top:-1px;left:-20px"
} : 0);

const StyledList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('ul',  true ? {
  target: "es17bp50"
} : 0)( true ? {
  name: "qr8q5p",
  styles: "list-style:none"
} : 0);

/***/ }),

/***/ "./app/components/events/interfaces/crashContent/stackTrace/contentV2.tsx":
/*!********************************************************************************!*\
  !*** ./app/components/events/interfaces/crashContent/stackTrace/contentV2.tsx ***!
  \********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var platformicons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! platformicons */ "../node_modules/platformicons/build/index.js");
/* harmony import */ var sentry_components_list__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/list */ "./app/components/list/index.tsx");
/* harmony import */ var sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/list/listItem */ "./app/components/list/listItem.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _frame_lineV2__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../../frame/lineV2 */ "./app/components/events/interfaces/frame/lineV2/index.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../../utils */ "./app/components/events/interfaces/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }












function Content(_ref) {
  let {
    data,
    platform,
    event,
    newestFirst,
    className,
    isHoverPreviewed,
    groupingCurrentLevel,
    meta,
    includeSystemFrames = true,
    expandFirstFrame = true
  } = _ref;
  const [showingAbsoluteAddresses, setShowingAbsoluteAddresses] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(false);
  const [showCompleteFunctionName, setShowCompleteFunctionName] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(false);
  const {
    frames = [],
    framesOmitted,
    registers
  } = data;

  function findImageForAddress(address, addrMode) {
    var _event$entries$find, _event$entries$find$d;

    const images = (_event$entries$find = event.entries.find(entry => entry.type === 'debugmeta')) === null || _event$entries$find === void 0 ? void 0 : (_event$entries$find$d = _event$entries$find.data) === null || _event$entries$find$d === void 0 ? void 0 : _event$entries$find$d.images;
    return images && address ? images.find((img, idx) => {
      if (!addrMode || addrMode === 'abs') {
        const [startAddress, endAddress] = (0,_utils__WEBPACK_IMPORTED_MODULE_9__.getImageRange)(img);
        return address >= startAddress && address < endAddress;
      }

      return addrMode === `rel:${idx}`;
    }) : null;
  }

  function getClassName() {
    if (includeSystemFrames) {
      return `${className} traceback full-traceback`;
    }

    return `${className} traceback in-app-traceback`;
  }

  function isFrameUsedForGrouping(frame) {
    const {
      minGroupingLevel
    } = frame;

    if (groupingCurrentLevel === undefined || minGroupingLevel === undefined) {
      return false;
    }

    return minGroupingLevel <= groupingCurrentLevel;
  }

  function handleToggleAddresses(mouseEvent) {
    mouseEvent.stopPropagation(); // to prevent collapsing if collapsible

    setShowingAbsoluteAddresses(!showingAbsoluteAddresses);
  }

  function handleToggleFunctionName(mouseEvent) {
    mouseEvent.stopPropagation(); // to prevent collapsing if collapsible

    setShowCompleteFunctionName(!showCompleteFunctionName);
  }

  function getLastFrameIndex() {
    const inAppFrameIndexes = frames.map((frame, frameIndex) => {
      if (frame.inApp) {
        return frameIndex;
      }

      return undefined;
    }).filter(frame => frame !== undefined);
    return !inAppFrameIndexes.length ? frames.length - 1 : inAppFrameIndexes[inAppFrameIndexes.length - 1];
  }

  function renderOmittedFrames(firstFrameOmitted, lastFrameOmitted) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_5__["default"], {
      className: "frame frames-omitted",
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Frames %d until %d were omitted and not available.', firstFrameOmitted, lastFrameOmitted)
    });
  }

  function renderConvertedFrames() {
    var _framesOmitted$, _framesOmitted$2;

    const firstFrameOmitted = (_framesOmitted$ = framesOmitted === null || framesOmitted === void 0 ? void 0 : framesOmitted[0]) !== null && _framesOmitted$ !== void 0 ? _framesOmitted$ : null;
    const lastFrameOmitted = (_framesOmitted$2 = framesOmitted === null || framesOmitted === void 0 ? void 0 : framesOmitted[1]) !== null && _framesOmitted$2 !== void 0 ? _framesOmitted$2 : null;
    const lastFrameIndex = getLastFrameIndex();
    let nRepeats = 0;
    const maxLengthOfAllRelativeAddresses = frames.reduce((maxLengthUntilThisPoint, frame) => {
      const correspondingImage = findImageForAddress(frame.instructionAddr, frame.addrMode);

      try {
        const relativeAddress = ((0,_utils__WEBPACK_IMPORTED_MODULE_9__.parseAddress)(frame.instructionAddr) - (0,_utils__WEBPACK_IMPORTED_MODULE_9__.parseAddress)(correspondingImage.image_addr)).toString(16);
        return maxLengthUntilThisPoint > relativeAddress.length ? maxLengthUntilThisPoint : relativeAddress.length;
      } catch {
        return maxLengthUntilThisPoint;
      }
    }, 0);
    const convertedFrames = frames.map((frame, frameIndex) => {
      const prevFrame = frames[frameIndex - 1];
      const nextFrame = frames[frameIndex + 1];
      const repeatedFrame = nextFrame && frame.lineNo === nextFrame.lineNo && frame.instructionAddr === nextFrame.instructionAddr && frame.package === nextFrame.package && frame.module === nextFrame.module && frame.function === nextFrame.function;

      if (repeatedFrame) {
        nRepeats++;
      }

      const isUsedForGrouping = isFrameUsedForGrouping(frame);
      const isVisible = includeSystemFrames || frame.inApp || nextFrame && nextFrame.inApp || // the last non-app frame
      !frame.inApp && !nextFrame || isUsedForGrouping;

      if (isVisible && !repeatedFrame) {
        var _meta$frames;

        const lineProps = {
          event,
          frame,
          prevFrame,
          nextFrame,
          isExpanded: expandFirstFrame && lastFrameIndex === frameIndex,
          emptySourceNotation: lastFrameIndex === frameIndex && frameIndex === 0,
          platform,
          timesRepeated: nRepeats,
          showingAbsoluteAddress: showingAbsoluteAddresses,
          onAddressToggle: handleToggleAddresses,
          image: findImageForAddress(frame.instructionAddr, frame.addrMode),
          maxLengthOfRelativeAddress: maxLengthOfAllRelativeAddresses,
          registers: {},
          includeSystemFrames,
          onFunctionNameToggle: handleToggleFunctionName,
          showCompleteFunctionName,
          isHoverPreviewed,
          isUsedForGrouping,
          frameMeta: meta === null || meta === void 0 ? void 0 : (_meta$frames = meta.frames) === null || _meta$frames === void 0 ? void 0 : _meta$frames[frameIndex],
          registersMeta: meta === null || meta === void 0 ? void 0 : meta.registers
        };
        nRepeats = 0;

        if (frameIndex === firstFrameOmitted) {
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(_frame_lineV2__WEBPACK_IMPORTED_MODULE_8__["default"], { ...lineProps
            }), renderOmittedFrames(firstFrameOmitted, lastFrameOmitted)]
          }, frameIndex);
        }

        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(_frame_lineV2__WEBPACK_IMPORTED_MODULE_8__["default"], { ...lineProps
        }, frameIndex);
      }

      if (!repeatedFrame) {
        nRepeats = 0;
      }

      if (frameIndex !== firstFrameOmitted) {
        return null;
      }

      return renderOmittedFrames(firstFrameOmitted, lastFrameOmitted);
    }).filter(frame => !!frame);

    if (convertedFrames.length > 0 && registers) {
      const lastFrame = convertedFrames.length - 1;
      convertedFrames[lastFrame] = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_2__.cloneElement)(convertedFrames[lastFrame], {
        registers
      });

      if (!newestFirst) {
        return convertedFrames;
      }

      return [...convertedFrames].reverse();
    }

    if (!newestFirst) {
      return convertedFrames;
    }

    return [...convertedFrames].reverse();
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(Wrapper, {
    className: getClassName(),
    "data-test-id": "stack-trace-content-v2",
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(StyledPlatformIcon, {
      platform: (0,_utils__WEBPACK_IMPORTED_MODULE_9__.stackTracePlatformIcon)(platform, frames),
      size: "20px",
      style: {
        borderRadius: '3px 0 0 3px'
      }
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(StyledList, {
      children: renderConvertedFrames()
    })]
  });
}

Content.displayName = "Content";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Content);

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1p86c9l2"
} : 0)( true ? {
  name: "bjn8wh",
  styles: "position:relative"
} : 0);

const StyledPlatformIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(platformicons__WEBPACK_IMPORTED_MODULE_3__.PlatformIcon,  true ? {
  target: "e1p86c9l1"
} : 0)("position:absolute;margin-top:-1px;left:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(3), ";" + ( true ? "" : 0));

const StyledList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_list__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "e1p86c9l0"
} : 0)( true ? {
  name: "8ixhiv",
  styles: "gap:0"
} : 0);

/***/ }),

/***/ "./app/components/events/interfaces/crashContent/stackTrace/contentV3.tsx":
/*!********************************************************************************!*\
  !*** ./app/components/events/interfaces/crashContent/stackTrace/contentV3.tsx ***!
  \********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _nativeFrame__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../../nativeFrame */ "./app/components/events/interfaces/nativeFrame.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../../utils */ "./app/components/events/interfaces/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









function Content(_ref) {
  var _framesOmitted$, _framesOmitted$2;

  let {
    data,
    platform,
    event,
    newestFirst,
    isHoverPreviewed,
    groupingCurrentLevel,
    includeSystemFrames = true,
    expandFirstFrame = true,
    meta
  } = _ref;
  const [showingAbsoluteAddresses, setShowingAbsoluteAddresses] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(false);
  const [showCompleteFunctionName, setShowCompleteFunctionName] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(false);
  const {
    frames = [],
    framesOmitted,
    registers
  } = data;

  function findImageForAddress(address, addrMode) {
    var _event$entries$find, _event$entries$find$d;

    const images = (_event$entries$find = event.entries.find(entry => entry.type === 'debugmeta')) === null || _event$entries$find === void 0 ? void 0 : (_event$entries$find$d = _event$entries$find.data) === null || _event$entries$find$d === void 0 ? void 0 : _event$entries$find$d.images;

    if (!images || !address) {
      return null;
    }

    const image = images.find((img, idx) => {
      if (!addrMode || addrMode === 'abs') {
        const [startAddress, endAddress] = (0,_utils__WEBPACK_IMPORTED_MODULE_6__.getImageRange)(img);
        return address >= startAddress && address < endAddress;
      }

      return addrMode === `rel:${idx}`;
    });
    return image;
  }

  function isFrameUsedForGrouping(frame) {
    const {
      minGroupingLevel
    } = frame;

    if (groupingCurrentLevel === undefined || minGroupingLevel === undefined) {
      return false;
    }

    return minGroupingLevel <= groupingCurrentLevel;
  }

  function handleToggleAddresses(mouseEvent) {
    mouseEvent.stopPropagation(); // to prevent collapsing if collapsible

    setShowingAbsoluteAddresses(!showingAbsoluteAddresses);
  }

  function handleToggleFunctionName(mouseEvent) {
    mouseEvent.stopPropagation(); // to prevent collapsing if collapsible

    setShowCompleteFunctionName(!showCompleteFunctionName);
  }

  function getLastFrameIndex() {
    const inAppFrameIndexes = frames.map((frame, frameIndex) => {
      if (frame.inApp) {
        return frameIndex;
      }

      return undefined;
    }).filter(frame => frame !== undefined);
    return !inAppFrameIndexes.length ? frames.length - 1 : inAppFrameIndexes[inAppFrameIndexes.length - 1];
  }

  function renderOmittedFrames(firstFrameOmitted, lastFrameOmitted) {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Frames %d until %d were omitted and not available.', firstFrameOmitted, lastFrameOmitted);
  }

  const firstFrameOmitted = (_framesOmitted$ = framesOmitted === null || framesOmitted === void 0 ? void 0 : framesOmitted[0]) !== null && _framesOmitted$ !== void 0 ? _framesOmitted$ : null;
  const lastFrameOmitted = (_framesOmitted$2 = framesOmitted === null || framesOmitted === void 0 ? void 0 : framesOmitted[1]) !== null && _framesOmitted$2 !== void 0 ? _framesOmitted$2 : null;
  const lastFrameIndex = getLastFrameIndex();
  let nRepeats = 0;
  const maxLengthOfAllRelativeAddresses = frames.reduce((maxLengthUntilThisPoint, frame) => {
    const correspondingImage = findImageForAddress(frame.instructionAddr, frame.addrMode);

    try {
      const relativeAddress = ((0,_utils__WEBPACK_IMPORTED_MODULE_6__.parseAddress)(frame.instructionAddr) - (0,_utils__WEBPACK_IMPORTED_MODULE_6__.parseAddress)(correspondingImage.image_addr)).toString(16);
      return maxLengthUntilThisPoint > relativeAddress.length ? maxLengthUntilThisPoint : relativeAddress.length;
    } catch {
      return maxLengthUntilThisPoint;
    }
  }, 0);
  const convertedFrames = frames.map((frame, frameIndex) => {
    const prevFrame = frames[frameIndex - 1];
    const nextFrame = frames[frameIndex + 1];
    const repeatedFrame = nextFrame && frame.lineNo === nextFrame.lineNo && frame.instructionAddr === nextFrame.instructionAddr && frame.package === nextFrame.package && frame.module === nextFrame.module && frame.function === nextFrame.function;

    if (repeatedFrame) {
      nRepeats++;
    }

    const isUsedForGrouping = isFrameUsedForGrouping(frame);
    const isVisible = includeSystemFrames || frame.inApp || nextFrame && nextFrame.inApp || // the last non-app frame
    !frame.inApp && !nextFrame || isUsedForGrouping;

    if (isVisible && !repeatedFrame) {
      var _meta$frames;

      const frameProps = {
        event,
        frame,
        prevFrame,
        nextFrame,
        isExpanded: expandFirstFrame && lastFrameIndex === frameIndex,
        emptySourceNotation: lastFrameIndex === frameIndex && frameIndex === 0,
        platform,
        timesRepeated: nRepeats,
        showingAbsoluteAddress: showingAbsoluteAddresses,
        onAddressToggle: handleToggleAddresses,
        image: findImageForAddress(frame.instructionAddr, frame.addrMode),
        maxLengthOfRelativeAddress: maxLengthOfAllRelativeAddresses,
        registers: {},
        includeSystemFrames,
        onFunctionNameToggle: handleToggleFunctionName,
        showCompleteFunctionName,
        isHoverPreviewed,
        isUsedForGrouping,
        frameMeta: meta === null || meta === void 0 ? void 0 : (_meta$frames = meta.frames) === null || _meta$frames === void 0 ? void 0 : _meta$frames[frameIndex],
        registersMeta: meta === null || meta === void 0 ? void 0 : meta.registers
      };
      nRepeats = 0;

      if (frameIndex === firstFrameOmitted) {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(_nativeFrame__WEBPACK_IMPORTED_MODULE_5__["default"], { ...frameProps
          }), renderOmittedFrames(firstFrameOmitted, lastFrameOmitted)]
        }, frameIndex);
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(_nativeFrame__WEBPACK_IMPORTED_MODULE_5__["default"], { ...frameProps
      }, frameIndex);
    }

    if (!repeatedFrame) {
      nRepeats = 0;
    }

    if (frameIndex !== firstFrameOmitted) {
      return null;
    }

    return renderOmittedFrames(firstFrameOmitted, lastFrameOmitted);
  }).filter(frame => !!frame);
  const className = `traceback ${includeSystemFrames ? 'full-traceback' : 'in-app-traceback'}`;

  if (convertedFrames.length > 0 && registers) {
    const lastFrame = convertedFrames.length - 1;
    convertedFrames[lastFrame] = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_2__.cloneElement)(convertedFrames[lastFrame], {
      registers
    });
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Wrapper, {
      className: className,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Frames, {
        isHoverPreviewed: isHoverPreviewed,
        "data-test-id": "stack-trace",
        children: !newestFirst ? convertedFrames : [...convertedFrames].reverse()
      })
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Wrapper, {
    className: className,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Frames, {
      isHoverPreviewed: isHoverPreviewed,
      "data-test-id": "stack-trace",
      children: !newestFirst ? convertedFrames : [...convertedFrames].reverse()
    })
  });
}

Content.displayName = "Content";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Content);

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ewsx1zn1"
} : 0)( true ? {
  name: "j3cbvr",
  styles: "&&{border:0;box-shadow:none;margin:0;}"
} : 0);

const Frames = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('ul',  true ? {
  target: "ewsx1zn0"
} : 0)("background:", p => p.theme.background, ";border-radius:", p => p.theme.borderRadius, ";border:1px ", p => 'solid ' + p.theme.border, ";box-shadow:", p => p.theme.dropShadowLight, ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(2), ";position:relative;display:grid;overflow:hidden;font-size:", p => p.theme.fontSizeSmall, ";line-height:16px;color:", p => p.theme.gray500, ";", p => p.isHoverPreviewed && `
      border: 0;
      border-radius: 0;
      box-shadow: none;
      margin-bottom: 0;
    `, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/events/interfaces/debugMeta/utils.tsx":
/*!**************************************************************!*\
  !*** ./app/components/events/interfaces/debugMeta/utils.tsx ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "IMAGE_AND_CANDIDATE_LIST_MAX_HEIGHT": () => (/* binding */ IMAGE_AND_CANDIDATE_LIST_MAX_HEIGHT),
/* harmony export */   "combineStatus": () => (/* binding */ combineStatus),
/* harmony export */   "getFileName": () => (/* binding */ getFileName),
/* harmony export */   "getImageAddress": () => (/* binding */ getImageAddress),
/* harmony export */   "getStatusWeight": () => (/* binding */ getStatusWeight),
/* harmony export */   "normalizeId": () => (/* binding */ normalizeId),
/* harmony export */   "shouldSkipSection": () => (/* binding */ shouldSkipSection)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_events_interfaces_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/events/interfaces/utils */ "./app/components/events/interfaces/utils.tsx");
/* harmony import */ var sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/types/debugImage */ "./app/types/debugImage.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








const IMAGE_ADDR_LEN = 12;
const IMAGE_AND_CANDIDATE_LIST_MAX_HEIGHT = 400;
function getStatusWeight(status) {
  switch (status) {
    case null:
    case undefined:
    case sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_4__.ImageStatus.UNUSED:
      return 0;

    case sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_4__.ImageStatus.FOUND:
      return 1;

    default:
      return 2;
  }
}
function combineStatus(debugStatus, unwindStatus) {
  const debugWeight = getStatusWeight(debugStatus);
  const unwindWeight = getStatusWeight(unwindStatus);
  const combined = debugWeight >= unwindWeight ? debugStatus : unwindStatus;
  return combined || sentry_types_debugImage__WEBPACK_IMPORTED_MODULE_4__.ImageStatus.UNUSED;
}
function getFileName(path) {
  if (!path) {
    return undefined;
  }

  const directorySeparator = /^([a-z]:\\|\\\\)/i.test(path) ? '\\' : '/';
  return path.split(directorySeparator).pop();
}
function normalizeId(id) {
  var _id$trim$toLowerCase$;

  return (_id$trim$toLowerCase$ = id === null || id === void 0 ? void 0 : id.trim().toLowerCase().replace(/[- ]/g, '')) !== null && _id$trim$toLowerCase$ !== void 0 ? _id$trim$toLowerCase$ : '';
}
function shouldSkipSection(filteredImages, images) {
  if (!!filteredImages.length) {
    return false;
  }

  const definedImages = images.filter(image => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_5__.defined)(image));

  if (!definedImages.length) {
    return true;
  }

  if (definedImages.every(image => image.type === 'proguard')) {
    return true;
  }

  return false;
}
function getImageAddress(image) {
  const [startAddress, endAddress] = (0,sentry_components_events_interfaces_utils__WEBPACK_IMPORTED_MODULE_3__.getImageRange)(image);

  if (startAddress && endAddress) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("span", {
        children: (0,sentry_components_events_interfaces_utils__WEBPACK_IMPORTED_MODULE_3__.formatAddress)(startAddress, IMAGE_ADDR_LEN)
      }), ' \u2013 ', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("span", {
        children: (0,sentry_components_events_interfaces_utils__WEBPACK_IMPORTED_MODULE_3__.formatAddress)(endAddress, IMAGE_ADDR_LEN)
      })]
    });
  }

  return undefined;
}

/***/ }),

/***/ "./app/components/events/interfaces/frame/assembly.tsx":
/*!*************************************************************!*\
  !*** ./app/components/events/interfaces/frame/assembly.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Assembly": () => (/* binding */ Assembly)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/forms/textCopyInput */ "./app/components/forms/textCopyInput.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









function Assembly(_ref) {
  let {
    name,
    version,
    culture,
    publicKeyToken,
    filePath
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(AssemblyWrapper, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(AssemblyInfo, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Caption, {
        children: "Assembly:"
      }), name || '-']
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(AssemblyInfo, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(Caption, {
        children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Version'), ":"]
      }), version || '-']
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(AssemblyInfo, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(Caption, {
        children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Culture'), ":"]
      }), culture || '-']
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(AssemblyInfo, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Caption, {
        children: "PublicKeyToken:"
      }), publicKeyToken || '-']
    }), filePath && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(FilePathInfo, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(Caption, {
        children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Path'), ":"]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_2__["default"], {
        title: filePath,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_1__["default"], {
          rtl: true,
          children: filePath
        })
      })]
    })]
  });
}

Assembly.displayName = "Assembly";

const AssemblyWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e18vwvsm3"
} : 0)("font-size:80%;display:flex;flex-wrap:wrap;color:", p => p.theme.textColor, ";text-align:center;position:relative;padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(3), " 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(3), ";" + ( true ? "" : 0));

const AssemblyInfo = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e18vwvsm2"
} : 0)( true ? {
  name: "1xu3wed",
  styles: "margin-right:15px;margin-bottom:5px"
} : 0);

const Caption = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e18vwvsm1"
} : 0)( true ? {
  name: "9cqawg",
  styles: "margin-right:5px;font-weight:bold"
} : 0);

const FilePathInfo = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e18vwvsm0"
} : 0)("display:flex;align-items:center;margin-bottom:5px;input{width:300px;height:20px;padding-top:0;padding-bottom:0;line-height:1.5;@media (max-width: ", sentry_utils_theme__WEBPACK_IMPORTED_MODULE_5__["default"].breakpoints.medium, "){input{}width:auto;}}button{min-height:20px;height:20px;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1), ";}svg{width:11px;height:11px;}" + ( true ? "" : 0));



/***/ }),

/***/ "./app/components/events/interfaces/frame/context.tsx":
/*!************************************************************!*\
  !*** ./app/components/events/interfaces/frame/context.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_clippedBox__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/clippedBox */ "./app/components/clippedBox.tsx");
/* harmony import */ var sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/errorBoundary */ "./app/components/errorBoundary.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../utils */ "./app/components/events/interfaces/utils.tsx");
/* harmony import */ var _assembly__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./assembly */ "./app/components/events/interfaces/frame/assembly.tsx");
/* harmony import */ var _contextLine__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./contextLine */ "./app/components/events/interfaces/frame/contextLine.tsx");
/* harmony import */ var _frameRegisters__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./frameRegisters */ "./app/components/events/interfaces/frame/frameRegisters/index.tsx");
/* harmony import */ var _frameVariables__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./frameVariables */ "./app/components/events/interfaces/frame/frameVariables.tsx");
/* harmony import */ var _openInContextLine__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./openInContextLine */ "./app/components/events/interfaces/frame/openInContextLine.tsx");
/* harmony import */ var _stacktraceLink__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./stacktraceLink */ "./app/components/events/interfaces/frame/stacktraceLink.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


















const Context = _ref => {
  var _frame$vars, _event$contexts, _event$contexts$devic;

  let {
    hasContextVars = false,
    hasContextSource = false,
    hasContextRegisters = false,
    isExpanded = false,
    hasAssembly = false,
    expandable = false,
    emptySourceNotation = false,
    registers,
    components,
    frame,
    event,
    organization,
    className,
    frameMeta,
    registersMeta
  } = _ref;

  if (!hasContextSource && !hasContextVars && !hasContextRegisters && !hasAssembly) {
    return emptySourceNotation ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)("div", {
      className: "empty-context",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledIconFlag, {
        size: "xs"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('No additional details are available for this frame.')
      })]
    }) : null;
  }

  const contextLines = isExpanded ? frame.context : frame.context.filter(l => l[0] === frame.lineNo);
  const startLineNo = hasContextSource ? frame.context[0][0] : undefined;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(Wrapper, {
    start: startLineNo,
    className: `${className} context ${isExpanded ? 'expanded' : ''}`,
    children: [(0,sentry_utils__WEBPACK_IMPORTED_MODULE_7__.defined)(frame.errors) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("li", {
      className: expandable ? 'expandable error' : 'error',
      children: frame.errors.join(', ')
    }, "errors"), frame.context && contextLines.map((line, index) => {
      const isActive = frame.lineNo === line[0];
      const hasComponents = isActive && components.length > 0;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(StyledContextLine, {
        line: line,
        isActive: isActive,
        children: [hasComponents && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_3__["default"], {
          mini: true,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_openInContextLine__WEBPACK_IMPORTED_MODULE_14__.OpenInContextLine, {
            lineNo: line[0],
            filename: frame.filename || '',
            components: components
          }, index)
        }), (organization === null || organization === void 0 ? void 0 : organization.features.includes('integrations-stacktrace-link')) && isActive && isExpanded && frame.inApp && frame.filename && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_3__["default"], {
          customComponent: null,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_stacktraceLink__WEBPACK_IMPORTED_MODULE_15__["default"], {
            lineNo: line[0],
            frame: frame,
            event: event
          }, index)
        })]
      }, index);
    }), hasContextVars && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledClippedBox, {
      clipHeight: 100,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_frameVariables__WEBPACK_IMPORTED_MODULE_13__.FrameVariables, {
        data: (_frame$vars = frame.vars) !== null && _frame$vars !== void 0 ? _frame$vars : {},
        meta: frameMeta === null || frameMeta === void 0 ? void 0 : frameMeta.vars
      })
    }), hasContextRegisters && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_frameRegisters__WEBPACK_IMPORTED_MODULE_12__.FrameRegisters, {
      registers: registers,
      meta: registersMeta,
      deviceArch: (_event$contexts = event.contexts) === null || _event$contexts === void 0 ? void 0 : (_event$contexts$devic = _event$contexts.device) === null || _event$contexts$devic === void 0 ? void 0 : _event$contexts$devic.arch
    }), hasAssembly && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_assembly__WEBPACK_IMPORTED_MODULE_10__.Assembly, { ...(0,_utils__WEBPACK_IMPORTED_MODULE_9__.parseAssembly)(frame.package),
      filePath: frame.absPath
    })]
  });
};

Context.displayName = "Context";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_8__["default"])(Context));

const StyledClippedBox = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_clippedBox__WEBPACK_IMPORTED_MODULE_2__["default"],  true ? {
  target: "e1spsaex3"
} : 0)("margin-left:0;margin-right:0;&:first-of-type{margin-top:0;}:first-child{margin-top:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(3), ";}>*:first-child{padding-top:0;border-top:none;}" + ( true ? "" : 0));

const StyledIconFlag = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_4__.IconFlag,  true ? {
  target: "e1spsaex2"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1), ";" + ( true ? "" : 0));

const StyledContextLine = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_contextLine__WEBPACK_IMPORTED_MODULE_11__["default"],  true ? {
  target: "e1spsaex1"
} : 0)( true ? {
  name: "nzrepl",
  styles: "background:inherit;padding:0;text-indent:20px;z-index:1000"
} : 0);

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('ol',  true ? {
  target: "e1spsaex0"
} : 0)( true ? {
  name: "854e3v",
  styles: "&&{border-radius:0;}"
} : 0);

/***/ }),

/***/ "./app/components/events/interfaces/frame/contextLine.tsx":
/*!****************************************************************!*\
  !*** ./app/components/events/interfaces/frame/contextLine.tsx ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! classnames */ "../node_modules/classnames/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(classnames__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






const ContextLine = function (_ref) {
  let {
    line,
    isActive,
    children,
    className
  } = _ref;
  let lineWs = '';
  let lineCode = '';

  if (typeof line[1] === 'string') {
    [, lineWs, lineCode] = line[1].match(/^(\s*)(.*?)$/m);
  }

  const Component = !children ? react__WEBPACK_IMPORTED_MODULE_2__.Fragment : Context;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("li", {
    className: classnames__WEBPACK_IMPORTED_MODULE_3___default()(className, 'expandable', {
      active: isActive
    }),
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(Component, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("span", {
        className: "ws",
        children: lineWs
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("span", {
        className: "contextline",
        children: lineCode
      })]
    }), children]
  }, line[0]);
};

ContextLine.displayName = "ContextLine";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ContextLine);

const Context = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1ip0x50"
} : 0)( true ? {
  name: "1u4hpl4",
  styles: "display:inline"
} : 0);

/***/ }),

/***/ "./app/components/events/interfaces/frame/defaultTitle/index.tsx":
/*!***********************************************************************!*\
  !*** ./app/components/events/interfaces/frame/defaultTitle/index.tsx ***!
  \***********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_events_meta_annotatedText__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/events/meta/annotatedText */ "./app/components/events/meta/annotatedText/index.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_stacktracePreview__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/stacktracePreview */ "./app/components/stacktracePreview.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_components_truncate__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/truncate */ "./app/components/truncate.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _functionName__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ../functionName */ "./app/components/events/interfaces/frame/functionName.tsx");
/* harmony import */ var _groupingIndicator__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ../groupingIndicator */ "./app/components/events/interfaces/frame/groupingIndicator.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ../utils */ "./app/components/events/interfaces/frame/utils.tsx");
/* harmony import */ var _originalSourceInfo__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./originalSourceInfo */ "./app/components/events/interfaces/frame/defaultTitle/originalSourceInfo.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");

















const DefaultTitle = _ref => {
  let {
    frame,
    platform,
    isHoverPreviewed,
    isUsedForGrouping,
    meta
  } = _ref;
  const title = [];
  const framePlatform = (0,_utils__WEBPACK_IMPORTED_MODULE_13__.getPlatform)(frame.platform, platform);
  const tooltipDelay = isHoverPreviewed ? sentry_components_stacktracePreview__WEBPACK_IMPORTED_MODULE_4__.STACKTRACE_PREVIEW_TOOLTIP_DELAY : undefined;

  const handleExternalLink = event => {
    event.stopPropagation();
  };

  const getModule = () => {
    if (frame.module) {
      var _meta$module;

      return {
        key: 'module',
        value: frame.module,
        meta: meta === null || meta === void 0 ? void 0 : (_meta$module = meta.module) === null || _meta$module === void 0 ? void 0 : _meta$module['']
      };
    }

    return undefined;
  };

  const getPathNameOrModule = shouldPrioritizeModuleName => {
    if (shouldPrioritizeModuleName) {
      if (frame.module) {
        return getModule();
      }

      if (frame.filename) {
        var _meta$filename;

        return {
          key: 'filename',
          value: frame.filename,
          meta: meta === null || meta === void 0 ? void 0 : (_meta$filename = meta.filename) === null || _meta$filename === void 0 ? void 0 : _meta$filename['']
        };
      }

      return undefined;
    }

    if (frame.filename) {
      var _meta$filename2;

      return {
        key: 'filename',
        value: frame.filename,
        meta: meta === null || meta === void 0 ? void 0 : (_meta$filename2 = meta.filename) === null || _meta$filename2 === void 0 ? void 0 : _meta$filename2['']
      };
    }

    if (frame.module) {
      return getModule();
    }

    return undefined;
  }; // TODO(dcramer): this needs to use a formatted string so it can be
  // localized correctly


  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_10__.defined)(frame.filename || frame.module)) {
    // prioritize module name for Java as filename is often only basename
    const shouldPrioritizeModuleName = framePlatform === 'java'; // we do not want to show path in title on csharp platform

    const pathNameOrModule = (0,_utils__WEBPACK_IMPORTED_MODULE_13__.isDotnet)(framePlatform) ? getModule() : getPathNameOrModule(shouldPrioritizeModuleName);
    const enablePathTooltip = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_10__.defined)(frame.absPath) && frame.absPath !== (pathNameOrModule === null || pathNameOrModule === void 0 ? void 0 : pathNameOrModule.value);

    if (pathNameOrModule) {
      title.push((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_5__["default"], {
        title: frame.absPath,
        disabled: !enablePathTooltip,
        delay: tooltipDelay,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("code", {
          className: "filename",
          "data-test-id": "filename",
          children: !!pathNameOrModule.meta && !pathNameOrModule.value ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_events_meta_annotatedText__WEBPACK_IMPORTED_MODULE_2__["default"], {
            value: pathNameOrModule.value,
            meta: pathNameOrModule.meta
          }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_truncate__WEBPACK_IMPORTED_MODULE_6__["default"], {
            value: pathNameOrModule.value,
            maxLength: 100,
            leftTrim: true
          })
        }, "filename")
      }, pathNameOrModule.key));
    } // in case we prioritized the module name but we also have a filename info
    // we want to show a litle (?) icon that on hover shows the actual filename


    if (shouldPrioritizeModuleName && frame.filename) {
      title.push((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_5__["default"], {
        title: frame.filename,
        delay: tooltipDelay,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("a", {
          className: "in-at real-filename",
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconQuestion, {
            size: "xs"
          })
        })
      }, frame.filename));
    }

    if (frame.absPath && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_10__.isUrl)(frame.absPath)) {
      title.push((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(StyledExternalLink, {
        href: frame.absPath,
        onClick: handleExternalLink,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconOpen, {
          size: "xs"
        })
      }, "share"));
    }

    if (((0,sentry_utils__WEBPACK_IMPORTED_MODULE_10__.defined)(frame.function) || (0,sentry_utils__WEBPACK_IMPORTED_MODULE_10__.defined)(frame.rawFunction)) && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_10__.defined)(pathNameOrModule)) {
      title.push((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(InFramePosition, {
        className: "in-at",
        children: ` ${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('in')} `
      }, "in"));
    }
  }

  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_10__.defined)(frame.function) || (0,sentry_utils__WEBPACK_IMPORTED_MODULE_10__.defined)(frame.rawFunction)) {
    title.push((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_functionName__WEBPACK_IMPORTED_MODULE_11__.FunctionName, {
      frame: frame,
      className: "function",
      "data-test-id": "function",
      meta: meta
    }, "function"));
  } // we don't want to render out zero line numbers which are used to
  // indicate lack of source information for native setups.  We could
  // TODO(mitsuhiko): only do this for events from native platforms?


  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_10__.defined)(frame.lineNo) && frame.lineNo !== 0) {
    title.push((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(InFramePosition, {
      className: "in-at in-at-line",
      children: ` ${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('at line')} `
    }, "no"));
    title.push((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("code", {
      className: "lineno",
      children: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_10__.defined)(frame.colNo) ? `${frame.lineNo}:${frame.colNo}` : frame.lineNo
    }, "line"));
  }

  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_10__.defined)(frame.package) && !(0,_utils__WEBPACK_IMPORTED_MODULE_13__.isDotnet)(framePlatform)) {
    title.push((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(InFramePosition, {
      children: ` ${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('within')} `
    }, "within"));
    title.push((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("code", {
      title: frame.package,
      className: "package",
      children: (0,_utils__WEBPACK_IMPORTED_MODULE_13__.trimPackage)(frame.package)
    }, "package"));
  }

  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_10__.defined)(frame.origAbsPath)) {
    title.push((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_5__["default"], {
      title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_originalSourceInfo__WEBPACK_IMPORTED_MODULE_14__["default"], {
        mapUrl: frame.mapUrl,
        map: frame.map
      }),
      delay: tooltipDelay,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("a", {
        className: "in-at original-src",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconQuestion, {
          size: "xs"
        })
      })
    }, "info-tooltip"));
  }

  if (isUsedForGrouping) {
    title.push((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(StyledGroupingIndicator, {}, "info-tooltip"));
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: title
  });
};

DefaultTitle.displayName = "DefaultTitle";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DefaultTitle);

const StyledExternalLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e1cfec1l2"
} : 0)("position:relative;top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(0.25), ";margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(0.5), ";" + ( true ? "" : 0));

const InFramePosition = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1cfec1l1"
} : 0)("color:", p => p.theme.textColor, ";opacity:0.6;" + ( true ? "" : 0));

const StyledGroupingIndicator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_groupingIndicator__WEBPACK_IMPORTED_MODULE_12__["default"],  true ? {
  target: "e1cfec1l0"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(0.75), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/events/interfaces/frame/defaultTitle/originalSourceInfo.tsx":
/*!************************************************************************************!*\
  !*** ./app/components/events/interfaces/frame/defaultTitle/originalSourceInfo.tsx ***!
  \************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






// TODO(Priscila): Remove BR tags
// mapUrl not always present; e.g. uploaded source maps
const OriginalSourceInfo = _ref => {
  let {
    mapUrl,
    map
  } = _ref;

  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.defined)(map) && !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.defined)(mapUrl)) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("strong", {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Source Map')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("br", {}), mapUrl !== null && mapUrl !== void 0 ? mapUrl : map, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("br", {})]
  });
};

OriginalSourceInfo.displayName = "OriginalSourceInfo";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OriginalSourceInfo);

/***/ }),

/***/ "./app/components/events/interfaces/frame/frameRegisters/index.tsx":
/*!*************************************************************************!*\
  !*** ./app/components/events/interfaces/frame/frameRegisters/index.tsx ***!
  \*************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FrameRegisters": () => (/* binding */ FrameRegisters)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_components_clippedBox__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/clippedBox */ "./app/components/clippedBox.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./utils */ "./app/components/events/interfaces/frame/frameRegisters/utils.tsx");
/* harmony import */ var _value__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./value */ "./app/components/events/interfaces/frame/frameRegisters/value.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












const CLIPPED_HEIGHT = 40;
function FrameRegisters(_ref) {
  let {
    registers,
    deviceArch,
    meta
  } = _ref;
  const [isRevealed, setIsRevealed] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(false);
  const [renderedHeight, setRenderedHeight] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(0); // make sure that clicking on the registers does not actually do
  // anything on the containing element.

  const handlePreventToggling = event => {
    event.stopPropagation();
  };

  const sortedRegisters = (0,_utils__WEBPACK_IMPORTED_MODULE_7__.getSortedRegisters)(registers, deviceArch);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(Wrapper, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(Title, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Registers')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(StyledClippedBox, {
      isRevealed: isRevealed,
      renderedHeight: renderedHeight,
      clipHeight: CLIPPED_HEIGHT,
      onReveal: () => setIsRevealed(true),
      onSetRenderedHeight: setRenderedHeight,
      clipFade: _ref2 => {
        let {
          showMoreButton
        } = _ref2;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(ClipFade, {
          children: showMoreButton
        });
      },
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(Registers, {
        children: sortedRegisters.map(_ref3 => {
          var _meta$name;

          let [name, value] = _ref3;

          if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_6__.defined)(value)) {
            return null;
          }

          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(Register, {
            onClick: handlePreventToggling,
            children: [name, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_value__WEBPACK_IMPORTED_MODULE_8__.FrameRegisterValue, {
              value: value,
              meta: meta === null || meta === void 0 ? void 0 : (_meta$name = meta[name]) === null || _meta$name === void 0 ? void 0 : _meta$name['']
            })]
          }, name);
        })
      })
    })]
  });
}
FrameRegisters.displayName = "FrameRegisters";

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eez4mmo5"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(0.5), " calc(", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(4), " + ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(0.25), ");display:grid;font-size:", p => p.theme.fontSizeSmall, ";line-height:1rem;margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(0.5), ";border-top:1px solid ", p => p.theme.innerBorder, ";@media (min-width: ", p => p.theme.breakpoints.small, "){grid-template-columns:132px 1fr;}" + ( true ? "" : 0));

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eez4mmo4"
} : 0)("padding-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), ";padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), ";@media (min-width: ", p => p.theme.breakpoints.small, "){padding-bottom:0;padding-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), ";}" + ( true ? "" : 0));

const Registers = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eez4mmo3"
} : 0)("display:grid;grid-template-columns:repeat(auto-fit, minmax(14.063rem, 1fr));gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), ";" + ( true ? "" : 0));

const Register = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eez4mmo2"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(0.5), ";grid-template-columns:3em 1fr;align-items:center;color:", p => p.theme.gray300, ";@media (min-width: ", p => p.theme.breakpoints.small, "){text-align:right;}" + ( true ? "" : 0));

const StyledClippedBox = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_clippedBox__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "eez4mmo1"
} : 0)("margin-left:0;margin-right:0;padding:0;border-top:0;", p => !p.isRevealed && p.renderedHeight > CLIPPED_HEIGHT && /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_10__.css)("max-height:calc(", CLIPPED_HEIGHT * 2, "px + 28px);@media (min-width: ", p.theme.breakpoints.small, "){max-height:calc(", CLIPPED_HEIGHT, "px + 28px);}>*:last-child{background:", p.theme.white, ";right:0;bottom:0;width:100%;position:absolute;}" + ( true ? "" : 0),  true ? "" : 0), ";" + ( true ? "" : 0));

const ClipFade = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eez4mmo0"
} : 0)("background:", p => p.theme.white, ";display:flex;justify-content:flex-end;pointer-events:none;>*{pointer-events:auto;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/events/interfaces/frame/frameRegisters/registers.tsx":
/*!*****************************************************************************!*\
  !*** ./app/components/events/interfaces/frame/frameRegisters/registers.tsx ***!
  \*****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "REGISTERS_ARM": () => (/* binding */ REGISTERS_ARM),
/* harmony export */   "REGISTERS_ARM64": () => (/* binding */ REGISTERS_ARM64),
/* harmony export */   "REGISTERS_MIPS": () => (/* binding */ REGISTERS_MIPS),
/* harmony export */   "REGISTERS_PPC": () => (/* binding */ REGISTERS_PPC),
/* harmony export */   "REGISTERS_X86": () => (/* binding */ REGISTERS_X86),
/* harmony export */   "REGISTERS_X86_64": () => (/* binding */ REGISTERS_X86_64)
/* harmony export */ });
// Architecture "x86" (alias "i386", "i686")
// Special case: Breakpad uses "efl" in place of "eflags"
const REGISTERS_X86 = {
  eax: 0,
  ecx: 1,
  edx: 2,
  ebx: 3,
  esp: 4,
  ebp: 5,
  esi: 6,
  edi: 7,
  eip: 8,
  eflags: 9,
  efl: 9,
  unused1: 10,
  st0: 11,
  st1: 12,
  st2: 13,
  st3: 14,
  st4: 15,
  st5: 16,
  st6: 17,
  st7: 18,
  unused2: 19,
  unused3: 20,
  xmm0: 21,
  xmm1: 22,
  xmm2: 23,
  xmm3: 24,
  xmm4: 25,
  xmm5: 26,
  xmm6: 27,
  xmm7: 28,
  mm0: 29,
  mm1: 30,
  mm2: 31,
  mm3: 32,
  mm4: 33,
  mm5: 34,
  mm6: 35,
  mm7: 36,
  fcw: 37,
  fsw: 38,
  mxcsr: 39,
  es: 40,
  cs: 41,
  ss: 42,
  ds: 43,
  fs: 44,
  gs: 45,
  unused4: 46,
  unused5: 47,
  tr: 48,
  ldtr: 49
}; // Architecture "x86_64" (alias "amd64")

const REGISTERS_X86_64 = {
  rax: 0,
  rdx: 1,
  rcx: 2,
  rbx: 3,
  rsi: 4,
  rdi: 5,
  rbp: 6,
  rsp: 7,
  r8: 8,
  r9: 9,
  r10: 10,
  r11: 11,
  r12: 12,
  r13: 13,
  r14: 14,
  r15: 15,
  rip: 16,
  xmm0: 17,
  xmm1: 18,
  xmm2: 19,
  xmm3: 20,
  xmm4: 21,
  xmm5: 22,
  xmm6: 23,
  xmm7: 24,
  xmm8: 25,
  xmm9: 26,
  xmm10: 27,
  xmm11: 28,
  xmm12: 29,
  xmm13: 30,
  xmm14: 31,
  xmm15: 32,
  st0: 33,
  st1: 34,
  st2: 35,
  st3: 36,
  st4: 37,
  st5: 38,
  st6: 39,
  st7: 40,
  mm0: 41,
  mm1: 42,
  mm2: 43,
  mm3: 44,
  mm4: 45,
  mm5: 46,
  mm6: 47,
  mm7: 48,
  rflags: 49,
  es: 50,
  cs: 51,
  ss: 52,
  ds: 53,
  fs: 54,
  gs: 55,
  unused1: 56,
  unused2: 57,
  'fs.base': 58,
  'gs.base': 59,
  unused3: 60,
  unused4: 61,
  tr: 62,
  ldtr: 63,
  mxcsr: 64,
  fcw: 65,
  fsw: 66
}; // Architecture "arm*" (32-bit)
// Special case: "r11" -> "fp"

const REGISTERS_ARM = {
  r0: 0,
  r1: 1,
  r2: 2,
  r3: 3,
  r4: 4,
  r5: 5,
  r6: 6,
  r7: 7,
  r8: 8,
  r9: 9,
  r10: 10,
  r11: 11,
  fp: 11,
  r12: 12,
  sp: 13,
  lr: 14,
  pc: 15,
  f0: 96,
  f1: 97,
  f2: 98,
  f3: 99,
  f4: 100,
  f5: 101,
  f6: 102,
  f7: 103,
  fps: 24,
  cpsr: 25,
  s0: 64,
  s1: 65,
  s2: 66,
  s3: 67,
  s4: 68,
  s5: 69,
  s6: 70,
  s7: 71,
  s8: 72,
  s9: 73,
  s10: 74,
  s11: 75,
  s12: 76,
  s13: 77,
  s14: 78,
  s15: 79,
  s16: 80,
  s17: 81,
  s18: 82,
  s19: 83,
  s20: 84,
  s21: 85,
  s22: 86,
  s23: 87,
  s24: 88,
  s25: 89,
  s26: 90,
  s27: 91,
  s28: 92,
  s29: 93,
  s30: 94,
  s31: 95
}; // Architecture "arm64" (alias aarch64)
// Special cases: "x30" -> "lr", "x29" -> "fp", "x17" -> "ip1", "x16" -> "ip0"

const REGISTERS_ARM64 = {
  x0: 0,
  x1: 1,
  x2: 2,
  x3: 3,
  x4: 4,
  x5: 5,
  x6: 6,
  x7: 7,
  x8: 8,
  x9: 9,
  x10: 10,
  x11: 11,
  x12: 12,
  x13: 13,
  x14: 14,
  x15: 15,
  x16: 16,
  ip0: 16,
  x17: 17,
  ip1: 17,
  x18: 18,
  x19: 19,
  x20: 20,
  x21: 21,
  x22: 22,
  x23: 23,
  x24: 24,
  x25: 25,
  x26: 26,
  x27: 27,
  x28: 28,
  x29: 29,
  fp: 29,
  x30: 30,
  lr: 30,
  sp: 31,
  pc: 32,
  v0: 64,
  v1: 65,
  v2: 66,
  v3: 67,
  v4: 68,
  v5: 69,
  v6: 70,
  v7: 71,
  v8: 72,
  v9: 73,
  v10: 74,
  v11: 75,
  v12: 76,
  v13: 77,
  v14: 78,
  v15: 79,
  v16: 80,
  v17: 81,
  v18: 82,
  v19: 83,
  v20: 84,
  v21: 85,
  v22: 86,
  v23: 87,
  v24: 88,
  v25: 89,
  v26: 90,
  v27: 91,
  v28: 92,
  v29: 93,
  v30: 94,
  v31: 95
}; // Architectures "mips" and "mips64"

const REGISTERS_MIPS = {
  zero: 0,
  at: 1,
  v0: 2,
  v1: 3,
  a0: 4,
  a1: 5,
  a2: 6,
  a3: 7,
  t0: 8,
  t1: 9,
  t2: 10,
  t3: 11,
  t4: 12,
  t5: 13,
  t6: 14,
  t7: 15,
  s0: 16,
  s1: 17,
  s2: 18,
  s3: 19,
  s4: 20,
  s5: 21,
  s6: 22,
  s7: 23,
  t8: 24,
  t9: 25,
  k0: 26,
  k1: 27,
  gp: 28,
  sp: 29,
  fp: 30,
  ra: 31,
  lo: 32,
  hi: 33,
  pc: 34,
  f0: 35,
  f2: 36,
  f3: 37,
  f4: 38,
  f5: 39,
  f6: 40,
  f7: 41,
  f8: 42,
  f9: 43,
  f10: 44,
  f11: 45,
  f12: 46,
  f13: 47,
  f14: 48,
  f15: 49,
  f16: 50,
  f17: 51,
  f18: 52,
  f19: 53,
  f20: 54,
  f21: 55,
  f22: 56,
  f23: 57,
  f24: 58,
  f25: 59,
  f26: 60,
  f27: 61,
  f28: 62,
  f29: 63,
  f30: 64,
  f31: 65,
  fcsr: 66,
  fir: 67
}; // Architectures "ppc" and "ppc64" (incomplete)

const REGISTERS_PPC = {
  r0: 0,
  r1: 1,
  r2: 2,
  r3: 3,
  r4: 4,
  r5: 5,
  r6: 6,
  r7: 7,
  r8: 8,
  r9: 9,
  r10: 10,
  r11: 11,
  r12: 12,
  r13: 13,
  r14: 14,
  r15: 15,
  r16: 16,
  r17: 17,
  r18: 18,
  r19: 19,
  r20: 20,
  r21: 21,
  r22: 22,
  r23: 23,
  r24: 24,
  r25: 25,
  r26: 26,
  r27: 27,
  r28: 28,
  r29: 29,
  r30: 30,
  r31: 31,
  f0: 32,
  f1: 33,
  f2: 34,
  f3: 35,
  f4: 36,
  f5: 37,
  f6: 38,
  f7: 39,
  f8: 40,
  f9: 41,
  f10: 42,
  f11: 43,
  f12: 44,
  f13: 45,
  f14: 46,
  f15: 47,
  f16: 48,
  f17: 49,
  f18: 50,
  f19: 51,
  f20: 52,
  f21: 53,
  f22: 54,
  f23: 55,
  f24: 56,
  f25: 57,
  f26: 58,
  f27: 59,
  f28: 60,
  f29: 61,
  f30: 62,
  f31: 63,
  cr: 64,
  fpsrc: 65,
  msr: 66,
  sr0: 70,
  sr1: 71,
  sr2: 72,
  sr3: 73,
  sr4: 74,
  sr5: 75,
  sr6: 76,
  sr7: 77,
  sr8: 78,
  sr9: 79,
  sr10: 80,
  sr11: 81,
  sr12: 82,
  sr13: 83,
  sr14: 84,
  sr15: 85,
  srr0: 86,
  srr1: 87
};

/***/ }),

/***/ "./app/components/events/interfaces/frame/frameRegisters/utils.tsx":
/*!*************************************************************************!*\
  !*** ./app/components/events/interfaces/frame/frameRegisters/utils.tsx ***!
  \*************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getSortedRegisters": () => (/* binding */ getSortedRegisters)
/* harmony export */ });
/* harmony import */ var _registers__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./registers */ "./app/components/events/interfaces/frame/frameRegisters/registers.tsx");


function getRegisterMap(deviceArch) {
  if (deviceArch.startsWith('x86_64')) {
    return _registers__WEBPACK_IMPORTED_MODULE_0__.REGISTERS_X86_64;
  }

  if (deviceArch.startsWith('x86')) {
    return _registers__WEBPACK_IMPORTED_MODULE_0__.REGISTERS_X86;
  }

  if (deviceArch.startsWith('arm64')) {
    return _registers__WEBPACK_IMPORTED_MODULE_0__.REGISTERS_ARM64;
  }

  if (deviceArch.startsWith('arm')) {
    return _registers__WEBPACK_IMPORTED_MODULE_0__.REGISTERS_ARM64;
  }

  if (deviceArch.startsWith('mips')) {
    return _registers__WEBPACK_IMPORTED_MODULE_0__.REGISTERS_MIPS;
  }

  if (deviceArch.startsWith('ppc')) {
    return _registers__WEBPACK_IMPORTED_MODULE_0__.REGISTERS_PPC;
  }

  return undefined;
}

function getRegisterIndex(register, registerMap) {
  var _registerMap;

  return (_registerMap = registerMap[register[0] === '$' ? register.slice(1) : register]) !== null && _registerMap !== void 0 ? _registerMap : -1;
}

function getSortedRegisters(registers, deviceArch) {
  const entries = Object.entries(registers);

  if (!deviceArch) {
    return entries;
  }

  const registerMap = getRegisterMap(deviceArch);

  if (!registerMap) {
    return entries;
  }

  return entries.sort((a, b) => getRegisterIndex(a[0], registerMap) - getRegisterIndex(b[0], registerMap));
}

/***/ }),

/***/ "./app/components/events/interfaces/frame/frameRegisters/value.tsx":
/*!*************************************************************************!*\
  !*** ./app/components/events/interfaces/frame/frameRegisters/value.tsx ***!
  \*************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FrameRegisterValue": () => (/* binding */ FrameRegisterValue)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_events_meta_annotatedText__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/events/meta/annotatedText */ "./app/components/events/meta/annotatedText/index.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









const REGISTER_VIEWS = [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Hexadecimal'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Numeric')];
function FrameRegisterValue(_ref) {
  let {
    meta,
    value
  } = _ref;
  const [state, setState] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)({
    view: 0
  });

  function formatValue() {
    try {
      const parsed = typeof value === 'string' ? parseInt(value, 16) : value;

      if (isNaN(parsed)) {
        return value;
      }

      switch (state.view) {
        case 1:
          return `${parsed}`;

        case 0:
        default:
          return `0x${('0000000000000000' + parsed.toString(16)).substr(-16)}`;
      }
    } catch {
      return value;
    }
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(InlinePre, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_events_meta_annotatedText__WEBPACK_IMPORTED_MODULE_3__["default"], {
      value: formatValue(),
      meta: meta
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(StyledTooltip, {
      title: REGISTER_VIEWS[state.view],
      containerDisplayMode: "inline-flex",
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(Toggle, {
        onClick: () => {
          setState({
            view: (state.view + 1) % REGISTER_VIEWS.length
          });
        },
        size: "xs",
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Toggle register value format')
      })
    })]
  });
}
FrameRegisterValue.displayName = "FrameRegisterValue";

const StyledTooltip = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "ef4fy0g2"
} : 0)( true ? {
  name: "1h3rtzg",
  styles: "align-items:center"
} : 0);

const InlinePre = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('pre',  true ? {
  target: "ef4fy0g1"
} : 0)("margin:0;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";display:inline-grid;line-height:1rem;grid-template-columns:1fr max-content;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";text-align:left;font-size:", p => p.theme.fontSizeSmall, ";" + ( true ? "" : 0));

const Toggle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconSliders,  true ? {
  target: "ef4fy0g0"
} : 0)( true ? {
  name: "nl8cyh",
  styles: "opacity:0.33;cursor:pointer;&:hover{opacity:1;}"
} : 0);

/***/ }),

/***/ "./app/components/events/interfaces/frame/frameVariables.tsx":
/*!*******************************************************************!*\
  !*** ./app/components/events/interfaces/frame/frameVariables.tsx ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FrameVariables": () => (/* binding */ FrameVariables)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _meta_annotatedText__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../meta/annotatedText */ "./app/components/events/meta/annotatedText/index.tsx");
/* harmony import */ var _keyValueList__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../keyValueList */ "./app/components/events/interfaces/keyValueList/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function FrameVariables(_ref) {
  let {
    data,
    meta
  } = _ref;

  // make sure that clicking on the variables does not actually do
  // anything on the containing element.
  const handlePreventToggling = () => event => {
    event.stopPropagation();
  };

  const transformedData = [];
  const dataKeys = Object.keys(data).reverse();

  for (const key of dataKeys) {
    var _meta$key3;

    transformedData.push({
      key,
      subject: key,
      value: Array.isArray(data[key]) ? data[key].map((v, i) => {
        var _meta$key, _meta$key$i;

        if (!v && meta !== null && meta !== void 0 && (_meta$key = meta[key]) !== null && _meta$key !== void 0 && (_meta$key$i = _meta$key[i]) !== null && _meta$key$i !== void 0 && _meta$key$i['']) {
          var _meta$key2, _meta$key2$i;

          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_meta_annotatedText__WEBPACK_IMPORTED_MODULE_1__["default"], {
            value: v,
            meta: meta === null || meta === void 0 ? void 0 : (_meta$key2 = meta[key]) === null || _meta$key2 === void 0 ? void 0 : (_meta$key2$i = _meta$key2[i]) === null || _meta$key2$i === void 0 ? void 0 : _meta$key2$i['']
          });
        }

        return v;
      }) : data[key],
      meta: meta === null || meta === void 0 ? void 0 : (_meta$key3 = meta[key]) === null || _meta$key3 === void 0 ? void 0 : _meta$key3['']
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_keyValueList__WEBPACK_IMPORTED_MODULE_2__["default"], {
    data: transformedData,
    onClick: handlePreventToggling,
    isContextData: true
  });
}
FrameVariables.displayName = "FrameVariables";

/***/ }),

/***/ "./app/components/events/interfaces/frame/functionName.tsx":
/*!*****************************************************************!*\
  !*** ./app/components/events/interfaces/frame/functionName.tsx ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FunctionName": () => (/* binding */ FunctionName)
/* harmony export */ });
/* harmony import */ var sentry_components_events_meta_annotatedText__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/events/meta/annotatedText */ "./app/components/events/meta/annotatedText/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function FunctionName(_ref) {
  let {
    frame,
    showCompleteFunctionName,
    hasHiddenDetails,
    className,
    meta,
    ...props
  } = _ref;

  const getValueOutput = () => {
    if (hasHiddenDetails && showCompleteFunctionName && frame.rawFunction) {
      var _meta$rawFunction;

      return {
        value: frame.rawFunction,
        meta: meta === null || meta === void 0 ? void 0 : (_meta$rawFunction = meta.rawFunction) === null || _meta$rawFunction === void 0 ? void 0 : _meta$rawFunction['']
      };
    }

    if (frame.function) {
      var _meta$function;

      return {
        value: frame.function,
        meta: meta === null || meta === void 0 ? void 0 : (_meta$function = meta.function) === null || _meta$function === void 0 ? void 0 : _meta$function['']
      };
    }

    if (frame.rawFunction) {
      var _meta$rawFunction2;

      return {
        value: frame.rawFunction,
        meta: meta === null || meta === void 0 ? void 0 : (_meta$rawFunction2 = meta.rawFunction) === null || _meta$rawFunction2 === void 0 ? void 0 : _meta$rawFunction2['']
      };
    }

    return undefined;
  };

  const valueOutput = getValueOutput();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("code", {
    className: className,
    ...props,
    children: !valueOutput ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('<unknown>') : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_events_meta_annotatedText__WEBPACK_IMPORTED_MODULE_0__["default"], {
      value: valueOutput.value,
      meta: valueOutput.meta
    })
  });
}
FunctionName.displayName = "FunctionName";

/***/ }),

/***/ "./app/components/events/interfaces/frame/groupingIndicator.tsx":
/*!**********************************************************************!*\
  !*** ./app/components/events/interfaces/frame/groupingIndicator.tsx ***!
  \**********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons_iconInfo__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/icons/iconInfo */ "./app/icons/iconInfo.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






function GroupingIndicator(_ref) {
  let {
    className
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(StyledTooltip, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('This frame appears in all other events related to this issue'),
    containerDisplayMode: "inline-flex",
    className: className,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_icons_iconInfo__WEBPACK_IMPORTED_MODULE_2__.IconInfo, {
      size: "xs",
      color: "gray300"
    })
  });
}

GroupingIndicator.displayName = "GroupingIndicator";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GroupingIndicator);

const StyledTooltip = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "eo868af0"
} : 0)( true ? {
  name: "1h3rtzg",
  styles: "align-items:center"
} : 0);

/***/ }),

/***/ "./app/components/events/interfaces/frame/line.tsx":
/*!*********************************************************!*\
  !*** ./app/components/events/interfaces/frame/line.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Line": () => (/* binding */ Line),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! classnames */ "../node_modules/classnames/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(classnames__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var scroll_to_element__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! scroll-to-element */ "../node_modules/scroll-to-element/index.js");
/* harmony import */ var scroll_to_element__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(scroll_to_element__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_stacktracePreview__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/stacktracePreview */ "./app/components/stacktracePreview.tsx");
/* harmony import */ var sentry_components_strictClick__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/strictClick */ "./app/components/strictClick.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_debugMetaStore__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/stores/debugMetaStore */ "./app/stores/debugMetaStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_utils_withSentryAppComponents__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/withSentryAppComponents */ "./app/utils/withSentryAppComponents.tsx");
/* harmony import */ var _debugMeta_utils__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ../debugMeta/utils */ "./app/components/events/interfaces/debugMeta/utils.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ../types */ "./app/components/events/interfaces/types.tsx");
/* harmony import */ var _context__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ./context */ "./app/components/events/interfaces/frame/context.tsx");
/* harmony import */ var _defaultTitle__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ./defaultTitle */ "./app/components/events/interfaces/frame/defaultTitle/index.tsx");
/* harmony import */ var _packageLink__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ./packageLink */ "./app/components/events/interfaces/frame/packageLink.tsx");
/* harmony import */ var _packageStatus__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ./packageStatus */ "./app/components/events/interfaces/frame/packageStatus.tsx");
/* harmony import */ var _symbol__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ./symbol */ "./app/components/events/interfaces/frame/symbol.tsx");
/* harmony import */ var _togglableAddress__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ./togglableAddress */ "./app/components/events/interfaces/frame/togglableAddress.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ./utils */ "./app/components/events/interfaces/frame/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

























function makeFilter(addr, addrMode, image) {
  if (!(!addrMode || addrMode === 'abs') && image) {
    return `${image.debug_id}!${addr}`;
  }

  return addr;
}

class Line extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      isExpanded: this.props.isExpanded
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "toggleContext", evt => {
      evt && evt.preventDefault();
      this.setState({
        isExpanded: !this.state.isExpanded
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "scrollToImage", event => {
      event.stopPropagation(); // to prevent collapsing if collapsible

      const {
        instructionAddr,
        addrMode
      } = this.props.data;

      if (instructionAddr) {
        sentry_stores_debugMetaStore__WEBPACK_IMPORTED_MODULE_11__.DebugMetaActions.updateFilter(makeFilter(instructionAddr, addrMode, this.props.image));
      }

      scroll_to_element__WEBPACK_IMPORTED_MODULE_5___default()('#images-loaded');
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "preventCollapse", evt => {
      evt.stopPropagation();
    });
  }

  getPlatform() {
    var _this$props$platform;

    // prioritize the frame platform but fall back to the platform
    // of the stack trace / exception
    return (0,_utils__WEBPACK_IMPORTED_MODULE_23__.getPlatform)(this.props.data.platform, (_this$props$platform = this.props.platform) !== null && _this$props$platform !== void 0 ? _this$props$platform : 'other');
  }

  isInlineFrame() {
    return this.props.prevFrame && this.getPlatform() === (this.props.prevFrame.platform || this.props.platform) && this.props.data.instructionAddr === this.props.prevFrame.instructionAddr;
  }

  isExpandable() {
    const {
      registers,
      platform,
      emptySourceNotation,
      isOnlyFrame,
      data
    } = this.props;
    return (0,_utils__WEBPACK_IMPORTED_MODULE_23__.isExpandable)({
      frame: data,
      registers,
      platform,
      emptySourceNotation,
      isOnlyFrame
    });
  }

  shouldShowLinkToImage() {
    const {
      isHoverPreviewed,
      data
    } = this.props;
    const {
      symbolicatorStatus
    } = data;
    return !!symbolicatorStatus && symbolicatorStatus !== _types__WEBPACK_IMPORTED_MODULE_16__.SymbolicatorStatus.UNKNOWN_IMAGE && !isHoverPreviewed;
  }

  packageStatus() {
    // this is the status of image that belongs to this frame
    const {
      image
    } = this.props;

    if (!image) {
      return 'empty';
    }

    const combinedStatus = (0,_debugMeta_utils__WEBPACK_IMPORTED_MODULE_15__.combineStatus)(image.debug_status, image.unwind_status);

    switch (combinedStatus) {
      case 'unused':
        return 'empty';

      case 'found':
        return 'success';

      default:
        return 'error';
    }
  }

  renderExpander() {
    if (!this.isExpandable()) {
      return null;
    }

    const {
      isHoverPreviewed
    } = this.props;
    const {
      isExpanded
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(ToggleContextButtonWrapper, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(ToggleContextButton, {
        className: "btn-toggle",
        "data-test-id": `toggle-button-${isExpanded ? 'expanded' : 'collapsed'}`,
        css: (0,_utils__WEBPACK_IMPORTED_MODULE_23__.isDotnet)(this.getPlatform()) && {
          display: 'block !important'
        } // remove important once we get rid of css files
        ,
        size: "zero",
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Toggle Context'),
        tooltipProps: isHoverPreviewed ? {
          delay: sentry_components_stacktracePreview__WEBPACK_IMPORTED_MODULE_7__.STACKTRACE_PREVIEW_TOOLTIP_DELAY
        } : undefined,
        onClick: this.toggleContext,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconChevron, {
          direction: isExpanded ? 'up' : 'down',
          size: "8px"
        })
      })
    });
  }

  leadsToApp() {
    const {
      data,
      nextFrame
    } = this.props;
    return !data.inApp && (nextFrame && nextFrame.inApp || !nextFrame);
  }

  isFoundByStackScanning() {
    const {
      data
    } = this.props;
    return data.trust === 'scan' || data.trust === 'cfi-scan';
  }

  renderLeadHint() {
    const {
      isExpanded
    } = this.state;

    if (isExpanded) {
      return null;
    }

    const leadsToApp = this.leadsToApp();

    if (!leadsToApp) {
      return null;
    }

    const {
      nextFrame
    } = this.props;
    return !nextFrame ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(LeadHint, {
      className: "leads-to-app-hint",
      width: "115px",
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Crashed in non-app'), ': ']
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(LeadHint, {
      className: "leads-to-app-hint",
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Called from'), ': ']
    });
  }

  renderRepeats() {
    const timesRepeated = this.props.timesRepeated;

    if (timesRepeated && timesRepeated > 0) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(RepeatedFrames, {
        title: `Frame repeated ${timesRepeated} time${timesRepeated === 1 ? '' : 's'}`,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(RepeatedContent, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(StyledIconRefresh, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)("span", {
            children: timesRepeated
          })]
        })
      });
    }

    return null;
  }

  renderDefaultLine() {
    var _this$props$platform2;

    const {
      isHoverPreviewed
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_strictClick__WEBPACK_IMPORTED_MODULE_8__["default"], {
      onClick: this.isExpandable() ? this.toggleContext : undefined,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(DefaultLine, {
        className: "title",
        "data-test-id": "title",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(VertCenterWrapper, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)("div", {
            children: [this.renderLeadHint(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(_defaultTitle__WEBPACK_IMPORTED_MODULE_18__["default"], {
              frame: this.props.data,
              platform: (_this$props$platform2 = this.props.platform) !== null && _this$props$platform2 !== void 0 ? _this$props$platform2 : 'other',
              isHoverPreviewed: isHoverPreviewed,
              meta: this.props.frameMeta
            })]
          }), this.renderRepeats()]
        }), this.renderExpander()]
      })
    });
  }

  renderNativeLine() {
    var _image$image_addr;

    const {
      data,
      showingAbsoluteAddress,
      onAddressToggle,
      onFunctionNameToggle,
      image,
      maxLengthOfRelativeAddress,
      includeSystemFrames,
      isFrameAfterLastNonApp,
      showCompleteFunctionName,
      isHoverPreviewed
    } = this.props;
    const leadHint = this.renderLeadHint();
    const packageStatus = this.packageStatus();
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_strictClick__WEBPACK_IMPORTED_MODULE_8__["default"], {
      onClick: this.isExpandable() ? this.toggleContext : undefined,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(DefaultLine, {
        className: "title as-table",
        "data-test-id": "title",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(NativeLineContent, {
          isFrameAfterLastNonApp: !!isFrameAfterLastNonApp,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(PackageInfo, {
            children: [leadHint, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(_packageLink__WEBPACK_IMPORTED_MODULE_19__["default"], {
              includeSystemFrames: !!includeSystemFrames,
              withLeadHint: leadHint !== null,
              packagePath: data.package,
              onClick: this.scrollToImage,
              isClickable: this.shouldShowLinkToImage(),
              isHoverPreviewed: isHoverPreviewed,
              children: !isHoverPreviewed && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(_packageStatus__WEBPACK_IMPORTED_MODULE_20__["default"], {
                status: packageStatus,
                tooltip: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Go to Images Loaded')
              })
            })]
          }), data.instructionAddr && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(_togglableAddress__WEBPACK_IMPORTED_MODULE_22__["default"], {
            address: data.instructionAddr,
            startingAddress: image ? (_image$image_addr = image.image_addr) !== null && _image$image_addr !== void 0 ? _image$image_addr : null : null,
            isAbsolute: !!showingAbsoluteAddress,
            isFoundByStackScanning: this.isFoundByStackScanning(),
            isInlineFrame: !!this.isInlineFrame(),
            onToggle: onAddressToggle,
            relativeAddressMaxlength: maxLengthOfRelativeAddress,
            isHoverPreviewed: isHoverPreviewed
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(_symbol__WEBPACK_IMPORTED_MODULE_21__["default"], {
            frame: data,
            showCompleteFunctionName: !!showCompleteFunctionName,
            onFunctionNameToggle: onFunctionNameToggle,
            isHoverPreviewed: isHoverPreviewed
          })]
        }), this.renderExpander()]
      })
    });
  }

  renderLine() {
    switch (this.getPlatform()) {
      case 'objc': // fallthrough

      case 'cocoa': // fallthrough

      case 'native':
        return this.renderNativeLine();

      default:
        return this.renderDefaultLine();
    }
  }

  render() {
    const data = this.props.data;
    const className = classnames__WEBPACK_IMPORTED_MODULE_4___default()({
      frame: true,
      'is-expandable': this.isExpandable(),
      expanded: this.state.isExpanded,
      collapsed: !this.state.isExpanded,
      'system-frame': !data.inApp,
      'frame-errors': data.errors,
      'leads-to-app': this.leadsToApp()
    });
    const props = {
      className
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(StyledLi, { ...props,
      children: [this.renderLine(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(_context__WEBPACK_IMPORTED_MODULE_17__["default"], {
        frame: data,
        event: this.props.event,
        registers: this.props.registers,
        components: this.props.components,
        hasContextSource: (0,_utils__WEBPACK_IMPORTED_MODULE_23__.hasContextSource)(data),
        hasContextVars: (0,_utils__WEBPACK_IMPORTED_MODULE_23__.hasContextVars)(data),
        hasContextRegisters: (0,_utils__WEBPACK_IMPORTED_MODULE_23__.hasContextRegisters)(this.props.registers),
        emptySourceNotation: this.props.emptySourceNotation,
        hasAssembly: (0,_utils__WEBPACK_IMPORTED_MODULE_23__.hasAssembly)(data, this.props.platform),
        expandable: this.isExpandable(),
        isExpanded: this.state.isExpanded,
        registersMeta: this.props.registersMeta,
        frameMeta: this.props.frameMeta
      })]
    });
  }

}
Line.displayName = "Line";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(Line, "defaultProps", {
  isExpanded: false,
  emptySourceNotation: false,
  isHoverPreviewed: false
});

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_13__["default"])((0,sentry_utils_withSentryAppComponents__WEBPACK_IMPORTED_MODULE_14__["default"])(Line, {
  componentType: 'stacktrace-link'
})));

const PackageInfo = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e4z9bjt10"
} : 0)("display:grid;grid-template-columns:auto 1fr;order:2;align-items:flex-start;@media (min-width: ", props => props.theme.breakpoints.small, "){order:0;}" + ( true ? "" : 0));

const RepeatedFrames = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e4z9bjt9"
} : 0)("display:inline-block;border-radius:50px;padding:1px 3px;margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";border-width:thin;border-style:solid;border-color:", p => p.theme.pink200, ";color:", p => p.theme.pink300, ";background-color:", p => p.theme.backgroundSecondary, ";white-space:nowrap;" + ( true ? "" : 0));

const VertCenterWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e4z9bjt8"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const RepeatedContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(VertCenterWrapper,  true ? {
  target: "e4z9bjt7"
} : 0)( true ? {
  name: "f7ay7b",
  styles: "justify-content:center"
} : 0);

const NativeLineContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e4z9bjt6"
} : 0)("display:grid;flex:1;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(0.5), ";grid-template-columns:", p => `minmax(${p.isFrameAfterLastNonApp ? '167px' : '117px'}, auto)  1fr`, ";align-items:center;justify-content:flex-start;@media (min-width: ", props => props.theme.breakpoints.small, "){grid-template-columns:", p => p.isFrameAfterLastNonApp ? '200px' : '150px', " minmax(117px, auto) 1fr;}@media (min-width: ", props => props.theme.breakpoints.large, ") and (max-width: ", props => props.theme.breakpoints.xlarge, "){grid-template-columns:", p => p.isFrameAfterLastNonApp ? '180px' : '140px', " minmax(117px, auto) 1fr;}" + ( true ? "" : 0));

const DefaultLine = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e4z9bjt5"
} : 0)( true ? {
  name: "1jifhxf",
  styles: "display:grid;grid-template-columns:1fr auto;align-items:center"
} : 0);

const StyledIconRefresh = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconRefresh,  true ? {
  target: "e4z9bjt4"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(0.25), ";" + ( true ? "" : 0));

const LeadHint = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e4z9bjt3"
} : 0)(p => p.theme.overflowEllipsis, " max-width:", p => p.width ? p.width : '67px', ";" + ( true ? "" : 0));

const ToggleContextButtonWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e4z9bjt2"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";" + ( true ? "" : 0)); // the Button's label has the padding of 3px because the button size has to be 16x16 px.


const ToggleContextButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e4z9bjt1"
} : 0)( true ? {
  name: "uliihv",
  styles: "span:first-child{padding:3px;}"
} : 0);

const StyledLi = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('li',  true ? {
  target: "e4z9bjt0"
} : 0)(_packageStatus__WEBPACK_IMPORTED_MODULE_20__.PackageStatusIcon, "{flex-shrink:0;}:hover{", _packageStatus__WEBPACK_IMPORTED_MODULE_20__.PackageStatusIcon, "{visibility:visible;}", _togglableAddress__WEBPACK_IMPORTED_MODULE_22__.AddressToggleIcon, "{visibility:visible;}", _symbol__WEBPACK_IMPORTED_MODULE_21__.FunctionNameToggleIcon, "{visibility:visible;}}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/events/interfaces/frame/lineV2/default.tsx":
/*!*******************************************************************!*\
  !*** ./app/components/events/interfaces/frame/lineV2/default.tsx ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_icons_iconRefresh__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/icons/iconRefresh */ "./app/icons/iconRefresh.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _defaultTitle__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../defaultTitle */ "./app/components/events/interfaces/frame/defaultTitle/index.tsx");
/* harmony import */ var _expander__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./expander */ "./app/components/events/interfaces/frame/lineV2/expander.tsx");
/* harmony import */ var _leadHint__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./leadHint */ "./app/components/events/interfaces/frame/lineV2/leadHint.tsx");
/* harmony import */ var _wrapper__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./wrapper */ "./app/components/events/interfaces/frame/lineV2/wrapper.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }












function Default(_ref) {
  let {
    frame,
    nextFrame,
    isHoverPreviewed,
    isExpanded,
    platform,
    timesRepeated,
    isUsedForGrouping,
    leadsToApp,
    onMouseDown,
    onClick,
    frameMeta,
    ...props
  } = _ref;

  function renderRepeats() {
    if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_4__.defined)(timesRepeated) && timesRepeated > 0) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(RepeatedFrames, {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.tn)('Frame repeated %s time', 'Frame repeated %s times', timesRepeated),
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(RepeatedContent, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(StyledIconRefresh, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("span", {
            children: timesRepeated
          })]
        })
      });
    }

    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(_wrapper__WEBPACK_IMPORTED_MODULE_8__["default"], {
    className: "title",
    onMouseDown: onMouseDown,
    onClick: onClick,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(VertCenterWrapper, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(Title, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_leadHint__WEBPACK_IMPORTED_MODULE_7__["default"], {
          isExpanded: isExpanded,
          nextFrame: nextFrame,
          leadsToApp: leadsToApp
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_defaultTitle__WEBPACK_IMPORTED_MODULE_5__["default"], {
          frame: frame,
          platform: platform,
          isHoverPreviewed: isHoverPreviewed,
          isUsedForGrouping: isUsedForGrouping,
          meta: frameMeta
        })]
      }), renderRepeats()]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_expander__WEBPACK_IMPORTED_MODULE_6__["default"], {
      isExpanded: isExpanded,
      isHoverPreviewed: isHoverPreviewed,
      platform: platform,
      ...props
    })]
  });
}

Default.displayName = "Default";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Default);

const VertCenterWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ek8al2z4"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ek8al2z3"
} : 0)( true ? {
  name: "cp1r96",
  styles: ">*{vertical-align:middle;line-height:1;}"
} : 0);

const RepeatedContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(VertCenterWrapper,  true ? {
  target: "ek8al2z2"
} : 0)( true ? {
  name: "f7ay7b",
  styles: "justify-content:center"
} : 0);

const RepeatedFrames = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ek8al2z1"
} : 0)("display:inline-block;border-radius:50px;padding:1px 3px;margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(1), ";border-width:thin;border-style:solid;border-color:", p => p.theme.pink200, ";color:", p => p.theme.pink300, ";background-color:", p => p.theme.backgroundSecondary, ";white-space:nowrap;" + ( true ? "" : 0));

const StyledIconRefresh = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons_iconRefresh__WEBPACK_IMPORTED_MODULE_1__.IconRefresh,  true ? {
  target: "ek8al2z0"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(0.25), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/events/interfaces/frame/lineV2/expander.tsx":
/*!********************************************************************!*\
  !*** ./app/components/events/interfaces/frame/lineV2/expander.tsx ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_stacktracePreview__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/stacktracePreview */ "./app/components/stacktracePreview.tsx");
/* harmony import */ var sentry_icons_iconChevron__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons/iconChevron */ "./app/icons/iconChevron.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../utils */ "./app/components/events/interfaces/frame/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









function Expander(_ref) {
  let {
    isExpandable,
    isHoverPreviewed,
    isExpanded,
    platform,
    onToggleContext
  } = _ref;

  if (!isExpandable) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(StyledButton, {
    className: "btn-toggle",
    css: (0,_utils__WEBPACK_IMPORTED_MODULE_6__.isDotnet)(platform) && {
      display: 'block !important'
    } // remove important once we get rid of css files
    ,
    size: "zero",
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Toggle Context'),
    tooltipProps: isHoverPreviewed ? {
      delay: sentry_components_stacktracePreview__WEBPACK_IMPORTED_MODULE_2__.STACKTRACE_PREVIEW_TOOLTIP_DELAY
    } : undefined,
    onClick: onToggleContext,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_icons_iconChevron__WEBPACK_IMPORTED_MODULE_3__.IconChevron, {
      direction: isExpanded ? 'up' : 'down',
      size: "8px"
    })
  });
}

Expander.displayName = "Expander";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Expander); // the Button's label has the padding of 3px because the button size has to be 16x16 px.

const StyledButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "e1tqrvas0"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), ";span:first-child{padding:3px;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/events/interfaces/frame/lineV2/index.tsx":
/*!*****************************************************************!*\
  !*** ./app/components/events/interfaces/frame/lineV2/index.tsx ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! classnames */ "../node_modules/classnames/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(classnames__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/list/listItem */ "./app/components/list/listItem.tsx");
/* harmony import */ var sentry_components_strictClick__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/strictClick */ "./app/components/strictClick.tsx");
/* harmony import */ var sentry_utils_withSentryAppComponents__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/withSentryAppComponents */ "./app/utils/withSentryAppComponents.tsx");
/* harmony import */ var _context__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../context */ "./app/components/events/interfaces/frame/context.tsx");
/* harmony import */ var _packageStatus__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../packageStatus */ "./app/components/events/interfaces/frame/packageStatus.tsx");
/* harmony import */ var _symbol__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../symbol */ "./app/components/events/interfaces/frame/symbol.tsx");
/* harmony import */ var _togglableAddress__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ../togglableAddress */ "./app/components/events/interfaces/frame/togglableAddress.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ../utils */ "./app/components/events/interfaces/frame/utils.tsx");
/* harmony import */ var _default__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./default */ "./app/components/events/interfaces/frame/lineV2/default.tsx");
/* harmony import */ var _native__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./native */ "./app/components/events/interfaces/frame/lineV2/native.tsx");
/* harmony import */ var _nativeV2__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./nativeV2 */ "./app/components/events/interfaces/frame/lineV2/nativeV2.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


















function Line(_ref) {
  var _props$platform, _props$isExpanded, _frame$errors;

  let {
    frame,
    nextFrame,
    prevFrame,
    timesRepeated,
    includeSystemFrames,
    onAddressToggle,
    onFunctionNameToggle,
    showingAbsoluteAddress,
    showCompleteFunctionName,
    isFrameAfterLastNonApp,
    isUsedForGrouping,
    maxLengthOfRelativeAddress,
    image,
    registers,
    isOnlyFrame,
    event,
    components,
    frameMeta,
    registersMeta,
    emptySourceNotation = false,

    /**
     * Is the stack trace being previewed in a hovercard?
     */
    isHoverPreviewed = false,
    nativeV2 = false,
    ...props
  } = _ref;

  /* Prioritize the frame platform but fall back to the platform
   of the stack trace / exception */
  const platform = (0,_utils__WEBPACK_IMPORTED_MODULE_11__.getPlatform)(frame.platform, (_props$platform = props.platform) !== null && _props$platform !== void 0 ? _props$platform : 'other');
  const leadsToApp = !frame.inApp && (nextFrame && nextFrame.inApp || !nextFrame);
  const expandable = !leadsToApp || includeSystemFrames ? (0,_utils__WEBPACK_IMPORTED_MODULE_11__.isExpandable)({
    frame,
    registers,
    platform,
    emptySourceNotation,
    isOnlyFrame
  }) : false;
  const [isExpanded, setIsExpanded] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(expandable ? (_props$isExpanded = props.isExpanded) !== null && _props$isExpanded !== void 0 ? _props$isExpanded : false : false);

  function toggleContext(evt) {
    evt.preventDefault();
    setIsExpanded(!isExpanded);
  }

  function renderLine() {
    switch (platform) {
      case 'objc':
      case 'cocoa':
      case 'native':
        return nativeV2 ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_nativeV2__WEBPACK_IMPORTED_MODULE_14__["default"], {
          leadsToApp: leadsToApp,
          frame: frame,
          prevFrame: prevFrame,
          nextFrame: nextFrame,
          isHoverPreviewed: isHoverPreviewed,
          platform: platform,
          isExpanded: isExpanded,
          isExpandable: expandable,
          includeSystemFrames: includeSystemFrames,
          isFrameAfterLastNonApp: isFrameAfterLastNonApp,
          onToggleContext: toggleContext,
          image: image,
          maxLengthOfRelativeAddress: maxLengthOfRelativeAddress,
          isUsedForGrouping: isUsedForGrouping
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_native__WEBPACK_IMPORTED_MODULE_13__["default"], {
          leadsToApp: leadsToApp,
          frame: frame,
          prevFrame: prevFrame,
          nextFrame: nextFrame,
          isHoverPreviewed: isHoverPreviewed,
          platform: platform,
          isExpanded: isExpanded,
          isExpandable: expandable,
          onAddressToggle: onAddressToggle,
          onFunctionNameToggle: onFunctionNameToggle,
          includeSystemFrames: includeSystemFrames,
          showingAbsoluteAddress: showingAbsoluteAddress,
          showCompleteFunctionName: showCompleteFunctionName,
          isFrameAfterLastNonApp: isFrameAfterLastNonApp,
          onToggleContext: toggleContext,
          image: image,
          maxLengthOfRelativeAddress: maxLengthOfRelativeAddress,
          isUsedForGrouping: isUsedForGrouping
        });

      default:
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_default__WEBPACK_IMPORTED_MODULE_12__["default"], {
          leadsToApp: leadsToApp,
          frame: frame,
          nextFrame: nextFrame,
          timesRepeated: timesRepeated,
          isHoverPreviewed: isHoverPreviewed,
          platform: platform,
          isExpanded: isExpanded,
          isExpandable: expandable,
          onToggleContext: toggleContext,
          isUsedForGrouping: isUsedForGrouping,
          frameMeta: frameMeta
        });
    }
  }

  const className = classnames__WEBPACK_IMPORTED_MODULE_3___default()({
    frame: true,
    'is-expandable': expandable,
    expanded: isExpanded,
    collapsed: !isExpanded,
    'system-frame': !frame.inApp,
    'frame-errors': !!((_frame$errors = frame.errors) !== null && _frame$errors !== void 0 ? _frame$errors : []).length,
    'leads-to-app': leadsToApp
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(StyleListItem, {
    className: className,
    "data-test-id": "stack-trace-frame",
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_strictClick__WEBPACK_IMPORTED_MODULE_5__["default"], {
      onClick: expandable ? toggleContext : undefined,
      children: renderLine()
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_context__WEBPACK_IMPORTED_MODULE_7__["default"], {
      frame: frame,
      event: event,
      registers: registers,
      components: components,
      hasContextSource: (0,_utils__WEBPACK_IMPORTED_MODULE_11__.hasContextSource)(frame),
      hasContextVars: (0,_utils__WEBPACK_IMPORTED_MODULE_11__.hasContextVars)(frame),
      hasContextRegisters: (0,_utils__WEBPACK_IMPORTED_MODULE_11__.hasContextRegisters)(registers),
      emptySourceNotation: emptySourceNotation,
      hasAssembly: (0,_utils__WEBPACK_IMPORTED_MODULE_11__.hasAssembly)(frame, platform),
      expandable: expandable,
      isExpanded: isExpanded,
      registersMeta: registersMeta,
      frameMeta: frameMeta
    })]
  });
}

Line.displayName = "Line";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withSentryAppComponents__WEBPACK_IMPORTED_MODULE_6__["default"])(Line, {
  componentType: 'stacktrace-link'
}));

const StyleListItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "e1nxtbgi0"
} : 0)("overflow:hidden;:first-child{border-top:none;}", _packageStatus__WEBPACK_IMPORTED_MODULE_8__.PackageStatusIcon, "{flex-shrink:0;}:hover{", _packageStatus__WEBPACK_IMPORTED_MODULE_8__.PackageStatusIcon, "{visibility:visible;}", _togglableAddress__WEBPACK_IMPORTED_MODULE_10__.AddressToggleIcon, "{visibility:visible;}", _symbol__WEBPACK_IMPORTED_MODULE_9__.FunctionNameToggleIcon, "{visibility:visible;}}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/events/interfaces/frame/lineV2/leadHint.tsx":
/*!********************************************************************!*\
  !*** ./app/components/events/interfaces/frame/lineV2/leadHint.tsx ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function LeadHint(_ref) {
  let {
    leadsToApp,
    isExpanded,
    nextFrame
  } = _ref;

  if (isExpanded || !leadsToApp) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)(Wrapper, {
    className: "leads-to-app-hint",
    width: !nextFrame ? '115px' : '',
    children: [!nextFrame ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Crashed in non-app') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Called from'), ': ']
  });
}

LeadHint.displayName = "LeadHint";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (LeadHint);

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1m80khw0"
} : 0)(p => p.theme.overflowEllipsis, " max-width:", p => p.width ? p.width : '67px', ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/events/interfaces/frame/lineV2/native.tsx":
/*!******************************************************************!*\
  !*** ./app/components/events/interfaces/frame/lineV2/native.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var scroll_to_element__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! scroll-to-element */ "../node_modules/scroll-to-element/index.js");
/* harmony import */ var scroll_to_element__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(scroll_to_element__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_debugMetaStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/debugMetaStore */ "./app/stores/debugMetaStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _debugMeta_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../../debugMeta/utils */ "./app/components/events/interfaces/debugMeta/utils.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../../types */ "./app/components/events/interfaces/types.tsx");
/* harmony import */ var _packageLink__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../packageLink */ "./app/components/events/interfaces/frame/packageLink.tsx");
/* harmony import */ var _packageStatus__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../packageStatus */ "./app/components/events/interfaces/frame/packageStatus.tsx");
/* harmony import */ var _symbol__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../symbol */ "./app/components/events/interfaces/frame/symbol.tsx");
/* harmony import */ var _togglableAddress__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ../togglableAddress */ "./app/components/events/interfaces/frame/togglableAddress.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ../utils */ "./app/components/events/interfaces/frame/utils.tsx");
/* harmony import */ var _expander__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./expander */ "./app/components/events/interfaces/frame/lineV2/expander.tsx");
/* harmony import */ var _leadHint__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./leadHint */ "./app/components/events/interfaces/frame/lineV2/leadHint.tsx");
/* harmony import */ var _wrapper__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./wrapper */ "./app/components/events/interfaces/frame/lineV2/wrapper.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


















function Native(_ref) {
  var _image$image_addr;

  let {
    frame,
    isFrameAfterLastNonApp,
    isExpanded,
    isHoverPreviewed,
    onAddressToggle,
    image,
    includeSystemFrames,
    showingAbsoluteAddress,
    showCompleteFunctionName,
    onFunctionNameToggle,
    maxLengthOfRelativeAddress,
    platform,
    prevFrame,
    isUsedForGrouping,
    nextFrame,
    leadsToApp,
    onMouseDown,
    onClick,
    ...props
  } = _ref;
  const {
    instructionAddr,
    trust,
    addrMode,
    symbolicatorStatus
  } = frame !== null && frame !== void 0 ? frame : {};

  function packageStatus() {
    // this is the status of image that belongs to this frame
    if (!image) {
      return 'empty';
    }

    const combinedStatus = (0,_debugMeta_utils__WEBPACK_IMPORTED_MODULE_5__.combineStatus)(image.debug_status, image.unwind_status);

    switch (combinedStatus) {
      case 'unused':
        return 'empty';

      case 'found':
        return 'success';

      default:
        return 'error';
    }
  }

  function makeFilter(addr) {
    if (!(!addrMode || addrMode === 'abs') && image) {
      return `${image.debug_id}!${addr}`;
    }

    return addr;
  }

  function scrollToImage(event) {
    event.stopPropagation(); // to prevent collapsing if collapsible

    if (instructionAddr) {
      sentry_stores_debugMetaStore__WEBPACK_IMPORTED_MODULE_3__.DebugMetaActions.updateFilter(makeFilter(instructionAddr));
    }

    scroll_to_element__WEBPACK_IMPORTED_MODULE_1___default()('#images-loaded');
  }

  const shouldShowLinkToImage = !!symbolicatorStatus && symbolicatorStatus !== _types__WEBPACK_IMPORTED_MODULE_6__.SymbolicatorStatus.UNKNOWN_IMAGE && !isHoverPreviewed;
  const isInlineFrame = prevFrame && (0,_utils__WEBPACK_IMPORTED_MODULE_11__.getPlatform)(frame.platform, platform !== null && platform !== void 0 ? platform : 'other') === (prevFrame.platform || platform) && instructionAddr === prevFrame.instructionAddr;
  const isFoundByStackScanning = trust === 'scan' || trust === 'cfi-scan';
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(_wrapper__WEBPACK_IMPORTED_MODULE_14__["default"], {
    className: "title as-table",
    onMouseDown: onMouseDown,
    onClick: onClick,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(NativeLineContent, {
      isFrameAfterLastNonApp: !!isFrameAfterLastNonApp,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(PackageInfo, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_leadHint__WEBPACK_IMPORTED_MODULE_13__["default"], {
          isExpanded: isExpanded,
          nextFrame: nextFrame,
          leadsToApp: leadsToApp
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_packageLink__WEBPACK_IMPORTED_MODULE_7__["default"], {
          includeSystemFrames: !!includeSystemFrames,
          withLeadHint: !(isExpanded || !leadsToApp),
          packagePath: frame.package,
          onClick: scrollToImage,
          isClickable: shouldShowLinkToImage,
          isHoverPreviewed: isHoverPreviewed,
          children: !isHoverPreviewed && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_packageStatus__WEBPACK_IMPORTED_MODULE_8__["default"], {
            status: packageStatus(),
            tooltip: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Go to Images Loaded')
          })
        })]
      }), instructionAddr && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_togglableAddress__WEBPACK_IMPORTED_MODULE_10__["default"], {
        address: instructionAddr,
        startingAddress: image ? (_image$image_addr = image.image_addr) !== null && _image$image_addr !== void 0 ? _image$image_addr : null : null,
        isAbsolute: !!showingAbsoluteAddress,
        isFoundByStackScanning: isFoundByStackScanning,
        isInlineFrame: !!isInlineFrame,
        onToggle: onAddressToggle,
        relativeAddressMaxlength: maxLengthOfRelativeAddress,
        isHoverPreviewed: isHoverPreviewed
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_symbol__WEBPACK_IMPORTED_MODULE_9__["default"], {
        frame: frame,
        showCompleteFunctionName: !!showCompleteFunctionName,
        onFunctionNameToggle: onFunctionNameToggle,
        isHoverPreviewed: isHoverPreviewed,
        isUsedForGrouping: isUsedForGrouping
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_expander__WEBPACK_IMPORTED_MODULE_12__["default"], {
      isExpanded: isExpanded,
      isHoverPreviewed: isHoverPreviewed,
      platform: platform,
      ...props
    })]
  });
}

Native.displayName = "Native";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Native);

const PackageInfo = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e16ev3tf1"
} : 0)("display:grid;grid-template-columns:auto 1fr;order:2;align-items:flex-start;@media (min-width: ", props => props.theme.breakpoints.small, "){order:0;}" + ( true ? "" : 0));

const NativeLineContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e16ev3tf0"
} : 0)("display:grid;flex:1;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(0.5), ";grid-template-columns:auto 1fr;align-items:center;justify-content:flex-start;@media (min-width: ", props => props.theme.breakpoints.small, "){grid-template-columns:", p => p.isFrameAfterLastNonApp ? '200px' : '150px', " minmax(117px, auto) 1fr;}@media (min-width: ", props => props.theme.breakpoints.large, ") and (max-width: ", props => props.theme.breakpoints.xlarge, "){grid-template-columns:", p => p.isFrameAfterLastNonApp ? '180px' : '140px', " minmax(117px, auto) 1fr;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/events/interfaces/frame/lineV2/nativeV2.tsx":
/*!********************************************************************!*\
  !*** ./app/components/events/interfaces/frame/lineV2/nativeV2.tsx ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var scroll_to_element__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! scroll-to-element */ "../node_modules/scroll-to-element/index.js");
/* harmony import */ var scroll_to_element__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(scroll_to_element__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_components_events_traceEventDataSection__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/events/traceEventDataSection */ "./app/components/events/traceEventDataSection.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_debugMetaStore__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/stores/debugMetaStore */ "./app/stores/debugMetaStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _debugMeta_utils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../../debugMeta/utils */ "./app/components/events/interfaces/debugMeta/utils.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../../types */ "./app/components/events/interfaces/types.tsx");
/* harmony import */ var _packageLink__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ../packageLink */ "./app/components/events/interfaces/frame/packageLink.tsx");
/* harmony import */ var _packageStatus__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ../packageStatus */ "./app/components/events/interfaces/frame/packageStatus.tsx");
/* harmony import */ var _symbol__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ../symbol */ "./app/components/events/interfaces/frame/symbol.tsx");
/* harmony import */ var _togglableAddress__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ../togglableAddress */ "./app/components/events/interfaces/frame/togglableAddress.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ../utils */ "./app/components/events/interfaces/frame/utils.tsx");
/* harmony import */ var _expander__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./expander */ "./app/components/events/interfaces/frame/lineV2/expander.tsx");
/* harmony import */ var _leadHint__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ./leadHint */ "./app/components/events/interfaces/frame/lineV2/leadHint.tsx");
/* harmony import */ var _wrapper__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ./wrapper */ "./app/components/events/interfaces/frame/lineV2/wrapper.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





















function Native(_ref) {
  var _image$image_addr;

  let {
    frame,
    isFrameAfterLastNonApp,
    isExpanded,
    isHoverPreviewed,
    image,
    includeSystemFrames,
    maxLengthOfRelativeAddress,
    platform,
    prevFrame,
    isUsedForGrouping,
    nextFrame,
    leadsToApp,
    onMouseDown,
    onClick,
    ...props
  } = _ref;
  const traceEventDataSectionContext = (0,react__WEBPACK_IMPORTED_MODULE_2__.useContext)(sentry_components_events_traceEventDataSection__WEBPACK_IMPORTED_MODULE_4__.TraceEventDataSectionContext);

  if (!traceEventDataSectionContext) {
    return null;
  }

  const {
    instructionAddr,
    trust,
    addrMode,
    symbolicatorStatus
  } = frame !== null && frame !== void 0 ? frame : {};

  function packageStatus() {
    // this is the status of image that belongs to this frame
    if (!image) {
      return 'empty';
    }

    const combinedStatus = (0,_debugMeta_utils__WEBPACK_IMPORTED_MODULE_8__.combineStatus)(image.debug_status, image.unwind_status);

    switch (combinedStatus) {
      case 'unused':
        return 'empty';

      case 'found':
        return 'success';

      default:
        return 'error';
    }
  }

  function makeFilter(addr) {
    if (!(!addrMode || addrMode === 'abs') && image) {
      return `${image.debug_id}!${addr}`;
    }

    return addr;
  }

  function scrollToImage(event) {
    event.stopPropagation(); // to prevent collapsing if collapsible

    if (instructionAddr) {
      sentry_stores_debugMetaStore__WEBPACK_IMPORTED_MODULE_6__.DebugMetaActions.updateFilter(makeFilter(instructionAddr));
    }

    scroll_to_element__WEBPACK_IMPORTED_MODULE_3___default()('#images-loaded');
  }

  const shouldShowLinkToImage = !!symbolicatorStatus && symbolicatorStatus !== _types__WEBPACK_IMPORTED_MODULE_9__.SymbolicatorStatus.UNKNOWN_IMAGE && !isHoverPreviewed;
  const isInlineFrame = prevFrame && (0,_utils__WEBPACK_IMPORTED_MODULE_14__.getPlatform)(frame.platform, platform !== null && platform !== void 0 ? platform : 'other') === (prevFrame.platform || platform) && instructionAddr === prevFrame.instructionAddr;
  const isFoundByStackScanning = trust === 'scan' || trust === 'cfi-scan';
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(_wrapper__WEBPACK_IMPORTED_MODULE_17__["default"], {
    className: "title as-table",
    onMouseDown: onMouseDown,
    onClick: onClick,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(NativeLineContent, {
      isFrameAfterLastNonApp: !!isFrameAfterLastNonApp,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(PackageInfo, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(_leadHint__WEBPACK_IMPORTED_MODULE_16__["default"], {
          isExpanded: isExpanded,
          nextFrame: nextFrame,
          leadsToApp: leadsToApp
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(_packageLink__WEBPACK_IMPORTED_MODULE_10__["default"], {
          includeSystemFrames: !!includeSystemFrames,
          withLeadHint: !(isExpanded || !leadsToApp),
          packagePath: frame.package,
          onClick: scrollToImage,
          isClickable: shouldShowLinkToImage,
          isHoverPreviewed: isHoverPreviewed,
          children: !isHoverPreviewed && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(_packageStatus__WEBPACK_IMPORTED_MODULE_11__["default"], {
            status: packageStatus(),
            tooltip: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Go to Images Loaded')
          })
        })]
      }), instructionAddr && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(_togglableAddress__WEBPACK_IMPORTED_MODULE_13__["default"], {
        address: instructionAddr,
        startingAddress: image ? (_image$image_addr = image.image_addr) !== null && _image$image_addr !== void 0 ? _image$image_addr : null : null,
        isAbsolute: traceEventDataSectionContext.display.includes('absolute-addresses'),
        isFoundByStackScanning: isFoundByStackScanning,
        isInlineFrame: !!isInlineFrame,
        relativeAddressMaxlength: maxLengthOfRelativeAddress,
        isHoverPreviewed: isHoverPreviewed
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(_symbol__WEBPACK_IMPORTED_MODULE_12__["default"], {
        frame: frame,
        showCompleteFunctionName: traceEventDataSectionContext.display.includes('verbose-function-names'),
        absoluteFilePaths: traceEventDataSectionContext.display.includes('absolute-file-paths'),
        isHoverPreviewed: isHoverPreviewed,
        isUsedForGrouping: isUsedForGrouping,
        nativeStackTraceV2: true
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(_expander__WEBPACK_IMPORTED_MODULE_15__["default"], {
      isExpanded: isExpanded,
      isHoverPreviewed: isHoverPreviewed,
      platform: platform,
      ...props
    })]
  });
}

Native.displayName = "Native";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Native);

const PackageInfo = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "ehwbtrc1"
} : 0)("display:grid;grid-template-columns:auto 1fr;order:2;align-items:flex-start;@media (min-width: ", props => props.theme.breakpoints.small, "){order:0;}" + ( true ? "" : 0));

const NativeLineContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ehwbtrc0"
} : 0)("display:grid;flex:1;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(0.5), ";grid-template-columns:auto 1fr;align-items:center;justify-content:flex-start;@media (min-width: ", props => props.theme.breakpoints.small, "){grid-template-columns:", p => p.isFrameAfterLastNonApp ? '200px' : '150px', " minmax(117px, auto) 1fr;}@media (min-width: ", props => props.theme.breakpoints.large, ") and (max-width: ", props => props.theme.breakpoints.xlarge, "){grid-template-columns:", p => p.isFrameAfterLastNonApp ? '180px' : '140px', " minmax(117px, auto) 1fr;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/events/interfaces/frame/lineV2/wrapper.tsx":
/*!*******************************************************************!*\
  !*** ./app/components/events/interfaces/frame/lineV2/wrapper.tsx ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1njak3d0"
} : 0)( true ? {
  name: "1uffw4e",
  styles: "display:grid;grid-template-columns:1fr auto"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Wrapper);

/***/ }),

/***/ "./app/components/events/interfaces/frame/openInContextLine.tsx":
/*!**********************************************************************!*\
  !*** ./app/components/events/interfaces/frame/openInContextLine.tsx ***!
  \**********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "OpenInContainer": () => (/* binding */ OpenInContainer),
/* harmony export */   "OpenInContextLine": () => (/* binding */ OpenInContextLine),
/* harmony export */   "OpenInLink": () => (/* binding */ OpenInLink),
/* harmony export */   "OpenInName": () => (/* binding */ OpenInName)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_sentryAppComponentIcon__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/sentryAppComponentIcon */ "./app/components/sentryAppComponentIcon.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_recordSentryAppInteraction__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/recordSentryAppInteraction */ "./app/utils/recordSentryAppInteraction.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










const OpenInContextLine = _ref => {
  let {
    lineNo,
    filename,
    components
  } = _ref;

  const handleRecordInteraction = slug => () => {
    (0,sentry_utils_recordSentryAppInteraction__WEBPACK_IMPORTED_MODULE_6__.recordInteraction)(slug, 'sentry_app_component_interacted', {
      componentType: 'stacktrace-link'
    });
  };

  const getUrl = url => {
    return (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_5__.addQueryParamsToExistingUrl)(url, {
      lineNo,
      filename
    });
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(OpenInContainer, {
    columnQuantity: components.length + 1,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("div", {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Open this line in')
    }), components.map(component => {
      const url = getUrl(component.schema.url);
      const {
        slug
      } = component.sentryApp;
      const onClickRecordInteraction = handleRecordInteraction(slug);
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(OpenInLink, {
        "data-test-id": `stacktrace-link-${slug}`,
        href: url,
        onClick: onClickRecordInteraction,
        onContextMenu: onClickRecordInteraction,
        openInNewTab: true,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_sentryAppComponentIcon__WEBPACK_IMPORTED_MODULE_2__["default"], {
          sentryAppComponent: component
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(OpenInName, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)(`${component.sentryApp.name}`)
        })]
      }, component.uuid);
    })]
  });
};

OpenInContextLine.displayName = "OpenInContextLine";

const OpenInContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1r364ic2"
} : 0)("position:relative;z-index:1;display:grid;grid-template-columns:repeat(", p => p.columnQuantity, ", max-content);gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1), ";color:", p => p.theme.subText, ";background-color:", p => p.theme.background, ";font-family:", p => p.theme.text.family, ";border-bottom:1px solid ", p => p.theme.border, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(0.25), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(3), ";box-shadow:", p => p.theme.dropShadowLightest, ";text-indent:initial;overflow:auto;white-space:nowrap;" + ( true ? "" : 0));
const OpenInLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "e1r364ic1"
} : 0)("display:inline-grid;align-items:center;grid-template-columns:max-content auto;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(0.75), ";color:", p => p.theme.gray300, ";" + ( true ? "" : 0));
const OpenInName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('strong',  true ? {
  target: "e1r364ic0"
} : 0)("color:", p => p.theme.subText, ";font-weight:700;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/events/interfaces/frame/packageLink.tsx":
/*!****************************************************************!*\
  !*** ./app/components/events/interfaces/frame/packageLink.tsx ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Package": () => (/* binding */ Package),
/* harmony export */   "PackageName": () => (/* binding */ PackageName),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_events_interfaces_frame_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/events/interfaces/frame/utils */ "./app/components/events/interfaces/frame/utils.tsx");
/* harmony import */ var sentry_components_stacktracePreview__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/stacktracePreview */ "./app/components/stacktracePreview.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












class PackageLink extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleClick", event => {
      const {
        isClickable,
        onClick
      } = this.props;

      if (isClickable) {
        onClick(event);
      }
    });
  }

  render() {
    const {
      packagePath,
      isClickable,
      withLeadHint,
      children,
      includeSystemFrames,
      isHoverPreviewed
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(Package, {
      onClick: this.handleClick,
      isClickable: isClickable,
      withLeadHint: withLeadHint,
      includeSystemFrames: includeSystemFrames,
      children: [(0,sentry_utils__WEBPACK_IMPORTED_MODULE_8__.defined)(packagePath) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_6__["default"], {
        title: packagePath,
        delay: isHoverPreviewed ? sentry_components_stacktracePreview__WEBPACK_IMPORTED_MODULE_5__.STACKTRACE_PREVIEW_TOOLTIP_DELAY : undefined,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(PackageName, {
          isClickable: isClickable,
          withLeadHint: withLeadHint,
          includeSystemFrames: includeSystemFrames,
          children: (0,sentry_components_events_interfaces_frame_utils__WEBPACK_IMPORTED_MODULE_4__.trimPackage)(packagePath)
        })
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("span", {
        children: '<unknown>'
      }), children]
    });
  }

}

PackageLink.displayName = "PackageLink";
const Package = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('a',  true ? {
  target: "e1f3t8au1"
} : 0)("font-size:13px;font-weight:bold;padding:0 0 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(0.5), ";color:", p => p.theme.textColor, ";:hover{color:", p => p.theme.textColor, ";}cursor:", p => p.isClickable ? 'pointer' : 'default', ";display:flex;align-items:center;", p => p.withLeadHint && (p.includeSystemFrames ? `max-width: 89px;` : `max-width: 76px;`), "@media (min-width: ", p => p.theme.breakpoints.large, ") and (max-width: ", p => p.theme.breakpoints.xlarge, "){", p => p.withLeadHint && (p.includeSystemFrames ? `max-width: 76px;` : `max-width: 63px;`), ";}" + ( true ? "" : 0));
const PackageName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e1f3t8au0"
} : 0)("max-width:", p => p.withLeadHint && p.isClickable && !p.includeSystemFrames ? '45px' : '104px', ";", p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PackageLink);

/***/ }),

/***/ "./app/components/events/interfaces/frame/packageStatus.tsx":
/*!******************************************************************!*\
  !*** ./app/components/events/interfaces/frame/packageStatus.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "PackageStatusIcon": () => (/* binding */ PackageStatusIcon),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function PackageStatus(_ref) {
  let {
    status,
    tooltip
  } = _ref;

  const getIcon = () => {
    switch (status) {
      case 'success':
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_2__.IconCheckmark, {
          isCircled: true,
          color: "green300",
          size: "xs"
        });

      case 'empty':
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_2__.IconCircle, {
          size: "xs"
        });

      case 'error':
      default:
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_2__.IconFlag, {
          color: "red300",
          size: "xs"
        });
    }
  };

  const icon = getIcon();

  if (status === 'empty') {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(StyledTooltip, {
    title: tooltip,
    disabled: !(tooltip && tooltip.length),
    containerDisplayMode: "inline-flex",
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(PackageStatusIcon, {
      children: icon
    })
  });
}

PackageStatus.displayName = "PackageStatus";

const StyledTooltip = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "ewvw62l1"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(0.75), ";" + ( true ? "" : 0));

const PackageStatusIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "ewvw62l0"
} : 0)("height:12px;align-items:center;cursor:pointer;visibility:hidden;display:none;@media (min-width: ", p => p.theme.breakpoints.small, "){display:block;}" + ( true ? "" : 0));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PackageStatus);

/***/ }),

/***/ "./app/components/events/interfaces/frame/stacktraceLink.tsx":
/*!*******************************************************************!*\
  !*** ./app/components/events/interfaces/frame/stacktraceLink.tsx ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CodeMappingButtonContainer": () => (/* binding */ CodeMappingButtonContainer),
/* harmony export */   "StacktraceLink": () => (/* binding */ StacktraceLink),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_actionCreators_prompts__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/prompts */ "./app/actionCreators/prompts.tsx");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/hovercard */ "./app/components/hovercard.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_icons_iconClose__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/icons/iconClose */ "./app/icons/iconClose.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_integrations_stacktraceLinkAnalyticsEvents__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/analytics/integrations/stacktraceLinkAnalyticsEvents */ "./app/utils/analytics/integrations/stacktraceLinkAnalyticsEvents.ts");
/* harmony import */ var sentry_utils_handleXhrErrorResponse__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/handleXhrErrorResponse */ "./app/utils/handleXhrErrorResponse.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var sentry_utils_promptIsDismissed__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/promptIsDismissed */ "./app/utils/promptIsDismissed.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var _openInContextLine__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ./openInContextLine */ "./app/components/events/interfaces/frame/openInContextLine.tsx");
/* harmony import */ var _stacktraceLinkModal__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ./stacktraceLinkModal */ "./app/components/events/interfaces/frame/stacktraceLinkModal.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






















class StacktraceLink extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_8__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmit", () => {
      this.reloadData();
    });
  }

  get project() {
    // we can't use the withProject HoC on an the issue page
    // so we ge around that by using the withProjects HoC
    // and look up the project from the list
    const {
      projects,
      event
    } = this.props;
    return projects.find(project => project.id === event.projectID);
  }

  get match() {
    return this.state.match;
  }

  get config() {
    return this.match.config;
  }

  get integrations() {
    return this.match.integrations;
  }

  get errorText() {
    const error = this.match.error;

    switch (error) {
      case 'stack_root_mismatch':
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Error matching your configuration.');

      case 'file_not_found':
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Source file not found.');

      case 'integration_link_forbidden':
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('The repository integration was disconnected.');

      default:
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('There was an error encountered with the code mapping for this project');
    }
  }

  componentDidMount() {
    this.promptsCheck();
  }

  async promptsCheck() {
    var _this$project;

    const {
      organization
    } = this.props;
    const prompt = await (0,sentry_actionCreators_prompts__WEBPACK_IMPORTED_MODULE_6__.promptsCheck)(this.api, {
      organizationId: organization.id,
      projectId: (_this$project = this.project) === null || _this$project === void 0 ? void 0 : _this$project.id,
      feature: 'stacktrace_link'
    });
    this.setState({
      isDismissed: (0,sentry_utils_promptIsDismissed__WEBPACK_IMPORTED_MODULE_17__.promptIsDismissed)(prompt),
      promptLoaded: true
    });
  }

  dismissPrompt() {
    var _this$project2;

    const {
      organization
    } = this.props;
    (0,sentry_actionCreators_prompts__WEBPACK_IMPORTED_MODULE_6__.promptsUpdate)(this.api, {
      organizationId: organization.id,
      projectId: (_this$project2 = this.project) === null || _this$project2 === void 0 ? void 0 : _this$project2.id,
      feature: 'stacktrace_link',
      status: 'dismissed'
    });
    (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_16__.trackIntegrationAnalytics)('integrations.stacktrace_link_cta_dismissed', {
      view: 'stacktrace_issue_details',
      organization
    });
    this.setState({
      isDismissed: true
    });
  }

  getEndpoints() {
    var _event$release, _event$release$lastCo, _event$sdk;

    const {
      organization,
      frame,
      event
    } = this.props;
    const project = this.project;

    if (!project) {
      throw new Error('Unable to find project');
    }

    const commitId = (_event$release = event.release) === null || _event$release === void 0 ? void 0 : (_event$release$lastCo = _event$release.lastCommit) === null || _event$release$lastCo === void 0 ? void 0 : _event$release$lastCo.id;
    const platform = event.platform;
    const sdkName = (_event$sdk = event.sdk) === null || _event$sdk === void 0 ? void 0 : _event$sdk.name;
    return [['match', `/projects/${organization.slug}/${project.slug}/stacktrace-link/`, {
      query: {
        file: frame.filename,
        platform,
        commitId,
        ...(sdkName && {
          sdkName
        }),
        ...(frame.absPath && {
          absPath: frame.absPath
        }),
        ...(frame.module && {
          module: frame.module
        }),
        ...(frame.package && {
          package: frame.package
        })
      }
    }]];
  }

  onRequestError(resp) {
    (0,sentry_utils_handleXhrErrorResponse__WEBPACK_IMPORTED_MODULE_15__["default"])('Unable to fetch stack trace link')(resp);
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      showModal: false,
      sourceCodeInput: '',
      match: {
        integrations: []
      },
      isDismissed: false,
      promptLoaded: false
    };
  }

  onOpenLink() {
    var _this$config;

    const provider = (_this$config = this.config) === null || _this$config === void 0 ? void 0 : _this$config.provider;

    if (provider) {
      (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_16__.trackIntegrationAnalytics)(sentry_utils_analytics_integrations_stacktraceLinkAnalyticsEvents__WEBPACK_IMPORTED_MODULE_14__.StacktraceLinkEvents.OPEN_LINK, {
        view: 'stacktrace_issue_details',
        provider: provider.key,
        organization: this.props.organization
      }, {
        startSession: true
      });
    }
  }

  onReconfigureMapping() {
    var _this$config2;

    const provider = (_this$config2 = this.config) === null || _this$config2 === void 0 ? void 0 : _this$config2.provider;
    const error = this.match.error;

    if (provider) {
      (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_16__.trackIntegrationAnalytics)('integrations.reconfigure_stacktrace_setup', {
        view: 'stacktrace_issue_details',
        provider: provider.key,
        error_reason: error,
        organization: this.props.organization
      }, {
        startSession: true
      });
    }
  }

  // don't show the error boundary if the component fails.
  // capture the endpoint error on onRequestError
  renderError() {
    return null;
  }

  renderLoading() {
    // TODO: Add loading
    return null;
  }

  renderNoMatch() {
    const {
      organization
    } = this.props;
    const filename = this.props.frame.filename;
    const platform = this.props.event.platform;

    if (this.project && this.integrations.length > 0 && filename) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_7__["default"], {
        organization: organization,
        access: ['org:integrations'],
        children: _ref => {
          let {
            hasAccess
          } = _ref;
          return hasAccess && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(CodeMappingButtonContainer, {
            columnQuantity: 2,
            children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('[link:Link your stack trace to your source code.]', {
              link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)("a", {
                onClick: () => {
                  (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_16__.trackIntegrationAnalytics)('integrations.stacktrace_start_setup', {
                    view: 'stacktrace_issue_details',
                    platform,
                    organization
                  }, {
                    startSession: true
                  });
                  (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_5__.openModal)(deps => this.project && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(_stacktraceLinkModal__WEBPACK_IMPORTED_MODULE_21__["default"], {
                    onSubmit: this.handleSubmit,
                    filename: filename,
                    project: this.project,
                    organization: organization,
                    integrations: this.integrations,
                    ...deps
                  }));
                }
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(StyledIconClose, {
              size: "xs",
              onClick: () => this.dismissPrompt()
            })]
          });
        }
      });
    }

    return null;
  }

  renderHovercard() {
    const error = this.match.error;
    const url = this.match.attemptedUrl;
    const {
      frame
    } = this.props;
    const {
      config
    } = this.match;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(StyledHovercard, {
        header: error === 'stack_root_mismatch' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)("span", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Mismatch between filename and stack root')
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)("span", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Unable to find source code url')
        }),
        body: error === 'stack_root_mismatch' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(HeaderContainer, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(HovercardLine, {
            children: ["filename: ", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)("code", {
              children: `${frame.filename}`
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(HovercardLine, {
            children: ["stack root: ", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)("code", {
              children: `${config === null || config === void 0 ? void 0 : config.stackRoot}`
            })]
          })]
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(HeaderContainer, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(HovercardLine, {
            children: url
          })
        }),
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(StyledIconInfo, {
          size: "xs"
        })
      })
    });
  }

  renderMatchNoUrl() {
    const {
      config,
      error
    } = this.match;
    const {
      organization
    } = this.props;
    const url = `/settings/${organization.slug}/integrations/${config === null || config === void 0 ? void 0 : config.provider.key}/${config === null || config === void 0 ? void 0 : config.integrationId}/?tab=codeMappings`;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(CodeMappingButtonContainer, {
      columnQuantity: 2,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(ErrorInformation, {
        children: [error && this.renderHovercard(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(ErrorText, {
          children: this.errorText
        }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('[link:Configure Stack Trace Linking] to fix this problem.', {
          link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)("a", {
            onClick: () => {
              this.onReconfigureMapping();
            },
            href: url
          })
        })]
      })
    });
  }

  renderMatchWithUrl(config, url) {
    url = `${url}#L${this.props.frame.lineNo}`;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(_openInContextLine__WEBPACK_IMPORTED_MODULE_20__.OpenInContainer, {
      columnQuantity: 2,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)("div", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Open this line in')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(_openInContextLine__WEBPACK_IMPORTED_MODULE_20__.OpenInLink, {
        onClick: () => this.onOpenLink(),
        href: url,
        openInNewTab: true,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(StyledIconWrapper, {
          children: (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_16__.getIntegrationIcon)(config.provider.key)
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(_openInContextLine__WEBPACK_IMPORTED_MODULE_20__.OpenInName, {
          children: config.provider.name
        })]
      })]
    });
  }

  renderBody() {
    const {
      config,
      sourceUrl
    } = this.match || {};
    const {
      isDismissed,
      promptLoaded
    } = this.state;

    if (config && sourceUrl) {
      return this.renderMatchWithUrl(config, sourceUrl);
    }

    if (config) {
      return this.renderMatchNoUrl();
    }

    if (!promptLoaded || promptLoaded && isDismissed) {
      return null;
    }

    return this.renderNoMatch();
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_19__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_18__["default"])(StacktraceLink)));

const CodeMappingButtonContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(_openInContextLine__WEBPACK_IMPORTED_MODULE_20__.OpenInContainer,  true ? {
  target: "e1dsm8en8"
} : 0)( true ? {
  name: "2o6p8u",
  styles: "justify-content:space-between"
} : 0);

const StyledIconWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e1dsm8en7"
} : 0)( true ? {
  name: "1mzk1xb",
  styles: "color:inherit;line-height:0"
} : 0);

const StyledIconClose = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_icons_iconClose__WEBPACK_IMPORTED_MODULE_11__.IconClose,  true ? {
  target: "e1dsm8en6"
} : 0)( true ? {
  name: "gzd07f",
  styles: "margin:auto;cursor:pointer"
} : 0);

const StyledIconInfo = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconInfo,  true ? {
  target: "e1dsm8en5"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(0.5), ";margin-bottom:-2px;cursor:pointer;line-height:0;" + ( true ? "" : 0));

const StyledHovercard = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_9__.Hovercard,  true ? {
  target: "e1dsm8en4"
} : 0)("font-weight:normal;width:inherit;line-height:0;", sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_9__.Header, "{font-weight:strong;font-size:", p => p.theme.fontSizeSmall, ";color:", p => p.theme.subText, ";}", sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_9__.Body, "{font-weight:normal;font-size:", p => p.theme.fontSizeSmall, ";}" + ( true ? "" : 0));

const HeaderContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1dsm8en3"
} : 0)( true ? {
  name: "yhe5ws",
  styles: "width:100%;display:flex;justify-content:space-between"
} : 0);

const HovercardLine = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1dsm8en2"
} : 0)( true ? {
  name: "1p2ly5v",
  styles: "padding-bottom:3px"
} : 0);

const ErrorInformation = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1dsm8en1"
} : 0)("padding-right:5px;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1), ";" + ( true ? "" : 0));

const ErrorText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e1dsm8en0"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(0.5), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/events/interfaces/frame/stacktraceLinkModal.tsx":
/*!************************************************************************!*\
  !*** ./app/components/events/interfaces/frame/stacktraceLinkModal.tsx ***!
  \************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_forms_inputField__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/forms/inputField */ "./app/components/forms/inputField.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_views_settings_account_notifications_feedbackAlert__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/settings/account/notifications/feedbackAlert */ "./app/views/settings/account/notifications/feedbackAlert.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }















class StacktraceLinkModal extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      sourceCodeInput: ''
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmit", async () => {
      const {
        sourceCodeInput
      } = this.state;
      const {
        api,
        closeModal,
        filename,
        onSubmit,
        organization,
        project
      } = this.props;
      (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_11__.trackIntegrationAnalytics)('integrations.stacktrace_submit_config', {
        setup_type: 'automatic',
        view: 'stacktrace_issue_details',
        organization
      });
      const parsingEndpoint = `/projects/${organization.slug}/${project.slug}/repo-path-parsing/`;

      try {
        var _configData$config;

        const configData = await api.requestPromise(parsingEndpoint, {
          method: 'POST',
          data: {
            sourceUrl: sourceCodeInput,
            stackPath: filename
          }
        });
        const configEndpoint = `/organizations/${organization.slug}/code-mappings/`;
        await api.requestPromise(configEndpoint, {
          method: 'POST',
          data: { ...configData,
            projectId: project.id,
            integrationId: configData.integrationId
          }
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Stack trace configuration saved.'));
        (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_11__.trackIntegrationAnalytics)('integrations.stacktrace_complete_setup', {
          setup_type: 'automatic',
          provider: (_configData$config = configData.config) === null || _configData$config === void 0 ? void 0 : _configData$config.provider.key,
          view: 'stacktrace_issue_details',
          organization
        });
        closeModal();
        onSubmit();
      } catch (err) {
        const errors = err !== null && err !== void 0 && err.responseJSON ? Array.isArray(err === null || err === void 0 ? void 0 : err.responseJSON) ? err === null || err === void 0 ? void 0 : err.responseJSON : Object.values(err === null || err === void 0 ? void 0 : err.responseJSON) : [];
        const apiErrors = errors.length > 0 ? `: ${errors.join(', ')}` : '';
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Something went wrong%s', apiErrors));
      }
    });
  }

  onHandleChange(sourceCodeInput) {
    this.setState({
      sourceCodeInput
    });
  }

  onManualSetup(provider) {
    (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_11__.trackIntegrationAnalytics)('integrations.stacktrace_manual_option_clicked', {
      view: 'stacktrace_issue_details',
      setup_type: 'manual',
      provider,
      organization: this.props.organization
    });
  }

  render() {
    const {
      sourceCodeInput
    } = this.state;
    const {
      Header,
      Body,
      filename,
      integrations,
      organization
    } = this.props;
    const baseUrl = `/settings/${organization.slug}/integrations`;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(Header, {
        closeButton: true,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Link Stack Trace To Source Code')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(Body, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(ModalContainer, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)("div", {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("h6", {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Automatic Setup')
            }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)('Enter the source code URL corresponding to stack trace filename [filename] so we can automatically set up stack trace linking for this project.', {
              filename: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("code", {
                children: filename
              })
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(SourceCodeInput, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StyledInputField, {
              inline: false,
              flexibleControlStateSize: true,
              stacked: true,
              name: "source-code-input",
              type: "text",
              value: sourceCodeInput,
              onChange: val => this.onHandleChange(val),
              placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)(`https://github.com/helloworld/Hello-World/blob/master/${filename}`)
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_7__["default"], {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
                "data-test-id": "quick-setup-button",
                type: "button",
                onClick: () => this.handleSubmit(),
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Submit')
              })
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)("div", {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("h6", {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Manual Setup')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_5__["default"], {
              type: "warning",
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('We recommend this for more complicated configurations, like projects with multiple repositories.')
            }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)("To manually configure stack trace linking, select the integration you'd like to use for mapping:")]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(ManualSetup, {
            children: integrations.map(integration => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
              type: "button",
              onClick: () => this.onManualSetup(integration.provider.key),
              to: `${baseUrl}/${integration.provider.key}/${integration.id}/?tab=codeMappings&referrer=stacktrace-issue-details`,
              children: [(0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_11__.getIntegrationIcon)(integration.provider.key), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(IntegrationName, {
                children: integration.name
              })]
            }, integration.id))
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StyledFeedbackAlert, {})]
        })
      })]
    });
  }

}

StacktraceLinkModal.displayName = "StacktraceLinkModal";

const SourceCodeInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1vlqb3o5"
} : 0)("display:grid;grid-template-columns:5fr 1fr;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";" + ( true ? "" : 0));

const ManualSetup = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1vlqb3o4"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";justify-items:center;" + ( true ? "" : 0));

const ModalContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1vlqb3o3"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(3), ";code{word-break:break-word;}" + ( true ? "" : 0));

const StyledFeedbackAlert = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_views_settings_account_notifications_feedbackAlert__WEBPACK_IMPORTED_MODULE_13__["default"],  true ? {
  target: "e1vlqb3o2"
} : 0)( true ? {
  name: "1ykowef",
  styles: "margin-bottom:0"
} : 0);

const StyledInputField = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_forms_inputField__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "e1vlqb3o1"
} : 0)( true ? {
  name: "52b1oc",
  styles: "padding:0px"
} : 0);

const IntegrationName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('p',  true ? {
  target: "e1vlqb3o0"
} : 0)( true ? {
  name: "vnst0l",
  styles: "padding-left:10px"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_12__["default"])(StacktraceLinkModal));

/***/ }),

/***/ "./app/components/events/interfaces/frame/symbol.tsx":
/*!***********************************************************!*\
  !*** ./app/components/events/interfaces/frame/symbol.tsx ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FunctionNameToggleIcon": () => (/* binding */ FunctionNameToggleIcon),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_stacktracePreview__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/stacktracePreview */ "./app/components/stacktracePreview.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _functionName__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./functionName */ "./app/components/events/interfaces/frame/functionName.tsx");
/* harmony import */ var _groupingIndicator__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./groupingIndicator */ "./app/components/events/interfaces/frame/groupingIndicator.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./utils */ "./app/components/events/interfaces/frame/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }













const Symbol = _ref => {
  let {
    frame,
    absoluteFilePaths,
    onFunctionNameToggle,
    showCompleteFunctionName,
    nativeStackTraceV2,
    isHoverPreviewed,
    isUsedForGrouping,
    className
  } = _ref;
  const hasFunctionNameHiddenDetails = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_7__.defined)(frame.rawFunction) && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_7__.defined)(frame.function) && frame.function !== frame.rawFunction;

  const getFunctionNameTooltipTitle = () => {
    if (!hasFunctionNameHiddenDetails) {
      return undefined;
    }

    if (!showCompleteFunctionName) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Expand function details');
    }

    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Hide function details');
  };

  const [hint, hintIcon] = (0,_utils__WEBPACK_IMPORTED_MODULE_10__.getFrameHint)(frame);
  const enablePathTooltip = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_7__.defined)(frame.absPath) && frame.absPath !== frame.filename;
  const functionNameTooltipTitle = getFunctionNameTooltipTitle();
  const tooltipDelay = isHoverPreviewed ? sentry_components_stacktracePreview__WEBPACK_IMPORTED_MODULE_2__.STACKTRACE_PREVIEW_TOOLTIP_DELAY : undefined;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(Wrapper, {
    className: className,
    children: [onFunctionNameToggle && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(FunctionNameToggleTooltip, {
      title: functionNameTooltipTitle,
      containerDisplayMode: "inline-flex",
      delay: tooltipDelay,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(FunctionNameToggleIcon, {
        hasFunctionNameHiddenDetails: hasFunctionNameHiddenDetails,
        onClick: hasFunctionNameHiddenDetails ? onFunctionNameToggle : undefined,
        size: "xs",
        color: "purple300"
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(Data, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(StyledFunctionName, {
        frame: frame,
        showCompleteFunctionName: showCompleteFunctionName,
        hasHiddenDetails: hasFunctionNameHiddenDetails
      }), hint && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(HintStatus, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_3__["default"], {
          title: hint,
          delay: tooltipDelay,
          children: hintIcon
        })
      }), frame.filename && (nativeStackTraceV2 ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(Filename, {
        children: ['(', absoluteFilePaths ? frame.absPath : frame.filename, frame.lineNo && `:${frame.lineNo}`, ')']
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(FileNameTooltip, {
        title: frame.absPath,
        disabled: !enablePathTooltip,
        delay: tooltipDelay,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(Filename, {
          children: ['(', frame.filename, frame.lineNo && `:${frame.lineNo}`, ')']
        })
      })), isUsedForGrouping && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_groupingIndicator__WEBPACK_IMPORTED_MODULE_9__["default"], {})]
    })]
  });
};

Symbol.displayName = "Symbol";

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e2lqbvx7"
} : 0)("text-align:left;grid-column-start:1;grid-column-end:-1;order:3;flex:1;display:flex;code{background:transparent;color:", p => p.theme.textColor, ";padding-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(0.5), ";}@media (min-width: ", props => props.theme.breakpoints.small, "){order:0;grid-column-start:auto;grid-column-end:auto;}" + ( true ? "" : 0));

const StyledFunctionName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_functionName__WEBPACK_IMPORTED_MODULE_8__.FunctionName,  true ? {
  target: "e2lqbvx6"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(0.75), ";" + ( true ? "" : 0));

const Data = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e2lqbvx5"
} : 0)( true ? {
  name: "aa1g1h",
  styles: "max-width:100%;display:flex;flex-wrap:wrap;align-items:center"
} : 0);

const HintStatus = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e2lqbvx4"
} : 0)("position:relative;top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(0.25), ";margin:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(0.75), " 0 -", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(0.25), ";" + ( true ? "" : 0));

const FileNameTooltip = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e2lqbvx3"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(0.75), ";" + ( true ? "" : 0));

const Filename = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e2lqbvx2"
} : 0)("color:", p => p.theme.purple300, ";" + ( true ? "" : 0));

const FunctionNameToggleIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_4__.IconFilter,  true ? {
  shouldForwardProp: prop => prop !== 'hasFunctionNameHiddenDetails',
  target: "e2lqbvx1"
} : 0)("cursor:pointer;visibility:hidden;display:none;@media (min-width: ", p => p.theme.breakpoints.small, "){display:block;}", p => !p.hasFunctionNameHiddenDetails && 'opacity: 0; cursor: inherit;', ";" + ( true ? "" : 0));

const FunctionNameToggleTooltip = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e2lqbvx0"
} : 0)("height:16px;align-items:center;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(0.75), ";@media (max-width: ", p => p.theme.breakpoints.small, "){display:none;}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Symbol);

/***/ }),

/***/ "./app/components/events/interfaces/frame/togglableAddress.tsx":
/*!*********************************************************************!*\
  !*** ./app/components/events/interfaces/frame/togglableAddress.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AddressToggleIcon": () => (/* binding */ AddressToggleIcon),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_stacktracePreview__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/stacktracePreview */ "./app/components/stacktracePreview.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../utils */ "./app/components/events/interfaces/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










function TogglableAddress(_ref) {
  let {
    startingAddress,
    address,
    relativeAddressMaxlength,
    isInlineFrame,
    isFoundByStackScanning,
    isAbsolute,
    onToggle,
    isHoverPreviewed,
    className
  } = _ref;

  const convertAbsoluteAddressToRelative = () => {
    if (!startingAddress) {
      return '';
    }

    const relativeAddress = (0,_utils__WEBPACK_IMPORTED_MODULE_6__.formatAddress)((0,_utils__WEBPACK_IMPORTED_MODULE_6__.parseAddress)(address) - (0,_utils__WEBPACK_IMPORTED_MODULE_6__.parseAddress)(startingAddress), relativeAddressMaxlength);
    return `+${relativeAddress}`;
  };

  const getAddressTooltip = () => {
    if (isInlineFrame && isFoundByStackScanning) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Inline frame, found by stack scanning');
    }

    if (isInlineFrame) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Inline frame');
    }

    if (isFoundByStackScanning) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Found by stack scanning');
    }

    return undefined;
  };

  const relativeAddress = convertAbsoluteAddressToRelative();
  const canBeConverted = !!relativeAddress;
  const formattedAddress = !relativeAddress || isAbsolute ? address : relativeAddress;
  const tooltipTitle = getAddressTooltip();
  const tooltipDelay = isHoverPreviewed ? sentry_components_stacktracePreview__WEBPACK_IMPORTED_MODULE_1__.STACKTRACE_PREVIEW_TOOLTIP_DELAY : undefined;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(Wrapper, {
    className: className,
    children: [onToggle && canBeConverted && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(AddressIconTooltip, {
      title: isAbsolute ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Switch to relative') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Switch to absolute'),
      containerDisplayMode: "inline-flex",
      delay: tooltipDelay,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(AddressToggleIcon, {
        onClick: onToggle,
        size: "xs",
        color: "purple300"
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_2__["default"], {
      title: tooltipTitle,
      disabled: !(isFoundByStackScanning || isInlineFrame),
      delay: tooltipDelay,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Address, {
        isFoundByStackScanning: isFoundByStackScanning,
        isInlineFrame: isInlineFrame,
        canBeConverted: canBeConverted,
        children: formattedAddress
      })
    })]
  });
}

TogglableAddress.displayName = "TogglableAddress";

const AddressIconTooltip = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_2__["default"],  true ? {
  target: "e96yfr63"
} : 0)("align-items:center;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(0.75), ";" + ( true ? "" : 0));

const AddressToggleIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconFilter,  true ? {
  target: "e96yfr62"
} : 0)("cursor:pointer;visibility:hidden;display:none;@media (min-width: ", p => p.theme.breakpoints.small, "){display:block;}" + ( true ? "" : 0));

const getAddresstextBorderBottom = p => {
  if (p.isFoundByStackScanning) {
    return `1px dashed ${p.theme.red300}`;
  }

  if (p.isInlineFrame) {
    return `1px dashed ${p.theme.blue300}`;
  }

  return 'none';
};

const Address = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e96yfr61"
} : 0)("border-bottom:", getAddresstextBorderBottom, ";white-space:nowrap;@media (min-width: ", p => p.theme.breakpoints.small, "){padding-left:", p => p.canBeConverted ? null : '18px', ";}" + ( true ? "" : 0));

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e96yfr60"
} : 0)("font-family:", p => p.theme.text.familyMono, ";font-size:", p => p.theme.fontSizeExtraSmall, ";color:", p => p.theme.textColor, ";letter-spacing:-0.25px;width:100%;flex-grow:0;flex-shrink:0;display:inline-flex;align-items:center;padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(0.5), " 0 0;order:1;@media (min-width: ", props => props.theme.breakpoints.small, "){padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(0.5), ";order:0;}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TogglableAddress);


/***/ }),

/***/ "./app/components/events/interfaces/frame/utils.tsx":
/*!**********************************************************!*\
  !*** ./app/components/events/interfaces/frame/utils.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getFrameHint": () => (/* binding */ getFrameHint),
/* harmony export */   "getPlatform": () => (/* binding */ getPlatform),
/* harmony export */   "hasAssembly": () => (/* binding */ hasAssembly),
/* harmony export */   "hasContextRegisters": () => (/* binding */ hasContextRegisters),
/* harmony export */   "hasContextSource": () => (/* binding */ hasContextSource),
/* harmony export */   "hasContextVars": () => (/* binding */ hasContextVars),
/* harmony export */   "isDotnet": () => (/* binding */ isDotnet),
/* harmony export */   "isExpandable": () => (/* binding */ isExpandable),
/* harmony export */   "trimPackage": () => (/* binding */ trimPackage)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../types */ "./app/components/events/interfaces/types.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function trimPackage(pkg) {
  const pieces = pkg.split(/^([a-z]:\\|\\\\)/i.test(pkg) ? '\\' : '/');
  const filename = pieces[pieces.length - 1] || pieces[pieces.length - 2] || pkg;
  return filename.replace(/\.(dylib|so|a|dll|exe)$/, '');
}
function getPlatform(dataPlatform, platform) {
  // prioritize the frame platform but fall back to the platform
  // of the stack trace / exception
  return dataPlatform || platform;
}
function getFrameHint(frame) {
  // returning [hintText, hintIcon]
  const {
    symbolicatorStatus
  } = frame;
  const func = frame.function || '<unknown>'; // Custom color used to match adjacent text.

  const warningIcon = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_1__.IconQuestion, {
    size: "xs",
    color: '#2c45a8'
  });

  const errorIcon = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_1__.IconWarning, {
    size: "xs",
    color: "red300"
  });

  if (func.match(/^@objc\s/)) {
    return [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Objective-C -> Swift shim frame'), warningIcon];
  }

  if (func.match(/^__?hidden#\d+/)) {
    return [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Hidden function from bitcode build'), errorIcon];
  }

  if (!symbolicatorStatus && func === '<unknown>') {
    // Only render this if the event was not symbolicated.
    return [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('No function name was supplied by the client SDK.'), warningIcon];
  }

  if (func === '<unknown>' || func === '<redacted>' && symbolicatorStatus === _types__WEBPACK_IMPORTED_MODULE_4__.SymbolicatorStatus.MISSING_SYMBOL) {
    switch (symbolicatorStatus) {
      case _types__WEBPACK_IMPORTED_MODULE_4__.SymbolicatorStatus.MISSING_SYMBOL:
        return [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('The symbol was not found within the debug file.'), warningIcon];

      case _types__WEBPACK_IMPORTED_MODULE_4__.SymbolicatorStatus.UNKNOWN_IMAGE:
        return [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('No image is specified for the address of the frame.'), warningIcon];

      case _types__WEBPACK_IMPORTED_MODULE_4__.SymbolicatorStatus.MISSING:
        return [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('The debug file could not be retrieved from any of the sources.'), errorIcon];

      case _types__WEBPACK_IMPORTED_MODULE_4__.SymbolicatorStatus.MALFORMED:
        return [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('The retrieved debug file could not be processed.'), errorIcon];

      default:
    }
  }

  if (func === '<redacted>') {
    return [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Unknown system frame. Usually from beta SDKs'), warningIcon];
  }

  return [null, null];
}
function isDotnet(platform) {
  // csharp platform represents .NET and can be F#, VB or any language targeting CLS (the Common Language Specification)
  return platform === 'csharp';
}
function hasContextSource(frame) {
  return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_3__.defined)(frame.context) && !!frame.context.length;
}
function hasContextVars(frame) {
  return !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_3__.objectIsEmpty)(frame.vars || {});
}
function hasContextRegisters(registers) {
  return !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_3__.objectIsEmpty)(registers);
}
function hasAssembly(frame, platform) {
  return isDotnet(getPlatform(frame.platform, platform !== null && platform !== void 0 ? platform : 'other')) && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_3__.defined)(frame.package);
}
function isExpandable(_ref) {
  let {
    frame,
    registers,
    emptySourceNotation,
    platform,
    isOnlyFrame
  } = _ref;
  return !isOnlyFrame && emptySourceNotation || hasContextSource(frame) || hasContextVars(frame) || hasContextRegisters(registers) || hasAssembly(frame, platform);
}

/***/ }),

/***/ "./app/components/events/interfaces/keyValueList/index.tsx":
/*!*****************************************************************!*\
  !*** ./app/components/events/interfaces/keyValueList/index.tsx ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var lodash_sortBy__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/sortBy */ "../node_modules/lodash/sortBy.js");
/* harmony import */ var lodash_sortBy__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_sortBy__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var _value__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./value */ "./app/components/events/interfaces/keyValueList/value.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









function KeyValueList(_ref) {
  let {
    data,
    isContextData = false,
    isSorted = true,
    raw = false,
    longKeys = false,
    onClick,
    ...props
  } = _ref;

  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_3__.defined)(data) || data.length === 0) {
    return null;
  }

  const keyValueData = isSorted ? lodash_sortBy__WEBPACK_IMPORTED_MODULE_1___default()(data, [_ref2 => {
    let {
      key
    } = _ref2;
    return key.toLowerCase();
  }]) : data;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Table, {
    className: "table key-value",
    onClick: onClick,
    ...props,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("tbody", {
      children: keyValueData.map(_ref3 => {
        let {
          key,
          subject,
          value = null,
          meta,
          subjectIcon,
          subjectDataTestId,
          actionButton
        } = _ref3;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("tr", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(TableSubject, {
            className: "key",
            wide: longKeys,
            children: subject
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("td", {
            className: "val",
            "data-test-id": subjectDataTestId,
            children: actionButton ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(ValueWithButtonContainer, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(_value__WEBPACK_IMPORTED_MODULE_5__.Value, {
                isContextData: isContextData,
                meta: meta,
                subjectIcon: subjectIcon,
                value: value,
                raw: raw
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(ActionButtonWrapper, {
                children: actionButton
              })]
            }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(_value__WEBPACK_IMPORTED_MODULE_5__.Value, {
              isContextData: isContextData,
              meta: meta,
              subjectIcon: subjectIcon,
              value: value,
              raw: raw
            })
          })]
        }, `${key}.${value}`);
      })
    })
  });
}

KeyValueList.displayName = "KeyValueList";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (KeyValueList);

const TableSubject = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('td',  true ? {
  target: "e1h1gsq33"
} : 0)("@media (min-width: ", sentry_utils_theme__WEBPACK_IMPORTED_MODULE_4__["default"].breakpoints.large, "){max-width:", p => p.wide ? '620px !important' : 'none', ";}" + ( true ? "" : 0));

const ValueWithButtonContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1h1gsq32"
} : 0)("display:grid;align-items:center;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), ";font-size:", p => p.theme.fontSizeSmall, ";background:", p => p.theme.bodyBackground, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), " 10px;margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(0.25), " 0;pre{padding:0!important;margin:0!important;}@media (min-width: ", p => p.theme.breakpoints.small, "){grid-template-columns:1fr max-content;}" + ( true ? "" : 0));

const ActionButtonWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1h1gsq31"
} : 0)( true ? {
  name: "1ae3byg",
  styles: "height:100%;display:flex;align-items:flex-start"
} : 0);

const Table = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('table',  true ? {
  target: "e1h1gsq30"
} : 0)( true ? {
  name: "b2ixpe",
  styles: ">* pre>pre{margin:0!important;padding:0!important;}"
} : 0);

/***/ }),

/***/ "./app/components/events/interfaces/keyValueList/value.tsx":
/*!*****************************************************************!*\
  !*** ./app/components/events/interfaces/keyValueList/value.tsx ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Value": () => (/* binding */ Value)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_contextData__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/contextData */ "./app/components/contextData/index.tsx");
/* harmony import */ var sentry_components_events_meta_annotatedText__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/events/meta/annotatedText */ "./app/components/events/meta/annotatedText/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function Value(_ref) {
  let {
    subjectIcon,
    meta,
    raw,
    isContextData,
    value = null
  } = _ref;

  if (isContextData) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_contextData__WEBPACK_IMPORTED_MODULE_1__["default"], {
      data: !raw ? value : JSON.stringify(value),
      meta: meta,
      withAnnotatedText: true,
      children: subjectIcon
    });
  }

  const dataValue = typeof value === 'object' && ! /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_0__.isValidElement)(value) ? JSON.stringify(value, null, 2) : value;

  if (typeof dataValue !== 'string' && /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_0__.isValidElement)(dataValue)) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
      children: dataValue
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("pre", {
    className: "val-string",
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_events_meta_annotatedText__WEBPACK_IMPORTED_MODULE_2__["default"], {
      value: dataValue,
      meta: meta
    }), subjectIcon]
  });
}
Value.displayName = "Value";

/***/ }),

/***/ "./app/components/events/interfaces/nativeFrame.tsx":
/*!**********************************************************!*\
  !*** ./app/components/events/interfaces/nativeFrame.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var scroll_to_element__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! scroll-to-element */ "../node_modules/scroll-to-element/index.js");
/* harmony import */ var scroll_to_element__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(scroll_to_element__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_events_interfaces_frame_utils__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/events/interfaces/frame/utils */ "./app/components/events/interfaces/frame/utils.tsx");
/* harmony import */ var sentry_components_events_interfaces_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/events/interfaces/utils */ "./app/components/events/interfaces/utils.tsx");
/* harmony import */ var sentry_components_events_meta_annotatedText__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/events/meta/annotatedText */ "./app/components/events/meta/annotatedText/index.tsx");
/* harmony import */ var sentry_components_events_traceEventDataSection__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/events/traceEventDataSection */ "./app/components/events/traceEventDataSection.tsx");
/* harmony import */ var sentry_components_stacktracePreview__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/stacktracePreview */ "./app/components/stacktracePreview.tsx");
/* harmony import */ var sentry_components_strictClick__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/strictClick */ "./app/components/strictClick.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons_iconChevron__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/icons/iconChevron */ "./app/icons/iconChevron.tsx");
/* harmony import */ var sentry_icons_iconInfo__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/icons/iconInfo */ "./app/icons/iconInfo.tsx");
/* harmony import */ var sentry_icons_iconQuestion__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/icons/iconQuestion */ "./app/icons/iconQuestion.tsx");
/* harmony import */ var sentry_icons_iconWarning__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/icons/iconWarning */ "./app/icons/iconWarning.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_debugMetaStore__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/stores/debugMetaStore */ "./app/stores/debugMetaStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_withSentryAppComponents__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/withSentryAppComponents */ "./app/utils/withSentryAppComponents.tsx");
/* harmony import */ var _debugMeta_utils__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ./debugMeta/utils */ "./app/components/events/interfaces/debugMeta/utils.tsx");
/* harmony import */ var _frame_context__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ./frame/context */ "./app/components/events/interfaces/frame/context.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! ./types */ "./app/components/events/interfaces/types.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }



























function NativeFrame(_ref) {
  var _frame$package;

  let {
    frame,
    nextFrame,
    prevFrame,
    includeSystemFrames,
    isUsedForGrouping,
    maxLengthOfRelativeAddress,
    image,
    registers,
    isOnlyFrame,
    event,
    components,
    isExpanded,
    platform,
    registersMeta,
    frameMeta,
    emptySourceNotation = false,

    /**
     * Is the stack trace being previewed in a hovercard?
     */
    isHoverPreviewed = false
  } = _ref;
  const traceEventDataSectionContext = (0,react__WEBPACK_IMPORTED_MODULE_3__.useContext)(sentry_components_events_traceEventDataSection__WEBPACK_IMPORTED_MODULE_9__.TraceEventDataSectionContext);
  const absolute = traceEventDataSectionContext === null || traceEventDataSectionContext === void 0 ? void 0 : traceEventDataSectionContext.display.includes('absolute-addresses');
  const fullStackTrace = traceEventDataSectionContext === null || traceEventDataSectionContext === void 0 ? void 0 : traceEventDataSectionContext.fullStackTrace;
  const fullFunctionName = traceEventDataSectionContext === null || traceEventDataSectionContext === void 0 ? void 0 : traceEventDataSectionContext.display.includes('verbose-function-names');
  const absoluteFilePaths = traceEventDataSectionContext === null || traceEventDataSectionContext === void 0 ? void 0 : traceEventDataSectionContext.display.includes('absolute-file-paths');
  const tooltipDelay = isHoverPreviewed ? sentry_components_stacktracePreview__WEBPACK_IMPORTED_MODULE_10__.STACKTRACE_PREVIEW_TOOLTIP_DELAY : undefined;
  const foundByStackScanning = frame.trust === 'scan' || frame.trust === 'cfi-scan';
  const startingAddress = image ? image.image_addr : null;
  const packageClickable = !!frame.symbolicatorStatus && frame.symbolicatorStatus !== _types__WEBPACK_IMPORTED_MODULE_24__.SymbolicatorStatus.UNKNOWN_IMAGE && !isHoverPreviewed;
  const leadsToApp = !frame.inApp && (nextFrame && nextFrame.inApp || !nextFrame);
  const expandable = !leadsToApp || includeSystemFrames ? (0,sentry_components_events_interfaces_frame_utils__WEBPACK_IMPORTED_MODULE_6__.isExpandable)({
    frame,
    registers,
    platform,
    emptySourceNotation,
    isOnlyFrame
  }) : false;
  const inlineFrame = prevFrame && platform === (prevFrame.platform || platform) && frame.instructionAddr === prevFrame.instructionAddr;
  const functionNameHiddenDetails = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_20__.defined)(frame.rawFunction) && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_20__.defined)(frame.function) && frame.function !== frame.rawFunction;
  const [expanded, setExpanded] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(expandable ? isExpanded !== null && isExpanded !== void 0 ? isExpanded : false : false);

  function getRelativeAddress() {
    if (!startingAddress) {
      return '';
    }

    const relativeAddress = (0,sentry_components_events_interfaces_utils__WEBPACK_IMPORTED_MODULE_7__.formatAddress)((0,sentry_components_events_interfaces_utils__WEBPACK_IMPORTED_MODULE_7__.parseAddress)(frame.instructionAddr) - (0,sentry_components_events_interfaces_utils__WEBPACK_IMPORTED_MODULE_7__.parseAddress)(startingAddress), maxLengthOfRelativeAddress);
    return `+${relativeAddress}`;
  }

  function getAddressTooltip() {
    if (inlineFrame && foundByStackScanning) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_17__.t)('Inline frame, found by stack scanning');
    }

    if (inlineFrame) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_17__.t)('Inline frame');
    }

    if (foundByStackScanning) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_17__.t)('Found by stack scanning');
    }

    return undefined;
  }

  function getFunctionName() {
    if (functionNameHiddenDetails && fullFunctionName && frame.rawFunction) {
      var _frameMeta$rawFunctio;

      return {
        value: frame.rawFunction,
        meta: frameMeta === null || frameMeta === void 0 ? void 0 : (_frameMeta$rawFunctio = frameMeta.rawFunction) === null || _frameMeta$rawFunctio === void 0 ? void 0 : _frameMeta$rawFunctio['']
      };
    }

    if (frame.function) {
      var _frameMeta$function;

      return {
        value: frame.function,
        meta: frameMeta === null || frameMeta === void 0 ? void 0 : (_frameMeta$function = frameMeta.function) === null || _frameMeta$function === void 0 ? void 0 : _frameMeta$function['']
      };
    }

    return undefined;
  }

  function getStatus() {
    // this is the status of image that belongs to this frame
    if (!image) {
      return undefined;
    }

    const combinedStatus = (0,_debugMeta_utils__WEBPACK_IMPORTED_MODULE_22__.combineStatus)(image.debug_status, image.unwind_status);

    switch (combinedStatus) {
      case 'unused':
        return undefined;

      case 'found':
        return 'success';

      default:
        return 'error';
    }
  }

  function handleGoToImagesLoaded(e) {
    e.stopPropagation(); // to prevent collapsing if collapsible

    if (frame.instructionAddr) {
      const searchTerm = !(!frame.addrMode || frame.addrMode === 'abs') && image ? `${image.debug_id}!${frame.instructionAddr}` : frame.instructionAddr;
      sentry_stores_debugMetaStore__WEBPACK_IMPORTED_MODULE_18__.DebugMetaActions.updateFilter(searchTerm);
    }

    scroll_to_element__WEBPACK_IMPORTED_MODULE_4___default()('#images-loaded');
  }

  function handleToggleContext(e) {
    if (!expandable) {
      return;
    }

    e.preventDefault();
    setExpanded(!expanded);
  }

  const relativeAddress = getRelativeAddress();
  const addressTooltip = getAddressTooltip();
  const functionName = getFunctionName();
  const status = getStatus();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(GridRow, {
    inApp: frame.inApp,
    expandable: expandable,
    expanded: expanded,
    className: "frame",
    "data-test-id": "stack-trace-frame",
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_strictClick__WEBPACK_IMPORTED_MODULE_11__["default"], {
      onClick: handleToggleContext,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(StrictClickContent, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(StatusCell, {
          children: (status === 'error' || status === undefined) && (packageClickable ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(PackageStatusButton, {
            onClick: handleGoToImagesLoaded,
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_17__.t)('Go to images loaded'),
            "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_17__.t)('Go to images loaded'),
            icon: status === 'error' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_icons_iconQuestion__WEBPACK_IMPORTED_MODULE_15__.IconQuestion, {
              size: "sm",
              color: "red300"
            }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_icons_iconWarning__WEBPACK_IMPORTED_MODULE_16__.IconWarning, {
              size: "sm",
              color: "red300"
            }),
            size: "zero",
            borderless: true
          }) : status === 'error' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_icons_iconQuestion__WEBPACK_IMPORTED_MODULE_15__.IconQuestion, {
            size: "sm",
            color: "red300"
          }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_icons_iconWarning__WEBPACK_IMPORTED_MODULE_16__.IconWarning, {
            size: "sm",
            color: "red300"
          }))
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(PackageCell, {
          children: [!fullStackTrace && !expanded && leadsToApp && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
            children: [!nextFrame ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_17__.t)('Crashed in non-app') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_17__.t)('Called from'), ':', "\xA0"]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)("span", {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_12__["default"], {
              title: (_frame$package = frame.package) !== null && _frame$package !== void 0 ? _frame$package : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_17__.t)('Go to images loaded'),
              delay: tooltipDelay,
              disabled: frame.package ? false : !packageClickable,
              containerDisplayMode: "inline-flex",
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(Package, {
                color: status === undefined || status === 'error' ? 'red300' : packageClickable ? 'blue300' : undefined,
                onClick: packageClickable ? handleGoToImagesLoaded : undefined,
                children: frame.package ? (0,sentry_components_events_interfaces_frame_utils__WEBPACK_IMPORTED_MODULE_6__.trimPackage)(frame.package) : `<${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_17__.t)('unknown')}>`
              })
            })
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(AddressCell, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_12__["default"], {
            title: addressTooltip,
            disabled: !(foundByStackScanning || inlineFrame),
            delay: tooltipDelay,
            children: !relativeAddress || absolute ? frame.instructionAddr : relativeAddress
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(GroupingCell, {
          children: isUsedForGrouping && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_12__["default"], {
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_17__.t)('This frame appears in all other events related to this issue'),
            containerDisplayMode: "inline-flex",
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_icons_iconInfo__WEBPACK_IMPORTED_MODULE_14__.IconInfo, {
              size: "sm",
              color: "gray300"
            })
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(FunctionNameCell, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(FunctionName, {
            children: functionName ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_events_meta_annotatedText__WEBPACK_IMPORTED_MODULE_8__["default"], {
              value: functionName.value,
              meta: functionName.meta
            }) : `<${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_17__.t)('unknown')}>`
          }), frame.filename && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_12__["default"], {
            title: frame.absPath,
            disabled: !((0,sentry_utils__WEBPACK_IMPORTED_MODULE_20__.defined)(frame.absPath) && frame.absPath !== frame.filename),
            delay: tooltipDelay,
            containerDisplayMode: "inline-flex",
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(FileName, {
              children: ['(', absoluteFilePaths ? frame.absPath : frame.filename, frame.lineNo && `:${frame.lineNo}`, ')']
            })
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(ExpandCell, {
          children: expandable && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(ToggleButton, {
            size: "zero",
            css: (0,sentry_components_events_interfaces_frame_utils__WEBPACK_IMPORTED_MODULE_6__.isDotnet)(platform) && {
              display: 'block !important'
            } // remove important once we get rid of css files
            ,
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_17__.t)('Toggle Context'),
            "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_17__.t)('Toggle Context'),
            tooltipProps: isHoverPreviewed ? {
              delay: sentry_components_stacktracePreview__WEBPACK_IMPORTED_MODULE_10__.STACKTRACE_PREVIEW_TOOLTIP_DELAY
            } : undefined,
            icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_icons_iconChevron__WEBPACK_IMPORTED_MODULE_13__.IconChevron, {
              size: "8px",
              direction: expanded ? 'up' : 'down'
            })
          })
        })]
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(RegistersCell, {
      children: expanded && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(Registers, {
        frame: frame,
        event: event,
        registers: registers,
        components: components,
        hasContextSource: (0,sentry_components_events_interfaces_frame_utils__WEBPACK_IMPORTED_MODULE_6__.hasContextSource)(frame),
        hasContextVars: (0,sentry_components_events_interfaces_frame_utils__WEBPACK_IMPORTED_MODULE_6__.hasContextVars)(frame),
        hasContextRegisters: (0,sentry_components_events_interfaces_frame_utils__WEBPACK_IMPORTED_MODULE_6__.hasContextRegisters)(registers),
        emptySourceNotation: emptySourceNotation,
        hasAssembly: (0,sentry_components_events_interfaces_frame_utils__WEBPACK_IMPORTED_MODULE_6__.hasAssembly)(frame, platform),
        expandable: expandable,
        isExpanded: expanded,
        registersMeta: registersMeta,
        frameMeta: frameMeta
      })
    })]
  });
}

NativeFrame.displayName = "NativeFrame";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withSentryAppComponents__WEBPACK_IMPORTED_MODULE_21__["default"])(NativeFrame, {
  componentType: 'stacktrace-link'
}));

const Cell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "elaoi1g15"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_19__["default"])(0.5), ";display:flex;flex-wrap:wrap;word-break:break-all;align-items:flex-start;" + ( true ? "" : 0));

const StatusCell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Cell,  true ? {
  target: "elaoi1g14"
} : 0)("@media (max-width: ", p => p.theme.breakpoints.small, "){grid-column:1/1;grid-row:1/1;}" + ( true ? "" : 0));

const PackageCell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Cell,  true ? {
  target: "elaoi1g13"
} : 0)("color:", p => p.theme.subText, ";@media (max-width: ", p => p.theme.breakpoints.small, "){grid-column:2/2;grid-row:1/1;display:grid;grid-template-columns:1fr;grid-template-rows:repeat(2, auto);}" + ( true ? "" : 0));

const AddressCell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Cell,  true ? {
  target: "elaoi1g12"
} : 0)("font-family:", p => p.theme.text.familyMono, ";@media (max-width: ", p => p.theme.breakpoints.small, "){grid-column:3/3;grid-row:1/1;}" + ( true ? "" : 0));

const GroupingCell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Cell,  true ? {
  target: "elaoi1g11"
} : 0)("@media (max-width: ", p => p.theme.breakpoints.small, "){grid-column:1/1;grid-row:2/2;}" + ( true ? "" : 0));

const FunctionNameCell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Cell,  true ? {
  target: "elaoi1g10"
} : 0)("color:", p => p.theme.textColor, ";@media (max-width: ", p => p.theme.breakpoints.small, "){grid-column:2/-1;grid-row:2/2;}" + ( true ? "" : 0));

const ExpandCell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Cell,  true ? {
  target: "elaoi1g9"
} : 0)( true ? "" : 0);

const RegistersCell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "elaoi1g8"
} : 0)("grid-column:1/-1;margin-left:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_19__["default"])(0.5), ";margin-right:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_19__["default"])(0.5), ";margin-bottom:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_19__["default"])(0.5), ";cursor:default;" + ( true ? "" : 0));

const Registers = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_frame_context__WEBPACK_IMPORTED_MODULE_23__["default"],  true ? {
  target: "elaoi1g7"
} : 0)( true ? {
  name: "1772xtw",
  styles: "padding:0;margin:0"
} : 0);

const ToggleButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "elaoi1g6"
} : 0)( true ? {
  name: "157xhr7",
  styles: "width:16px;height:16px"
} : 0);

const Package = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "elaoi1g5"
} : 0)("border-bottom:1px dashed ", p => p.theme.border, ";", p => p.color && `color: ${p.theme[p.color]}`, ";", p => p.onClick && `cursor: pointer;`, ";" + ( true ? "" : 0));

const FunctionName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "elaoi1g4"
} : 0)("color:", p => p.theme.headingColor, ";margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_19__["default"])(1), ";" + ( true ? "" : 0));

const FileName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "elaoi1g3"
} : 0)("color:", p => p.theme.subText, ";border-bottom:1px dashed ", p => p.theme.border, ";" + ( true ? "" : 0));

const PackageStatusButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "elaoi1g2"
} : 0)( true ? {
  name: "1pc4ge5",
  styles: "padding:0;border:none"
} : 0);

const GridRow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('li',  true ? {
  target: "elaoi1g1"
} : 0)(p => p.expandable && `cursor: pointer;`, ";", p => p.inApp && `background: ${p.theme.bodyBackground};`, ";", p => !p.inApp && /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_26__.css)("color:", p.theme.subText, ";", FunctionName, "{color:", p.theme.subText, ";}", FunctionNameCell, "{color:", p.theme.subText, ";}" + ( true ? "" : 0),  true ? "" : 0), ";display:grid;align-items:flex-start;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_19__["default"])(0.5), ";:not(:last-child){border-bottom:1px solid ", p => p.theme.border, ";}&&{border-top:0;}grid-template-columns:24px 132px 138px 24px 1fr 24px;grid-template-rows:1fr;@media (max-width: ", p => p.theme.breakpoints.small, "){grid-template-columns:24px auto minmax(138px, 1fr) 24px;grid-template-rows:repeat(2, auto);}" + ( true ? "" : 0));

const StrictClickContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "elaoi1g0"
} : 0)( true ? {
  name: "49aokf",
  styles: "display:contents"
} : 0);

/***/ }),

/***/ "./app/components/events/interfaces/threads/threadSelector/findBestThread.tsx":
/*!************************************************************************************!*\
  !*** ./app/components/events/interfaces/threads/threadSelector/findBestThread.tsx ***!
  \************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
function findBestThread(threads) {
  // search the entire threads list for a crashed thread with stack trace
  return threads.find(thread => thread.crashed) || threads.find(thread => thread.stacktrace) || threads[0];
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (findBestThread);

/***/ }),

/***/ "./app/components/events/interfaces/threads/threadSelector/getThreadStacktrace.tsx":
/*!*****************************************************************************************!*\
  !*** ./app/components/events/interfaces/threads/threadSelector/getThreadStacktrace.tsx ***!
  \*****************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
function getThreadStacktrace(raw, thread) {
  if (!thread) {
    return undefined;
  }

  if (raw && thread.rawStacktrace) {
    return thread.rawStacktrace;
  }

  if (thread.stacktrace) {
    return thread.stacktrace;
  }

  return undefined;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (getThreadStacktrace);

/***/ }),

/***/ "./app/components/events/interfaces/types.tsx":
/*!****************************************************!*\
  !*** ./app/components/events/interfaces/types.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SymbolicatorStatus": () => (/* binding */ SymbolicatorStatus)
/* harmony export */ });
let SymbolicatorStatus;

(function (SymbolicatorStatus) {
  SymbolicatorStatus["SYMBOLICATED"] = "symbolicated";
  SymbolicatorStatus["MISSING_SYMBOL"] = "missing_symbol";
  SymbolicatorStatus["UNKNOWN_IMAGE"] = "unknown_image";
  SymbolicatorStatus["MISSING"] = "missing";
  SymbolicatorStatus["MALFORMED"] = "malformed";
})(SymbolicatorStatus || (SymbolicatorStatus = {}));

/***/ }),

/***/ "./app/components/events/interfaces/utils.tsx":
/*!****************************************************!*\
  !*** ./app/components/events/interfaces/utils.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "escapeQuotes": () => (/* binding */ escapeQuotes),
/* harmony export */   "formatAddress": () => (/* binding */ formatAddress),
/* harmony export */   "getCurlCommand": () => (/* binding */ getCurlCommand),
/* harmony export */   "getFullUrl": () => (/* binding */ getFullUrl),
/* harmony export */   "getImageRange": () => (/* binding */ getImageRange),
/* harmony export */   "isStacktraceNewestFirst": () => (/* binding */ isStacktraceNewestFirst),
/* harmony export */   "objectToSortedTupleArray": () => (/* binding */ objectToSortedTupleArray),
/* harmony export */   "parseAddress": () => (/* binding */ parseAddress),
/* harmony export */   "parseAssembly": () => (/* binding */ parseAssembly),
/* harmony export */   "removeFilterMaskedEntries": () => (/* binding */ removeFilterMaskedEntries),
/* harmony export */   "stackTracePlatformIcon": () => (/* binding */ stackTracePlatformIcon),
/* harmony export */   "stringifyQueryList": () => (/* binding */ stringifyQueryList)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var lodash_compact__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/compact */ "../node_modules/lodash/compact.js");
/* harmony import */ var lodash_compact__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_compact__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var lodash_isString__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/isString */ "../node_modules/lodash/isString.js");
/* harmony import */ var lodash_isString__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_isString__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var lodash_uniq__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/uniq */ "../node_modules/lodash/uniq.js");
/* harmony import */ var lodash_uniq__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_uniq__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_fileExtension__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/fileExtension */ "./app/utils/fileExtension.tsx");












function escapeQuotes(v) {
  return v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
} // TODO(dcramer): support cookies

function getCurlCommand(data) {
  var _data$headers, _data$headers$sort, _data$headers2;

  let result = 'curl';

  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_9__.defined)(data.method) && data.method !== 'GET') {
    result += ' \\\n -X ' + data.method;
  } // TODO(benvinegar): just gzip? what about deflate?


  const compressed = (_data$headers = data.headers) === null || _data$headers === void 0 ? void 0 : _data$headers.find(h => h[0] === 'Accept-Encoding' && h[1].indexOf('gzip') !== -1);

  if (compressed) {
    result += ' \\\n --compressed';
  } // sort headers


  const headers = (_data$headers$sort = (_data$headers2 = data.headers) === null || _data$headers2 === void 0 ? void 0 : _data$headers2.sort(function (a, b) {
    return a[0] === b[0] ? 0 : a[0] < b[0] ? -1 : 1;
  })) !== null && _data$headers$sort !== void 0 ? _data$headers$sort : [];

  for (const header of headers) {
    result += ' \\\n -H "' + header[0] + ': ' + escapeQuotes(header[1] + '') + '"';
  }

  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_9__.defined)(data.data)) {
    switch (data.inferredContentType) {
      case 'application/json':
        result += ' \\\n --data "' + escapeQuotes(JSON.stringify(data.data)) + '"';
        break;

      case 'application/x-www-form-urlencoded':
        result += ' \\\n --data "' + escapeQuotes(query_string__WEBPACK_IMPORTED_MODULE_6__.stringify(data.data)) + '"';
        break;

      default:
        if (lodash_isString__WEBPACK_IMPORTED_MODULE_4___default()(data.data)) {
          result += ' \\\n --data "' + escapeQuotes(data.data) + '"';
        } else if (Object.keys(data.data).length === 0) {// Do nothing with empty object data.
        } else {
          _sentry_react__WEBPACK_IMPORTED_MODULE_11__.withScope(scope => {
            scope.setExtra('data', data);
            _sentry_react__WEBPACK_IMPORTED_MODULE_11__.captureException(new Error('Unknown event data'));
          });
        }

    }
  }

  result += ' \\\n "' + getFullUrl(data) + '"';
  return result;
}
function stringifyQueryList(query) {
  if (lodash_isString__WEBPACK_IMPORTED_MODULE_4___default()(query)) {
    return query;
  }

  const queryObj = {};

  for (const kv of query) {
    if (kv !== null && kv.length === 2) {
      const [key, value] = kv;

      if (value !== null) {
        if (Array.isArray(queryObj[key])) {
          queryObj[key].push(value);
        } else {
          queryObj[key] = [value];
        }
      }
    }
  }

  return query_string__WEBPACK_IMPORTED_MODULE_6__.stringify(queryObj);
}
function getFullUrl(data) {
  var _data$query;

  let fullUrl = data === null || data === void 0 ? void 0 : data.url;

  if (!fullUrl) {
    return fullUrl;
  }

  if (data !== null && data !== void 0 && (_data$query = data.query) !== null && _data$query !== void 0 && _data$query.length) {
    fullUrl += '?' + stringifyQueryList(data.query);
  }

  if (data.fragment) {
    fullUrl += '#' + data.fragment;
  }

  return fullUrl;
}
/**
 * Converts an object of body/querystring key/value pairs
 * into a tuple of [key, value] pairs, and sorts them.
 *
 * This handles the case for query strings that were decoded like so:
 *
 *   ?foo=bar&foo=baz => { foo: ['bar', 'baz'] }
 *
 * By converting them to [['foo', 'bar'], ['foo', 'baz']]
 */

function objectToSortedTupleArray(obj) {
  return Object.keys(obj).reduce((out, k) => {
    const val = obj[k];
    return out.concat(Array.isArray(val) ? val.map(v => [k, v]) // key has multiple values (array)
    : [[k, val]] // key has single value
    );
  }, []).sort(function (_ref, _ref2) {
    let [keyA, valA] = _ref;
    let [keyB, valB] = _ref2;

    // if keys are identical, sort on value
    if (keyA === keyB) {
      return valA < valB ? -1 : 1;
    }

    return keyA < keyB ? -1 : 1;
  });
} // for context summaries and avatars

function removeFilterMaskedEntries(rawData) {
  const cleanedData = {};

  for (const key of Object.getOwnPropertyNames(rawData)) {
    if (rawData[key] !== sentry_constants__WEBPACK_IMPORTED_MODULE_7__.FILTER_MASK) {
      cleanedData[key] = rawData[key];
    }
  }

  return cleanedData;
}
function formatAddress(address, imageAddressLength) {
  return `0x${address.toString(16).padStart(imageAddressLength !== null && imageAddressLength !== void 0 ? imageAddressLength : 0, '0')}`;
}
function parseAddress(address) {
  if (!address) {
    return 0;
  }

  try {
    return parseInt(address, 16) || 0;
  } catch (_e) {
    return 0;
  }
}
function getImageRange(image) {
  // The start address is normalized to a `0x` prefixed hex string. The event
  // schema also allows ingesting plain numbers, but this is converted during
  // ingestion.
  const startAddress = parseAddress(image === null || image === void 0 ? void 0 : image.image_addr); // The image size is normalized to a regular number. However, it can also be
  // `null`, in which case we assume that it counts up to the next image.

  const endAddress = startAddress + ((image === null || image === void 0 ? void 0 : image.image_size) || 0);
  return [startAddress, endAddress];
}
function parseAssembly(assembly) {
  let name;
  let version;
  let culture;
  let publicKeyToken;
  const pieces = assembly ? assembly.split(',') : [];

  if (pieces.length === 4) {
    name = pieces[0];
    version = pieces[1].split('Version=')[1];
    culture = pieces[2].split('Culture=')[1];
    publicKeyToken = pieces[3].split('PublicKeyToken=')[1];
  }

  return {
    name,
    version,
    culture,
    publicKeyToken
  };
}
function stackTracePlatformIcon(platform, frames) {
  const fileExtensions = lodash_uniq__WEBPACK_IMPORTED_MODULE_5___default()(lodash_compact__WEBPACK_IMPORTED_MODULE_3___default()(frames.map(frame => {
    var _frame$filename;

    return (0,sentry_utils_fileExtension__WEBPACK_IMPORTED_MODULE_10__.getFileExtension)((_frame$filename = frame.filename) !== null && _frame$filename !== void 0 ? _frame$filename : '');
  })));

  if (fileExtensions.length === 1) {
    const newPlatform = (0,sentry_utils_fileExtension__WEBPACK_IMPORTED_MODULE_10__.fileExtensionToPlatform)(fileExtensions[0]);
    return newPlatform !== null && newPlatform !== void 0 ? newPlatform : platform;
  }

  return platform;
}
function isStacktraceNewestFirst() {
  const user = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_8__["default"].get('user'); // user may not be authenticated

  if (!user) {
    return true;
  }

  switch (user.options.stacktraceOrder) {
    case 2:
      return true;

    case 1:
      return false;

    case -1:
    default:
      return true;
  }
}

/***/ }),

/***/ "./app/components/events/meta/annotatedText/chunk.tsx":
/*!************************************************************!*\
  !*** ./app/components/events/meta/annotatedText/chunk.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var _redaction__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./redaction */ "./app/components/events/meta/annotatedText/redaction.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./utils */ "./app/components/events/meta/annotatedText/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





const Chunk = _ref => {
  let {
    chunk
  } = _ref;

  if (chunk.type === 'redaction') {
    const title = (0,_utils__WEBPACK_IMPORTED_MODULE_2__.getTooltipText)({
      rule_id: chunk.rule_id,
      remark: chunk.remark
    });
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_0__["default"], {
      title: title,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_redaction__WEBPACK_IMPORTED_MODULE_1__["default"], {
        children: chunk.text
      })
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
    children: chunk.text
  });
};

Chunk.displayName = "Chunk";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Chunk);

/***/ }),

/***/ "./app/components/events/meta/annotatedText/chunks.tsx":
/*!*************************************************************!*\
  !*** ./app/components/events/meta/annotatedText/chunks.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _chunk__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./chunk */ "./app/components/events/meta/annotatedText/chunk.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }





const Chunks = _ref => {
  let {
    chunks
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(ChunksSpan, {
    children: chunks.map((chunk, key) => /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.cloneElement)((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_chunk__WEBPACK_IMPORTED_MODULE_2__["default"], {
      chunk: chunk
    }), {
      key
    }))
  });
};

Chunks.displayName = "Chunks";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Chunks);

const ChunksSpan = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1s0tizn0"
} : 0)( true ? {
  name: "1g8jxa6",
  styles: "span{display:inline;}"
} : 0);

/***/ }),

/***/ "./app/components/events/meta/annotatedText/index.tsx":
/*!************************************************************!*\
  !*** ./app/components/events/meta/annotatedText/index.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var lodash_capitalize__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/capitalize */ "../node_modules/lodash/capitalize.js");
/* harmony import */ var lodash_capitalize__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_capitalize__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_components_list__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/list */ "./app/components/list/index.tsx");
/* harmony import */ var sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/list/listItem */ "./app/components/list/listItem.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _chunks__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./chunks */ "./app/components/events/meta/annotatedText/chunks.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./utils */ "./app/components/events/meta/annotatedText/utils.tsx");
/* harmony import */ var _valueElement__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./valueElement */ "./app/components/events/meta/annotatedText/valueElement.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }














const AnnotatedText = _ref => {
  let {
    value,
    meta,
    className,
    ...props
  } = _ref;

  const renderValue = () => {
    var _meta$chunks, _meta$rem;

    if (meta !== null && meta !== void 0 && (_meta$chunks = meta.chunks) !== null && _meta$chunks !== void 0 && _meta$chunks.length && meta.chunks.length > 1) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(_chunks__WEBPACK_IMPORTED_MODULE_9__["default"], {
        chunks: meta.chunks
      });
    }

    if (meta !== null && meta !== void 0 && (_meta$rem = meta.rem) !== null && _meta$rem !== void 0 && _meta$rem.length) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_5__["default"], {
        title: (0,_utils__WEBPACK_IMPORTED_MODULE_10__.getTooltipText)({
          rule_id: meta.rem[0][0],
          remark: meta.rem[0][1]
        }),
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(_valueElement__WEBPACK_IMPORTED_MODULE_11__["default"], {
          value: value,
          meta: meta
        })
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(_valueElement__WEBPACK_IMPORTED_MODULE_11__["default"], {
      value: value,
      meta: meta
    });
  };

  const formatErrorKind = kind => {
    return lodash_capitalize__WEBPACK_IMPORTED_MODULE_2___default()(kind.replace(/_/g, ' '));
  };

  const getErrorMessage = error => {
    const errorMessage = [];

    if (Array.isArray(error)) {
      var _error$;

      if (error[0]) {
        errorMessage.push(formatErrorKind(error[0]));
      }

      if ((_error$ = error[1]) !== null && _error$ !== void 0 && _error$.reason) {
        errorMessage.push(`(${error[1].reason})`);
      }
    } else {
      errorMessage.push(formatErrorKind(error));
    }

    return errorMessage.join(' ');
  };

  const getTooltipTitle = errors => {
    if (errors.length === 1) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(TooltipTitle, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Error: %s', getErrorMessage(errors[0]))
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(TooltipTitle, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("span", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Errors:')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(StyledList, {
        symbol: "bullet",
        children: errors.map((error, index) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_4__["default"], {
          children: getErrorMessage(error)
        }, index))
      })]
    });
  };

  const renderErrors = errors => {
    if (!errors.length) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(StyledTooltipError, {
      title: getTooltipTitle(errors),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(StyledIconWarning, {
        color: "red300"
      })
    });
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)("span", {
    role: "text",
    className: className,
    ...props,
    children: [renderValue(), (meta === null || meta === void 0 ? void 0 : meta.err) && renderErrors(meta.err)]
  });
};

AnnotatedText.displayName = "AnnotatedText";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AnnotatedText);

const StyledTooltipError = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e9xgd1j3"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(0.75), ";vertical-align:middle;" + ( true ? "" : 0));

const StyledList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_list__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e9xgd1j2"
} : 0)("li{padding-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(3), ";word-break:break-all;:before{border-color:", p => p.theme.white, ";top:6px;}}" + ( true ? "" : 0));

const TooltipTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e9xgd1j1"
} : 0)( true ? {
  name: "1flj9lk",
  styles: "text-align:left"
} : 0);

const StyledIconWarning = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_6__.IconWarning,  true ? {
  target: "e9xgd1j0"
} : 0)( true ? {
  name: "1989ovb",
  styles: "vertical-align:middle"
} : 0);

/***/ }),

/***/ "./app/components/events/meta/annotatedText/redaction.tsx":
/*!****************************************************************!*\
  !*** ./app/components/events/meta/annotatedText/redaction.tsx ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



const Redaction = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_ref => {
  let {
    children,
    className
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)("span", {
    className: className,
    children: children
  });
},  true ? {
  target: "er04dok0"
} : 0)("cursor:default;vertical-align:middle;", p => !p.withoutBackground && `background: rgba(255, 0, 0, 0.05);`, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Redaction);

/***/ }),

/***/ "./app/components/events/meta/annotatedText/utils.tsx":
/*!************************************************************!*\
  !*** ./app/components/events/meta/annotatedText/utils.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getTooltipText": () => (/* binding */ getTooltipText)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");

const REMARKS = {
  a: 'Annotated',
  x: 'Removed',
  s: 'Replaced',
  m: 'Masked',
  p: 'Pseudonymized',
  e: 'Encrypted'
};
const KNOWN_RULES = {
  '!limit': 'size limits',
  '!raw': 'raw payload',
  '!config': 'SDK configuration'
};
function getTooltipText(_ref) {
  let {
    remark = '',
    rule_id: rule = ''
  } = _ref;
  const remark_title = REMARKS[remark];
  const rule_title = KNOWN_RULES[rule] || (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('PII rule "%s"', rule);

  if (remark_title) {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('%s because of %s', remark_title, rule_title);
  }

  return rule_title;
}

/***/ }),

/***/ "./app/components/events/meta/annotatedText/valueElement.tsx":
/*!*******************************************************************!*\
  !*** ./app/components/events/meta/annotatedText/valueElement.tsx ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _redaction__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./redaction */ "./app/components/events/meta/annotatedText/redaction.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





// If you find yourself modifying this component to fix some tooltip bug,
// consider that `meta` is not properly passed into this component in the
// first place. It's much more likely that `withMeta` is buggy or improperly
// used than that this component has a bug.
const ValueElement = _ref => {
  var _meta$err, _meta$rem;

  let {
    value,
    meta
  } = _ref;

  if (!!value && meta) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_redaction__WEBPACK_IMPORTED_MODULE_2__["default"], {
      children: value
    });
  }

  if (meta !== null && meta !== void 0 && (_meta$err = meta.err) !== null && _meta$err !== void 0 && _meta$err.length) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_redaction__WEBPACK_IMPORTED_MODULE_2__["default"], {
      withoutBackground: true,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("i", {
        children: `<${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('invalid')}>`
      })
    });
  }

  if (meta !== null && meta !== void 0 && (_meta$rem = meta.rem) !== null && _meta$rem !== void 0 && _meta$rem.length) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_redaction__WEBPACK_IMPORTED_MODULE_2__["default"], {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("i", {
        children: `<${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('redacted')}>`
      })
    });
  }

  if ( /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_0__.isValidElement)(value)) {
    return value;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: typeof value === 'object' || typeof value === 'boolean' ? JSON.stringify(value) : value
  });
};

ValueElement.displayName = "ValueElement";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ValueElement);

/***/ }),

/***/ "./app/components/events/styles.tsx":
/*!******************************************!*\
  !*** ./app/components/events/styles.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "BannerContainer": () => (/* binding */ BannerContainer),
/* harmony export */   "BannerSummary": () => (/* binding */ BannerSummary),
/* harmony export */   "CauseHeader": () => (/* binding */ CauseHeader),
/* harmony export */   "DataSection": () => (/* binding */ DataSection)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");


const DataSection = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e9xr8173"
} : 0)("display:flex;flex-direction:column;border-top:1px solid ", p => p.theme.innerBorder, ";margin:0;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(3), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(2), ";@media (min-width: ", p => p.theme.breakpoints.medium, "){padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(3), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(4), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(3), ";}" + ( true ? "" : 0));

function getColors(_ref) {
  let {
    priority,
    theme
  } = _ref;
  const COLORS = {
    default: {
      background: theme.backgroundSecondary,
      border: theme.border
    },
    danger: {
      background: theme.alert.error.backgroundLight,
      border: theme.alert.error.border
    },
    success: {
      background: theme.alert.success.backgroundLight,
      border: theme.alert.success.border
    }
  };
  return COLORS[priority];
}

const BannerContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e9xr8172"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";background:", p => getColors(p).background, ";border-top:1px solid ", p => getColors(p).border, ";border-bottom:1px solid ", p => getColors(p).border, ";&+",
/* sc-selector */
DataSection, ":first-child,&+div>",
/* sc-selector */
DataSection, ":first-child{border-top:0;}" + ( true ? "" : 0));
const BannerSummary = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('p',  true ? {
  target: "e9xr8171"
} : 0)("display:flex;align-items:flex-start;margin-bottom:0;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(2), ";@media (min-width: ", p => p.theme.breakpoints.large, "){padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(4), ";}&>.icon,&>svg{flex-shrink:0;flex-grow:0;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1), ";margin-top:2px;}&>span{flex-grow:1;}&>a{align-self:flex-end;}" + ( true ? "" : 0));
const CauseHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e9xr8170"
} : 0)("display:flex;justify-content:space-between;align-items:center;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(3), ";& button,& h3{color:", p => p.theme.gray300, ";font-size:14px;font-weight:600;line-height:1.2;text-transform:uppercase;}& h3{margin-bottom:0;}& button{background:none;border:0;outline:none;padding:0;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/events/traceEventDataSection.tsx":
/*!*********************************************************!*\
  !*** ./app/components/events/traceEventDataSection.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "PermalinkTitle": () => (/* binding */ PermalinkTitle),
/* harmony export */   "TraceEventDataSection": () => (/* binding */ TraceEventDataSection),
/* harmony export */   "TraceEventDataSectionContext": () => (/* binding */ TraceEventDataSectionContext),
/* harmony export */   "displayOptions": () => (/* binding */ displayOptions)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/compactSelect */ "./app/components/forms/compactSelect.tsx");
/* harmony import */ var sentry_components_forms_compositeSelect__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/forms/compositeSelect */ "./app/components/forms/compositeSelect.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_icons_iconAnchor__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/icons/iconAnchor */ "./app/icons/iconAnchor.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_types_stacktrace__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/types/stacktrace */ "./app/types/stacktrace.tsx");
/* harmony import */ var sentry_utils_platform__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/platform */ "./app/utils/platform.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var _eventDataSection__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ./eventDataSection */ "./app/components/events/eventDataSection.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


















const sortByOptions = {
  'recent-first': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Newest'),
  'recent-last': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Oldest')
};
const displayOptions = {
  'absolute-addresses': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Absolute addresses'),
  'absolute-file-paths': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Absolute file paths'),
  minified: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Unsymbolicated'),
  'raw-stack-trace': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Raw stack trace'),
  'verbose-function-names': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Verbose function names')
};
const TraceEventDataSectionContext = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_3__.createContext)(undefined);
function TraceEventDataSection(_ref) {
  let {
    type,
    title,
    wrapTitle,
    stackTraceNotFound,
    fullStackTrace,
    recentFirst,
    children,
    platform,
    stackType,
    projectId,
    eventId,
    hasNewestFirst,
    hasMinified,
    hasVerboseFunctionNames,
    hasAbsoluteFilePaths,
    hasAbsoluteAddresses,
    hasAppOnlyFrames
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_15__["default"])();
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_16__["default"])();
  const [state, setState] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)({
    sortBy: recentFirst ? 'recent-first' : 'recent-last',
    fullStackTrace: !hasAppOnlyFrames ? true : fullStackTrace,
    display: []
  });

  function getDisplayOptions() {
    if (platform === 'objc' || platform === 'native' || platform === 'cocoa') {
      return [{
        label: displayOptions['absolute-addresses'],
        value: 'absolute-addresses',
        disabled: state.display.includes('raw-stack-trace') || !hasAbsoluteAddresses,
        tooltip: state.display.includes('raw-stack-trace') ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Not available on raw stack trace') : !hasAbsoluteAddresses ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Absolute addresses not available') : undefined
      }, {
        label: displayOptions['absolute-file-paths'],
        value: 'absolute-file-paths',
        disabled: state.display.includes('raw-stack-trace') || !hasAbsoluteFilePaths,
        tooltip: state.display.includes('raw-stack-trace') ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Not available on raw stack trace') : !hasAbsoluteFilePaths ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Absolute file paths not available') : undefined
      }, {
        label: displayOptions.minified,
        value: 'minified',
        disabled: !hasMinified,
        tooltip: !hasMinified ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Unsymbolicated version not available') : undefined
      }, {
        label: displayOptions['raw-stack-trace'],
        value: 'raw-stack-trace'
      }, {
        label: displayOptions['verbose-function-names'],
        value: 'verbose-function-names',
        disabled: state.display.includes('raw-stack-trace') || !hasVerboseFunctionNames,
        tooltip: state.display.includes('raw-stack-trace') ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Not available on raw stack trace') : !hasVerboseFunctionNames ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Verbose function names not available') : undefined
      }];
    }

    if (platform.startsWith('python')) {
      return [{
        label: displayOptions['raw-stack-trace'],
        value: 'raw-stack-trace'
      }];
    }

    return [{
      label: displayOptions.minified,
      value: 'minified',
      disabled: !hasMinified,
      tooltip: !hasMinified ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Minified version not available') : undefined
    }, {
      label: displayOptions['raw-stack-trace'],
      value: 'raw-stack-trace'
    }];
  }

  const nativePlatform = (0,sentry_utils_platform__WEBPACK_IMPORTED_MODULE_14__.isNativePlatform)(platform);
  const minified = stackType === sentry_types_stacktrace__WEBPACK_IMPORTED_MODULE_13__.STACK_TYPE.MINIFIED; // Apple crash report endpoint

  const appleCrashEndpoint = `/projects/${organization.slug}/${projectId}/events/${eventId}/apple-crash-report?minified=${minified}`;
  const rawStackTraceDownloadLink = `${api.baseUrl}${appleCrashEndpoint}&download=1`;
  const sortByTooltip = !hasNewestFirst ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Not available on stack trace with single frame') : state.display.includes('raw-stack-trace') ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Not available on raw stack trace') : undefined;
  const childProps = {
    recentFirst: state.sortBy === 'recent-first',
    display: state.display,
    fullStackTrace: state.fullStackTrace
  };
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(_eventDataSection__WEBPACK_IMPORTED_MODULE_17__["default"], {
    type: type,
    title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(Header, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(Title, {
        children: /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_3__.cloneElement)(title, {
          type
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(ActionWrapper, {
        children: !stackTraceNotFound && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
          children: [!state.display.includes('raw-stack-trace') && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_8__["default"], {
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Only full version available'),
            disabled: hasAppOnlyFrames,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_5__["default"], {
              active: state.fullStackTrace ? 'full' : 'relevant',
              merged: true,
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
                type: "button",
                size: "xs",
                barId: "relevant",
                onClick: () => setState({ ...state,
                  fullStackTrace: false
                }),
                disabled: !hasAppOnlyFrames,
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Most Relevant')
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
                type: "button",
                size: "xs",
                barId: "full",
                priority: !hasAppOnlyFrames ? 'primary' : undefined,
                onClick: () => setState({ ...state,
                  fullStackTrace: true
                }),
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Full Stack Trace')
              })]
            })
          }), state.display.includes('raw-stack-trace') && nativePlatform && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
            size: "xs",
            href: rawStackTraceDownloadLink,
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Download raw stack trace file'),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Download')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_6__["default"], {
            triggerProps: {
              icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconSort, {}),
              size: 'xs',
              title: sortByTooltip
            },
            isDisabled: !!sortByTooltip,
            placement: "bottom right",
            onChange: selectedOption => {
              setState({ ...state,
                sortBy: selectedOption.value
              });
            },
            value: state.sortBy,
            options: Object.entries(sortByOptions).map(_ref2 => {
              let [value, label] = _ref2;
              return {
                label,
                value
              };
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_forms_compositeSelect__WEBPACK_IMPORTED_MODULE_7__["default"], {
            triggerProps: {
              icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconEllipsis, {}),
              size: 'xs',
              showChevron: false,
              'aria-label': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Options')
            },
            triggerLabel: "",
            placement: "bottom right",
            sections: [{
              label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Display'),
              value: 'display',
              defaultValue: state.display,
              multiple: true,
              options: getDisplayOptions().map(option => ({ ...option,
                value: String(option.value)
              })),
              onChange: display => setState({ ...state,
                display
              })
            }]
          })]
        })
      })]
    }),
    showPermalink: false,
    wrapTitle: wrapTitle,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(TraceEventDataSectionContext.Provider, {
      value: childProps,
      children: children(childProps)
    })
  });
}
TraceEventDataSection.displayName = "TraceEventDataSection";
function PermalinkTitle(props) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(Permalink, { ...props,
    href: '#' + props.type,
    className: "permalink",
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(StyledIconAnchor, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("h3", {
      children: props.children
    })]
  });
}
PermalinkTitle.displayName = "PermalinkTitle";

const StyledIconAnchor = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons_iconAnchor__WEBPACK_IMPORTED_MODULE_10__.IconAnchor,  true ? {
  target: "ej36lci4"
} : 0)( true ? {
  name: "q6ay0w",
  styles: "display:none;position:absolute;top:4px;left:-22px"
} : 0);

const Permalink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('a',  true ? {
  target: "ej36lci3"
} : 0)("display:inline-flex;justify-content:flex-start;&:hover ", StyledIconAnchor, "{display:block;color:", p => p.theme.gray300, ";}" + ( true ? "" : 0));

const Header = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ej36lci2"
} : 0)("width:100%;display:flex;flex-wrap:wrap;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";align-items:center;justify-content:space-between;" + ( true ? "" : 0));

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ej36lci1"
} : 0)("flex:1;@media (min-width: ", props => props.theme.breakpoints.small, "){flex:unset;}" + ( true ? "" : 0));

const ActionWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ej36lci0"
} : 0)("display:flex;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/forms/compositeSelect.tsx":
/*!**************************************************!*\
  !*** ./app/components/forms/compositeSelect.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/forms/compactSelect */ "./app/components/forms/compactSelect.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




/**
 * CompositeSelect simulates independent selectors inside the same dropdown
 * menu. Each selector is called a "section". The selection value of one
 * section does not affect the value of the others.
 */



/**
 * Special version of CompactSelect that simulates independent selectors (here
 * implemented as "sections") within the same dropdown menu.
 */
function CompositeSelect(_ref) {
  let {
    sections,
    ...props
  } = _ref;
  const [values, setValues] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(sections.map(section => section.defaultValue));
  /**
   * Object that maps an option value (e.g. "opt_one") to its parent section's index,
   * to be used in onChangeValueMap.
   */

  const optionsMap = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    const allOptions = sections.map((section, i) => section.options.map(opt => [opt.value, i])).flat();
    return Object.fromEntries(allOptions);
  }, [sections]);
  /**
   * Options with the "selectionMode" key attached. This key overrides the
   * isMulti setting from SelectControl and forces SelectOption
   * (./selectOption.tsx) to display either a chekmark or a checkbox based on
   * the selection mode of its parent section, rather than the selection mode
   * of the entire select menu.
   */

  const options = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    return sections.map(section => ({ ...section,
      options: section.options.map(opt => ({ ...opt,
        selectionMode: section.multiple ? 'multiple' : 'single'
      }))
    }));
  }, [sections]);
  /**
   * Intercepts the incoming set of selected values, and trims it so that
   * single-selection sections will only have one selected value at a time.
   */

  function onChangeValueMap(selectedOptions) {
    const newValues = new Array(sections.length).fill(undefined);
    selectedOptions.forEach(option => {
      const parentSectionIndex = optionsMap[option.value];
      const parentSection = sections[parentSectionIndex]; // If the section allows multiple selection, then add the value to the
      // list of selected values

      if (parentSection.multiple) {
        if (!newValues[parentSectionIndex]) {
          newValues[parentSectionIndex] = [];
        }

        newValues[parentSectionIndex].push(option.value);
        return;
      } // If the section allows only single selection, then replace whatever the
      // old value is with the new one.


      if (option.value) {
        newValues[parentSectionIndex] = option.value;
      }
    });
    sections.forEach((section, i) => {
      // Prevent sections with single selection from losing their values. This might
      // happen if the user clicks on an already-selected option.
      if (!section.multiple && !newValues[i]) {
        newValues[i] = values[i]; // Return an empty array for sections with multiple selection without any value.
      } else if (!newValues[i]) {
        newValues[i] = [];
      } // Trigger the onChange callback for sections whose values have changed.


      if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_3__.valueIsEqual)(values[i], newValues[i])) {
        var _sections$i$onChange, _sections$i;

        (_sections$i$onChange = (_sections$i = sections[i]).onChange) === null || _sections$i$onChange === void 0 ? void 0 : _sections$i$onChange.call(_sections$i, newValues[i]);
      }
    });
    setValues(newValues); // Return a flattened array of the selected values to be used inside
    // CompactSelect and SelectControl.

    return newValues.flat();
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_2__["default"], { ...props,
    multiple: true,
    options: options,
    defaultValue: sections.map(section => section.defaultValue).flat(),
    onChangeValueMap: onChangeValueMap
  });
}

CompositeSelect.displayName = "CompositeSelect";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (CompositeSelect);

/***/ }),

/***/ "./app/components/layouts/thirds.tsx":
/*!*******************************************!*\
  !*** ./app/components/layouts/thirds.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Body": () => (/* binding */ Body),
/* harmony export */   "Header": () => (/* binding */ Header),
/* harmony export */   "HeaderActions": () => (/* binding */ HeaderActions),
/* harmony export */   "HeaderContent": () => (/* binding */ HeaderContent),
/* harmony export */   "HeaderNavTabs": () => (/* binding */ HeaderNavTabs),
/* harmony export */   "Main": () => (/* binding */ Main),
/* harmony export */   "Side": () => (/* binding */ Side),
/* harmony export */   "Title": () => (/* binding */ Title)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/navTabs */ "./app/components/navTabs.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }



/**
 * Base container for 66/33 containers.
 */

const Body = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1q4ew4a7"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(2), ";margin:0;background-color:", p => p.theme.background, ";flex-grow:1;@media (min-width: ", p => p.theme.breakpoints.medium, "){padding:", p => !p.noRowGap ? `${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(3)} ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(4)}` : `${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(2)} ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(4)}`, ";}@media (min-width: ", p => p.theme.breakpoints.large, "){display:grid;grid-template-columns:minmax(100px, auto) 325px;align-content:start;gap:", p => !p.noRowGap ? `${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(3)}` : `0 ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(3)}`, ";}" + ( true ? "" : 0));
/**
 * Use HeaderContent to create horizontal regions in the header
 * that contain a heading/breadcrumbs and a button group.
 */

const HeaderContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1q4ew4a6"
} : 0)("display:flex;flex-direction:column;justify-content:normal;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(2), ";overflow:hidden;max-width:100%;@media (max-width: ", p => p.theme.breakpoints.medium, "){margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), ";}" + ( true ? "" : 0));
/**
 * Container for action buttons and secondary information that
 * flows on the top right of the header.
 */

const HeaderActions = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1q4ew4a5"
} : 0)("display:flex;flex-direction:column;justify-content:normal;min-width:max-content;@media (max-width: ", p => p.theme.breakpoints.medium, "){width:max-content;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(2), ";}" + ( true ? "" : 0));
/**
 * Heading container that includes margins.
 */

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('h1',  true ? {
  target: "e1q4ew4a4"
} : 0)(p => p.theme.text.pageTitle, ";color:", p => p.theme.headingColor, ";margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(2), ";margin-bottom:0!important;min-height:30px;align-self:center;", p => p.theme.overflowEllipsis, ";@media (max-width: ", p => p.theme.breakpoints.medium, "){margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), ";}" + ( true ? "" : 0));
/**
 * Header container for header content and header actions.
 *
 * Uses a horizontal layout in wide viewports to put space between
 * the headings and the actions container. In narrow viewports these elements
 * are stacked vertically.
 *
 * Use `noActionWrap` to disable wrapping if there are minimal actions.
 */

const Header = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1q4ew4a3"
} : 0)("display:grid;grid-template-columns:", p => !p.noActionWrap ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) auto', ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(2), " 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(2), ";background-color:transparent;border-bottom:1px solid ", p => p.theme.border, ";@media (min-width: ", p => p.theme.breakpoints.medium, "){padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(4), " 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(4), ";grid-template-columns:minmax(0, 1fr) auto;}" + ( true ? "" : 0));
/**
 * Styled Nav Tabs for use inside a Layout.Header component
 */

const HeaderNavTabs = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "e1q4ew4a2"
} : 0)("margin:0;border-bottom:0!important;&>li{margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(3), ";}&>li>a{display:flex;align-items:center;height:1.25rem;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), " 0;margin-bottom:4px;box-sizing:content-box;}&>li.active>a{margin-bottom:0;}" + ( true ? "" : 0));
/**
 * Containers for two column 66/33 layout.
 */

const Main = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('section',  true ? {
  target: "e1q4ew4a1"
} : 0)("grid-column:", p => p.fullWidth ? '1/3' : '1/2', ";max-width:100%;" + ( true ? "" : 0));
const Side = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('aside',  true ? {
  target: "e1q4ew4a0"
} : 0)( true ? {
  name: "pyv407",
  styles: "grid-column:2/3"
} : 0);

/***/ }),

/***/ "./app/components/navTabs.tsx":
/*!************************************!*\
  !*** ./app/components/navTabs.tsx ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! classnames */ "../node_modules/classnames/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(classnames__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function NavTabs(_ref) {
  let {
    underlined,
    className,
    ...tabProps
  } = _ref;
  const mergedClassName = classnames__WEBPACK_IMPORTED_MODULE_1___default()('nav nav-tabs', className, {
    'border-bottom': underlined
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(Wrap, {
    className: mergedClassName,
    ...tabProps
  });
}

NavTabs.displayName = "NavTabs";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (NavTabs);

const Wrap = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('ul',  true ? {
  target: "e1fej6h40"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/pagination.tsx":
/*!***************************************!*\
  !*** ./app/components/pagination.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_parseLinkHeader__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/parseLinkHeader */ "./app/utils/parseLinkHeader.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");

// eslint-disable-next-line no-restricted-imports







/**
 * @param cursor The string cursor value
 * @param path   The current page pathname
 * @param query  The current query object
 * @param delta  The delta in page number change triggered by the
 *               click. A negative delta would be a "previous" page.
 */




const defaultOnCursor = (cursor, path, query, _direction) => react_router__WEBPACK_IMPORTED_MODULE_1__.browserHistory.push({
  pathname: path,
  query: { ...query,
    cursor
  }
});

const Pagination = _ref => {
  var _links$previous, _links$next;

  let {
    to,
    location,
    className,
    onCursor = defaultOnCursor,
    paginationAnalyticsEvent,
    pageLinks,
    size = 'sm',
    caption,
    disabled = false
  } = _ref;

  if (!pageLinks) {
    return null;
  }

  const path = to !== null && to !== void 0 ? to : location.pathname;
  const query = location.query;
  const links = (0,sentry_utils_parseLinkHeader__WEBPACK_IMPORTED_MODULE_7__["default"])(pageLinks);
  const previousDisabled = disabled || ((_links$previous = links.previous) === null || _links$previous === void 0 ? void 0 : _links$previous.results) === false;
  const nextDisabled = disabled || ((_links$next = links.next) === null || _links$next === void 0 ? void 0 : _links$next.results) === false;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(Wrapper, {
    className: className,
    children: [caption && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(PaginationCaption, {
      children: caption
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_3__["default"], {
      merged: true,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_4__.IconChevron, {
          direction: "left",
          size: "sm"
        }),
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Previous'),
        size: size,
        disabled: previousDisabled,
        onClick: () => {
          var _links$previous2;

          onCursor === null || onCursor === void 0 ? void 0 : onCursor((_links$previous2 = links.previous) === null || _links$previous2 === void 0 ? void 0 : _links$previous2.cursor, path, query, -1);
          paginationAnalyticsEvent === null || paginationAnalyticsEvent === void 0 ? void 0 : paginationAnalyticsEvent('Previous');
        }
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_4__.IconChevron, {
          direction: "right",
          size: "sm"
        }),
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Next'),
        size: size,
        disabled: nextDisabled,
        onClick: () => {
          var _links$next2;

          onCursor === null || onCursor === void 0 ? void 0 : onCursor((_links$next2 = links.next) === null || _links$next2 === void 0 ? void 0 : _links$next2.cursor, path, query, 1);
          paginationAnalyticsEvent === null || paginationAnalyticsEvent === void 0 ? void 0 : paginationAnalyticsEvent('Next');
        }
      })]
    })]
  });
};

Pagination.displayName = "Pagination";

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ewgwd3b1"
} : 0)("display:flex;align-items:center;justify-content:flex-end;margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(3), " 0 0 0;" + ( true ? "" : 0));

const PaginationCaption = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "ewgwd3b0"
} : 0)("color:", p => p.theme.subText, ";font-size:", p => p.theme.fontSizeMedium, ";margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(2), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_1__.withRouter)(Pagination));

/***/ }),

/***/ "./app/components/sentryAppComponentIcon.tsx":
/*!***************************************************!*\
  !*** ./app/components/sentryAppComponentIcon.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_avatar_sentryAppAvatar__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/avatar/sentryAppAvatar */ "./app/components/avatar/sentryAppAvatar.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





/**
 * Icon Renderer for SentryAppComponents with UI
 * (e.g. Issue Linking, Stacktrace Linking)
 */
const SentryAppComponentIcon = _ref => {
  var _sentryAppComponent$s, _sentryAppComponent$s2;

  let {
    sentryAppComponent
  } = _ref;
  const selectedAvatar = (_sentryAppComponent$s = sentryAppComponent.sentryApp) === null || _sentryAppComponent$s === void 0 ? void 0 : (_sentryAppComponent$s2 = _sentryAppComponent$s.avatars) === null || _sentryAppComponent$s2 === void 0 ? void 0 : _sentryAppComponent$s2.find(_ref2 => {
    let {
      color
    } = _ref2;
    return color === false;
  });
  const isDefault = (selectedAvatar === null || selectedAvatar === void 0 ? void 0 : selectedAvatar.avatarType) !== 'upload';
  const isDisabled = sentryAppComponent.error;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(SentryAppAvatarWrapper, {
    isDark: sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_2__["default"].get('theme') === 'dark',
    isDefault: isDefault,
    isDisabled: isDisabled,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_avatar_sentryAppAvatar__WEBPACK_IMPORTED_MODULE_1__["default"], {
      sentryApp: sentryAppComponent.sentryApp,
      size: 20,
      isColor: false
    })
  });
};

SentryAppComponentIcon.displayName = "SentryAppComponentIcon";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SentryAppComponentIcon);

const SentryAppAvatarWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e8x8anl0"
} : 0)("color:", _ref3 => {
  let {
    isDark,
    isDisabled,
    theme
  } = _ref3;
  return isDisabled ? theme.disabled : isDark ? 'white' : 'black';
}, ";filter:", p => p.isDark && !p.isDefault ? 'invert(1)' : 'invert(0)', ";line-height:0;flex-shrink:0;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/stacktracePreview.tsx":
/*!**********************************************!*\
  !*** ./app/components/stacktracePreview.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "STACKTRACE_PREVIEW_TOOLTIP_DELAY": () => (/* binding */ STACKTRACE_PREVIEW_TOOLTIP_DELAY),
/* harmony export */   "StackTracePreview": () => (/* binding */ StackTracePreview)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_events_interfaces_crashContent_stackTrace_content__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/events/interfaces/crashContent/stackTrace/content */ "./app/components/events/interfaces/crashContent/stackTrace/content.tsx");
/* harmony import */ var sentry_components_events_interfaces_crashContent_stackTrace_contentV2__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/events/interfaces/crashContent/stackTrace/contentV2 */ "./app/components/events/interfaces/crashContent/stackTrace/contentV2.tsx");
/* harmony import */ var sentry_components_events_interfaces_crashContent_stackTrace_contentV3__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/events/interfaces/crashContent/stackTrace/contentV3 */ "./app/components/events/interfaces/crashContent/stackTrace/contentV3.tsx");
/* harmony import */ var sentry_components_events_interfaces_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/events/interfaces/utils */ "./app/components/events/interfaces/utils.tsx");
/* harmony import */ var sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/hovercard */ "./app/components/hovercard.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_types_event__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/types/event */ "./app/types/event.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_platform__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/platform */ "./app/utils/platform.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var _events_interfaces_threads_threadSelector_findBestThread__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ./events/interfaces/threads/threadSelector/findBestThread */ "./app/components/events/interfaces/threads/threadSelector/findBestThread.tsx");
/* harmony import */ var _events_interfaces_threads_threadSelector_getThreadStacktrace__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ./events/interfaces/threads/threadSelector/getThreadStacktrace */ "./app/components/events/interfaces/threads/threadSelector/getThreadStacktrace.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



















const REQUEST_DELAY = 100;
const HOVERCARD_CONTENT_DELAY = 400;
const STACKTRACE_PREVIEW_TOOLTIP_DELAY = 1000;

function getStacktrace(event) {
  var _event$entries$find$d, _event$entries$find, _event$entries$find$d2, _exceptionsWithStackt, _exceptionsWithStackt2, _event$entries$find$d3, _event$entries$find2, _event$entries$find2$;

  const exceptionsWithStacktrace = (_event$entries$find$d = (_event$entries$find = event.entries.find(e => e.type === sentry_types_event__WEBPACK_IMPORTED_MODULE_12__.EntryType.EXCEPTION)) === null || _event$entries$find === void 0 ? void 0 : (_event$entries$find$d2 = _event$entries$find.data) === null || _event$entries$find$d2 === void 0 ? void 0 : _event$entries$find$d2.values.filter(_ref => {
    let {
      stacktrace
    } = _ref;
    return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_13__.defined)(stacktrace);
  })) !== null && _event$entries$find$d !== void 0 ? _event$entries$find$d : [];
  const exceptionStacktrace = (0,sentry_components_events_interfaces_utils__WEBPACK_IMPORTED_MODULE_7__.isStacktraceNewestFirst)() ? (_exceptionsWithStackt = exceptionsWithStacktrace[exceptionsWithStacktrace.length - 1]) === null || _exceptionsWithStackt === void 0 ? void 0 : _exceptionsWithStackt.stacktrace : (_exceptionsWithStackt2 = exceptionsWithStacktrace[0]) === null || _exceptionsWithStackt2 === void 0 ? void 0 : _exceptionsWithStackt2.stacktrace;

  if (exceptionStacktrace) {
    return exceptionStacktrace;
  }

  const threads = (_event$entries$find$d3 = (_event$entries$find2 = event.entries.find(e => e.type === sentry_types_event__WEBPACK_IMPORTED_MODULE_12__.EntryType.THREADS)) === null || _event$entries$find2 === void 0 ? void 0 : (_event$entries$find2$ = _event$entries$find2.data) === null || _event$entries$find2$ === void 0 ? void 0 : _event$entries$find2$.values) !== null && _event$entries$find$d3 !== void 0 ? _event$entries$find$d3 : [];
  const bestThread = (0,_events_interfaces_threads_threadSelector_findBestThread__WEBPACK_IMPORTED_MODULE_16__["default"])(threads);

  if (!bestThread) {
    return null;
  }

  const bestThreadStacktrace = (0,_events_interfaces_threads_threadSelector_getThreadStacktrace__WEBPACK_IMPORTED_MODULE_17__["default"])(false, bestThread);

  if (bestThreadStacktrace) {
    return bestThreadStacktrace;
  }

  return null;
}

function StackTracePreviewContent(_ref2) {
  var _stacktrace$frames2, _stacktrace$frames2$f, _ref3;

  let {
    event,
    stacktrace,
    orgFeatures = [],
    groupingCurrentLevel
  } = _ref2;
  const includeSystemFrames = (0,react__WEBPACK_IMPORTED_MODULE_3__.useMemo)(() => {
    var _stacktrace$frames$ev, _stacktrace$frames;

    return (_stacktrace$frames$ev = stacktrace === null || stacktrace === void 0 ? void 0 : (_stacktrace$frames = stacktrace.frames) === null || _stacktrace$frames === void 0 ? void 0 : _stacktrace$frames.every(frame => !frame.inApp)) !== null && _stacktrace$frames$ev !== void 0 ? _stacktrace$frames$ev : false;
  }, [stacktrace]);
  const framePlatform = stacktrace === null || stacktrace === void 0 ? void 0 : (_stacktrace$frames2 = stacktrace.frames) === null || _stacktrace$frames2 === void 0 ? void 0 : (_stacktrace$frames2$f = _stacktrace$frames2.find(frame => !!frame.platform)) === null || _stacktrace$frames2$f === void 0 ? void 0 : _stacktrace$frames2$f.platform;
  const platform = (_ref3 = framePlatform !== null && framePlatform !== void 0 ? framePlatform : event.platform) !== null && _ref3 !== void 0 ? _ref3 : 'other';
  const newestFirst = (0,sentry_components_events_interfaces_utils__WEBPACK_IMPORTED_MODULE_7__.isStacktraceNewestFirst)();
  const commonProps = {
    data: stacktrace,
    expandFirstFrame: false,
    includeSystemFrames,
    platform,
    newestFirst,
    event,
    isHoverPreviewed: true
  };

  if (orgFeatures.includes('native-stack-trace-v2') && (0,sentry_utils_platform__WEBPACK_IMPORTED_MODULE_14__.isNativePlatform)(platform)) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_events_interfaces_crashContent_stackTrace_contentV3__WEBPACK_IMPORTED_MODULE_6__["default"], { ...commonProps,
      groupingCurrentLevel: groupingCurrentLevel
    });
  }

  if (orgFeatures.includes('grouping-stacktrace-ui')) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_events_interfaces_crashContent_stackTrace_contentV2__WEBPACK_IMPORTED_MODULE_5__["default"], { ...commonProps,
      groupingCurrentLevel: groupingCurrentLevel
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_events_interfaces_crashContent_stackTrace_content__WEBPACK_IMPORTED_MODULE_4__["default"], { ...commonProps
  });
}

StackTracePreviewContent.displayName = "StackTracePreviewContent";

function StackTracePreview(props) {
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_15__["default"])();
  const [loadingVisible, setLoadingVisible] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(false);
  const [status, setStatus] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)('loading');
  const [event, setEvent] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(null);
  const delayTimeoutRef = (0,react__WEBPACK_IMPORTED_MODULE_3__.useRef)(undefined);
  const loaderTimeoutRef = (0,react__WEBPACK_IMPORTED_MODULE_3__.useRef)(undefined);
  (0,react__WEBPACK_IMPORTED_MODULE_3__.useEffect)(() => {
    return () => {
      window.clearTimeout(loaderTimeoutRef.current);
      window.clearTimeout(delayTimeoutRef.current);
    };
  }, []);
  const fetchData = (0,react__WEBPACK_IMPORTED_MODULE_3__.useCallback)(async () => {
    // Data is already loaded
    if (event) {
      return;
    } // These are required props to load data


    if (!props.issueId && !props.eventId && !props.projectSlug) {
      return;
    }

    loaderTimeoutRef.current = window.setTimeout(() => setLoadingVisible(true), HOVERCARD_CONTENT_DELAY);

    try {
      const evt = await api.requestPromise(props.eventId && props.projectSlug ? `/projects/${props.organization.slug}/${props.projectSlug}/events/${props.eventId}/` : `/issues/${props.issueId}/events/latest/?collapse=stacktraceOnly`);
      window.clearTimeout(loaderTimeoutRef.current);
      setEvent(evt);
      setStatus('loaded');
      setLoadingVisible(false);
    } catch {
      window.clearTimeout(loaderTimeoutRef.current);
      setEvent(null);
      setStatus('error');
      setLoadingVisible(false);
    }
  }, [event, api, props.organization.slug, props.projectSlug, props.eventId, props.issueId]);
  const handleMouseEnter = (0,react__WEBPACK_IMPORTED_MODULE_3__.useCallback)(() => {
    window.clearTimeout(delayTimeoutRef.current);
    delayTimeoutRef.current = window.setTimeout(fetchData, REQUEST_DELAY);
  }, [fetchData]);
  const handleMouseLeave = (0,react__WEBPACK_IMPORTED_MODULE_3__.useCallback)(() => {
    window.clearTimeout(delayTimeoutRef.current);
    delayTimeoutRef.current = undefined;
  }, []); // Not sure why we need to stop propagation, maybe to prevent the
  // hovercard from closing? If we are doing this often, maybe it should be
  // part of the hovercard component.

  const handleStackTracePreviewClick = (0,react__WEBPACK_IMPORTED_MODULE_3__.useCallback)(e => void e.stopPropagation(), []);
  const stacktrace = (0,react__WEBPACK_IMPORTED_MODULE_3__.useMemo)(() => event ? getStacktrace(event) : null, [event]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("span", {
    className: props.className,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(StacktraceHovercard, {
      body: status === 'loading' && !loadingVisible ? null : status === 'loading' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(NoStackTraceWrapper, {
        onClick: handleStackTracePreviewClick,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_9__["default"], {
          hideMessage: true,
          size: 32
        })
      }) : status === 'error' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(NoStackTraceWrapper, {
        onClick: handleStackTracePreviewClick,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Failed to load stack trace.')
      }) : !stacktrace ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(NoStackTraceWrapper, {
        onClick: handleStackTracePreviewClick,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('There is no stack trace available for this issue.')
      }) : !event ? null : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("div", {
        onClick: handleStackTracePreviewClick,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(StackTracePreviewContent, {
          event: event,
          stacktrace: stacktrace,
          groupingCurrentLevel: props.groupingCurrentLevel,
          orgFeatures: props.organization.features
        })
      }),
      displayTimeout: 200,
      position: "right",
      state: status === 'loading' && loadingVisible ? 'loading' : !stacktrace ? 'empty' : 'done',
      tipBorderColor: "border",
      tipColor: "background",
      children: props.children
    })
  });
}

StackTracePreview.displayName = "StackTracePreview";


const StacktraceHovercard = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_8__.Hovercard,  true ? {
  target: "em55nim1"
} : 0)("z-index:", p => p.theme.zIndex.modal, ";width:", p => {
  if (p.state === 'loading') {
    return 'auto';
  }

  if (p.state === 'empty') {
    return '340px';
  }

  return '700px';
}, ";", sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_8__.Body, "{padding:0;max-height:300px;overflow-y:auto;overscroll-behavior:contain;border-bottom-left-radius:", p => p.theme.borderRadius, ";border-bottom-right-radius:", p => p.theme.borderRadius, ";}.traceback{margin-bottom:0;border:0;box-shadow:none;}.loading{margin:0 auto;.loading-indicator{border-width:3px;}}@media (max-width: ", p => p.theme.breakpoints.large, "){display:none;}" + ( true ? "" : 0));

const NoStackTraceWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "em55nim0"
} : 0)("color:", p => p.theme.subText, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(1.5), ";font-size:", p => p.theme.fontSizeMedium, ";display:flex;align-items:center;justify-content:center;min-height:56px;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/strictClick.tsx":
/*!****************************************!*\
  !*** ./app/components/strictClick.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");




/**
 * Does not fire the onclick event if the mouse has moved outside of the
 * original click location upon release.
 *
 * <StrictClick onClick={this.onClickHandler}>
 *   <button>Some button</button>
 * </StrictClick>
 */
class StrictClick extends react__WEBPACK_IMPORTED_MODULE_2__.PureComponent {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleMouseDown", _ref => {
      let {
        screenX,
        screenY
      } = _ref;
      return this.setState({
        startCoords: [screenX, screenY]
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleMouseClick", evt => {
      if (!this.props.onClick) {
        return;
      } // Click happens if mouse down/up in same element - click will not fire if
      // either initial mouse down OR final mouse up occurs in different element


      const [x, y] = this.state.startCoords;
      const deltaX = Math.abs(evt.screenX - x);
      const deltaY = Math.abs(evt.screenY - y); // If mouse hasn't moved more than 10 pixels in either Y or X direction,
      // fire onClick

      if (deltaX < StrictClick.MAX_DELTA_X && deltaY < StrictClick.MAX_DELTA_Y) {
        this.props.onClick(evt);
      }

      this.setState({
        startCoords: undefined
      });
    });
  }

  render() {
    // Bail out early if there is no onClick handler
    if (!this.props.onClick) {
      return this.props.children;
    }

    return /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_2__.cloneElement)(this.props.children, {
      onMouseDown: this.handleMouseDown,
      onClick: this.handleMouseClick
    });
  }

}

StrictClick.displayName = "StrictClick";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(StrictClick, "MAX_DELTA_X", 10);

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(StrictClick, "MAX_DELTA_Y", 10);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (StrictClick);

/***/ }),

/***/ "./app/components/timeSince.tsx":
/*!**************************************!*\
  !*** ./app/components/timeSince.tsx ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "getRelativeDate": () => (/* binding */ getRelativeDate)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_isNumber__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/isNumber */ "../node_modules/lodash/isNumber.js");
/* harmony import */ var lodash_isNumber__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_isNumber__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var lodash_isString__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/isString */ "../node_modules/lodash/isString.js");
/* harmony import */ var lodash_isString__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_isString__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var moment_timezone__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! moment-timezone */ "../node_modules/moment-timezone/index.js");
/* harmony import */ var moment_timezone__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(moment_timezone__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var _tooltip__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












const ONE_MINUTE_IN_MS = 60000;

function getDateObj(date) {
  return lodash_isString__WEBPACK_IMPORTED_MODULE_3___default()(date) || lodash_isNumber__WEBPACK_IMPORTED_MODULE_2___default()(date) ? new Date(date) : date;
}

function TimeSince(_ref) {
  var _options$timezone;

  let {
    date,
    suffix = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('ago'),
    disabledAbsoluteTooltip,
    tooltipTitle,
    tooltipUnderlineColor,
    shorten,
    extraShort,
    ...props
  } = _ref;
  const tickerRef = (0,react__WEBPACK_IMPORTED_MODULE_1__.useRef)();
  const computeRelativeDate = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => getRelativeDate(date, suffix, shorten, extraShort), [date, suffix, shorten, extraShort]);
  const [relative, setRelative] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(computeRelativeDate());
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    // Immediately update if props change
    setRelative(computeRelativeDate()); // Start a ticker to update the relative time

    tickerRef.current = window.setTimeout(() => setRelative(computeRelativeDate()), ONE_MINUTE_IN_MS);
    return () => window.clearTimeout(tickerRef.current);
  }, [computeRelativeDate]);
  const dateObj = getDateObj(date);
  const user = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_6__["default"].get('user');
  const options = user ? user.options : null;
  const format = options !== null && options !== void 0 && options.clock24Hours ? 'MMMM D, YYYY HH:mm z' : 'LLL z';
  const tooltip = (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_8__["default"])({
    fixed: options !== null && options !== void 0 && options.clock24Hours ? 'November 3, 2020 08:57 UTC' : 'November 3, 2020 8:58 AM UTC',
    value: moment_timezone__WEBPACK_IMPORTED_MODULE_4___default().tz(dateObj, (_options$timezone = options === null || options === void 0 ? void 0 : options.timezone) !== null && _options$timezone !== void 0 ? _options$timezone : '').format(format)
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(_tooltip__WEBPACK_IMPORTED_MODULE_9__["default"], {
    disabled: disabledAbsoluteTooltip,
    underlineColor: tooltipUnderlineColor,
    showUnderline: true,
    title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: [tooltipTitle && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("div", {
        children: tooltipTitle
      }), tooltip]
    }),
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("time", {
      dateTime: dateObj === null || dateObj === void 0 ? void 0 : dateObj.toISOString(),
      ...props,
      children: relative
    })
  });
}

TimeSince.displayName = "TimeSince";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TimeSince);
function getRelativeDate(currentDateTime, suffix, shorten, extraShort) {
  const date = getDateObj(currentDateTime);

  if ((shorten || extraShort) && suffix) {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('%(time)s %(suffix)s', {
      time: (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_7__.getDuration)(moment_timezone__WEBPACK_IMPORTED_MODULE_4___default()().diff(moment_timezone__WEBPACK_IMPORTED_MODULE_4___default()(date), 'seconds'), 0, shorten, extraShort),
      suffix
    });
  }

  if ((shorten || extraShort) && !suffix) {
    return (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_7__.getDuration)(moment_timezone__WEBPACK_IMPORTED_MODULE_4___default()().diff(moment_timezone__WEBPACK_IMPORTED_MODULE_4___default()(date), 'seconds'), 0, shorten, extraShort);
  }

  if (!suffix) {
    return moment_timezone__WEBPACK_IMPORTED_MODULE_4___default()(date).fromNow(true);
  }

  if (suffix === 'ago') {
    return moment_timezone__WEBPACK_IMPORTED_MODULE_4___default()(date).fromNow();
  }

  return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('%(time)s %(suffix)s', {
    time: moment_timezone__WEBPACK_IMPORTED_MODULE_4___default()(date).fromNow(true),
    suffix
  });
}

/***/ }),

/***/ "./app/stores/debugMetaStore.tsx":
/*!***************************************!*\
  !*** ./app/stores/debugMetaStore.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DebugMetaActions": () => (/* binding */ DebugMetaActions),
/* harmony export */   "DebugMetaStore": () => (/* binding */ DebugMetaStore),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/makeSafeRefluxStore */ "./app/utils/makeSafeRefluxStore.ts");


const DebugMetaActions = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createActions)(['updateFilter']);
const storeConfig = {
  filter: null,
  unsubscribeListeners: [],

  init() {
    this.reset();
    this.unsubscribeListeners.push(this.listenTo(DebugMetaActions.updateFilter, this.updateFilter));
  },

  reset() {
    this.filter = null;
    this.trigger(this.get());
  },

  updateFilter(word) {
    this.filter = word;
    this.trigger(this.get());
  },

  get() {
    return {
      filter: this.filter
    };
  }

};
const DebugMetaStore = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createStore)((0,sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_1__.makeSafeRefluxStore)(storeConfig));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DebugMetaStore);

/***/ }),

/***/ "./app/stores/latestContextStore.tsx":
/*!*******************************************!*\
  !*** ./app/stores/latestContextStore.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_actions_organizationActions__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actions/organizationActions */ "./app/actions/organizationActions.tsx");
/* harmony import */ var sentry_actions_organizationsActions__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actions/organizationsActions */ "./app/actions/organizationsActions.tsx");
/* harmony import */ var sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actions/projectActions */ "./app/actions/projectActions.tsx");
/* harmony import */ var sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/makeSafeRefluxStore */ "./app/utils/makeSafeRefluxStore.ts");






/**
 * Keeps track of last usable project/org this currently won't track when users
 * navigate out of a org/project completely, it tracks only if a user switches
 * into a new org/project.
 *
 * Only keep slug so that people don't get the idea to access org/project data
 * here Org/project data is currently in organizationsStore/projectsStore
 */
const storeConfig = {
  unsubscribeListeners: [],
  state: {
    project: null,
    lastProject: null,
    organization: null,
    environment: null
  },

  get() {
    return this.state;
  },

  init() {
    this.reset();
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_3__["default"].setActive, this.onSetActiveProject));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_3__["default"].updateSuccess, this.onUpdateProject));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_organizationsActions__WEBPACK_IMPORTED_MODULE_2__["default"].setActive, this.onSetActiveOrganization));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_organizationsActions__WEBPACK_IMPORTED_MODULE_2__["default"].update, this.onUpdateOrganization));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_organizationActions__WEBPACK_IMPORTED_MODULE_1__["default"].update, this.onUpdateOrganization));
  },

  reset() {
    this.state = {
      project: null,
      lastProject: null,
      organization: null,
      environment: null
    };
    return this.state;
  },

  onUpdateOrganization(org) {
    // Don't do anything if base/target orgs are falsey
    if (!this.state.organization) {
      return;
    }

    if (!org) {
      return;
    } // Check to make sure current active org is what has been updated


    if (org.slug !== this.state.organization.slug) {
      return;
    }

    this.state = { ...this.state,
      organization: org
    };
    this.trigger(this.state);
  },

  onSetActiveOrganization(org) {
    if (!org) {
      this.state = { ...this.state,
        organization: null,
        project: null
      };
    } else if (!this.state.organization || this.state.organization.slug !== org.slug) {
      // Update only if different
      this.state = { ...this.state,
        organization: org,
        project: null
      };
    }

    this.trigger(this.state);
  },

  onSetActiveProject(project) {
    if (!project) {
      this.state = { ...this.state,
        lastProject: this.state.project,
        project: null
      };
    } else if (!this.state.project || this.state.project.slug !== project.slug) {
      // Update only if different
      this.state = { ...this.state,
        lastProject: this.state.project,
        project
      };
    }

    this.trigger(this.state);
  },

  onUpdateProject(project) {
    this.state = { ...this.state,
      project
    };
    this.trigger(this.state);
  }

};
const LatestContextStore = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createStore)((0,sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_4__.makeSafeRefluxStore)(storeConfig));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (LatestContextStore);

/***/ }),

/***/ "./app/stores/organizationsStore.tsx":
/*!*******************************************!*\
  !*** ./app/stores/organizationsStore.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_actions_organizationsActions__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actions/organizationsActions */ "./app/actions/organizationsActions.tsx");
/* harmony import */ var sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/makeSafeRefluxStore */ "./app/utils/makeSafeRefluxStore.ts");




const storeConfig = {
  listenables: [sentry_actions_organizationsActions__WEBPACK_IMPORTED_MODULE_2__["default"]],
  state: [],
  loaded: false,

  // So we can use Reflux.connect in a component mixin
  getInitialState() {
    return this.state;
  },

  init() {
    this.state = [];
    this.loaded = false;
  },

  onUpdate(org) {
    this.add(org);
  },

  onChangeSlug(prev, next) {
    if (prev.slug === next.slug) {
      return;
    }

    this.remove(prev.slug);
    this.add(next);
  },

  onRemoveSuccess(slug) {
    this.remove(slug);
  },

  get(slug) {
    return this.state.find(item => item.slug === slug);
  },

  getAll() {
    return this.state;
  },

  remove(slug) {
    this.state = this.state.filter(item => slug !== item.slug);
    this.trigger(this.state);
  },

  add(item) {
    let match = false;
    this.state.forEach((existing, idx) => {
      if (existing.id === item.id) {
        item = { ...existing,
          ...item
        };
        this.state[idx] = item;
        match = true;
      }
    });

    if (!match) {
      this.state = [...this.state, item];
    }

    this.trigger(this.state);
  },

  load(items) {
    this.state = items;
    this.loaded = true;
    this.trigger(items);
  }

};
const OrganizationsStore = (0,reflux__WEBPACK_IMPORTED_MODULE_1__.createStore)((0,sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_3__.makeSafeRefluxStore)(storeConfig));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OrganizationsStore);

/***/ }),

/***/ "./app/stores/sentryAppComponentsStore.tsx":
/*!*************************************************!*\
  !*** ./app/stores/sentryAppComponentsStore.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/makeSafeRefluxStore */ "./app/utils/makeSafeRefluxStore.ts");


const storeConfig = {
  unsubscribeListeners: [],
  items: [],

  init() {
    this.items = [];
  },

  getInitialState() {
    return this.items;
  },

  loadComponents(items) {
    this.items = items;
    this.trigger(items);
  },

  get(uuid) {
    const items = this.items;
    return items.find(item => item.uuid === uuid);
  },

  getAll() {
    return this.items;
  },

  getComponentByType(type) {
    if (!type) {
      return this.getAll();
    }

    const items = this.items;
    return items.filter(item => item.type === type);
  }

};
const SentryAppComponentsStore = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createStore)((0,sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_1__.makeSafeRefluxStore)(storeConfig));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SentryAppComponentsStore);

/***/ }),

/***/ "./app/types/debugImage.tsx":
/*!**********************************!*\
  !*** ./app/types/debugImage.tsx ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CandidateDownloadStatus": () => (/* binding */ CandidateDownloadStatus),
/* harmony export */   "CandidateProcessingStatus": () => (/* binding */ CandidateProcessingStatus),
/* harmony export */   "ImageFeature": () => (/* binding */ ImageFeature),
/* harmony export */   "ImageStatus": () => (/* binding */ ImageStatus),
/* harmony export */   "SymbolType": () => (/* binding */ SymbolType)
/* harmony export */ });
// Candidate Processing Info
let CandidateProcessingStatus;

(function (CandidateProcessingStatus) {
  CandidateProcessingStatus["OK"] = "ok";
  CandidateProcessingStatus["MALFORMED"] = "malformed";
  CandidateProcessingStatus["ERROR"] = "error";
})(CandidateProcessingStatus || (CandidateProcessingStatus = {}));

let SymbolType;

(function (SymbolType) {
  SymbolType["UNKNOWN"] = "unknown";
  SymbolType["BREAKPAD"] = "breakpad";
  SymbolType["ELF"] = "elf";
  SymbolType["MACHO"] = "macho";
  SymbolType["PDB"] = "pdb";
  SymbolType["PE"] = "pe";
  SymbolType["SOURCEBUNDLE"] = "sourcebundle";
  SymbolType["WASM"] = "wasm";
  SymbolType["PROGUARD"] = "proguard";
})(SymbolType || (SymbolType = {}));

let ImageFeature;

(function (ImageFeature) {
  ImageFeature["has_sources"] = "has_sources";
  ImageFeature["has_debug_info"] = "has_debug_info";
  ImageFeature["has_unwind_info"] = "has_unwind_info";
  ImageFeature["has_symbols"] = "has_symbols";
})(ImageFeature || (ImageFeature = {}));

// Candidate Download Status
let CandidateDownloadStatus;

(function (CandidateDownloadStatus) {
  CandidateDownloadStatus["OK"] = "ok";
  CandidateDownloadStatus["MALFORMED"] = "malformed";
  CandidateDownloadStatus["NOT_FOUND"] = "notfound";
  CandidateDownloadStatus["ERROR"] = "error";
  CandidateDownloadStatus["NO_PERMISSION"] = "noperm";
  CandidateDownloadStatus["DELETED"] = "deleted";
  CandidateDownloadStatus["UNAPPLIED"] = "unapplied";
})(CandidateDownloadStatus || (CandidateDownloadStatus = {}));

// Debug Status
let ImageStatus;

(function (ImageStatus) {
  ImageStatus["FOUND"] = "found";
  ImageStatus["UNUSED"] = "unused";
  ImageStatus["MISSING"] = "missing";
  ImageStatus["MALFORMED"] = "malformed";
  ImageStatus["FETCHING_FAILED"] = "fetching_failed";
  ImageStatus["TIMEOUT"] = "timeout";
  ImageStatus["OTHER"] = "other";
})(ImageStatus || (ImageStatus = {}));

/***/ }),

/***/ "./app/utils/fileExtension.tsx":
/*!*************************************!*\
  !*** ./app/utils/fileExtension.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "fileExtensionToPlatform": () => (/* binding */ fileExtensionToPlatform),
/* harmony export */   "getFileExtension": () => (/* binding */ getFileExtension)
/* harmony export */ });
const FILE_EXTENSION_TO_PLATFORM = {
  jsx: 'react',
  tsx: 'react',
  js: 'javascript',
  ts: 'javascript',
  php: 'php',
  py: 'python',
  vue: 'vue',
  go: 'go',
  java: 'java',
  perl: 'perl',
  rb: 'ruby',
  rs: 'rust',
  rlib: 'rust',
  swift: 'swift',
  h: 'apple',
  m: 'apple',
  mm: 'apple',
  M: 'apple',
  ex: 'elixir',
  exs: 'elixir',
  cs: 'csharp',
  fs: 'fsharp',
  kt: 'kotlin',
  dart: 'dart',
  sc: 'scala',
  scala: 'scala',
  clj: 'clojure'
};
/**
 * Takes in path (/Users/test/sentry/something.jsx) and returns file extension (jsx)
 */

function getFileExtension(fileName) {
  // this won't work for something like .spec.jsx
  const segments = fileName.split('.');

  if (segments.length > 1) {
    return segments.pop();
  }

  return undefined;
}
/**
 * Takes in file extension and returns a platform string that can be passed into platformicons
 */

function fileExtensionToPlatform(fileExtension) {
  return FILE_EXTENSION_TO_PLATFORM[fileExtension];
}

/***/ }),

/***/ "./app/utils/promptIsDismissed.tsx":
/*!*****************************************!*\
  !*** ./app/utils/promptIsDismissed.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DEFAULT_SNOOZE_PROMPT_DAYS": () => (/* binding */ DEFAULT_SNOOZE_PROMPT_DAYS),
/* harmony export */   "promptCanShow": () => (/* binding */ promptCanShow),
/* harmony export */   "promptIsDismissed": () => (/* binding */ promptIsDismissed)
/* harmony export */ });
/* harmony import */ var _promptsActivity__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./promptsActivity */ "./app/utils/promptsActivity.tsx");

const DEFAULT_SNOOZE_PROMPT_DAYS = 14;
const promptIsDismissed = function (prompt) {
  let daysToSnooze = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : DEFAULT_SNOOZE_PROMPT_DAYS;

  if (typeof (prompt === null || prompt === void 0 ? void 0 : prompt.dismissedTime) === 'number') {
    return true;
  }

  if (typeof (prompt === null || prompt === void 0 ? void 0 : prompt.snoozedTime) === 'number') {
    return (0,_promptsActivity__WEBPACK_IMPORTED_MODULE_0__.snoozedDays)(prompt.snoozedTime) < daysToSnooze;
  }

  return false;
};
function promptCanShow(prompt, uuid) {
  /**
   * This is to ensure that only one of suspect_commits
   * or distributed_tracing is shown at a given time.
   */
  const x = (parseInt(uuid.charAt(0), 16) || 0) % 2;

  if (prompt === 'suspect_commits') {
    return x === 1;
  }

  if (prompt === 'distributed_tracing') {
    return x === 0;
  }

  return true;
}

/***/ }),

/***/ "./app/utils/promptsActivity.tsx":
/*!***************************************!*\
  !*** ./app/utils/promptsActivity.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "snoozedDays": () => (/* binding */ snoozedDays)
/* harmony export */ });
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_0__);

/**
 * Given a snoozed unix timestamp in seconds, returns the number of days since
 * the prompt was snoozed.
 *
 * @param snoozedTs Snoozed timestamp
 */

function snoozedDays(snoozedTs) {
  const now = moment__WEBPACK_IMPORTED_MODULE_0___default().utc();
  const snoozedOn = moment__WEBPACK_IMPORTED_MODULE_0___default().unix(snoozedTs).utc();
  return now.diff(snoozedOn, 'days');
}

/***/ }),

/***/ "./app/utils/recordSentryAppInteraction.tsx":
/*!**************************************************!*\
  !*** ./app/utils/recordSentryAppInteraction.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "recordInteraction": () => (/* binding */ recordInteraction)
/* harmony export */ });
/* harmony import */ var sentry_api__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/api */ "./app/api.tsx");

const recordInteraction = async (sentryAppSlug, field, data) => {
  const api = new sentry_api__WEBPACK_IMPORTED_MODULE_0__.Client();
  const endpoint = `/sentry-apps/${sentryAppSlug}/interaction/`;
  return await api.requestPromise(endpoint, {
    method: 'POST',
    data: {
      tsdbField: field,
      ...data
    }
  });
};

/***/ }),

/***/ "./app/utils/replaceRouterParams.tsx":
/*!*******************************************!*\
  !*** ./app/utils/replaceRouterParams.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ replaceRouterParams)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__);


/**
 * Given a route string, replace path parameters (e.g. `:id`) with value from `params`
 *
 * e.g. {id: 'test'}
 */
function replaceRouterParams(route, params) {
  // parse route params from route
  const matches = route.match(/:\w+/g);

  if (!matches || !matches.length) {
    return route;
  } // replace with current params


  matches.forEach(param => {
    const paramName = param.slice(1);

    if (typeof params[paramName] === 'undefined') {
      return;
    }

    route = route.replace(param, String(params[paramName]));
  });
  return route;
}

/***/ }),

/***/ "./app/utils/withOrganizations.tsx":
/*!*****************************************!*\
  !*** ./app/utils/withOrganizations.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_stores_organizationsStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/organizationsStore */ "./app/stores/organizationsStore.tsx");
/* harmony import */ var sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/getDisplayName */ "./app/utils/getDisplayName.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







function withOrganizations(WrappedComponent) {
  class WithOrganizations extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
    constructor() {
      super(...arguments);

      (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
        organizations: sentry_stores_organizationsStore__WEBPACK_IMPORTED_MODULE_3__["default"].getAll()
      });

      (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "unsubscribe", sentry_stores_organizationsStore__WEBPACK_IMPORTED_MODULE_3__["default"].listen(organizations => this.setState({
        organizations
      }), undefined));
    }

    componentWillUnmount() {
      this.unsubscribe();
    }

    render() {
      const {
        organizationsLoading,
        organizations,
        ...props
      } = this.props;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(WrappedComponent, {
        organizationsLoading: organizationsLoading !== null && organizationsLoading !== void 0 ? organizationsLoading : !sentry_stores_organizationsStore__WEBPACK_IMPORTED_MODULE_3__["default"].loaded,
        organizations: organizations !== null && organizations !== void 0 ? organizations : this.state.organizations,
        ...props
      });
    }

  }

  WithOrganizations.displayName = "WithOrganizations";

  (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(WithOrganizations, "displayName", `withOrganizations(${(0,sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_4__["default"])(WrappedComponent)})`);

  return WithOrganizations;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (withOrganizations);

/***/ }),

/***/ "./app/utils/withSentryAppComponents.tsx":
/*!***********************************************!*\
  !*** ./app/utils/withSentryAppComponents.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_stores_sentryAppComponentsStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/sentryAppComponentsStore */ "./app/stores/sentryAppComponentsStore.tsx");
/* harmony import */ var sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/getDisplayName */ "./app/utils/getDisplayName.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







function withSentryAppComponents(WrappedComponent) {
  let {
    componentType
  } = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  class WithSentryAppComponents extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
    constructor() {
      super(...arguments);

      (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
        components: sentry_stores_sentryAppComponentsStore__WEBPACK_IMPORTED_MODULE_3__["default"].getAll()
      });

      (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "unsubscribe", sentry_stores_sentryAppComponentsStore__WEBPACK_IMPORTED_MODULE_3__["default"].listen(() => this.setState({
        components: sentry_stores_sentryAppComponentsStore__WEBPACK_IMPORTED_MODULE_3__["default"].getAll()
      }), undefined));
    }

    componentWillUnmount() {
      this.unsubscribe();
    }

    render() {
      const {
        components,
        ...props
      } = this.props;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(WrappedComponent, {
        components: components !== null && components !== void 0 ? components : sentry_stores_sentryAppComponentsStore__WEBPACK_IMPORTED_MODULE_3__["default"].getComponentByType(componentType),
        ...props
      });
    }

  }

  WithSentryAppComponents.displayName = "WithSentryAppComponents";

  (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(WithSentryAppComponents, "displayName", `withSentryAppComponents(${(0,sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_4__["default"])(WrappedComponent)})`);

  return WithSentryAppComponents;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (withSentryAppComponents);

/***/ }),

/***/ "./app/views/organizationGroupDetails/unhandledTag.tsx":
/*!*************************************************************!*\
  !*** ./app/views/organizationGroupDetails/unhandledTag.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TagAndMessageWrapper": () => (/* binding */ TagAndMessageWrapper),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_tag__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/tag */ "./app/components/tag.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }







function UnhandledTag() {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(TagWrapper, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_2__["default"], {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('An unhandled error was detected in this Issue.'),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_tag__WEBPACK_IMPORTED_MODULE_1__["default"], {
        type: "error",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Unhandled')
      })
    })
  });
}

UnhandledTag.displayName = "UnhandledTag";

const TagWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1sv1o1n1"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1), ";" + ( true ? "" : 0));

const TagAndMessageWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1sv1o1n0"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (UnhandledTag);


/***/ }),

/***/ "./app/views/organizationIntegrations/integrationIcon.tsx":
/*!****************************************************************!*\
  !*** ./app/views/organizationIntegrations/integrationIcon.tsx ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_plugins_components_pluginIcon__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/plugins/components/pluginIcon */ "./app/plugins/components/pluginIcon.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







const StyledIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('img',  true ? {
  target: "e11cnql20"
} : 0)("height:", p => p.size, "px;width:", p => p.size, "px;border-radius:2px;display:block;" + ( true ? "" : 0));

class Icon extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      imgSrc: this.props.integration.icon
    });
  }

  render() {
    const {
      integration,
      size
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(StyledIcon, {
      size: size,
      src: this.state.imgSrc,
      onError: () => {
        this.setState({
          imgSrc: sentry_plugins_components_pluginIcon__WEBPACK_IMPORTED_MODULE_4__.ICON_PATHS[integration.provider.key] || sentry_plugins_components_pluginIcon__WEBPACK_IMPORTED_MODULE_4__.DEFAULT_ICON
        });
      }
    });
  }

}

Icon.displayName = "Icon";

const IntegrationIcon = _ref => {
  let {
    integration,
    size = 32
  } = _ref;
  return integration.icon ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Icon, {
    size: size,
    integration: integration
  }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_plugins_components_pluginIcon__WEBPACK_IMPORTED_MODULE_4__["default"], {
    size: size,
    pluginId: integration.provider.key
  });
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (IntegrationIcon);

/***/ }),

/***/ "./app/views/settings/account/notifications/feedbackAlert.tsx":
/*!********************************************************************!*\
  !*** ./app/views/settings/account/notifications/feedbackAlert.tsx ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }





const FeedbackAlert = _ref => {
  let {
    className
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(StyledAlert, {
    type: "info",
    showIcon: true,
    className: className,
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.tct)('Got feedback? Email [email:ecosystem-feedback@sentry.io].', {
      email: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("a", {
        href: "mailto:ecosystem-feedback@sentry.io"
      })
    })
  });
};

FeedbackAlert.displayName = "FeedbackAlert";

const StyledAlert = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "eb7gyj50"
} : 0)( true ? {
  name: "12jd8yt",
  styles: "margin:20px 0px"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (FeedbackAlert);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_actionCreators_navigation_tsx-app_components_eventOrGroupHeader_tsx-app_components_layout-58d688.39e8d1e2949bf064190b5f52a3fa18a8.js.map