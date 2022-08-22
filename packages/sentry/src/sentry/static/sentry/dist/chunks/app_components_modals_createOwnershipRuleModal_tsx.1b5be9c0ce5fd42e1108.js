"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_modals_createOwnershipRuleModal_tsx"],{

/***/ "./app/components/modals/createOwnershipRuleModal.tsx":
/*!************************************************************!*\
  !*** ./app/components/modals/createOwnershipRuleModal.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "modalCss": () => (/* binding */ modalCss)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var sentry_views_settings_project_projectOwnership_modal__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/views/settings/project/projectOwnership/modal */ "./app/views/settings/project/projectOwnership/modal.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








const CreateOwnershipRuleModal = _ref => {
  let {
    Body,
    Header,
    closeModal,
    ...props
  } = _ref;
  const closeModalTimeoutRef = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(undefined);
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    return () => {
      window.clearInterval(closeModalTimeoutRef.current);
    };
  }, []);
  const handleSuccess = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(() => {
    var _props$onClose;

    (_props$onClose = props.onClose) === null || _props$onClose === void 0 ? void 0 : _props$onClose.call(props);
    window.clearTimeout(closeModalTimeoutRef.current);
    closeModalTimeoutRef.current = window.setTimeout(closeModal, 2000);
  }, [props.onClose]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(Header, {
      closeButton: true,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Create Ownership Rule')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(Body, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_views_settings_project_projectOwnership_modal__WEBPACK_IMPORTED_MODULE_3__["default"], { ...props,
        onSave: handleSuccess
      })
    })]
  });
};

CreateOwnershipRuleModal.displayName = "CreateOwnershipRuleModal";
const modalCss = /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_5__.css)("@media (min-width: ", sentry_utils_theme__WEBPACK_IMPORTED_MODULE_2__["default"].breakpoints.small, "){width:80%;}[role='document']{overflow:initial;}" + ( true ? "" : 0),  true ? "" : 0);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (CreateOwnershipRuleModal);

/***/ }),

/***/ "./app/views/settings/project/projectOwnership/modal.tsx":
/*!***************************************************************!*\
  !*** ./app/views/settings/project/projectOwnership/modal.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_uniq__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/uniq */ "../node_modules/lodash/uniq.js");
/* harmony import */ var lodash_uniq__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_uniq__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_settings_project_projectOwnership_ownerInput__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/views/settings/project/projectOwnership/ownerInput */ "./app/views/settings/project/projectOwnership/ownerInput.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










class ProjectOwnershipModal extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_4__["default"] {
  getEndpoints() {
    const {
      organization,
      project,
      issueId
    } = this.props;
    return [['ownership', `/projects/${organization.slug}/${project.slug}/ownership/`], ['urlTagData', `/issues/${issueId}/tags/url/`, {}, {
      allowError: error => // Allow for 404s
      error.status === 404
    }], ['eventData', `/issues/${issueId}/events/latest/`]];
  }

  renderBody() {
    const {
      ownership,
      urlTagData,
      eventData
    } = this.state;

    if (!ownership && !urlTagData && !eventData) {
      return null;
    }

    const urls = urlTagData ? urlTagData.topValues.sort((a, b) => a.count - b.count).map(i => i.value).slice(0, 5) : []; // pull frame data out of exception or the stacktrace

    const entry = (eventData === null || eventData === void 0 ? void 0 : eventData.entries).find(_ref => {
      let {
        type
      } = _ref;
      return ['exception', 'stacktrace'].includes(type);
    });
    let frames = [];

    if ((entry === null || entry === void 0 ? void 0 : entry.type) === 'exception') {
      var _entry$data$values$0$, _entry$data, _entry$data$values, _entry$data$values$, _entry$data$values$$s;

      frames = (_entry$data$values$0$ = entry === null || entry === void 0 ? void 0 : (_entry$data = entry.data) === null || _entry$data === void 0 ? void 0 : (_entry$data$values = _entry$data.values) === null || _entry$data$values === void 0 ? void 0 : (_entry$data$values$ = _entry$data$values[0]) === null || _entry$data$values$ === void 0 ? void 0 : (_entry$data$values$$s = _entry$data$values$.stacktrace) === null || _entry$data$values$$s === void 0 ? void 0 : _entry$data$values$$s.frames) !== null && _entry$data$values$0$ !== void 0 ? _entry$data$values$0$ : [];
    }

    if ((entry === null || entry === void 0 ? void 0 : entry.type) === 'stacktrace') {
      var _entry$data$frames, _entry$data2;

      frames = (_entry$data$frames = entry === null || entry === void 0 ? void 0 : (_entry$data2 = entry.data) === null || _entry$data2 === void 0 ? void 0 : _entry$data2.frames) !== null && _entry$data$frames !== void 0 ? _entry$data$frames : [];
    } // filter frames by inApp unless there would be 0


    const inAppFrames = frames.filter(frame => frame.inApp);

    if (inAppFrames.length > 0) {
      frames = inAppFrames;
    }

    const paths = lodash_uniq__WEBPACK_IMPORTED_MODULE_3___default()(frames.map(frame => frame.filename || frame.absPath || '')).filter(i => i).slice(0, 30);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Match against Issue Data: (globbing syntax *, ? supported)')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_views_settings_project_projectOwnership_ownerInput__WEBPACK_IMPORTED_MODULE_6__["default"], { ...this.props,
        initialText: (ownership === null || ownership === void 0 ? void 0 : ownership.raw) || '',
        urls: urls,
        paths: paths
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectOwnershipModal);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_modals_createOwnershipRuleModal_tsx.6b7d5b1d9eb25590a5abe202b6e2f435.js.map