"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_modals_reprocessEventModal_tsx"],{

/***/ "./app/components/modals/reprocessEventModal.tsx":
/*!*******************************************************!*\
  !*** ./app/components/modals/reprocessEventModal.tsx ***!
  \*******************************************************/
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
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_numberField__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/numberField */ "./app/components/forms/numberField.tsx");
/* harmony import */ var sentry_components_forms_radioField__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/forms/radioField */ "./app/components/forms/radioField.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_list__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/list */ "./app/components/list/index.tsx");
/* harmony import */ var sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/list/listItem */ "./app/components/list/listItem.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");















const impacts = [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.tct)("[strong:Quota applies.] Every event you choose to reprocess counts against your plan's quota. Rate limits and spike protection do not apply.", {
  strong: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("strong", {})
}), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.tct)('[strong:Attachment storage required.] If your events come from minidumps or unreal crash reports, you must have [link:attachment storage] enabled.', {
  strong: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("strong", {}),
  link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_8__["default"], {
    href: "https://docs.sentry.io/platforms/native/enriching-events/attachments/#crash-reports-and-privacy"
  })
}), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Please wait one hour after upload before attempting to reprocess missing debug files.')];
const remainingEventsChoices = [['keep', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Keep')], ['delete', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Delete')]];

class ReprocessingEventModal extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      maxEvents: undefined
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSuccess", () => {
      const {
        closeModal
      } = this.props;
      closeModal();
      window.location.reload();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleMaxEventsChange", maxEvents => {
      this.setState({
        maxEvents: Number(maxEvents) || undefined
      });
    });
  }

  handleError() {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Failed to reprocess. Please check your input.'));
  }

  render() {
    const {
      organization,
      Header,
      Body,
      closeModal,
      groupId
    } = this.props;
    const {
      maxEvents
    } = this.state;
    const orgSlug = organization.slug;
    const endpoint = `/organizations/${orgSlug}/issues/${groupId}/reprocessing/`;
    const title = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Reprocess Events');
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(Header, {
        closeButton: true,
        children: title
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(Body, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(Introduction, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Reprocessing applies new debug files and grouping enhancements to this Issue. Please consider these impacts:')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(StyledList, {
          symbol: "bullet",
          children: impacts.map((impact, index) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_10__["default"], {
            children: impact
          }, index))
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(Introduction, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.tct)('For more information, please refer to [link:the documentation.]', {
            link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_8__["default"], {
              href: "https://docs.sentry.io/product/error-monitoring/reprocessing/"
            })
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_5__["default"], {
          submitLabel: title,
          apiEndpoint: endpoint,
          apiMethod: "POST",
          initialData: {
            maxEvents: undefined,
            remainingEvents: 'keep'
          },
          onSubmitSuccess: this.handleSuccess,
          onSubmitError: this.handleError,
          onCancel: closeModal,
          footerClass: "modal-footer",
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_forms_numberField__WEBPACK_IMPORTED_MODULE_6__["default"], {
            name: "maxEvents",
            label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Number of events to be reprocessed'),
            help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('If you set a limit, we will reprocess your most recent events.'),
            placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Reprocess all events'),
            onChange: this.handleMaxEventsChange,
            min: 1
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_forms_radioField__WEBPACK_IMPORTED_MODULE_7__["default"], {
            orientInline: true,
            label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Remaining events'),
            help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('What to do with the events that are not reprocessed.'),
            name: "remainingEvents",
            choices: remainingEventsChoices,
            disabled: maxEvents === undefined
          })]
        })]
      })]
    });
  }

}

ReprocessingEventModal.displayName = "ReprocessingEventModal";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReprocessingEventModal);

const Introduction = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('p',  true ? {
  target: "e1ee6kus1"
} : 0)("font-size:", p => p.theme.fontSizeLarge, ";" + ( true ? "" : 0));

const StyledList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_list__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "e1ee6kus0"
} : 0)("gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(4), ";font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_modals_reprocessEventModal_tsx.82cdc7ca27e7ce7d5cfaf3a67c2f80de.js.map