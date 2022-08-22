(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_admin_adminSettings_tsx"],{

/***/ "./app/views/admin/adminSettings.tsx":
/*!*******************************************!*\
  !*** ./app/views/admin/adminSettings.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AdminSettings)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_components_forms__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/forms */ "./app/components/forms/index.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var _options__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./options */ "./app/views/admin/options.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








const optionsAvailable = ['system.url-prefix', 'system.admin-email', 'system.support-email', 'system.security-email', 'system.rate-limit', 'auth.allow-registration', 'auth.ip-rate-limit', 'auth.user-rate-limit', 'api.rate-limit.org-create', 'beacon.anonymous'];
class AdminSettings extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_4__["default"] {
  get endpoint() {
    return '/internal/options/';
  }

  getEndpoints() {
    return [['data', this.endpoint]];
  }

  renderBody() {
    const {
      data
    } = this.state;
    const initialData = {};
    const fields = {};

    for (const key of optionsAvailable) {
      var _data$key;

      // TODO(dcramer): we should not be mutating options
      const option = (_data$key = data[key]) !== null && _data$key !== void 0 ? _data$key : {
        field: {},
        value: undefined
      };

      if (option.value === undefined || option.value === '') {
        const defn = (0,_options__WEBPACK_IMPORTED_MODULE_5__.getOption)(key);
        initialData[key] = defn.defaultValue ? defn.defaultValue() : '';
      } else {
        initialData[key] = option.value;
      }

      fields[key] = (0,_options__WEBPACK_IMPORTED_MODULE_5__.getOptionField)(key, option.field);
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("h3", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Settings')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(sentry_components_forms__WEBPACK_IMPORTED_MODULE_1__.Form, {
        apiMethod: "PUT",
        apiEndpoint: this.endpoint,
        initialData: initialData,
        saveOnBlur: true,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.Panel, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.PanelHeader, {
            children: "General"
          }), fields['system.url-prefix'], fields['system.admin-email'], fields['system.support-email'], fields['system.security-email'], fields['system.rate-limit']]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.Panel, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.PanelHeader, {
            children: "Security & Abuse"
          }), fields['auth.allow-registration'], fields['auth.ip-rate-limit'], fields['auth.user-rate-limit'], fields['api.rate-limit.org-create']]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.Panel, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.PanelHeader, {
            children: "Beacon"
          }), fields['beacon.anonymous']]
        })]
      })]
    });
  }

}

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


/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_admin_adminSettings_tsx.9747ce3759fb8398796e1a4c6b4f37a1.js.map