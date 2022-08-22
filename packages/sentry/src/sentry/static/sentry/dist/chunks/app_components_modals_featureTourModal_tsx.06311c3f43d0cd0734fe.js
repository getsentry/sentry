"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_modals_featureTourModal_tsx"],{

/***/ "./app/components/modals/featureTourModal.tsx":
/*!****************************************************!*\
  !*** ./app/components/modals/featureTourModal.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TourImage": () => (/* binding */ TourImage),
/* harmony export */   "TourText": () => (/* binding */ TourText),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/callIfFunction */ "./app/utils/callIfFunction.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













const defaultProps = {
  doneText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Done')
};
/**
 * Provide a showModal action to the child function that lets
 * a tour be triggered.
 *
 * Once active this component will track when the tour was started and keep
 * a last known step state. Ideally the state would live entirely in this component.
 * However, once the modal has been opened state changes in this component don't
 * trigger re-renders in the modal contents. This requires a bit of duplicate state
 * to be managed around the current step.
 */

class FeatureTourModal extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      openedAt: 0,
      current: 0
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleAdvance", (current, duration) => {
      this.setState({
        current
      });
      (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_10__.callIfFunction)(this.props.onAdvance, current, duration);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleShow", () => {
      this.setState({
        openedAt: Date.now()
      }, () => {
        const modalProps = {
          steps: this.props.steps,
          onAdvance: this.handleAdvance,
          openedAt: this.state.openedAt,
          doneText: this.props.doneText,
          doneUrl: this.props.doneUrl
        };
        (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_4__.openModal)(deps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(ModalContents, { ...deps,
          ...modalProps
        }), {
          onClose: this.handleClose
        });
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleClose", () => {
      // The bootstrap modal and modal store both call this callback.
      // We use the state flag to deduplicate actions to upstream components.
      if (this.state.openedAt === 0) {
        return;
      }

      const {
        onCloseModal
      } = this.props;
      const duration = Date.now() - this.state.openedAt;
      (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_10__.callIfFunction)(onCloseModal, this.state.current, duration); // Reset the state now that the modal is closed, used to deduplicate close actions.

      this.setState({
        openedAt: 0,
        current: 0
      });
    });
  }

  render() {
    const {
      children
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: children({
        showModal: this.handleShow
      })
    });
  }

}

FeatureTourModal.displayName = "FeatureTourModal";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(FeatureTourModal, "defaultProps", defaultProps);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (FeatureTourModal);

class ModalContents extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      current: 0,
      openedAt: Date.now()
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleAdvance", () => {
      const {
        onAdvance,
        openedAt
      } = this.props;
      this.setState(prevState => ({
        current: prevState.current + 1
      }), () => {
        const duration = Date.now() - openedAt;
        (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_10__.callIfFunction)(onAdvance, this.state.current, duration);
      });
    });
  }

  render() {
    const {
      Body,
      steps,
      doneText,
      doneUrl,
      closeModal
    } = this.props;
    const {
      current
    } = this.state;
    const step = steps[current] !== undefined ? steps[current] : steps[steps.length - 1];
    const hasNext = steps[current + 1] !== undefined;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(Body, {
      "data-test-id": "feature-tour",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(CloseButton, {
        borderless: true,
        size: "zero",
        onClick: closeModal,
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconClose, {}),
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Close tour')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(TourContent, {
        children: [step.image, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(TourHeader, {
          children: step.title
        }), step.body, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(TourButtonBar, {
          gap: 1,
          children: [step.actions && step.actions, hasNext && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
            priority: "primary",
            onClick: this.handleAdvance,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Next')
          }), !hasNext && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
            external: true,
            href: doneUrl,
            onClick: closeModal,
            priority: "primary",
            "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Complete tour'),
            children: doneText
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(StepCounter, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('%s of %s', current + 1, steps.length)
        })]
      })]
    });
  }

}

ModalContents.displayName = "ModalContents";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(ModalContents, "defaultProps", defaultProps);

const CloseButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e4yabkt6"
} : 0)("position:absolute;top:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(2), ";right:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";" + ( true ? "" : 0));

const TourContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e4yabkt5"
} : 0)("display:flex;flex-direction:column;align-items:center;margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(3), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(4), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(4), ";" + ( true ? "" : 0));

const TourHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('h4',  true ? {
  target: "e4yabkt4"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";" + ( true ? "" : 0));

const TourButtonBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e4yabkt3"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(3), ";" + ( true ? "" : 0));

const StepCounter = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e4yabkt2"
} : 0)("text-transform:uppercase;font-size:", p => p.theme.fontSizeSmall, ";font-weight:bold;color:", p => p.theme.gray300, ";" + ( true ? "" : 0)); // Styled components that can be used to build tour content.


const TourText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('p',  true ? {
  target: "e4yabkt1"
} : 0)("text-align:center;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(4), ";" + ( true ? "" : 0));
const TourImage = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('img',  true ? {
  target: "e4yabkt0"
} : 0)("height:200px;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(4), ";max-width:380px!important;box-shadow:none!important;border:0!important;border-radius:0!important;" + ( true ? "" : 0));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_modals_featureTourModal_tsx.8a5c36ac17d741aa0e8a7bb0831009f3.js.map