(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_alertLink_tsx-app_components_events_eventCustomPerformanceMetrics_tsx-app_comp-f4801d"],{

/***/ "./app/components/alertLink.tsx":
/*!**************************************!*\
  !*** ./app/components/alertLink.tsx ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









function AlertLink(_ref) {
  let {
    size = 'normal',
    priority = 'warning',
    icon,
    children,
    onClick,
    withoutMarginBottom = false,
    openInNewTab = false,
    to,
    href,
    ['data-test-id']: dataTestId
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(StyledLink, {
    "data-test-id": dataTestId,
    to: to,
    href: href,
    onClick: onClick,
    size: size,
    priority: priority,
    withoutMarginBottom: withoutMarginBottom,
    openInNewTab: openInNewTab,
    children: [icon && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(IconWrapper, {
      children: icon
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(AlertLinkText, {
      children: children
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(IconLink, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_4__.IconChevron, {
        direction: "right"
      })
    })]
  });
}

AlertLink.displayName = "AlertLink";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AlertLink);

const StyledLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_ref2 => {
  let {
    openInNewTab,
    to,
    href,
    ...props
  } = _ref2;
  const linkProps = lodash_omit__WEBPACK_IMPORTED_MODULE_1___default()(props, ['withoutMarginBottom', 'priority', 'size']);

  if (href) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_2__["default"], { ...linkProps,
      href: href,
      openInNewTab: openInNewTab
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_3__["default"], { ...linkProps,
    to: to || ''
  });
},  true ? {
  target: "ear9tuy3"
} : 0)("display:flex;align-items:center;background-color:", p => p.theme.alert[p.priority].backgroundLight, ";color:", p => p.theme.textColor, ";font-size:", p => p.theme.fontSizeMedium, ";border:1px dashed ", p => p.theme.alert[p.priority].border, ";padding:", p => p.size === 'small' ? `${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1)} ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1.5)}` : (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(2), ";margin-bottom:", p => p.withoutMarginBottom ? 0 : (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(3), ";border-radius:0.25em;transition:0.2s border-color;&.focus-visible{outline:none;box-shadow:", p => p.theme.alert[p.priority].border, "7f 0 0 0 2px;}" + ( true ? "" : 0));

const IconWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "ear9tuy2"
} : 0)("display:flex;height:calc(", p => p.theme.fontSizeMedium, " * ", p => p.theme.text.lineHeightBody, ");margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), ";align-items:center;" + ( true ? "" : 0));

const IconLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(IconWrapper,  true ? {
  target: "ear9tuy1"
} : 0)("margin-right:0;margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), ";" + ( true ? "" : 0));

const AlertLinkText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ear9tuy0"
} : 0)("line-height:", p => p.theme.text.lineHeightBody, ";flex-grow:1;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/events/eventCustomPerformanceMetrics.tsx":
/*!*****************************************************************!*\
  !*** ./app/components/events/eventCustomPerformanceMetrics.tsx ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ EventCustomPerformanceMetrics)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/featureBadge */ "./app/components/featureBadge.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/discover/fieldRenderers */ "./app/utils/discover/fieldRenderers.tsx");
/* harmony import */ var sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/views/dashboardsV2/utils */ "./app/views/dashboardsV2/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }











function isNotMarkMeasurement(field) {
  return !field.startsWith('mark.');
}

function EventCustomPerformanceMetrics(_ref) {
  var _event$measurements;

  let {
    event,
    location,
    organization
  } = _ref;
  const measurementNames = Object.keys((_event$measurements = event.measurements) !== null && _event$measurements !== void 0 ? _event$measurements : {}).filter(name => (0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_8__.isCustomMeasurement)(`measurements.${name}`)).filter(isNotMarkMeasurement).sort();

  if (measurementNames.length === 0) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(Container, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_2__.SectionHeading, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Custom Performance Metrics')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_3__["default"], {
      type: "beta"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(Measurements, {
      children: measurementNames.map(name => {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(EventCustomPerformanceMetric, {
          event: event,
          name: name,
          location: location,
          organization: organization
        }, name);
      })
    })]
  });
}
EventCustomPerformanceMetrics.displayName = "EventCustomPerformanceMetrics";

function getFieldTypeFromUnit(unit) {
  if (unit) {
    if (sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_7__.DURATION_UNITS[unit]) {
      return 'duration';
    }

    if (sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_7__.SIZE_UNITS[unit]) {
      return 'size';
    }

    if (sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_7__.PERCENTAGE_UNITS.includes(unit)) {
      return 'percentage';
    }

    if (unit === 'none') {
      return 'integer';
    }
  }

  return 'number';
}

function EventCustomPerformanceMetric(_ref2) {
  var _event$measurements$n, _event$measurements2;

  let {
    event,
    name,
    location,
    organization
  } = _ref2;
  const {
    value,
    unit
  } = (_event$measurements$n = (_event$measurements2 = event.measurements) === null || _event$measurements2 === void 0 ? void 0 : _event$measurements2[name]) !== null && _event$measurements$n !== void 0 ? _event$measurements$n : {};

  if (value === null) {
    return null;
  }

  const fieldType = getFieldTypeFromUnit(unit);
  const rendered = fieldType ? sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_7__.FIELD_FORMATTERS[fieldType].renderFunc(name, {
    [name]: value
  }, {
    location,
    organization,
    unit
  }) : value;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(StyledPanel, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("div", {
      children: name
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(ValueRow, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(Value, {
        children: rendered
      })
    })]
  });
}

EventCustomPerformanceMetric.displayName = "EventCustomPerformanceMetric";

const Measurements = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "etadham4"
} : 0)("display:grid;grid-column-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1), ";" + ( true ? "" : 0));

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "etadham3"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(4), ";" + ( true ? "" : 0));

const StyledPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__.Panel,  true ? {
  target: "etadham2"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1.5), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1), ";" + ( true ? "" : 0));

const ValueRow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "etadham1"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const Value = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "etadham0"
} : 0)("font-size:", p => p.theme.fontSizeExtraLarge, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/events/eventVitals.tsx":
/*!***********************************************!*\
  !*** ./app/components/events/eventVitals.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "EventVitalContainer": () => (/* binding */ EventVitalContainer),
/* harmony export */   "default": () => (/* binding */ EventVitals)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_measurements_index__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/measurements/index */ "./app/utils/measurements/index.tsx");
/* harmony import */ var sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/performance/vitals/constants */ "./app/utils/performance/vitals/constants.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }














function isOutdatedSdk(event) {
  var _event$sdk;

  if (!((_event$sdk = event.sdk) !== null && _event$sdk !== void 0 && _event$sdk.version)) {
    return false;
  }

  const sdkVersion = event.sdk.version;
  return sdkVersion.startsWith('5.26.') || sdkVersion.startsWith('5.27.0') || sdkVersion.startsWith('5.27.1') || sdkVersion.startsWith('5.27.2');
}

function EventVitals(_ref) {
  let {
    event
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(WebVitals, {
      event: event
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(MobileVitals, {
      event: event
    })]
  });
}
EventVitals.displayName = "EventVitals";

function WebVitals(_ref2) {
  var _event$measurements;

  let {
    event
  } = _ref2;
  const measurementNames = Object.keys((_event$measurements = event.measurements) !== null && _event$measurements !== void 0 ? _event$measurements : {}).filter(name => Boolean(sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_10__.WEB_VITAL_DETAILS[`measurements.${name}`])).sort();

  if (measurementNames.length === 0) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(Container, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_2__.SectionHeading, {
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Web Vitals'), isOutdatedSdk(event) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(WarningIconContainer, {
        size: "sm",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_4__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('These vitals were collected using an outdated SDK version and may not be accurate. To ensure accurate web vitals in new transaction events, please update your SDK to the latest version.'),
          position: "top",
          containerDisplayMode: "inline-block",
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconWarning, {
            size: "sm"
          })
        })
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Measurements, {
      children: measurementNames.map(name => {
        // Measurements are referred to by their full name `measurements.<name>`
        // here but are stored using their abbreviated name `<name>`. Make sure
        // to convert it appropriately.
        const measurement = `measurements.${name}`;
        const vital = sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_10__.WEB_VITAL_DETAILS[measurement];
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(EventVital, {
          event: event,
          name: name,
          vital: vital
        }, name);
      })
    })]
  });
}

WebVitals.displayName = "WebVitals";

function MobileVitals(_ref3) {
  var _event$measurements2;

  let {
    event
  } = _ref3;
  const measurementNames = Object.keys((_event$measurements2 = event.measurements) !== null && _event$measurements2 !== void 0 ? _event$measurements2 : {}).filter(name => Boolean(sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_10__.MOBILE_VITAL_DETAILS[`measurements.${name}`])).sort();

  if (measurementNames.length === 0) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(Container, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_2__.SectionHeading, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Mobile Vitals')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Measurements, {
      children: measurementNames.map(name => {
        // Measurements are referred to by their full name `measurements.<name>`
        // here but are stored using their abbreviated name `<name>`. Make sure
        // to convert it appropriately.
        const measurement = `measurements.${name}`;
        const vital = sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_10__.MOBILE_VITAL_DETAILS[measurement];
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(EventVital, {
          event: event,
          name: name,
          vital: vital
        }, name);
      })
    })]
  });
}

MobileVitals.displayName = "MobileVitals";

function EventVital(_ref4) {
  var _event$measurements$n, _event$measurements3, _vital$poorThreshold, _vital$name;

  let {
    event,
    name,
    vital
  } = _ref4;
  const value = (_event$measurements$n = (_event$measurements3 = event.measurements) === null || _event$measurements3 === void 0 ? void 0 : _event$measurements3[name].value) !== null && _event$measurements$n !== void 0 ? _event$measurements$n : null;

  if (value === null || !vital) {
    return null;
  }

  const failedThreshold = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_8__.defined)(vital.poorThreshold) && value >= vital.poorThreshold;
  const currentValue = (0,sentry_utils_measurements_index__WEBPACK_IMPORTED_MODULE_9__.formattedValue)(vital, value);
  const thresholdValue = (0,sentry_utils_measurements_index__WEBPACK_IMPORTED_MODULE_9__.formattedValue)(vital, (_vital$poorThreshold = vital === null || vital === void 0 ? void 0 : vital.poorThreshold) !== null && _vital$poorThreshold !== void 0 ? _vital$poorThreshold : 0);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(EventVitalContainer, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(StyledPanel, {
      failedThreshold: failedThreshold,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Name, {
        children: (_vital$name = vital.name) !== null && _vital$name !== void 0 ? _vital$name : name
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(ValueRow, {
        children: [failedThreshold ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(FireIconContainer, {
          size: "sm",
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_4__["default"], {
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Fails threshold at %s.', thresholdValue),
            position: "top",
            containerDisplayMode: "inline-block",
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconFire, {
              size: "sm"
            })
          })
        }) : null, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Value, {
          failedThreshold: failedThreshold,
          children: currentValue
        })]
      })]
    })
  });
}

EventVital.displayName = "EventVital";

const Measurements = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eknakzv8"
} : 0)("display:grid;grid-column-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";" + ( true ? "" : 0));

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eknakzv7"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(4), ";" + ( true ? "" : 0));

const StyledPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.Panel,  true ? {
  target: "eknakzv6"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1.5), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";", p => p.failedThreshold && `border: 1px solid ${p.theme.red300};`, ";" + ( true ? "" : 0));

const Name = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eknakzv5"
} : 0)( true ? "" : 0);

const ValueRow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eknakzv4"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const WarningIconContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "eknakzv3"
} : 0)("display:inline-block;height:", p => {
  var _p$theme$iconSizes$p$;

  return (_p$theme$iconSizes$p$ = p.theme.iconSizes[p.size]) !== null && _p$theme$iconSizes$p$ !== void 0 ? _p$theme$iconSizes$p$ : p.size;
}, ";line-height:", p => {
  var _p$theme$iconSizes$p$2;

  return (_p$theme$iconSizes$p$2 = p.theme.iconSizes[p.size]) !== null && _p$theme$iconSizes$p$2 !== void 0 ? _p$theme$iconSizes$p$2 : p.size;
}, ";margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(0.5), ";color:", p => p.theme.red300, ";" + ( true ? "" : 0));

const FireIconContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "eknakzv2"
} : 0)("display:inline-block;height:", p => {
  var _p$theme$iconSizes$p$3;

  return (_p$theme$iconSizes$p$3 = p.theme.iconSizes[p.size]) !== null && _p$theme$iconSizes$p$3 !== void 0 ? _p$theme$iconSizes$p$3 : p.size;
}, ";line-height:", p => {
  var _p$theme$iconSizes$p$4;

  return (_p$theme$iconSizes$p$4 = p.theme.iconSizes[p.size]) !== null && _p$theme$iconSizes$p$4 !== void 0 ? _p$theme$iconSizes$p$4 : p.size;
}, ";margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(0.5), ";color:", p => p.theme.red300, ";" + ( true ? "" : 0));

const Value = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "eknakzv1"
} : 0)("font-size:", p => p.theme.fontSizeExtraLarge, ";", p => p.failedThreshold && `color: ${p.theme.red300};`, ";" + ( true ? "" : 0));

const EventVitalContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eknakzv0"
} : 0)( true ? "" : 0);

/***/ }),

/***/ "./app/components/keyValueTable.tsx":
/*!******************************************!*\
  !*** ./app/components/keyValueTable.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "KeyValueTable": () => (/* binding */ KeyValueTable),
/* harmony export */   "KeyValueTableRow": () => (/* binding */ KeyValueTableRow)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }





const KeyValueTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('dl',  true ? {
  target: "e13z4zle2"
} : 0)( true ? {
  name: "u4s7v9",
  styles: "display:grid;grid-template-columns:50% 50%"
} : 0);
const KeyValueTableRow = _ref => {
  let {
    keyName,
    value
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Key, {
      children: keyName
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Value, {
      children: value
    })]
  });
};
KeyValueTableRow.displayName = "KeyValueTableRow";

const commonStyles = _ref2 => {
  let {
    theme
  } = _ref2;
  return `
font-size: ${theme.fontSizeMedium};
padding: ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(0.5)} ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1)};
font-weight: normal;
line-height: inherit;
${p => p.theme.overflowEllipsis};
&:nth-of-type(2n-1) {
  background-color: ${theme.backgroundSecondary};
}
`;
};

const Key = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('dt',  true ? {
  target: "e13z4zle1"
} : 0)(commonStyles, ";color:", p => p.theme.textColor, ";" + ( true ? "" : 0));

const Value = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('dd',  true ? {
  target: "e13z4zle0"
} : 0)(commonStyles, ";color:", p => p.theme.subText, ";text-align:right;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/tagsTable.tsx":
/*!**************************************!*\
  !*** ./app/components/tagsTable.tsx ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TagsTable": () => (/* binding */ TagsTable)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_events_meta_annotatedText__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/events/meta/annotatedText */ "./app/components/events/meta/annotatedText/index.tsx");
/* harmony import */ var sentry_components_keyValueTable__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/keyValueTable */ "./app/components/keyValueTable.tsx");
/* harmony import */ var sentry_components_tagsTableRow__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/tagsTableRow */ "./app/components/tagsTableRow.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









function TagsTable(_ref) {
  var _event$_meta;

  let {
    event,
    query,
    generateUrl
  } = _ref;
  const meta = (_event$_meta = event._meta) === null || _event$_meta === void 0 ? void 0 : _event$_meta.tags;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(StyledTagsTable, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_1__.SectionHeading, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Tag Details')
    }), !!(meta !== null && meta !== void 0 && meta['']) && !event.tags ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_events_meta_annotatedText__WEBPACK_IMPORTED_MODULE_2__["default"], {
      value: event.tags,
      meta: meta === null || meta === void 0 ? void 0 : meta['']
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_keyValueTable__WEBPACK_IMPORTED_MODULE_3__.KeyValueTable, {
      children: event.tags.map((tag, index) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_tagsTableRow__WEBPACK_IMPORTED_MODULE_4__["default"], {
        tag: tag,
        query: query,
        generateUrl: generateUrl,
        meta: meta === null || meta === void 0 ? void 0 : meta[index]
      }, tag.key))
    })]
  });
}
TagsTable.displayName = "TagsTable";

const StyledTagsTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eaaaj7z0"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(3), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/tagsTableRow.tsx":
/*!*****************************************!*\
  !*** ./app/components/tagsTableRow.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_keyValueTable__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/keyValueTable */ "./app/components/keyValueTable.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_components_version__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/version */ "./app/components/version.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _events_meta_annotatedText__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./events/meta/annotatedText */ "./app/components/events/meta/annotatedText/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









function TagsTableRow(_ref) {
  var _meta$key, _meta$value, _keyMetaData$err;

  let {
    tag,
    query,
    generateUrl,
    meta
  } = _ref;
  const tagInQuery = query.includes(`${tag.key}:`);
  const target = tagInQuery ? undefined : generateUrl(tag);
  const keyMetaData = meta === null || meta === void 0 ? void 0 : (_meta$key = meta.key) === null || _meta$key === void 0 ? void 0 : _meta$key[''];
  const valueMetaData = meta === null || meta === void 0 ? void 0 : (_meta$value = meta.value) === null || _meta$value === void 0 ? void 0 : _meta$value[''];

  const renderTagValue = () => {
    switch (tag.key) {
      case 'release':
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_version__WEBPACK_IMPORTED_MODULE_5__["default"], {
          version: tag.value,
          anchor: false,
          withPackage: true
        });

      default:
        return tag.value;
    }
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_keyValueTable__WEBPACK_IMPORTED_MODULE_2__.KeyValueTableRow, {
    keyName: !!keyMetaData && !tag.key ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_events_meta_annotatedText__WEBPACK_IMPORTED_MODULE_7__["default"], {
      value: tag.key,
      meta: keyMetaData
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(StyledTooltip, {
      title: tag.key,
      children: tag.key
    }),
    value: !!valueMetaData && !tag.value ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_events_meta_annotatedText__WEBPACK_IMPORTED_MODULE_7__["default"], {
      value: tag.value,
      meta: valueMetaData
    }) : keyMetaData !== null && keyMetaData !== void 0 && (_keyMetaData$err = keyMetaData.err) !== null && _keyMetaData$err !== void 0 && _keyMetaData$err.length ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(ValueContainer, {
      children: renderTagValue()
    }) : tagInQuery ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(StyledTooltip, {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('This tag is in the current filter conditions'),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(ValueContainer, {
        children: renderTagValue()
      })
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(StyledTooltip, {
      title: renderTagValue(),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_3__["default"], {
        to: target || '',
        children: renderTagValue()
      })
    })
  });
}

TagsTableRow.displayName = "TagsTableRow";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TagsTableRow);

const StyledTooltip = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "eefv4rs1"
} : 0)(p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

const ValueContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "eefv4rs0"
} : 0)( true ? {
  name: "1jltqks",
  styles: "display:block;overflow:hidden;text-overflow:ellipsis;line-height:normal"
} : 0);

/***/ }),

/***/ "./app/utils/measurements/index.tsx":
/*!******************************************!*\
  !*** ./app/utils/measurements/index.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "formattedValue": () => (/* binding */ formattedValue)
/* harmony export */ });
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");

function formattedValue(record, value) {
  if (record && record.type === 'duration') {
    return (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_0__.getDuration)(value / 1000, 3);
  }

  if (record && record.type === 'integer') {
    return value.toFixed(0);
  }

  return value.toFixed(3);
}

/***/ }),

/***/ "./app/utils/performance/quickTrace/quickTraceQuery.tsx":
/*!**************************************************************!*\
  !*** ./app/utils/performance/quickTrace/quickTraceQuery.tsx ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ QuickTraceQuery)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_utils_performance_quickTrace_traceFullQuery__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/performance/quickTrace/traceFullQuery */ "./app/utils/performance/quickTrace/traceFullQuery.tsx");
/* harmony import */ var sentry_utils_performance_quickTrace_traceLiteQuery__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/performance/quickTrace/traceLiteQuery */ "./app/utils/performance/quickTrace/traceLiteQuery.tsx");
/* harmony import */ var sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/performance/quickTrace/utils */ "./app/utils/performance/quickTrace/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function QuickTraceQuery(_ref) {
  var _event$contexts, _event$contexts$trace;

  let {
    children,
    event,
    ...props
  } = _ref;

  const renderEmpty = () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: children({
      isLoading: false,
      error: null,
      trace: [],
      type: 'empty',
      currentEvent: null
    })
  });

  if (!event) {
    return renderEmpty();
  }

  const traceId = (_event$contexts = event.contexts) === null || _event$contexts === void 0 ? void 0 : (_event$contexts$trace = _event$contexts.trace) === null || _event$contexts$trace === void 0 ? void 0 : _event$contexts$trace.trace_id;

  if (!traceId) {
    return renderEmpty();
  }

  const {
    start,
    end
  } = (0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_4__.getTraceTimeRangeFromEvent)(event);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_utils_performance_quickTrace_traceLiteQuery__WEBPACK_IMPORTED_MODULE_3__["default"], {
    eventId: event.id,
    traceId: traceId,
    start: start,
    end: end,
    ...props,
    children: traceLiteResults => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_utils_performance_quickTrace_traceFullQuery__WEBPACK_IMPORTED_MODULE_2__.TraceFullQuery, {
      eventId: event.id,
      traceId: traceId,
      start: start,
      end: end,
      ...props,
      children: traceFullResults => {
        var _traceFullResults$tra;

        if (!traceFullResults.isLoading && traceFullResults.error === null && traceFullResults.traces !== null) {
          for (const subtrace of traceFullResults.traces) {
            try {
              var _trace$find;

              const trace = (0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_4__.flattenRelevantPaths)(event, subtrace);
              return children({ ...traceFullResults,
                trace,
                currentEvent: (_trace$find = trace.find(e => (0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_4__.isCurrentEvent)(e, event))) !== null && _trace$find !== void 0 ? _trace$find : null
              });
            } catch {// let this fall through and check the next subtrace
              // or use the trace lite results
            }
          }
        }

        if (!traceLiteResults.isLoading && traceLiteResults.error === null && traceLiteResults.trace !== null) {
          var _trace$find2;

          const {
            trace
          } = traceLiteResults;
          return children({ ...traceLiteResults,
            currentEvent: (_trace$find2 = trace.find(e => (0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_4__.isCurrentEvent)(e, event))) !== null && _trace$find2 !== void 0 ? _trace$find2 : null
          });
        }

        return children({
          // only use the light results loading state if it didn't error
          // if it did, we should rely on the full results
          isLoading: traceLiteResults.error ? traceFullResults.isLoading : traceLiteResults.isLoading || traceFullResults.isLoading,
          // swallow any errors from the light results because we
          // should rely on the full results in this situations
          error: traceFullResults.error,
          trace: [],
          // if we reach this point but there were some traces in the full results,
          // that means there were other transactions in the trace, but the current
          // event could not be found
          type: (_traceFullResults$tra = traceFullResults.traces) !== null && _traceFullResults$tra !== void 0 && _traceFullResults$tra.length ? 'missing' : 'empty',
          currentEvent: null
        });
      }
    })
  });
}
QuickTraceQuery.displayName = "QuickTraceQuery";

/***/ }),

/***/ "./app/utils/performance/quickTrace/traceFullQuery.tsx":
/*!*************************************************************!*\
  !*** ./app/utils/performance/quickTrace/traceFullQuery.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TraceFullDetailedQuery": () => (/* binding */ TraceFullDetailedQuery),
/* harmony export */   "TraceFullQuery": () => (/* binding */ TraceFullQuery)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/discover/genericDiscoverQuery */ "./app/utils/discover/genericDiscoverQuery.tsx");
/* harmony import */ var sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/performance/quickTrace/utils */ "./app/utils/performance/quickTrace/utils.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function getTraceFullRequestPayload(_ref) {
  let {
    detailed,
    eventId,
    ...props
  } = _ref;
  const additionalApiPayload = (0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_2__.getTraceRequestPayload)(props);
  additionalApiPayload.detailed = detailed ? '1' : '0';

  if (eventId) {
    additionalApiPayload.event_id = eventId;
  }

  return additionalApiPayload;
}

function EmptyTrace(_ref2) {
  let {
    children
  } = _ref2;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: children({
      isLoading: false,
      error: null,
      traces: null,
      type: 'full'
    })
  });
}

EmptyTrace.displayName = "EmptyTrace";

function GenericTraceFullQuery(_ref3) {
  let {
    traceId,
    start,
    end,
    statsPeriod,
    children,
    ...props
  } = _ref3;

  if (!traceId) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(EmptyTrace, {
      children: children
    });
  }

  const eventView = (0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_2__.makeEventView)({
    start,
    end,
    statsPeriod
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_1__["default"], {
    route: `events-trace/${traceId}`,
    getRequestPayload: getTraceFullRequestPayload,
    eventView: eventView,
    ...props,
    children: _ref4 => {
      let {
        tableData,
        ...rest
      } = _ref4;
      return children({
        // This is using '||` instead of '??` here because
        // the client returns a empty string when the response
        // is 204. And we want the empty string, undefined and
        // null to be converted to null.
        traces: tableData || null,
        type: 'full',
        ...rest
      });
    }
  });
}

GenericTraceFullQuery.displayName = "GenericTraceFullQuery";
const TraceFullQuery = (0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_3__["default"])(props => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(GenericTraceFullQuery, { ...props,
  detailed: false
}));
const TraceFullDetailedQuery = (0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_3__["default"])(props => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(GenericTraceFullQuery, { ...props,
  detailed: true
}));

/***/ }),

/***/ "./app/utils/performance/quickTrace/traceLiteQuery.tsx":
/*!*************************************************************!*\
  !*** ./app/utils/performance/quickTrace/traceLiteQuery.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/discover/genericDiscoverQuery */ "./app/utils/discover/genericDiscoverQuery.tsx");
/* harmony import */ var sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/performance/quickTrace/utils */ "./app/utils/performance/quickTrace/utils.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function getTraceLiteRequestPayload(_ref) {
  let {
    eventId,
    ...props
  } = _ref;
  const additionalApiPayload = (0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_2__.getTraceRequestPayload)(props);
  return Object.assign({
    event_id: eventId
  }, additionalApiPayload);
}

function EmptyTrace(_ref2) {
  let {
    children
  } = _ref2;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: children({
      isLoading: false,
      error: null,
      trace: null,
      type: 'partial'
    })
  });
}

EmptyTrace.displayName = "EmptyTrace";

function TraceLiteQuery(_ref3) {
  let {
    traceId,
    start,
    end,
    statsPeriod,
    children,
    ...props
  } = _ref3;

  if (!traceId) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(EmptyTrace, {
      children: children
    });
  }

  const eventView = (0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_2__.makeEventView)({
    start,
    end,
    statsPeriod
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_1__["default"], {
    route: `events-trace-light/${traceId}`,
    getRequestPayload: getTraceLiteRequestPayload,
    eventView: eventView,
    ...props,
    children: _ref4 => {
      let {
        tableData,
        ...rest
      } = _ref4;
      return children({
        // This is using '||` instead of '??` here because
        // the client returns a empty string when the response
        // is 204. And we want the empty string, undefined and
        // null to be converted to null.
        trace: tableData || null,
        type: 'partial',
        ...rest
      });
    }
  });
}

TraceLiteQuery.displayName = "TraceLiteQuery";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_3__["default"])(TraceLiteQuery));

/***/ }),

/***/ "./app/utils/performance/quickTrace/traceMetaQuery.tsx":
/*!*************************************************************!*\
  !*** ./app/utils/performance/quickTrace/traceMetaQuery.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/discover/genericDiscoverQuery */ "./app/utils/discover/genericDiscoverQuery.tsx");
/* harmony import */ var sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/performance/quickTrace/utils */ "./app/utils/performance/quickTrace/utils.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function TraceMetaQuery(_ref) {
  let {
    traceId,
    start,
    end,
    statsPeriod,
    children,
    ...props
  } = _ref;

  if (!traceId) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
      children: children({
        isLoading: false,
        error: null,
        meta: null
      })
    });
  }

  const eventView = (0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_2__.makeEventView)({
    start,
    end,
    statsPeriod
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_1__["default"], {
    route: `events-trace-meta/${traceId}`,
    getRequestPayload: sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_2__.getTraceRequestPayload,
    eventView: eventView,
    ...props,
    children: _ref2 => {
      let {
        tableData,
        ...rest
      } = _ref2;
      return children({
        meta: tableData,
        ...rest
      });
    }
  });
}

TraceMetaQuery.displayName = "TraceMetaQuery";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_3__["default"])(TraceMetaQuery));

/***/ }),

/***/ "./app/views/dashboardsV2/utils.tsx":
/*!******************************************!*\
  !*** ./app/views/dashboardsV2/utils.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "cloneDashboard": () => (/* binding */ cloneDashboard),
/* harmony export */   "constructWidgetFromQuery": () => (/* binding */ constructWidgetFromQuery),
/* harmony export */   "eventViewFromWidget": () => (/* binding */ eventViewFromWidget),
/* harmony export */   "flattenErrors": () => (/* binding */ flattenErrors),
/* harmony export */   "getCurrentPageFilters": () => (/* binding */ getCurrentPageFilters),
/* harmony export */   "getCustomMeasurementQueryParams": () => (/* binding */ getCustomMeasurementQueryParams),
/* harmony export */   "getDashboardFiltersFromURL": () => (/* binding */ getDashboardFiltersFromURL),
/* harmony export */   "getDashboardsMEPQueryParams": () => (/* binding */ getDashboardsMEPQueryParams),
/* harmony export */   "getFieldsFromEquations": () => (/* binding */ getFieldsFromEquations),
/* harmony export */   "getNumEquations": () => (/* binding */ getNumEquations),
/* harmony export */   "getSavedFiltersAsPageFilters": () => (/* binding */ getSavedFiltersAsPageFilters),
/* harmony export */   "getSavedPageFilters": () => (/* binding */ getSavedPageFilters),
/* harmony export */   "getWidgetDiscoverUrl": () => (/* binding */ getWidgetDiscoverUrl),
/* harmony export */   "getWidgetInterval": () => (/* binding */ getWidgetInterval),
/* harmony export */   "getWidgetIssueUrl": () => (/* binding */ getWidgetIssueUrl),
/* harmony export */   "getWidgetReleasesUrl": () => (/* binding */ getWidgetReleasesUrl),
/* harmony export */   "hasSavedPageFilters": () => (/* binding */ hasSavedPageFilters),
/* harmony export */   "hasUnsavedFilterChanges": () => (/* binding */ hasUnsavedFilterChanges),
/* harmony export */   "isCustomMeasurement": () => (/* binding */ isCustomMeasurement),
/* harmony export */   "isCustomMeasurementWidget": () => (/* binding */ isCustomMeasurementWidget),
/* harmony export */   "isWidgetUsingTransactionName": () => (/* binding */ isWidgetUsingTransactionName),
/* harmony export */   "miniWidget": () => (/* binding */ miniWidget),
/* harmony export */   "resetPageFilters": () => (/* binding */ resetPageFilters)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/cloneDeep */ "../node_modules/lodash/cloneDeep.js");
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var lodash_isEmpty__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/isEmpty */ "../node_modules/lodash/isEmpty.js");
/* harmony import */ var lodash_isEmpty__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_isEmpty__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var lodash_trimStart__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! lodash/trimStart */ "../node_modules/lodash/trimStart.js");
/* harmony import */ var lodash_trimStart__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(lodash_trimStart__WEBPACK_IMPORTED_MODULE_8__);
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var sentry_images_dashboard_widget_area_svg__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry-images/dashboard/widget-area.svg */ "./images/dashboard/widget-area.svg");
/* harmony import */ var sentry_images_dashboard_widget_bar_svg__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry-images/dashboard/widget-bar.svg */ "./images/dashboard/widget-bar.svg");
/* harmony import */ var sentry_images_dashboard_widget_big_number_svg__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry-images/dashboard/widget-big-number.svg */ "./images/dashboard/widget-big-number.svg");
/* harmony import */ var sentry_images_dashboard_widget_line_1_svg__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry-images/dashboard/widget-line-1.svg */ "./images/dashboard/widget-line-1.svg");
/* harmony import */ var sentry_images_dashboard_widget_table_svg__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry-images/dashboard/widget-table.svg */ "./images/dashboard/widget-table.svg");
/* harmony import */ var sentry_images_dashboard_widget_world_map_svg__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry-images/dashboard/widget-world-map.svg */ "./images/dashboard/widget-world-map.svg");
/* harmony import */ var sentry_components_arithmeticInput_parser__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/arithmeticInput/parser */ "./app/components/arithmeticInput/parser.tsx");
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/discover/types */ "./app/utils/discover/types.tsx");
/* harmony import */ var sentry_utils_measurements_measurements__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/utils/measurements/measurements */ "./app/utils/measurements/measurements.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/views/dashboardsV2/types */ "./app/views/dashboardsV2/types.tsx");



























function cloneDashboard(dashboard) {
  return lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_4___default()(dashboard);
}
function eventViewFromWidget(title, query, selection, widgetDisplayType) {
  const {
    start,
    end,
    period: statsPeriod
  } = selection.datetime;
  const {
    projects,
    environments
  } = selection; // World Map requires an additional column (geo.country_code) to display in discover when navigating from the widget

  const fields = widgetDisplayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.WORLD_MAP && !query.columns.includes('geo.country_code') ? ['geo.country_code', ...query.columns, ...query.aggregates] : [...query.columns, ...query.aggregates];
  const conditions = widgetDisplayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.WORLD_MAP && !query.conditions.includes('has:geo.country_code') ? `${query.conditions} has:geo.country_code`.trim() : query.conditions;
  const {
    orderby
  } = query; // Need to convert orderby to aggregate alias because eventView still uses aggregate alias format

  const aggregateAliasOrderBy = orderby ? `${orderby.startsWith('-') ? '-' : ''}${(0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_22__.getAggregateAlias)(lodash_trimStart__WEBPACK_IMPORTED_MODULE_8___default()(orderby, '-'))}` : orderby;
  return sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_21__["default"].fromSavedQuery({
    id: undefined,
    name: title,
    version: 2,
    fields,
    query: conditions,
    orderby: aggregateAliasOrderBy,
    projects,
    range: statsPeriod !== null && statsPeriod !== void 0 ? statsPeriod : undefined,
    start: start ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_20__.getUtcDateString)(start) : undefined,
    end: end ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_20__.getUtcDateString)(end) : undefined,
    environment: environments
  });
}

function coerceStringToArray(value) {
  return typeof value === 'string' ? [value] : value;
}

function constructWidgetFromQuery(query) {
  if (query) {
    const queryNames = coerceStringToArray(query.queryNames);
    const queryConditions = coerceStringToArray(query.queryConditions);
    const queryFields = coerceStringToArray(query.queryFields);
    const queries = [];

    if (queryConditions && queryNames && queryFields && typeof query.queryOrderby === 'string') {
      const {
        columns,
        aggregates
      } = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_22__.getColumnsAndAggregates)(queryFields);
      queryConditions.forEach((condition, index) => {
        queries.push({
          name: queryNames[index],
          conditions: condition,
          fields: queryFields,
          columns,
          aggregates,
          orderby: query.queryOrderby
        });
      });
    }

    if (query.title && query.displayType && query.interval && queries.length > 0) {
      const newWidget = { ...lodash_pick__WEBPACK_IMPORTED_MODULE_7___default()(query, ['title', 'displayType', 'interval']),
        widgetType: sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.WidgetType.DISCOVER,
        queries
      };
      return newWidget;
    }
  }

  return undefined;
}
function miniWidget(displayType) {
  switch (displayType) {
    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.BAR:
      return sentry_images_dashboard_widget_bar_svg__WEBPACK_IMPORTED_MODULE_11__;

    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.AREA:
    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.TOP_N:
      return sentry_images_dashboard_widget_area_svg__WEBPACK_IMPORTED_MODULE_10__;

    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.BIG_NUMBER:
      return sentry_images_dashboard_widget_big_number_svg__WEBPACK_IMPORTED_MODULE_12__;

    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.TABLE:
      return sentry_images_dashboard_widget_table_svg__WEBPACK_IMPORTED_MODULE_14__;

    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.WORLD_MAP:
      return sentry_images_dashboard_widget_world_map_svg__WEBPACK_IMPORTED_MODULE_15__;

    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.LINE:
    default:
      return sentry_images_dashboard_widget_line_1_svg__WEBPACK_IMPORTED_MODULE_13__;
  }
}
function getWidgetInterval(displayType, datetimeObj, widgetInterval, fidelity) {
  // Don't fetch more than 66 bins as we're plotting on a small area.
  const MAX_BIN_COUNT = 66; // Bars charts are daily totals to aligned with discover. It also makes them
  // usefully different from line/area charts until we expose the interval control, or remove it.

  let interval = displayType === 'bar' ? '1d' : widgetInterval;

  if (!interval) {
    // Default to 5 minutes
    interval = '5m';
  }

  const desiredPeriod = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_20__.parsePeriodToHours)(interval);
  const selectedRange = (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_17__.getDiffInMinutes)(datetimeObj);

  if (fidelity) {
    // Primarily to support lower fidelity for Release Health widgets
    // the sort on releases and hit the metrics API endpoint.
    interval = (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_17__.getInterval)(datetimeObj, fidelity);

    if (selectedRange > sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_17__.SIX_HOURS && selectedRange <= sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_17__.TWENTY_FOUR_HOURS) {
      interval = '1h';
    }

    return displayType === 'bar' ? '1d' : interval;
  } // selectedRange is in minutes, desiredPeriod is in hours
  // convert desiredPeriod to minutes


  if (selectedRange / (desiredPeriod * 60) > MAX_BIN_COUNT) {
    const highInterval = (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_17__.getInterval)(datetimeObj, 'high'); // Only return high fidelity interval if desired interval is higher fidelity

    if (desiredPeriod < (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_20__.parsePeriodToHours)(highInterval)) {
      return highInterval;
    }
  }

  return interval;
}
function getFieldsFromEquations(fields) {
  // Gather all fields and functions used in equations and prepend them to the provided fields
  const termsSet = new Set();
  fields.filter(sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_22__.isEquation).forEach(field => {
    const parsed = (0,sentry_components_arithmeticInput_parser__WEBPACK_IMPORTED_MODULE_16__.parseArithmetic)((0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_22__.stripEquationPrefix)(field)).tc;
    parsed.fields.forEach(_ref => {
      let {
        term
      } = _ref;
      return termsSet.add(term);
    });
    parsed.functions.forEach(_ref2 => {
      let {
        term
      } = _ref2;
      return termsSet.add(term);
    });
  });
  return Array.from(termsSet);
}
function getWidgetDiscoverUrl(widget, selection, organization) {
  let index = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;
  let isMetricsData = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;
  const eventView = eventViewFromWidget(widget.title, widget.queries[index], selection, widget.displayType);
  const discoverLocation = eventView.getResultsViewUrlTarget(organization.slug); // Pull a max of 3 valid Y-Axis from the widget

  const yAxisOptions = eventView.getYAxisOptions().map(_ref3 => {
    let {
      value
    } = _ref3;
    return value;
  });
  discoverLocation.query.yAxis = [...new Set(widget.queries[0].aggregates.filter(aggregate => yAxisOptions.includes(aggregate)))].slice(0, 3); // Visualization specific transforms

  switch (widget.displayType) {
    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.WORLD_MAP:
      discoverLocation.query.display = sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_23__.DisplayModes.WORLDMAP;
      break;

    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.BAR:
      discoverLocation.query.display = sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_23__.DisplayModes.BAR;
      break;

    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.TOP_N:
      discoverLocation.query.display = sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_23__.DisplayModes.TOP5; // Last field is used as the yAxis

      const aggregates = widget.queries[0].aggregates;
      discoverLocation.query.yAxis = aggregates[aggregates.length - 1];

      if (aggregates.slice(0, -1).includes(aggregates[aggregates.length - 1])) {
        discoverLocation.query.field = aggregates.slice(0, -1);
      }

      break;

    default:
      break;
  } // Equation fields need to have their terms explicitly selected as columns in the discover table


  const fields = discoverLocation.query.field;
  const query = widget.queries[0];
  const queryFields = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_19__.defined)(query.fields) ? query.fields : [...query.columns, ...query.aggregates];
  const equationFields = getFieldsFromEquations(queryFields); // Updates fields by adding any individual terms from equation fields as a column

  equationFields.forEach(term => {
    if (Array.isArray(fields) && !fields.includes(term)) {
      fields.unshift(term);
    }
  });

  if (isMetricsData) {
    discoverLocation.query.fromMetric = 'true';
  } // Construct and return the discover url


  const discoverPath = `${discoverLocation.pathname}?${query_string__WEBPACK_IMPORTED_MODULE_9__.stringify({ ...discoverLocation.query
  })}`;
  return discoverPath;
}
function getWidgetIssueUrl(widget, selection, organization) {
  var _widget$queries, _widget$queries$, _widget$queries2, _widget$queries2$;

  const {
    start,
    end,
    utc,
    period
  } = selection.datetime;
  const datetime = start && end ? {
    start: (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_20__.getUtcDateString)(start),
    end: (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_20__.getUtcDateString)(end),
    utc
  } : {
    statsPeriod: period
  };
  const issuesLocation = `/organizations/${organization.slug}/issues/?${query_string__WEBPACK_IMPORTED_MODULE_9__.stringify({
    query: (_widget$queries = widget.queries) === null || _widget$queries === void 0 ? void 0 : (_widget$queries$ = _widget$queries[0]) === null || _widget$queries$ === void 0 ? void 0 : _widget$queries$.conditions,
    sort: (_widget$queries2 = widget.queries) === null || _widget$queries2 === void 0 ? void 0 : (_widget$queries2$ = _widget$queries2[0]) === null || _widget$queries2$ === void 0 ? void 0 : _widget$queries2$.orderby,
    ...datetime,
    project: selection.projects,
    environment: selection.environments
  })}`;
  return issuesLocation;
}
function getWidgetReleasesUrl(_widget, selection, organization) {
  const {
    start,
    end,
    utc,
    period
  } = selection.datetime;
  const datetime = start && end ? {
    start: (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_20__.getUtcDateString)(start),
    end: (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_20__.getUtcDateString)(end),
    utc
  } : {
    statsPeriod: period
  };
  const releasesLocation = `/organizations/${organization.slug}/releases/?${query_string__WEBPACK_IMPORTED_MODULE_9__.stringify({ ...datetime,
    project: selection.projects,
    environment: selection.environments
  })}`;
  return releasesLocation;
}
function flattenErrors(data, update) {
  if (typeof data === 'string') {
    update.error = data;
  } else {
    Object.keys(data).forEach(key => {
      const value = data[key];

      if (typeof value === 'string') {
        update[key] = value;
        return;
      } // Recurse into nested objects.


      if (Array.isArray(value) && typeof value[0] === 'string') {
        update[key] = value[0];
        return;
      }

      if (Array.isArray(value) && typeof value[0] === 'object') {
        value.map(item => flattenErrors(item, update));
      } else {
        flattenErrors(value, update);
      }
    });
  }

  return update;
}
function getDashboardsMEPQueryParams(isMEPEnabled) {
  return isMEPEnabled ? {
    dataset: 'metricsEnhanced'
  } : {};
}
function getNumEquations(possibleEquations) {
  return possibleEquations.filter(sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_22__.isEquation).length;
}
function isCustomMeasurement(field) {
  const definedMeasurements = Object.keys((0,sentry_utils_measurements_measurements__WEBPACK_IMPORTED_MODULE_24__.getMeasurements)());
  return (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_22__.isMeasurement)(field) && !definedMeasurements.includes(field);
}
function isCustomMeasurementWidget(widget) {
  return widget.widgetType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.WidgetType.DISCOVER && widget.queries.some(_ref4 => {
    let {
      aggregates,
      columns,
      fields
    } = _ref4;
    const aggregateArgs = aggregates.reduce((acc, aggregate) => {
      // Should be ok to use getAggregateArg. getAggregateArg only returns the first arg
      // but there aren't any custom measurement aggregates that use custom measurements
      // outside of the first arg.
      const aggregateArg = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_22__.getAggregateArg)(aggregate);

      if (aggregateArg) {
        acc.push(aggregateArg);
      }

      return acc;
    }, []);
    return [...aggregateArgs, ...columns, ...(fields !== null && fields !== void 0 ? fields : [])].some(field => isCustomMeasurement(field));
  });
}
function getCustomMeasurementQueryParams() {
  return {
    dataset: 'metrics'
  };
}
function isWidgetUsingTransactionName(widget) {
  return widget.widgetType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.WidgetType.DISCOVER && widget.queries.some(_ref5 => {
    let {
      aggregates,
      columns,
      fields
    } = _ref5;
    const aggregateArgs = aggregates.reduce((acc, aggregate) => {
      const aggregateArg = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_22__.getAggregateArg)(aggregate);

      if (aggregateArg) {
        acc.push(aggregateArg);
      }

      return acc;
    }, []);
    return [...aggregateArgs, ...columns, ...(fields !== null && fields !== void 0 ? fields : [])].some(field => field === 'transaction');
  });
}
function hasSavedPageFilters(dashboard) {
  return !(lodash_isEmpty__WEBPACK_IMPORTED_MODULE_5___default()(dashboard.projects) && dashboard.environment === undefined && dashboard.start === undefined && dashboard.end === undefined && dashboard.period === undefined);
}
function hasUnsavedFilterChanges(initialDashboard, location) {
  var _location$query;

  // Use Sets to compare the filter fields that are arrays
  const savedFilters = {
    projects: new Set(initialDashboard.projects),
    environment: new Set(initialDashboard.environment),
    period: initialDashboard.period,
    start: (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_18__.normalizeDateTimeString)(initialDashboard.start),
    end: (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_18__.normalizeDateTimeString)(initialDashboard.end),
    utc: initialDashboard.utc
  };
  let currentFilters = { ...getCurrentPageFilters(location)
  };
  currentFilters = { ...currentFilters,
    projects: new Set(currentFilters.projects),
    environment: new Set(currentFilters.environment)
  };

  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_19__.defined)((_location$query = location.query) === null || _location$query === void 0 ? void 0 : _location$query.release)) {
    var _initialDashboard$fil, _location$query2;

    // Release is only included in the comparison if it exists in the query
    // params, otherwise the dashboard should be using its saved state
    savedFilters.release = new Set((_initialDashboard$fil = initialDashboard.filters) === null || _initialDashboard$fil === void 0 ? void 0 : _initialDashboard$fil.release);
    currentFilters.release = new Set((_location$query2 = location.query) === null || _location$query2 === void 0 ? void 0 : _location$query2.release);
  }

  return !lodash_isEqual__WEBPACK_IMPORTED_MODULE_6___default()(savedFilters, currentFilters);
}
function getSavedFiltersAsPageFilters(dashboard) {
  return {
    datetime: {
      end: dashboard.end || null,
      period: dashboard.period || null,
      start: dashboard.start || null,
      utc: null
    },
    environments: dashboard.environment || [],
    projects: dashboard.projects || []
  };
}
function getSavedPageFilters(dashboard) {
  return {
    project: dashboard.projects,
    environment: dashboard.environment,
    statsPeriod: dashboard.period,
    start: (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_18__.normalizeDateTimeString)(dashboard.start),
    end: (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_18__.normalizeDateTimeString)(dashboard.end),
    utc: dashboard.utc
  };
}
function resetPageFilters(dashboard, location) {
  react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.replace({ ...location,
    query: getSavedPageFilters(dashboard)
  });
}
function getCurrentPageFilters(location) {
  var _location$query3;

  const {
    project,
    environment,
    statsPeriod,
    start,
    end,
    utc
  } = (_location$query3 = location.query) !== null && _location$query3 !== void 0 ? _location$query3 : {};
  return {
    // Ensure projects and environment are sent as arrays, or undefined in the request
    // location.query will return a string if there's only one value
    projects: project === undefined || project === null ? [] : typeof project === 'string' ? [Number(project)] : project.map(Number),
    environment: typeof environment === 'string' ? [environment] : environment !== null && environment !== void 0 ? environment : undefined,
    period: statsPeriod,
    start: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_19__.defined)(start) ? (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_18__.normalizeDateTimeString)(start) : undefined,
    end: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_19__.defined)(end) ? (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_18__.normalizeDateTimeString)(end) : undefined,
    utc: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_19__.defined)(utc) ? utc === 'true' : undefined
  };
}
function getDashboardFiltersFromURL(location) {
  const dashboardFilters = {};
  Object.values(sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DashboardFilterKeys).forEach(key => {
    var _location$query4;

    if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_19__.defined)((_location$query4 = location.query) === null || _location$query4 === void 0 ? void 0 : _location$query4[key])) {
      var _location$query5;

      dashboardFilters[key] = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_25__.decodeList)((_location$query5 = location.query) === null || _location$query5 === void 0 ? void 0 : _location$query5[key]);
    }
  });
  return !lodash_isEmpty__WEBPACK_IMPORTED_MODULE_5___default()(dashboardFilters) ? dashboardFilters : null;
}

/***/ }),

/***/ "./app/views/performance/transactionDetails/eventMetas.tsx":
/*!*****************************************************************!*\
  !*** ./app/views/performance/transactionDetails/eventMetas.tsx ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_clipboard__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/clipboard */ "./app/components/clipboard.tsx");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/idBadge/projectBadge */ "./app/components/idBadge/projectBadge.tsx");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/data/platformCategories */ "./app/data/platformCategories.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_events__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/events */ "./app/utils/events.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/performance/quickTrace/utils */ "./app/utils/performance/quickTrace/utils.tsx");
/* harmony import */ var sentry_utils_projects__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/projects */ "./app/utils/projects.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var _quickTraceMeta__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ./quickTraceMeta */ "./app/views/performance/transactionDetails/quickTraceMeta.tsx");
/* harmony import */ var _styles__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ./styles */ "./app/views/performance/transactionDetails/styles.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






















/**
 * This should match the breakpoint chosen for the `EventDetailHeader` below
 */
const BREAKPOINT_MEDIA_QUERY = `(min-width: ${sentry_utils_theme__WEBPACK_IMPORTED_MODULE_18__["default"].breakpoints.large})`;

class EventMetas extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    var _window$matchMedia, _window, _window$matchMedia$ca, _window$matchMedia2, _window2;

    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      isLargeScreen: (_window$matchMedia = (_window = window).matchMedia) === null || _window$matchMedia === void 0 ? void 0 : (_window$matchMedia$ca = _window$matchMedia.call(_window, BREAKPOINT_MEDIA_QUERY)) === null || _window$matchMedia$ca === void 0 ? void 0 : _window$matchMedia$ca.matches
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "mq", (_window$matchMedia2 = (_window2 = window).matchMedia) === null || _window$matchMedia2 === void 0 ? void 0 : _window$matchMedia2.call(_window2, BREAKPOINT_MEDIA_QUERY));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleMediaQueryChange", changed => {
      this.setState({
        isLargeScreen: changed.matches
      });
    });
  }

  componentDidMount() {
    if (this.mq) {
      this.mq.addListener(this.handleMediaQueryChange);
    }
  }

  componentWillUnmount() {
    if (this.mq) {
      this.mq.removeListener(this.handleMediaQueryChange);
    }
  }

  render() {
    const {
      event,
      organization,
      projectId,
      location,
      quickTrace,
      meta,
      errorDest,
      transactionDest
    } = this.props;
    const {
      isLargeScreen
    } = this.state;
    const type = (0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_16__.isTransaction)(event) ? 'transaction' : 'event';

    const timestamp = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_7__["default"], {
      date: event.dateCreated || (event.endTimestamp || 0) * 1000
    });

    const httpStatus = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(HttpStatus, {
      event: event
    });

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_utils_projects__WEBPACK_IMPORTED_MODULE_17__["default"], {
      orgId: organization.slug,
      slugs: [projectId],
      children: _ref => {
        let {
          projects
        } = _ref;
        const project = projects.find(p => p.slug === projectId);
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(EventDetailHeader, {
          type: type,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_20__.MetaData, {
            headingText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Event ID'),
            tooltipText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('The unique ID assigned to this %s.', type),
            bodyText: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(EventID, {
              event: event
            }),
            subtext: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_6__["default"], {
              project: project ? project : {
                slug: projectId
              },
              avatarSize: 16
            })
          }), (0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_16__.isTransaction)(event) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_20__.MetaData, {
            headingText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Event Duration'),
            tooltipText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('The time elapsed between the start and end of this transaction.'),
            bodyText: (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_14__.getDuration)(event.endTimestamp - event.startTimestamp, 2, true),
            subtext: timestamp
          }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_20__.MetaData, {
            headingText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Created'),
            tooltipText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('The time at which this event was created.'),
            bodyText: timestamp,
            subtext: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_15__["default"])({
              value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_5__["default"], {
                date: event.dateCreated
              }),
              fixed: 'May 6, 2021 3:27:01 UTC'
            })
          }), (0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_16__.isTransaction)(event) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_20__.MetaData, {
            headingText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Status'),
            tooltipText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('The status of this transaction indicating if it succeeded or otherwise.'),
            bodyText: getStatusBodyText(project, event, meta),
            subtext: httpStatus
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(QuickTraceContainer, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(_quickTraceMeta__WEBPACK_IMPORTED_MODULE_19__["default"], {
              event: event,
              project: project,
              location: location,
              quickTrace: quickTrace,
              traceMeta: meta,
              anchor: isLargeScreen ? 'right' : 'left',
              errorDest: errorDest,
              transactionDest: transactionDest
            })
          })]
        });
      }
    });
  }

}

EventMetas.displayName = "EventMetas";

const EventDetailHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ej1eqv63"
} : 0)("display:grid;grid-template-columns:repeat(", p => p.type === 'transaction' ? 3 : 2, ", 1fr);grid-template-rows:repeat(2, auto);gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(2), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(2), ";@media (min-width: ", p => p.theme.breakpoints.medium, "){margin-bottom:0;}@media (min-width: ", p => p.theme.breakpoints.large, "){", p => p.type === 'transaction' ? 'grid-template-columns: minmax(160px, 1fr) minmax(160px, 1fr) minmax(160px, 1fr) 6fr;' : 'grid-template-columns: minmax(160px, 1fr) minmax(200px, 1fr) 6fr;', ";grid-row-gap:0;}" + ( true ? "" : 0));

const QuickTraceContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ej1eqv62"
} : 0)("grid-column:1/4;@media (min-width: ", p => p.theme.breakpoints.large, "){justify-self:flex-end;min-width:325px;grid-column:unset;}" + ( true ? "" : 0));

function EventID(_ref2) {
  let {
    event
  } = _ref2;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_clipboard__WEBPACK_IMPORTED_MODULE_4__["default"], {
    value: event.eventID,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(EventIDContainer, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(EventIDWrapper, {
        children: (0,sentry_utils_events__WEBPACK_IMPORTED_MODULE_13__.getShortEventId)(event.eventID)
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_8__["default"], {
        title: event.eventID,
        position: "top",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconCopy, {
          color: "subText"
        })
      })]
    })
  });
}

EventID.displayName = "EventID";

const EventIDContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ej1eqv61"
} : 0)( true ? {
  name: "1uoamx5",
  styles: "display:flex;align-items:center;cursor:pointer"
} : 0);

const EventIDWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "ej1eqv60"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";" + ( true ? "" : 0));

function HttpStatus(_ref3) {
  let {
    event
  } = _ref3;
  const {
    tags
  } = event;

  const emptyStatus = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
    children: '\u2014'
  });

  if (!Array.isArray(tags)) {
    return emptyStatus;
  }

  const tag = tags.find(tagObject => tagObject.key === 'http.status_code');

  if (!tag) {
    return emptyStatus;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
    children: ["HTTP ", tag.value]
  });
}

HttpStatus.displayName = "HttpStatus";

/*
  TODO: Ash
  I put this in place as a temporary patch to prevent successful frontend transactions from being set as 'unknown', which is what Relay sets by default
  if there is no status set by the SDK. In the future, the possible statuses will be revised and frontend transactions should properly have a status set.
  When that change is implemented, this function can simply be replaced with:

  event.contexts?.trace?.status ?? '\u2014';
*/
function getStatusBodyText(project, event, meta) {
  var _event$contexts, _event$contexts$trace, _event$contexts$trace2, _event$contexts2, _event$contexts2$trac;

  const isFrontendProject = sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_9__.frontend.some(val => val === (project === null || project === void 0 ? void 0 : project.platform));

  if (isFrontendProject && meta && meta.errors === 0 && ((_event$contexts = event.contexts) === null || _event$contexts === void 0 ? void 0 : (_event$contexts$trace = _event$contexts.trace) === null || _event$contexts$trace === void 0 ? void 0 : _event$contexts$trace.status) === 'unknown') {
    return 'ok';
  }

  return (_event$contexts$trace2 = (_event$contexts2 = event.contexts) === null || _event$contexts2 === void 0 ? void 0 : (_event$contexts2$trac = _event$contexts2.trace) === null || _event$contexts2$trac === void 0 ? void 0 : _event$contexts2$trac.status) !== null && _event$contexts$trace2 !== void 0 ? _event$contexts$trace2 : '\u2014';
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EventMetas);

/***/ }),

/***/ "./app/views/performance/transactionDetails/quickTraceMeta.tsx":
/*!*********************************************************************!*\
  !*** ./app/views/performance/transactionDetails/quickTraceMeta.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "QuickTraceMetaBase": () => (/* binding */ QuickTraceMetaBase),
/* harmony export */   "default": () => (/* binding */ QuickTraceMeta)
/* harmony export */ });
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/acl/featureDisabled */ "./app/components/acl/featureDisabled.tsx");
/* harmony import */ var sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/errorBoundary */ "./app/components/errorBoundary.tsx");
/* harmony import */ var sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/hovercard */ "./app/components/hovercard.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_components_quickTrace__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/quickTrace */ "./app/components/quickTrace/index.tsx");
/* harmony import */ var sentry_components_quickTrace_utils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/quickTrace/utils */ "./app/components/quickTrace/utils.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_docs__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/docs */ "./app/utils/docs.tsx");
/* harmony import */ var sentry_utils_events__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/events */ "./app/utils/events.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var _styles__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./styles */ "./app/views/performance/transactionDetails/styles.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");

















function handleTraceLink(organization) {
  (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_10__.trackAnalyticsEvent)({
    eventKey: 'quick_trace.trace_id.clicked',
    eventName: 'Quick Trace: Trace ID clicked',
    organization_id: parseInt(organization.id, 10),
    source: 'events'
  });
}

function QuickTraceMeta(_ref) {
  var _event$contexts$trace, _event$contexts, _event$contexts$trace2;

  let {
    event,
    location,
    quickTrace,
    traceMeta,
    anchor,
    errorDest,
    transactionDest,
    project
  } = _ref;
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_13__["default"])();
  const features = ['performance-view'];
  const noFeatureMessage = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Requires performance monitoring.');
  const docsLink = (0,sentry_utils_docs__WEBPACK_IMPORTED_MODULE_11__.getConfigureTracingDocsLink)(project);
  const traceId = (_event$contexts$trace = (_event$contexts = event.contexts) === null || _event$contexts === void 0 ? void 0 : (_event$contexts$trace2 = _event$contexts.trace) === null || _event$contexts$trace2 === void 0 ? void 0 : _event$contexts$trace2.trace_id) !== null && _event$contexts$trace !== void 0 ? _event$contexts$trace : null;
  const traceTarget = (0,sentry_components_quickTrace_utils__WEBPACK_IMPORTED_MODULE_8__.generateTraceTarget)(event, organization);
  let body;
  let footer;

  if (!traceId || !quickTrace || quickTrace.trace === null) {
    // this platform doesn't support performance don't show anything here
    if (docsLink === null) {
      return null;
    }

    body = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Missing Trace'); // need to configure tracing

    footer = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_4__["default"], {
      href: docsLink,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Read the docs')
    });
  } else {
    if (quickTrace.isLoading) {
      body = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_6__["default"], {
        height: "24px"
      });
    } else if (quickTrace.error) {
      body = '\u2014';
    } else {
      body = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_2__["default"], {
        mini: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_quickTrace__WEBPACK_IMPORTED_MODULE_7__["default"], {
          event: event,
          quickTrace: {
            type: quickTrace.type,
            trace: quickTrace.trace
          },
          location: location,
          organization: organization,
          anchor: anchor,
          errorDest: errorDest,
          transactionDest: transactionDest
        })
      });
    }

    footer = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__["default"], {
      to: traceTarget,
      onClick: () => handleTraceLink(organization),
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)('View Full Trace: [id][events]', {
        id: (0,sentry_utils_events__WEBPACK_IMPORTED_MODULE_12__.getShortEventId)(traceId !== null && traceId !== void 0 ? traceId : ''),
        events: traceMeta ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tn)(' (%s event)', ' (%s events)', traceMeta.transactions + traceMeta.errors) : ''
      })
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_0__["default"], {
    hookName: "feature-disabled:performance-quick-trace",
    features: features,
    children: _ref2 => {
      let {
        hasFeature
      } = _ref2;

      // also need to enable the performance feature
      if (!hasFeature) {
        footer = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_3__.Hovercard, {
          body: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_1__["default"], {
            features: features,
            hideHelpToggle: true,
            message: noFeatureMessage,
            featureName: noFeatureMessage
          }),
          children: footer
        });
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(QuickTraceMetaBase, {
        body: body,
        footer: footer
      });
    }
  });
}
QuickTraceMeta.displayName = "QuickTraceMeta";
function QuickTraceMetaBase(_ref3) {
  let {
    body,
    footer
  } = _ref3;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_14__.MetaData, {
    headingText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Trace Navigator'),
    tooltipText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('An abbreviated version of the full trace. Related frontend and backend services can be added to provide further visibility.'),
    bodyText: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("div", {
      "data-test-id": "quick-trace-body",
      children: body
    }),
    subtext: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("div", {
      "data-test-id": "quick-trace-footer",
      children: footer
    })
  });
}
QuickTraceMetaBase.displayName = "QuickTraceMetaBase";

/***/ }),

/***/ "./app/views/performance/transactionDetails/styles.tsx":
/*!*************************************************************!*\
  !*** ./app/views/performance/transactionDetails/styles.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "MetaData": () => (/* binding */ MetaData),
/* harmony export */   "SectionSubtext": () => (/* binding */ SectionSubtext)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/featureBadge */ "./app/components/featureBadge.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }







function MetaData(_ref) {
  let {
    headingText,
    tooltipText,
    bodyText,
    subtext,
    badge
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(HeaderInfo, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(StyledSectionHeading, {
      children: [headingText, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_3__["default"], {
        position: "top",
        size: "sm",
        containerDisplayMode: "block",
        title: tooltipText
      }), badge && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(StyledFeatureBadge, {
        type: badge
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(SectionBody, {
      children: bodyText
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(SectionSubtext, {
      children: subtext
    })]
  });
}
MetaData.displayName = "MetaData";

const HeaderInfo = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eqz9f144"
} : 0)( true ? {
  name: "4ks2md",
  styles: "height:78px"
} : 0);

const StyledSectionHeading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_1__.SectionHeading,  true ? {
  target: "eqz9f143"
} : 0)( true ? {
  name: "ti75j2",
  styles: "margin:0"
} : 0);

const SectionBody = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eqz9f142"
} : 0)("font-size:", p => p.theme.fontSizeExtraLarge, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(0.5), " 0;max-height:32px;" + ( true ? "" : 0));

const StyledFeatureBadge = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_2__["default"],  true ? {
  target: "eqz9f141"
} : 0)( true ? {
  name: "ti75j2",
  styles: "margin:0"
} : 0);

const SectionSubtext = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eqz9f140"
} : 0)("color:", p => p.type === 'error' ? p.theme.error : p.theme.subText, ";font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

/***/ }),

/***/ "../node_modules/lodash/_charsStartIndex.js":
/*!**************************************************!*\
  !*** ../node_modules/lodash/_charsStartIndex.js ***!
  \**************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseIndexOf = __webpack_require__(/*! ./_baseIndexOf */ "../node_modules/lodash/_baseIndexOf.js");

/**
 * Used by `_.trim` and `_.trimStart` to get the index of the first string symbol
 * that is not found in the character symbols.
 *
 * @private
 * @param {Array} strSymbols The string symbols to inspect.
 * @param {Array} chrSymbols The character symbols to find.
 * @returns {number} Returns the index of the first unmatched string symbol.
 */
function charsStartIndex(strSymbols, chrSymbols) {
  var index = -1,
      length = strSymbols.length;

  while (++index < length && baseIndexOf(chrSymbols, strSymbols[index], 0) > -1) {}
  return index;
}

module.exports = charsStartIndex;


/***/ }),

/***/ "../node_modules/lodash/trimStart.js":
/*!*******************************************!*\
  !*** ../node_modules/lodash/trimStart.js ***!
  \*******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseToString = __webpack_require__(/*! ./_baseToString */ "../node_modules/lodash/_baseToString.js"),
    castSlice = __webpack_require__(/*! ./_castSlice */ "../node_modules/lodash/_castSlice.js"),
    charsStartIndex = __webpack_require__(/*! ./_charsStartIndex */ "../node_modules/lodash/_charsStartIndex.js"),
    stringToArray = __webpack_require__(/*! ./_stringToArray */ "../node_modules/lodash/_stringToArray.js"),
    toString = __webpack_require__(/*! ./toString */ "../node_modules/lodash/toString.js");

/** Used to match leading whitespace. */
var reTrimStart = /^\s+/;

/**
 * Removes leading whitespace or specified characters from `string`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category String
 * @param {string} [string=''] The string to trim.
 * @param {string} [chars=whitespace] The characters to trim.
 * @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
 * @returns {string} Returns the trimmed string.
 * @example
 *
 * _.trimStart('  abc  ');
 * // => 'abc  '
 *
 * _.trimStart('-_-abc-_-', '_-');
 * // => 'abc-_-'
 */
function trimStart(string, chars, guard) {
  string = toString(string);
  if (string && (guard || chars === undefined)) {
    return string.replace(reTrimStart, '');
  }
  if (!string || !(chars = baseToString(chars))) {
    return string;
  }
  var strSymbols = stringToArray(string),
      start = charsStartIndex(strSymbols, stringToArray(chars));

  return castSlice(strSymbols, start).join('');
}

module.exports = trimStart;


/***/ }),

/***/ "./images/dashboard/widget-area.svg":
/*!******************************************!*\
  !*** ./images/dashboard/widget-area.svg ***!
  \******************************************/
/***/ ((module) => {

"use strict";
module.exports = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTU5IiBoZWlnaHQ9IjgxIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik0wIDBoMTU3djc5SDB6Ii8+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xNTggM0gzdjc3aDE1NVYzek0yIDJ2NzloMTU3VjJIMnoiIGZpbGw9IiM0NDQ2NzQiLz48cmVjdCB4PSI5IiB5PSIxMCIgd2lkdGg9IjI5IiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjRDREMUVDIi8+PHBhdGggZD0iTTExLjI2MiA1NS42N2wtMS42MjguNjRhMSAxIDAgMDAtLjYzNC45M1Y3My41aDE0MVY0OS40NmExIDEgMCAwMC0xLjYxNC0uNzlsLTEuNDAzIDEuMDkxYTEuMDE1IDEuMDE1IDAgMDEtLjIyNC4xMzJsLTIuMTguOTI1YTEgMSAwIDAxLS45NjgtLjEwNGwtMi4xMjgtMS41MDRhLjk5OC45OTggMCAwMC0uNTE0LS4xODJsLTIuNTMxLS4xNTktMi4xMTYuMTMzYTEuMDAxIDEuMDAxIDAgMDEtLjk3OS0uNTk2bC0yLjI1Mi01LjEyOGExIDEgMCAwMC0uOTc4LS41OTZsLTIuMTE3LjEzMy0yLjgxMy4wNDQtMi4wMzMuMTZhMSAxIDAgMDEtMS4wMjgtLjY4M2wtMi40NzktNy40NzVhMSAxIDAgMDAtLjMwMi0uNDQ4bC0yLjMxNi0xLjk2NGExLjAwMyAxLjAwMyAwIDAxLS4zNDEtLjYxbC0xLjU3NC0xMC4xODVjLS4xNzktMS4xNTktMS44NjItMS4xMTctMS45ODMuMDVsLTEuOTYxIDE4Ljg4MWExIDEgMCAwMS0uNDkzLjc2MmwtMi4wODIgMS4yMWEuOTk4Ljk5OCAwIDAxLS42MjcuMTI3bC0xLjc4NC0uMjI0YTEgMSAwIDAwLTEuMDE0LjUzNWwtMi4wMDIgMy44OTlhMSAxIDAgMDEtMS40MTIuMzk2bC0xLjUyMS0uOTMyYTEgMSAwIDAwLS43OTQtLjExbC0yLjE1Ny42MWEuOTk5Ljk5OSAwIDAwLS40MTQuMjM1bC0yLjYzNiAyLjQ4My0yLjU3MiAxLjk4YTEgMSAwIDAxLS41NDcuMjA1bC0yLjM2LjE0OGExIDEgMCAwMS0uMjkzLS4wMjRsLTIuMDE3LS40NzVhMSAxIDAgMDEtLjc1OC0uODE2bC0yLjcwOS0xNi45NzItMS40MTQtNS41NTRjLS4yNzYtMS4wODQtMS44NTMtLjk2Ni0xLjk2NC4xNDdsLTIuMDQgMjAuMzgxYTEgMSAwIDAxLTEuNjk5LjYxMWwtLjkzLS45MmExIDEgMCAwMC0uOTMzLS4yNjNsLTIuMjc1LjUzNi0yLjgxNC4zNTQtMi40NDUuMDc2YTEgMSAwIDAxLS42NTctLjIxOWwtMS43OTgtMS40NGExIDEgMCAwMC0xLjM2LjEwMmwtMi4wMyAyLjIwMWExIDEgMCAwMS0uMzU3LjI0OGwtMi4xODcuODkzYTEgMSAwIDAxLS44MjgtLjAzM2wtMi4yMzItMS4xMjJhMSAxIDAgMDAtLjM3LS4xMDNsLTIuNDQ4LS4xOTJhMS4wMDEgMS4wMDEgMCAwMC0uMzM3LjAzbC0xLjU3Ny40MjJhMSAxIDAgMDEtMS4yNDUtLjgxbC0xLjUwNy05LjQ2Yy0uMTc4LTEuMTE0LTEuNzc3LTEuMTI4LTEuOTczLS4wMTdsLTEuODMzIDEwLjM5MWExIDEgMCAwMS0uOTUzLjgyNmwtMS44MDMuMDU3YTEgMSAwIDAxLS4zODQtLjA2NGwtMi40MjctLjkxNWEuOTk5Ljk5OSAwIDAwLS40MTYtLjA2MmwtMi41MDUuMTU3YTEuMDAyIDEuMDAyIDAgMDEtLjE4OC0uMDA2bC0yLjU1LS4zMmExIDEgMCAwMS0uMzI0LS4wOTlsLTIuMTU2LTEuMDg0YTEgMSAwIDAwLS45ODEuMDQ3bC0yLjI0NiAxLjQxYTEgMSAwIDAxLS4xOTIuMDk0bC0yLjcxMy45OC0yLjYzNS43ODdhLjk5OS45OTkgMCAwMS0uMzY0LjAzOGwtMi4zMTEtLjE4MWExIDEgMCAwMS0uNTYyLS4yMjhsLTIuNDgtMi4wNjRhMS4wMDYgMS4wMDYgMCAwMC0uMTk0LS4xMjdsLTMuMTc4LTEuNTc3YTEgMSAwIDAwLTEuNDM2Ljc3bC0uODM0IDYuNTQ3YTEgMSAwIDAxLS42MjcuODA0eiIgZmlsbD0iIzdBNTA4OCIvPjwvc3ZnPg==";

/***/ }),

/***/ "./images/dashboard/widget-bar.svg":
/*!*****************************************!*\
  !*** ./images/dashboard/widget-bar.svg ***!
  \*****************************************/
/***/ ((module) => {

"use strict";
module.exports = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTU5IiBoZWlnaHQ9IjgxIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik0wIDBoMTU3djc5SDB6Ii8+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xNTggM0gzdjc3aDE1NVYzek0yIDJ2NzloMTU3VjJIMnoiIGZpbGw9IiM0NDQ2NzQiLz48cmVjdCB4PSI5IiB5PSIxMCIgd2lkdGg9IjI5IiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjRDREMUVDIi8+PHBhdGggZmlsbD0iI0I4NTU4NiIgZD0iTTE0MCA1MmgtOHYyMmg4ek0xMTggMzRoLTh2NDBoOHpNOTYgNDhoLTh2MjZoOHpNNzQgNDVoLTh2MjloOHpNNTIgMzRoLTh2NDBoOHpNMzAgNDVoLTh2MjloOHpNMTI5IDQ1aC04djI5aDh6TTE1MSAzOWgtOHYzNWg4ek0xMDcgMzloLTh2MzVoOHpNODUgMzloLTh2MzVoOHpNNjMgMzRoLTh2NDBoOHpNNDEgMjZoLTh2NDhoOHpNMTkgNTJoLTh2MjJoOHoiLz48L3N2Zz4=";

/***/ }),

/***/ "./images/dashboard/widget-big-number.svg":
/*!************************************************!*\
  !*** ./images/dashboard/widget-big-number.svg ***!
  \************************************************/
/***/ ((module) => {

"use strict";
module.exports = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTU5IiBoZWlnaHQ9IjQ2IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik0wIDBoMTU3djQ0SDB6Ii8+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xNTggM0gzLjV2NDJIMTU4VjN6TTIuNSAydjQ0SDE1OVYySDIuNXoiIGZpbGw9IiM0NDQ2NzQiLz48cmVjdCB4PSI5IiB5PSIxMCIgd2lkdGg9IjI5IiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjRDREMUVDIi8+PHBhdGggZmlsbD0iIzQ0NDY3NCIgZD0iTTkgMTloNjB2MTdIOXoiLz48L3N2Zz4=";

/***/ }),

/***/ "./images/dashboard/widget-line-1.svg":
/*!********************************************!*\
  !*** ./images/dashboard/widget-line-1.svg ***!
  \********************************************/
/***/ ((module) => {

"use strict";
module.exports = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTU5IiBoZWlnaHQ9IjgxIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik0wIDBoMTU3djc5SDB6Ii8+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xNTggM0gzdjc3aDE1NVYzek0yIDJ2NzloMTU3VjJIMnoiIGZpbGw9IiM0NDQ2NzQiLz48cmVjdCB4PSI5IiB5PSIxMCIgd2lkdGg9IjI5IiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjRDREMUVDIi8+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik00My4wNTYgMjEuNTg2Yy4wMjUuMDIxLjA2My4wNjQuMDcxLjE3M2wxLjk4IDI2LjQyMmMuMDM2LjQ4Mi4yNy45MjguNjQ3IDEuMjMybDIuMTIzIDEuNzFhMS43NSAxLjc1IDAgMDAxLjM5OS4zNjFsMS41NDctLjI2OWEuMjUuMjUgMCAwMS4yNzcuMTZsMi4wMjkgNS40NzZhMS43NSAxLjc1IDAgMDAyLjc3NC43MjdsMS4yNy0xLjA3OGEuMjUuMjUgMCAwMS4yNTItLjA0M2wxLjk5OC43ODNhLjI1LjI1IDAgMDEuMTA3LjA4MWwyLjY0NSAzLjQ1NS4wNDguMDU3IDIuNTUyIDIuNzIzYy4yOTUuMzE0LjY5NS41MDkgMS4xMjUuNTQ2bDIuMjMuMTk0Yy4yMzQuMDIuNDctLjAwNi42OTUtLjA4bDIuMDEtLjY1NmExLjc1IDEuNzUgMCAwMDEuMTk1LTEuNDY0bDIuNzM4LTIzLjc4MyAxLjM5My03LjU4MmMuMDE4LS4xMDIuMDU4LS4xNC4wODYtLjE2YS4yNzYuMjc2IDAgMDEuMTczLS4wNDUuMjc1LjI3NSAwIDAxLjE2OC4wNjNjLjAyNS4wMjMuMDYuMDY2LjA2OC4xNjlsMi4wNTIgMjguNDI0Yy4xMTggMS42MjYgMi4yIDIuMjIyIDMuMTYuOTA0bC43NzctMS4wNjZhLjI1LjI1IDAgMDEuMjgtLjA5bDIuMDU1LjY3MWMuMDguMDI2LjE2LjA0Ni4yNDMuMDZsMi43NDMuNDc5LjA5Ni4wMSAyLjM0My4xMDJhMS43NSAxLjc1IDAgMDAxLjM3Ny0uNTc3bDEuNjM2LTEuODE3YS4yNS4yNSAwIDAxLjM5NC4wMjhsMS45NjggMi45NTdjLjE1Mi4yMjkuMzU2LjQxOC41OTUuNTUzbDIuMDU4IDEuMTY2YTEuNzUgMS43NSAwIDAwMS44NjMtLjA4N2wyLjA4Ny0xLjQ1NWEuMjU1LjI1NSAwIDAxLjExNi0uMDQ0bDIuMzI2LS4yNTNhLjI1Mi4yNTIgMCAwMS4xMTQuMDE0bDEuMzk3LjUxOGExLjc1IDEuNzUgMCAwMDIuMzQ3LTEuNDQybDEuNTMtMTMuMzE5Yy4wMTItLjEwNC4wNDktLjE0NS4wNzYtLjE2N2EuMjczLjI3MyAwIDAxLjE3MS0uMDU0Yy4wNzYgMCAuMTM2LjAyMy4xNzIuMDUyLjAyNi4wMjEuMDY0LjA2My4wNzcuMTY2bDEuODYgMTQuNjE5YTEuNzUgMS43NSAwIDAwMS42NiAxLjUyN2wxLjcwMy4wNzVhMS43NSAxLjc1IDAgMDAuODg3LS4xOThsMi4zMTctMS4yMWEuMjQ5LjI0OSAwIDAxLjEzNy0uMDI4bDIuMzkzLjIwOGMuMTUxLjAxNC4zMDMuMDA3LjQ1Mi0uMDE5bDIuNDY4LS40M2MuMjUxLS4wNDMuNDktLjE0Mi43LS4yODhsMS45OTItMS4zODhhLjI1LjI1IDAgMDEuMzA3LjAxN2wyLjEzIDEuODU1Yy4xMTEuMDk3LjIzNC4xNzkuMzY1LjI0NWwyLjcwMSAxLjM1Mi4wNDkuMDIzIDIuNTc4IDEuMDY2Yy4yNzEuMTEyLjU2Ni4xNTQuODU4LjEyM2wyLjE2OS0uMjM2YTEuNzUgMS43NSAwIDAwMS4xMzMtLjU5NGwyLjQ3NC0yLjg1NGEuMjEyLjIxMiAwIDAxLjA0Ny0uMDQybDMuMDI5LTIuMDg1YS4yNS4yNSAwIDAxLjM5MS4xODNsLjg4MSA5LjU5M2MuMDU0LjU4Mi4zOTQgMS4wOTguOTA2IDEuMzc3bDIuMzQ1IDEuMjc3LjcxOC0xLjMxOC0yLjM0NS0xLjI3NmEuMjUuMjUgMCAwMS0uMTMtLjE5N2wtLjg4MS05LjU5M2MtLjEyMy0xLjMzMi0xLjYzMy0yLjA0LTIuNzM1LTEuMjgxbC0zLjAzIDIuMDg0YTEuNzUgMS43NSAwIDAwLS4zMy4yOTZsLTIuNDczIDIuODU0YS4yNDkuMjQ5IDAgMDEtLjE2Mi4wODRsLTIuMTY5LjIzNmEuMjUxLjI1MSAwIDAxLS4xMjMtLjAxN2wtMi41NTMtMS4wNTYtMi42NzYtMS4zNGEuMjQzLjI0MyAwIDAxLS4wNTItLjAzNWwtMi4xMy0xLjg1NWExLjc1IDEuNzUgMCAwMC0yLjE1LS4xMTZsLTEuOTkyIDEuMzg4YS4yNS4yNSAwIDAxLS4xLjA0bC0yLjQ2Ny40M2EuMjUxLjI1MSAwIDAxLS4wNjUuMDAzbC0yLjM5My0uMjA4YTEuNzUgMS43NSAwIDAwLS45NjIuMTkybC0yLjMxNyAxLjIxYS4yNDcuMjQ3IDAgMDEtLjEyNi4wMjlsLTEuNzA0LS4wNzRhLjI1LjI1IDAgMDEtLjIzNy0uMjE4bC0xLjg2LTE0LjYyYy0uMjYxLTIuMDUtMy4yMzgtMi4wMzItMy40NzQuMDIybC0xLjUzMSAxMy4zMmEuMjUuMjUgMCAwMS0uMzM1LjIwNWwtMS4zOTgtLjUxN2ExLjc0NyAxLjc0NyAwIDAwLS43OTYtLjA5OWwtMi4zMjYuMjUzYTEuNzUgMS43NSAwIDAwLS44MTEuMzA0bC0yLjA4OCAxLjQ1NWEuMjUuMjUgMCAwMS0uMjY2LjAxMmwtMi4wNTgtMS4xNjVhLjI1LjI1IDAgMDEtLjA4NS0uMDhsLTEuOTY4LTIuOTU2YTEuNzUgMS43NSAwIDAwLTIuNzU4LS4yMDFsLTEuNjM2IDEuODE3YS4yNS4yNSAwIDAxLS4xOTcuMDgzbC0yLjI5NC0uMS0yLjY5Ni0uNDdhLjI0MS4yNDEgMCAwMS0uMDM0LS4wMDlsLTIuMDU1LS42N2ExLjc1IDEuNzUgMCAwMC0xLjk1OC42MzJsLS43NzcgMS4wNjZhLjI1LjI1IDAgMDEtLjQ1MS0uMTNMNzguMTUyIDMwLjY1Yy0uMTQ4LTIuMDUtMy4wOTUtMi4yMS0zLjQ2Ny0uMTlsLTEuMzk3IDcuNjA3LS4wMDguMDUtMi43NCAyMy44MDhhLjI1LjI1IDAgMDEtLjE3LjIxbC0yLjAxMS42NTZhLjI0OC4yNDggMCAwMS0uMS4wMTFsLTIuMjI5LS4xOTRhLjI1LjI1IDAgMDEtLjE2LS4wNzhsLTIuNTI3LTIuNjk2LTIuNjIyLTMuNDI1YTEuNzUgMS43NSAwIDAwLS43NS0uNTY1bC0xLjk5OC0uNzgzYTEuNzUgMS43NSAwIDAwLTEuNzcyLjI5NWwtMS4yNyAxLjA3OGEuMjUuMjUgMCAwMS0uMzk1LS4xMDRsLTIuMDI5LTUuNDc3YTEuNzUgMS43NSAwIDAwLTEuOTQxLTEuMTE2bC0xLjU0OC4yN2EuMjUuMjUgMCAwMS0uMi0uMDUybC0yLjEyMy0xLjcxYS4yNS4yNSAwIDAxLS4wOTMtLjE3N2wtMS45OC0yNi40MmMtLjE1OC0yLjEyMS0zLjI0OC0yLjE3Ny0zLjQ4NC0uMDY0bC0xLjU5IDE0LjI3YS4yNS4yNSAwIDAxLS4wNTguMTM1bC0yLjQ2MSAyLjg5M2ExLjc1IDEuNzUgMCAwMC0uMzY5LjcyN2wtMi41NTMgMTAuNjczYS4yNS4yNSAwIDAxLS4yNy4xOWwtMS45MzgtLjIxLS4wNjUtLjAwNS0yLjc5LS4wNi0xLjk5MS0uMTc0YTEuNzUgMS43NSAwIDAwLTEuODIgMS4yMTVsLTIuMzMgNy4zNTZhLjI1LjI1IDAgMDEtLjI2LjE3NGwtMS45My0uMTY4YTEuNzUgMS43NSAwIDAwLS4zMDMgMGwtMi4zNy4yMDZhMS43NSAxLjc1IDAgMDAtMS4wNzMuNDk0bC0yLjAxIDEuOTdhLjI1LjI1IDAgMDEtLjMwMy4wMzdsLTIuMDI3LTEuMTkyYS4yNDguMjQ4IDAgMDEtLjA1Ny0uMDQ1bC0zLjAyLTMuMjU3LTEuMSAxLjAyIDMuMDIgMy4yNTdjLjExNi4xMjUuMjUuMjMyLjM5Ny4zMThsMi4wMjcgMS4xOTJhMS43NSAxLjc1IDAgMDAyLjExMi0uMjU4bDIuMDExLTEuOTdhLjI1LjI1IDAgMDEuMTUzLS4wNzFsMi4zNy0uMjA3YS4yNjIuMjYyIDAgMDEuMDQ0IDBsMS45MjkuMTY4YTEuNzUgMS43NSAwIDAwMS44Mi0xLjIxNWwyLjMzLTcuMzU2YS4yNS4yNSAwIDAxLjI2LS4xNzNsMi4wMTYuMTc1LjA0OC4wMDMgMi43ODIuMDYgMS45MDUuMjA4YTEuNzUgMS43NSAwIDAwMS44OTItMS4zMzNsMi41NTMtMTAuNjczYS4yNS4yNSAwIDAxLjA1My0uMTA0bDIuNDYtMi44OTNhMS43NSAxLjc1IDAgMDAuNDA2LS45NGwxLjU5MS0xNC4yN2MuMDEyLS4xMS4wNTEtLjE1LjA3Ny0uMTcxYS4yOC4yOCAwIDAxLjE3Ni0uMDUyYy4wNzkuMDAxLjE0LjAyOC4xNzUuMDU4eiIgZmlsbD0iIzQ0NDY3NCIvPjwvc3ZnPg==";

/***/ }),

/***/ "./images/dashboard/widget-table.svg":
/*!*******************************************!*\
  !*** ./images/dashboard/widget-table.svg ***!
  \*******************************************/
/***/ ((module) => {

"use strict";
module.exports = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTU5IiBoZWlnaHQ9IjgxIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0wIDBoMTU3djc5SDBWMHoiIGZpbGw9IiNmZmYiLz48cGF0aCBkPSJNOSAxMWExIDEgMCAwMTEtMWgyN2ExIDEgMCAxMTAgMkgxMGExIDEgMCAwMS0xLTF6IiBmaWxsPSIjRDREMUVDIi8+PHBhdGggZD0iTTEgMjBoMTU3djEzSDFWMjB6IiBmaWxsPSIjQzFCMkREIi8+PHBhdGggZD0iTTkgNDJhMSAxIDAgMDExLTFoNDBhMSAxIDAgMTEwIDJIMTBhMSAxIDAgMDEtMS0xeiIgZmlsbD0iI0Q0RDFFQyIvPjxwYXRoIGQ9Ik05IDI3YTEgMSAwIDAxMS0xaDQwYTEgMSAwIDExMCAySDEwYTEgMSAwIDAxLTEtMXpNMTIyIDI3YTEgMSAwIDAxMS0xaDI2YTEgMSAwIDAxMCAyaC0yNmExIDEgMCAwMS0xLTF6IiBmaWxsPSIjQTM5NkRBIi8+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xNTggM0gzdjc3aDE1NVYzem0xLTF2NzlIMlYyaDE1N3oiIGZpbGw9IiM0NDQ2NzQiLz48cGF0aCBkPSJNMTIyIDQyYTEgMSAwIDAxMS0xaDI2YTEgMSAwIDAxMCAyaC0yNmExIDEgMCAwMS0xLTF6TTkgNTFhMSAxIDAgMDExLTFoNDBhMSAxIDAgMTEwIDJIMTBhMSAxIDAgMDEtMS0xek0xMjIgNTFhMSAxIDAgMDExLTFoMjZhMSAxIDAgMDEwIDJoLTI2YTEgMSAwIDAxLTEtMXpNOSA2MGExIDEgMCAwMTEtMWg0MGExIDEgMCAxMTAgMkgxMGExIDEgMCAwMS0xLTF6TTEyMiA2MGExIDEgMCAwMTEtMWgyNmExIDEgMCAwMTAgMmgtMjZhMSAxIDAgMDEtMS0xek05IDY5YTEgMSAwIDAxMS0xaDQwYTEgMSAwIDExMCAySDEwYTEgMSAwIDAxLTEtMXpNMTIyIDY5YTEgMSAwIDAxMS0xaDI2YTEgMSAwIDAxMCAyaC0yNmExIDEgMCAwMS0xLTF6IiBmaWxsPSIjRDREMUVDIi8+PC9zdmc+";

/***/ }),

/***/ "./images/dashboard/widget-world-map.svg":
/*!***********************************************!*\
  !*** ./images/dashboard/widget-world-map.svg ***!
  \***********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";
module.exports = __webpack_require__.p + "assets/widget-world-map.b5c5097ff7a4945389d2.svg";

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_alertLink_tsx-app_components_events_eventCustomPerformanceMetrics_tsx-app_comp-f4801d.5438feb3e150b628d2cc84b03f547980.js.map