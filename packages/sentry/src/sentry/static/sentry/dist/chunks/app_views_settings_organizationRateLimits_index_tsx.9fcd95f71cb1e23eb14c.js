"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_organizationRateLimits_index_tsx"],{

/***/ "./app/views/settings/organizationRateLimits/index.tsx":
/*!*************************************************************!*\
  !*** ./app/views/settings/organizationRateLimits/index.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _organizationRateLimits__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./organizationRateLimits */ "./app/views/settings/organizationRateLimits/organizationRateLimits.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




const OrganizationRateLimitsContainer = props => !props.organization ? null : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(_organizationRateLimits__WEBPACK_IMPORTED_MODULE_1__["default"], { ...props
});

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_0__["default"])(OrganizationRateLimitsContainer));

/***/ }),

/***/ "./app/views/settings/organizationRateLimits/organizationRateLimits.tsx":
/*!******************************************************************************!*\
  !*** ./app/views/settings/organizationRateLimits/organizationRateLimits.tsx ***!
  \******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_rangeField__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/forms/rangeField */ "./app/components/forms/rangeField.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }











const getRateLimitValues = () => {
  const steps = [];
  let i = 0;

  while (i <= 1000000) {
    steps.push(i);

    if (i < 10000) {
      i += 1000;
    } else if (i < 100000) {
      i += 10000;
    } else {
      i += 100000;
    }
  }

  return steps;
}; // We can just generate this once


const ACCOUNT_RATE_LIMIT_VALUES = getRateLimitValues();

var _ref2 =  true ? {
  name: "1ykowef",
  styles: "margin-bottom:0"
} : 0;

const OrganizationRateLimit = _ref => {
  let {
    organization
  } = _ref;
  // TODO(billy): Update organization.quota in organizationStore with new values
  const {
    quota
  } = organization;
  const {
    maxRate,
    maxRateInterval,
    projectLimit,
    accountLimit
  } = quota;
  const initialData = {
    projectRateLimit: projectLimit || 100,
    accountRateLimit: accountLimit
  };
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)("div", {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_5__["default"], {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Rate Limits')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.Panel, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.PanelHeader, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Adjust Limits')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.PanelBody, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.PanelAlert, {
          type: "info",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)(`Rate limits allow you to control how much data is stored for this
                organization. When a rate is exceeded the system will begin discarding
                data until the next interval.`)
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_1__["default"], {
          "data-test-id": "rate-limit-editor",
          saveOnBlur: true,
          allowUndo: true,
          apiMethod: "PUT",
          apiEndpoint: `/organizations/${organization.slug}/`,
          initialData: initialData,
          children: [!maxRate ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_forms_rangeField__WEBPACK_IMPORTED_MODULE_2__["default"], {
            name: "accountRateLimit",
            label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Account Limit'),
            min: 0,
            max: 1000000,
            allowedValues: ACCOUNT_RATE_LIMIT_VALUES,
            help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('The maximum number of events to accept across this entire organization.'),
            placeholder: "e.g. 500",
            formatLabel: value => !value ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('No Limit') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)('[number] per hour', {
              number: value.toLocaleString()
            })
          }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_0__["default"], {
            label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Account Limit'),
            help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('The maximum number of events to accept across this entire organization.'),
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_6__["default"], {
              css: _ref2,
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)('Your account is limited to a maximum of [maxRate] events per [maxRateInterval] seconds.', {
                maxRate,
                maxRateInterval
              })
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_forms_rangeField__WEBPACK_IMPORTED_MODULE_2__["default"], {
            name: "projectRateLimit",
            label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Per-Project Limit'),
            help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('The maximum percentage of the account limit (set above) that an individual project can consume.'),
            step: 5,
            min: 50,
            max: 100,
            formatLabel: value => value !== 100 ? `${value}%` : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("span", {
              dangerouslySetInnerHTML: {
                __html: `${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('No Limit')} &mdash; 100%`
              }
            })
          })]
        })]
      })]
    })]
  });
};

OrganizationRateLimit.displayName = "OrganizationRateLimit";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OrganizationRateLimit);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_organizationRateLimits_index_tsx.83147a6d289302b424e4bcf8c8354350.js.map