(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_admin_installWizard_index_tsx"],{

/***/ "./app/views/admin/installWizard/index.tsx":
/*!*************************************************!*\
  !*** ./app/views/admin/installWizard/index.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ InstallWizard)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_images_pattern_sentry_pattern_png__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry-images/pattern/sentry-pattern.png */ "./images/pattern/sentry-pattern.png");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_forms__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/forms */ "./app/components/forms/index.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var _options__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ../options */ "./app/views/admin/options.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }













class InstallWizard extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_9__["default"] {
  getEndpoints() {
    return [['data', '/internal/options/?query=is:required']];
  }

  renderFormFields() {
    const options = this.state.data;
    let missingOptions = new Set(Object.keys(options).filter(option => !options[option].field.isSet)); // This is to handle the initial installation case.
    // Even if all options are filled out, we want to prompt to confirm
    // them. This is a bit of a hack because we're assuming that
    // the backend only spit back all filled out options for
    // this case.

    if (missingOptions.size === 0) {
      missingOptions = new Set(Object.keys(options));
    } // A mapping of option name to Field object


    const fields = {};

    for (const key of missingOptions) {
      const option = options[key];

      if (option.field.disabled) {
        continue;
      }

      fields[key] = (0,_options__WEBPACK_IMPORTED_MODULE_10__.getOptionField)(key, option.field);
    }

    return (0,_options__WEBPACK_IMPORTED_MODULE_10__.getForm)(fields);
  }

  getInitialData() {
    const options = this.state.data;
    const data = {};
    Object.keys(options).forEach(optionName => {
      const option = options[optionName];

      if (option.field.disabled) {
        return;
      } // TODO(dcramer): we need to rethink this logic as doing multiple "is this value actually set"
      // is problematic
      // all values to their server-defaults (as client-side defaults don't really work)


      const displayValue = option.value || (0,_options__WEBPACK_IMPORTED_MODULE_10__.getOptionDefault)(optionName);

      if ( // XXX(dcramer): we need the user to explicitly choose beacon.anonymous
      // vs using an implied default so effectively this is binding
      optionName !== 'beacon.anonymous' && // XXX(byk): if we don't have a set value but have a default value filled
      // instead, from the client, set it on the data so it is sent to the server
      !option.field.isSet && displayValue !== undefined) {
        data[optionName] = displayValue;
      }
    });
    return data;
  }

  getTitle() {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Setup Sentry');
  }

  render() {
    const version = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_7__["default"].get('version');
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_5__["default"], {
      noSuffix: true,
      title: this.getTitle(),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(Wrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Pattern, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(SetupWizard, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(Heading, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)("span", {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Welcome to Sentry')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Version, {
              children: version.current
            })]
          }), this.state.loading ? this.renderLoading() : this.state.error ? this.renderError() : this.renderBody()]
        })]
      })
    });
  }

  renderError() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__["default"], {
      type: "error",
      showIcon: true,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('We were unable to load the required configuration from the Sentry server. Please take a look at the service logs.')
    });
  }

  renderBody() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(sentry_components_forms__WEBPACK_IMPORTED_MODULE_4__.ApiForm, {
      apiMethod: "PUT",
      apiEndpoint: this.getEndpoints()[0][1],
      submitLabel: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Continue'),
      initialData: this.getInitialData(),
      onSubmitSuccess: this.props.onConfigured,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Complete setup by filling out the required configuration.')
      }), this.renderFormFields()]
    });
  }

}
InstallWizard.displayName = "InstallWizard";

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1hin65u4"
} : 0)( true ? {
  name: "zl1inp",
  styles: "display:flex;justify-content:center"
} : 0);

const fixedStyle =  true ? {
  name: "yfl0u7",
  styles: "position:fixed;top:0;right:0;bottom:0;left:0"
} : 0;

const Pattern = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1hin65u3"
} : 0)("z-index:-1;&::before{", fixedStyle, " content:'';background-image:linear-gradient(\n      to right,\n      ", p => p.theme.purple200, " 0%,\n      ", p => p.theme.purple300, " 100%\n    );background-repeat:repeat-y;}&::after{", fixedStyle, " content:'';background:url(", sentry_images_pattern_sentry_pattern_png__WEBPACK_IMPORTED_MODULE_2__, ");background-size:400px;opacity:0.8;}" + ( true ? "" : 0));

const Heading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('h1',  true ? {
  target: "e1hin65u2"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";justify-content:space-between;grid-auto-flow:column;line-height:36px;" + ( true ? "" : 0));

const Version = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('small',  true ? {
  target: "e1hin65u1"
} : 0)("font-size:", p => p.theme.fontSizeExtraLarge, ";line-height:inherit;" + ( true ? "" : 0));

const SetupWizard = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1hin65u0"
} : 0)("background:", p => p.theme.background, ";border-radius:", p => p.theme.borderRadius, ";box-shadow:", p => p.theme.dropShadowHeavy, ";margin-top:40px;padding:40px 40px 20px;width:600px;z-index:", p => p.theme.zIndex.initial, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/admin/options.tsx":
/*!*************************************!*\
  !*** ./app/views/admin/options.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getForm": () => (/* binding */ getForm),
/* harmony export */   "getOption": () => (/* binding */ getOption),
/* harmony export */   "getOptionDefault": () => (/* binding */ getOptionDefault),
/* harmony export */   "getOptionField": () => (/* binding */ getOptionField)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var lodash_keyBy__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/keyBy */ "../node_modules/lodash/keyBy.js");
/* harmony import */ var lodash_keyBy__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_keyBy__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_forms__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/forms */ "./app/components/forms/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");








// This are ordered based on their display order visually
const sections = [{
  key: 'system'
}, {
  key: 'mail',
  heading: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Outbound email')
}, {
  key: 'auth',
  heading: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Authentication')
}, {
  key: 'beacon',
  heading: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Beacon')
}]; // This are ordered based on their display order visually

const definitions = [{
  key: 'system.url-prefix',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Root URL'),
  placeholder: 'https://sentry.example.com',
  help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('The root web address which is used to communicate with the Sentry backend.'),
  defaultValue: () => `${document.location.protocol}//${document.location.host}`
}, {
  key: 'system.admin-email',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Admin Email'),
  placeholder: 'admin@example.com',
  help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('The technical contact for this Sentry installation.'),
  // TODO(dcramer): this should not be hardcoded to a component
  component: sentry_components_forms__WEBPACK_IMPORTED_MODULE_2__.EmailField,
  defaultValue: () => sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_4__["default"].get('user').email
}, {
  key: 'system.support-email',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Support Email'),
  placeholder: 'support@example.com',
  help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('The support contact for this Sentry installation.'),
  // TODO(dcramer): this should not be hardcoded to a component
  component: sentry_components_forms__WEBPACK_IMPORTED_MODULE_2__.EmailField,
  defaultValue: () => sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_4__["default"].get('user').email
}, {
  key: 'system.security-email',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Security Email'),
  placeholder: 'security@example.com',
  help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('The security contact for this Sentry installation.'),
  // TODO(dcramer): this should not be hardcoded to a component
  component: sentry_components_forms__WEBPACK_IMPORTED_MODULE_2__.EmailField,
  defaultValue: () => sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_4__["default"].get('user').email
}, {
  key: 'system.rate-limit',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Rate Limit'),
  placeholder: 'e.g. 500',
  help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('The maximum number of events the system should accept per minute. A value of 0 will disable the default rate limit.')
}, {
  key: 'auth.allow-registration',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Allow Registration'),
  help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Allow anyone to create an account and access this Sentry installation.'),
  component: sentry_components_forms__WEBPACK_IMPORTED_MODULE_2__.BooleanField,
  defaultValue: () => false
}, {
  key: 'auth.ip-rate-limit',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('IP Rate Limit'),
  placeholder: 'e.g. 10',
  help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('The maximum number of times an authentication attempt may be made by a single IP address in a 60 second window.')
}, {
  key: 'auth.user-rate-limit',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('User Rate Limit'),
  placeholder: 'e.g. 10',
  help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('The maximum number of times an authentication attempt may be made against a single account in a 60 second window.')
}, {
  key: 'api.rate-limit.org-create',
  label: 'Organization Creation Rate Limit',
  placeholder: 'e.g. 5',
  help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('The maximum number of organizations which may be created by a single account in a one hour window.')
}, {
  key: 'beacon.anonymous',
  label: 'Usage Statistics',
  component: sentry_components_forms__WEBPACK_IMPORTED_MODULE_2__.RadioBooleanField,
  // yes and no are inverted here due to the nature of this configuration
  noLabel: 'Send my contact information along with usage statistics',
  yesLabel: 'Please keep my usage information anonymous',
  yesFirst: false,
  help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tct)('If enabled, any stats reported to sentry.io will exclude identifying information (such as your administrative email address). By anonymizing your installation the Sentry team will be unable to contact you about security updates. For more information on what data is sent to Sentry, see the [link:documentation].', {
    link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("a", {
      href: "https://develop.sentry.dev/self-hosted/"
    })
  })
}, {
  key: 'mail.from',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Email From'),
  component: sentry_components_forms__WEBPACK_IMPORTED_MODULE_2__.EmailField,
  defaultValue: () => `sentry@${document.location.hostname}`,
  help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Email address to be used in From for all outbound email.')
}, {
  key: 'mail.host',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('SMTP Host'),
  placeholder: 'localhost',
  defaultValue: () => 'localhost'
}, {
  key: 'mail.port',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('SMTP Port'),
  placeholder: '25',
  defaultValue: () => '25'
}, {
  key: 'mail.username',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('SMTP Username'),
  defaultValue: () => ''
}, {
  key: 'mail.password',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('SMTP Password'),
  // TODO(mattrobenolt): We don't want to use a real password field unless
  // there's a way to reveal it. Without being able to see the password, it's
  // impossible to confirm if it's right.
  // component: PasswordField,
  defaultValue: () => ''
}, {
  key: 'mail.use-tls',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Use STARTTLS? (exclusive with SSL)'),
  component: sentry_components_forms__WEBPACK_IMPORTED_MODULE_2__.BooleanField,
  defaultValue: () => false
}, {
  key: 'mail.use-ssl',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Use SSL? (exclusive with STARTTLS)'),
  component: sentry_components_forms__WEBPACK_IMPORTED_MODULE_2__.BooleanField,
  defaultValue: () => false
}];
const definitionsMap = lodash_keyBy__WEBPACK_IMPORTED_MODULE_1___default()(definitions, def => def.key);
const disabledReasons = {
  diskPriority: 'This setting is defined in config.yml and may not be changed via the web UI.',
  smtpDisabled: 'SMTP mail has been disabled, so this option is unavailable'
};
function getOption(option) {
  return definitionsMap[option];
}
function getOptionDefault(option) {
  const meta = getOption(option);
  return meta.defaultValue ? meta.defaultValue() : undefined;
}

function optionsForSection(section) {
  return definitions.filter(option => option.key.split('.')[0] === section.key);
}

function getOptionField(option, field) {
  const meta = { ...getOption(option),
    ...field
  };
  const Field = meta.component || sentry_components_forms__WEBPACK_IMPORTED_MODULE_2__.TextField;
  return (0,_emotion_react__WEBPACK_IMPORTED_MODULE_6__.createElement)(Field, { ...meta,
    name: option,
    key: option,
    defaultValue: getOptionDefault(option),
    required: meta.required && !meta.allowEmpty,
    disabledReason: meta.disabledReason && disabledReasons[meta.disabledReason]
  });
}
getOptionField.displayName = "getOptionField";

function getSectionFieldSet(section, fields) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("fieldset", {
    children: [section.heading && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("legend", {
      children: section.heading
    }), fields]
  }, section.key);
}

getSectionFieldSet.displayName = "getSectionFieldSet";
function getForm(fieldMap) {
  const sets = [];

  for (const section of sections) {
    const set = [];

    for (const option of optionsForSection(section)) {
      if (fieldMap[option.key]) {
        set.push(fieldMap[option.key]);
      }
    }

    if (set.length) {
      sets.push(getSectionFieldSet(section, set));
    }
  }

  return sets;
}

/***/ }),

/***/ "./app/views/asyncView.tsx":
/*!*********************************!*\
  !*** ./app/views/asyncView.tsx ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AsyncView)
/* harmony export */ });
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



class AsyncView extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_0__["default"] {
  getTitle() {
    return '';
  }

  render() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_1__["default"], {
      title: this.getTitle(),
      children: this.renderComponent()
    });
  }

}
AsyncView.displayName = "AsyncView";

/***/ }),

/***/ "../node_modules/lodash/keyBy.js":
/*!***************************************!*\
  !*** ../node_modules/lodash/keyBy.js ***!
  \***************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseAssignValue = __webpack_require__(/*! ./_baseAssignValue */ "../node_modules/lodash/_baseAssignValue.js"),
    createAggregator = __webpack_require__(/*! ./_createAggregator */ "../node_modules/lodash/_createAggregator.js");

/**
 * Creates an object composed of keys generated from the results of running
 * each element of `collection` thru `iteratee`. The corresponding value of
 * each key is the last element responsible for generating the key. The
 * iteratee is invoked with one argument: (value).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Collection
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Function} [iteratee=_.identity] The iteratee to transform keys.
 * @returns {Object} Returns the composed aggregate object.
 * @example
 *
 * var array = [
 *   { 'dir': 'left', 'code': 97 },
 *   { 'dir': 'right', 'code': 100 }
 * ];
 *
 * _.keyBy(array, function(o) {
 *   return String.fromCharCode(o.code);
 * });
 * // => { 'a': { 'dir': 'left', 'code': 97 }, 'd': { 'dir': 'right', 'code': 100 } }
 *
 * _.keyBy(array, 'dir');
 * // => { 'left': { 'dir': 'left', 'code': 97 }, 'right': { 'dir': 'right', 'code': 100 } }
 */
var keyBy = createAggregator(function(result, value, key) {
  baseAssignValue(result, key, value);
});

module.exports = keyBy;


/***/ }),

/***/ "./images/pattern/sentry-pattern.png":
/*!*******************************************!*\
  !*** ./images/pattern/sentry-pattern.png ***!
  \*******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";
module.exports = __webpack_require__.p + "assets/sentry-pattern.1fdeb8da7eb86954da80.png";

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_admin_installWizard_index_tsx.705b934eddb5d1d28a91868b83ca2b8c.js.map