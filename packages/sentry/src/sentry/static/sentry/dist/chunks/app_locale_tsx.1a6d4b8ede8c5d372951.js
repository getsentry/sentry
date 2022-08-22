"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_locale_tsx"],{

/***/ "./app/locale.tsx":
/*!************************!*\
  !*** ./app/locale.tsx ***!
  \************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DEFAULT_LOCALE_DATA": () => (/* binding */ DEFAULT_LOCALE_DATA),
/* harmony export */   "format": () => (/* binding */ format),
/* harmony export */   "gettext": () => (/* binding */ gettext),
/* harmony export */   "gettextComponentTemplate": () => (/* binding */ gettextComponentTemplate),
/* harmony export */   "ngettext": () => (/* binding */ ngettext),
/* harmony export */   "parseComponentTemplate": () => (/* binding */ parseComponentTemplate),
/* harmony export */   "renderTemplate": () => (/* binding */ renderTemplate),
/* harmony export */   "setLocale": () => (/* binding */ setLocale),
/* harmony export */   "setLocaleDebug": () => (/* binding */ setLocaleDebug),
/* harmony export */   "t": () => (/* binding */ gettext),
/* harmony export */   "tct": () => (/* binding */ gettextComponentTemplate),
/* harmony export */   "tn": () => (/* binding */ ngettext),
/* harmony export */   "toggleLocaleDebug": () => (/* binding */ toggleLocaleDebug)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var jed__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! jed */ "../node_modules/jed/jed.js");
/* harmony import */ var jed__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(jed__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var lodash_isObject__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/isObject */ "../node_modules/lodash/isObject.js");
/* harmony import */ var lodash_isObject__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_isObject__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var lodash_isString__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/isString */ "../node_modules/lodash/isString.js");
/* harmony import */ var lodash_isString__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_isString__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var sprintf_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sprintf-js */ "../node_modules/sprintf-js/src/sprintf.js");
/* harmony import */ var sprintf_js__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(sprintf_js__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/localStorage */ "./app/utils/localStorage.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











const markerStyles = {
  background: '#ff801790',
  outline: '2px solid #ff801790'
};
const LOCALE_DEBUG = sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_8__["default"].getItem('localeDebug') === '1';
const DEFAULT_LOCALE_DATA = {
  '': {
    domain: 'sentry',
    lang: 'en',
    plural_forms: 'nplurals=2; plural=(n != 1);'
  }
};
function setLocaleDebug(value) {
  sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_8__["default"].setItem('localeDebug', value ? '1' : '0'); // eslint-disable-next-line no-console

  console.log(`Locale debug is: ${value ? 'on' : 'off'}. Reload page to apply changes!`);
}
/**
 * Toggles the locale debug flag in local storage, but does _not_ reload the
 * page. The caller should do this.
 */

function toggleLocaleDebug() {
  const currentValue = sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_8__["default"].getItem('localeDebug');
  setLocaleDebug(currentValue !== '1');
}
/**
 * Global Jed locale object loaded with translations via setLocale
 */

let i18n = null;
/**
 * Set the current application locale.
 *
 * NOTE: This MUST be called early in the application before calls to any
 * translation functions, as this mutates a singleton translation object used
 * to lookup translations at runtime.
 */

function setLocale(translations) {
  i18n = new (jed__WEBPACK_IMPORTED_MODULE_4___default())({
    domain: 'sentry',
    missing_key_callback: () => {},
    locale_data: {
      sentry: translations
    }
  });
  return i18n;
}

/**
 * Helper to return the i18n client, and initialize for the default locale (English)
 * if it has otherwise not been initialized.
 */
function getClient() {
  if (!i18n) {
    // If this happens, it could mean that an import was added/changed where
    // locale initialization does not happen soon enough.
    const warning = new Error('Locale not set, defaulting to English');
    console.error(warning); // eslint-disable-line no-console

    _sentry_react__WEBPACK_IMPORTED_MODULE_9__.captureException(warning);
    return setLocale(DEFAULT_LOCALE_DATA);
  }

  return i18n;
}
/**
 * printf style string formatting which render as react nodes.
 */


function formatForReact(formatString, args) {
  const nodes = [];
  let cursor = 0; // always re-parse, do not cache, because we change the match

  sprintf_js__WEBPACK_IMPORTED_MODULE_7__.sprintf.parse(formatString).forEach((match, idx) => {
    if (lodash_isString__WEBPACK_IMPORTED_MODULE_6___default()(match)) {
      nodes.push(match);
      return;
    }

    let arg = null;

    if (match[2]) {
      arg = args[0][match[2][0]];
    } else if (match[1]) {
      arg = args[parseInt(match[1], 10) - 1];
    } else {
      arg = args[cursor++];
    } // this points to a react element!


    if ( /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_3__.isValidElement)(arg)) {
      nodes.push( /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_3__.cloneElement)(arg, {
        key: idx
      }));
    } else {
      // Not a react element, massage it so that sprintf.format can format it
      // for us.  We make sure match[2] is null so that we do not go down the
      // object path, and we set match[1] to the first index and then pass an
      // array with two items in.
      match[2] = null;
      match[1] = 1;
      nodes.push((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("span", {
        children: sprintf_js__WEBPACK_IMPORTED_MODULE_7__.sprintf.format([match], [null, arg])
      }, idx++));
    }
  });
  return nodes;
}
/**
 * Determine if any arguments include React elements.
 */


function argsInvolveReact(args) {
  if (args.some(react__WEBPACK_IMPORTED_MODULE_3__.isValidElement)) {
    return true;
  }

  if (args.length !== 1 || !lodash_isObject__WEBPACK_IMPORTED_MODULE_5___default()(args[0])) {
    return false;
  }

  const componentMap = args[0];
  return Object.keys(componentMap).some(key => /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_3__.isValidElement)(componentMap[key]));
}
/**
 * Parse template strings will be parsed into an array of TemplateSubvalue's,
 * this represents either a portion of the string, or a object with the group
 * key indicating the group to lookup the group value in.
 */


/**
 * Parses a template string into groups.
 *
 * The top level group will be keyed as `root`. All other group names will have
 * been extracted from the template string.
 */
function parseComponentTemplate(template) {
  const parsed = {};

  function process(startPos, group, inGroup) {
    const regex = /\[(.*?)(:|\])|\]/g;
    const buf = [];
    let satisfied = false;
    let match;
    let pos = regex.lastIndex = startPos; // eslint-disable-next-line no-cond-assign

    while ((match = regex.exec(template)) !== null) {
      const substr = template.substr(pos, match.index - pos);

      if (substr !== '') {
        buf.push(substr);
      }

      const [fullMatch, groupName, closeBraceOrValueSeparator] = match;

      if (fullMatch === ']') {
        if (inGroup) {
          satisfied = true;
          break;
        } else {
          pos = regex.lastIndex;
          continue;
        }
      }

      if (closeBraceOrValueSeparator === ']') {
        pos = regex.lastIndex;
      } else {
        pos = regex.lastIndex = process(regex.lastIndex, groupName, true);
      }

      buf.push({
        group: groupName
      });
    }

    let endPos = regex.lastIndex;

    if (!satisfied) {
      const rest = template.substr(pos);

      if (rest) {
        buf.push(rest);
      }

      endPos = template.length;
    }

    parsed[group] = buf;
    return endPos;
  }

  process(0, 'root', false);
  return parsed;
}
/**
 * Renders a parsed template into a React tree given a ComponentMap to use for
 * the parsed groups.
 */

function renderTemplate(template, components) {
  let idx = 0;

  function renderGroup(groupKey) {
    var _components$groupKey;

    const children = [];
    const group = template[groupKey] || [];

    for (const item of group) {
      if (lodash_isString__WEBPACK_IMPORTED_MODULE_6___default()(item)) {
        children.push((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("span", {
          children: item
        }, idx++));
      } else {
        children.push(renderGroup(item.group));
      }
    } // In case we cannot find our component, we call back to an empty
    // span so that stuff shows up at least.


    let reference = (_components$groupKey = components[groupKey]) !== null && _components$groupKey !== void 0 ? _components$groupKey : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("span", {}, idx++);

    if (! /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_3__.isValidElement)(reference)) {
      reference = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("span", {
        children: reference
      }, idx++);
    }

    const element = reference;
    return children.length === 0 ? /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_3__.cloneElement)(element, {
      key: idx++
    }) : /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_3__.cloneElement)(element, {
      key: idx++
    }, children);
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
    children: renderGroup('root')
  });
}
renderTemplate.displayName = "renderTemplate";

/**
 * mark is used to debug translations by visually marking translated strings.
 *
 * NOTE: This is a no-op and will return the node if LOCALE_DEBUG is not
 * currently enabled. See setLocaleDebug and toggleLocaleDebug.
 */
function mark(node) {
  if (!LOCALE_DEBUG) {
    return node;
  } // TODO(epurkhiser): Explain why we manually create a react node and assign
  // the toString function. This could likely also use better typing, but will
  // require some understanding of reacts internal types.


  const proxy = {
    $$typeof: Symbol.for('react.element'),
    type: 'span',
    key: null,
    ref: null,
    props: {
      style: markerStyles,
      children: Array.isArray(node) ? node : [node]
    },
    _owner: null,
    _store: {}
  };

  proxy.toString = () => '✅' + node + '✅';

  return proxy;
}
/**
 * sprintf style string formatting. Does not handle translations.
 *
 * See the sprintf-js library [0] for specifics on the argument
 * parameterization format.
 *
 * [0]: https://github.com/alexei/sprintf.js
 */


function format(formatString, args) {
  if (argsInvolveReact(args)) {
    return formatForReact(formatString, args);
  }

  return (0,sprintf_js__WEBPACK_IMPORTED_MODULE_7__.sprintf)(formatString, ...args);
}
/**
 * Translates a string to the current locale.
 *
 * See the sprintf-js library [0] for specifics on the argument
 * parameterization format.
 *
 * [0]: https://github.com/alexei/sprintf.js
 */

function gettext(string) {
  const val = getClient().gettext(string);

  for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    args[_key - 1] = arguments[_key];
  }

  if (args.length === 0) {
    return mark(val);
  } // XXX(ts): It IS possible to use gettext in such a way that it will return a
  // React.ReactNodeArray, however we currently rarely (if at all) use it in
  // this way, and usually just expect strings back.


  return mark(format(val, args));
}
/**
 * Translates a singular and plural string to the current locale. Supports
 * argument parameterization, and will use the first argument as the counter to
 * determine which message to use.
 *
 * See the sprintf-js library [0] for specifics on the argument
 * parameterization format.
 *
 * [0]: https://github.com/alexei/sprintf.js
 */

function ngettext(singular, plural) {
  for (var _len2 = arguments.length, args = new Array(_len2 > 2 ? _len2 - 2 : 0), _key2 = 2; _key2 < _len2; _key2++) {
    args[_key2 - 2] = arguments[_key2];
  }

  let countArg = 0;

  if (args.length > 0) {
    countArg = Math.abs(args[0]) || 0; // `toLocaleString` will render `999` as `"999"` but `9999` as `"9,999"`. This means that any call with `tn` or `ngettext` cannot use `%d` in the codebase but has to use `%s`.
    // This means a string is always being passed in as an argument, but `sprintf-js` implicitly coerces strings that can be parsed as integers into an integer.
    // This would break under any locale that used different formatting and other undesirable behaviors.

    if ((singular + plural).includes('%d')) {
      // eslint-disable-next-line no-console
      console.error(new Error('You should not use %d within tn(), use %s instead'));
    } else {
      args = [countArg.toLocaleString(), ...args.slice(1)];
    }
  } // XXX(ts): See XXX in gettext.


  return mark(format(getClient().ngettext(singular, plural, countArg), args));
}
/**
 * special form of gettext where you can render nested react components in
 * template strings.
 *
 * ```jsx
 * gettextComponentTemplate('Welcome. Click [link:here]', {
 *   root: <p/>,
 *   link: <a href="#" />,
 * });
 * ```
 *
 * The root string is always called "root", the rest is prefixed with the name
 * in the brackets
 *
 * You may recursively nest additional groups within the grouped string values.
 */

function gettextComponentTemplate(template, components) {
  const parsedTemplate = parseComponentTemplate(getClient().gettext(template));
  return mark(renderTemplate(parsedTemplate, components));
}
/**
 * Shorthand versions should primarily be used.
 */



/***/ }),

/***/ "./app/utils/createStorage.tsx":
/*!*************************************!*\
  !*** ./app/utils/createStorage.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ createStorage)
/* harmony export */ });
// Noop storage for instances where storage is not available
const noopStorage = {
  length: 0,

  // Returns null if index does not exist:
  // https://developer.mozilla.org/en-US/docs/Web/API/Storage/key
  key(_index) {
    return null;
  },

  setItem() {
    return;
  },

  clear() {
    return undefined;
  },

  // Returns null if key doesn't exist:
  // https://developer.mozilla.org/en-US/docs/Web/API/Storage/getItem
  getItem() {
    return null;
  },

  removeItem() {
    return null;
  }

}; // Returns a storage wrapper by trying to perform a single storage op.
// This asserts that storage is both available and that it can be used.
// See https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API

const STORAGE_TEST_KEY = 'sentry';
function createStorage(getStorage) {
  try {
    const storage = getStorage(); // Test if a value can be set into the storage.
    // This can fail in cases where storage may be full or not available.

    storage.setItem(STORAGE_TEST_KEY, STORAGE_TEST_KEY);
    storage.removeItem(STORAGE_TEST_KEY); // If we can set and remove a value, we can use it.

    return storage;
  } catch (e) {
    return noopStorage;
  }
}

/***/ }),

/***/ "./app/utils/localStorage.tsx":
/*!************************************!*\
  !*** ./app/utils/localStorage.tsx ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _createStorage__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./createStorage */ "./app/utils/createStorage.tsx");

const Storage = (0,_createStorage__WEBPACK_IMPORTED_MODULE_0__["default"])(() => window.localStorage);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Storage);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_locale_tsx.11bd3b075ddee11c51df14cb7a2460c7.js.map