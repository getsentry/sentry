"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_data_forms_projectIssueGrouping_tsx"],{

/***/ "./app/data/forms/projectIssueGrouping.tsx":
/*!*************************************************!*\
  !*** ./app/data/forms/projectIssueGrouping.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "fields": () => (/* binding */ fields),
/* harmony export */   "route": () => (/* binding */ route)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_events_groupingInfo__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/events/groupingInfo */ "./app/components/events/groupingInfo/index.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_marked__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/marked */ "./app/utils/marked.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






 // Export route to make these forms searchable by label/help



const route = '/settings/:orgId/projects/:projectId/issue-grouping/';
const groupingConfigField = {
  name: 'groupingConfig',
  type: 'select',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Grouping Config'),
  saveOnBlur: false,
  saveMessageAlertType: 'info',
  saveMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Changing grouping config will apply to future events only (can take up to a minute).'),
  selectionInfoFunction: args => {
    const {
      groupingConfigs,
      value
    } = args;
    const selection = groupingConfigs.find(_ref => {
      let {
        id
      } = _ref;
      return id === value;
    });
    const changelog = (selection === null || selection === void 0 ? void 0 : selection.changelog) || '';

    if (!changelog) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(Changelog, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(ChangelogTitle, {
        children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)('New in version [version]', {
          version: selection.id
        }), ":"]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("div", {
        dangerouslySetInnerHTML: {
          __html: (0,sentry_utils_marked__WEBPACK_IMPORTED_MODULE_6__["default"])(changelog)
        }
      })]
    });
  },
  choices: _ref2 => {
    let {
      groupingConfigs
    } = _ref2;
    return groupingConfigs.map(_ref3 => {
      let {
        id,
        hidden
      } = _ref3;
      return [id.toString(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_events_groupingInfo__WEBPACK_IMPORTED_MODULE_2__.GroupingConfigItem, {
        isHidden: hidden,
        children: id
      }, id)];
    });
  },
  help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Sets the grouping algorithm to be used for new events.'),
  visible: _ref4 => {
    let {
      features
    } = _ref4;
    return features.has('set-grouping-config');
  }
};
const fields = {
  fingerprintingRules: {
    name: 'fingerprintingRules',
    type: 'string',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Fingerprint Rules'),
    hideLabel: true,
    placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('error.type:MyException -> fingerprint-value\nstack.function:some_panic_function -> fingerprint-value'),
    multiline: true,
    monospace: true,
    autosize: true,
    inline: false,
    maxRows: 20,
    saveOnBlur: false,
    saveMessageAlertType: 'info',
    saveMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Changing fingerprint rules will apply to future events only (can take up to a minute).'),
    formatMessageValue: false,
    help: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(RuleDescription, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)(`This can be used to modify the fingerprint rules on the server with custom rules.
        Rules follow the pattern [pattern]. To learn more about fingerprint rules, [docs:read the docs].`, {
          pattern: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("code", {
            children: "matcher:glob -> fingerprint, values"
          }),
          docs: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_3__["default"], {
            href: "https://docs.sentry.io/product/data-management-settings/event-grouping/fingerprint-rules/"
          })
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(RuleExample, {
        children: `# force all errors of the same type to have the same fingerprint
error.type:DatabaseUnavailable -> system-down
# force all memory allocation errors to be grouped together
stack.function:malloc -> memory-allocation-error`
      })]
    }),
    visible: true
  },
  groupingEnhancements: {
    name: 'groupingEnhancements',
    type: 'string',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Stack Trace Rules'),
    hideLabel: true,
    placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('stack.function:raise_an_exception ^-group\nstack.function:namespace::* +app'),
    multiline: true,
    monospace: true,
    autosize: true,
    inline: false,
    maxRows: 20,
    saveOnBlur: false,
    saveMessageAlertType: 'info',
    saveMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Changing stack trace rules will apply to future events only (can take up to a minute).'),
    formatMessageValue: false,
    help: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(RuleDescription, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)(`This can be used to enhance the grouping algorithm with custom rules.
        Rules follow the pattern [pattern]. To learn more about stack trace rules, [docs:read the docs].`, {
          pattern: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("code", {
            children: "matcher:glob [v^]?[+-]flag"
          }),
          docs: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_3__["default"], {
            href: "https://docs.sentry.io/product/data-management-settings/event-grouping/stack-trace-rules/"
          })
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(RuleExample, {
        children: `# remove all frames above a certain function from grouping
stack.function:panic_handler ^-group
# mark all functions following a prefix in-app
stack.function:mylibrary_* +app`
      })]
    }),
    validate: () => [],
    visible: true
  },
  groupingConfig: groupingConfigField,
  secondaryGroupingConfig: { ...groupingConfigField,
    name: 'secondaryGroupingConfig',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Fallback/Secondary Grouping Config'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Sets the secondary grouping algorithm that should be run in addition to avoid creating too many new groups. Controlled by expiration date below.'),
    saveMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Changing the secondary grouping strategy will affect how many new issues are created.')
  },
  secondaryGroupingExpiry: {
    name: 'secondaryGroupingExpiry',
    type: 'number',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Expiration date of secondary grouping'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('If this UNIX timestamp is in the past, the secondary grouping configuration stops applying automatically.'),
    saveOnBlur: false,
    saveMessageAlertType: 'info',
    saveMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Changing the expiration date will affect how many new issues are created.')
  },
  groupingAutoUpdate: {
    name: 'groupingAutoUpdate',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Automatically Update Grouping'),
    saveOnBlur: false,
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('When enabled projects will in the future automatically update to the latest grouping algorithm. Right now this setting does nothing.'),
    saveMessage: _ref5 => {
      let {
        value
      } = _ref5;
      return value ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Enabling automatic upgrading will take effect on the next incoming event once auto updating has been rolled out.') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Disabling auto updates will cause you to no longer receive improvements to the grouping algorithm.');
    }
  }
};

const RuleDescription = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e7y3swh3"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), ";margin-top:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), ";margin-right:36px;" + ( true ? "" : 0));

const RuleExample = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('pre',  true ? {
  target: "e7y3swh2"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), ";margin-right:36px;" + ( true ? "" : 0));

const Changelog = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e7y3swh1"
} : 0)("position:relative;top:-1px;margin-bottom:-1px;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(2), ";border-bottom:1px solid ", p => p.theme.innerBorder, ";background:", p => p.theme.backgroundSecondary, ";font-size:", p => p.theme.fontSizeMedium, ";&:last-child{border:0;border-bottom-left-radius:", p => p.theme.borderRadius, ";border-bottom-right-radius:", p => p.theme.borderRadius, ";}" + ( true ? "" : 0));

const ChangelogTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('h3',  true ? {
  target: "e7y3swh0"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(0.75), "!important;" + ( true ? "" : 0));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_data_forms_projectIssueGrouping_tsx.5c83ee6db8d9555cae044c52871f90a9.js.map