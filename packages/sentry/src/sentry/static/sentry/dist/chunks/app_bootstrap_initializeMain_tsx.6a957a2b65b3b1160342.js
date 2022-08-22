(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_bootstrap_initializeMain_tsx"],{

/***/ "./app/bootstrap/initializeLocale.tsx":
/*!********************************************!*\
  !*** ./app/bootstrap/initializeLocale.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "initializeLocale": () => (/* binding */ initializeLocale)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");






// zh-cn => zh_CN
function convertToDjangoLocaleFormat(language) {
  const [left, right] = language.split('-');
  return left + (right ? '_' + right.toUpperCase() : '');
}

async function getTranslations(language) {
  language = convertToDjangoLocaleFormat(language); // No need to load the english locale

  if (language === 'en') {
    return sentry_locale__WEBPACK_IMPORTED_MODULE_3__.DEFAULT_LOCALE_DATA;
  }

  try {
    return await __webpack_require__("../src/sentry/locale lazy recursive (ach%7Caf%7Car%7Cbg%7Cca%7Ccs%7Cda%7Cde%7Cel%7Cen%7Ces%7Cet%7Cfa%7Cfi%7Cfr%7Cgl%7Che%7Chi%7Chu%7Cid%7Cit%7Cja%7Cko%7Clt%7Clv%7Cnl_NL%7Cno%7Cpl%7Cpl_PL%7Cpt%7Cpt_BR%7Cro%7Cro_RO%7Cru%7Cru_RU%7Csk%7Csl%7Csv_SE%7Cth%7Ctr%7Cuk%7Cvi%7Czh_CN%7Czh_TW)\\/.*\\.po$")(`./${language}/LC_MESSAGES/django.po`);
  } catch (e) {
    _sentry_react__WEBPACK_IMPORTED_MODULE_4__.withScope(scope => {
      scope.setLevel('warning');
      scope.setFingerprint(['sentry-locale-not-found']);
      scope.setExtra('locale', language);
      _sentry_react__WEBPACK_IMPORTED_MODULE_4__.captureException(e);
    }); // Default locale if not found

    return sentry_locale__WEBPACK_IMPORTED_MODULE_3__.DEFAULT_LOCALE_DATA;
  }
}
/**
 * Initialize locale
 *
 * This *needs* to be initialized as early as possible (e.g. before `app/locale` is used),
 * otherwise the rest of the application will fail to load.
 *
 * Priority:
 *
 * - URL params (`?lang=en`)
 * - User configuration options
 * - User's system language code (from request)
 * - "en" as default
 */


async function initializeLocale(config) {
  var _config$user, _config$user$options;

  let queryString = {}; // Parse query string for `lang`

  try {
    queryString = query_string__WEBPACK_IMPORTED_MODULE_2__.parse(window.location.search) || {};
  } catch {// ignore if this fails to parse
    // this can happen if we have an invalid query string
    // e.g. unencoded "%"
  }

  const queryStringLang = Array.isArray(queryString.lang) ? queryString.lang[0] : queryString.lang;
  const languageCode = queryStringLang || ((_config$user = config.user) === null || _config$user === void 0 ? void 0 : (_config$user$options = _config$user.options) === null || _config$user$options === void 0 ? void 0 : _config$user$options.language) || config.languageCode || 'en';

  try {
    const translations = await getTranslations(languageCode);
    (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.setLocale)(translations); // No need to import english

    if (languageCode !== 'en') {
      await __webpack_require__("../node_modules/moment/locale lazy recursive (ach%7Caf%7Car%7Cbg%7Cca%7Ccs%7Cda%7Cde%7Cel%7Cen%7Ces%7Cet%7Cfa%7Cfi%7Cfr%7Cgl%7Che%7Chi%7Chu%7Cid%7Cit%7Cja%7Cko%7Clt%7Clv%7Cnl-nl%7Cno%7Cpl%7Cpl-pl%7Cpt%7Cpt-br%7Cro%7Cro-ro%7Cru%7Cru-ru%7Csk%7Csl%7Csv-se%7Cth%7Ctr%7Cuk%7Cvi%7Czh-cn%7Czh-tw)\\.js$")(`./${languageCode}`);
      moment__WEBPACK_IMPORTED_MODULE_1__.locale(languageCode);
    }
  } catch (err) {
    _sentry_react__WEBPACK_IMPORTED_MODULE_4__.captureException(err);
  }
}

/***/ }),

/***/ "./app/bootstrap/initializeMain.tsx":
/*!******************************************!*\
  !*** ./app/bootstrap/initializeMain.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "initializeMain": () => (/* binding */ initializeMain)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _initializeLocale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./initializeLocale */ "./app/bootstrap/initializeLocale.tsx");


async function initializeMain(config) {
  // This needs to be loaded as early as possible, or else the locale library can
  // throw an exception and prevent the application from being loaded.
  //
  // e.g. `app/constants` uses `t()` and is imported quite early
  await (0,_initializeLocale__WEBPACK_IMPORTED_MODULE_1__.initializeLocale)(config); // This is dynamically imported because we need to make sure locale is configured
  // before proceeding.

  const {
    initializeApp
  } = await Promise.all(/*! import() */[__webpack_require__.e("vendors-node_modules_react-aria_button_dist_module_js-node_modules_react-aria_menu_dist_modul-af0898"), __webpack_require__.e("vendors-node_modules_buffer_index_js"), __webpack_require__.e("vendors-node_modules_lodash_cloneDeep_js-node_modules_lodash_invert_js-node_modules_lodash_is-9086a9"), __webpack_require__.e("vendors-node_modules_core-js_modules_es_array_at_js-node_modules_core-js_modules_es_string_at-da908d"), __webpack_require__.e("vendors-node_modules_react-aria_separator_dist_module_js-node_modules_react-stately_tree_dist-1a6f99"), __webpack_require__.e("vendors-node_modules_emotion_css_dist_emotion-css_esm_js-node_modules_emotion_is-prop-valid_d-a11b11"), __webpack_require__.e("vendors-node_modules_echarts_lib_component_markPoint_js-node_modules_focus-trap_dist_focus-tr-e85e7b"), __webpack_require__.e("app_components_tag_tsx-app_stores_organizationStore_tsx-app_utils_withApi_tsx"), __webpack_require__.e("app_actions_organizationsActions_tsx-app_components_clipboard_tsx-app_components_forms_compac-1ced7e"), __webpack_require__.e("app_components_asyncComponent_tsx"), __webpack_require__.e("app_components_acl_access_tsx-app_components_forms_textCopyInput_tsx-app_components_truncate_-b908d0"), __webpack_require__.e("app_components_charts_utils_tsx-app_utils_discover_eventView_tsx-app_utils_withPageFilters_tsx"), __webpack_require__.e("app_actionCreators_pageFilters_tsx-app_actionCreators_tags_tsx-app_components_assigneeSelecto-6127d8"), __webpack_require__.e("app_actionCreators_members_tsx-app_components_acl_feature_tsx-app_components_dropdownMenuCont-79946c"), __webpack_require__.e("app_actionCreators_navigation_tsx-app_components_eventOrGroupHeader_tsx-app_components_layout-58d688"), __webpack_require__.e("app_actionCreators_projects_tsx-app_components_deprecatedforms_selectField_tsx"), __webpack_require__.e("app_bootstrap_commonInitialization_tsx-app_bootstrap_initializeSdk_tsx-app_bootstrap_renderOn-4bad9e"), __webpack_require__.e("app_components_acl_featureDisabled_tsx-app_components_hookOrDefault_tsx"), __webpack_require__.e("app_bootstrap_initializeApp_tsx")]).then(__webpack_require__.bind(__webpack_require__, /*! ./initializeApp */ "./app/bootstrap/initializeApp.tsx"));
  initializeApp(config);
}

/***/ }),

/***/ "../node_modules/moment/locale lazy recursive (ach%7Caf%7Car%7Cbg%7Cca%7Ccs%7Cda%7Cde%7Cel%7Cen%7Ces%7Cet%7Cfa%7Cfi%7Cfr%7Cgl%7Che%7Chi%7Chu%7Cid%7Cit%7Cja%7Cko%7Clt%7Clv%7Cnl-nl%7Cno%7Cpl%7Cpl-pl%7Cpt%7Cpt-br%7Cro%7Cro-ro%7Cru%7Cru-ru%7Csk%7Csl%7Csv-se%7Cth%7Ctr%7Cuk%7Cvi%7Czh-cn%7Czh-tw)\\.js$":
/*!**********************************************************************************************************************************************************************************************************************************************************************************************************************!*\
  !*** ../node_modules/moment/locale/ lazy (ach%7Caf%7Car%7Cbg%7Cca%7Ccs%7Cda%7Cde%7Cel%7Cen%7Ces%7Cet%7Cfa%7Cfi%7Cfr%7Cgl%7Che%7Chi%7Chu%7Cid%7Cit%7Cja%7Cko%7Clt%7Clv%7Cnl-nl%7Cno%7Cpl%7Cpl-pl%7Cpt%7Cpt-br%7Cro%7Cro-ro%7Cru%7Cru-ru%7Csk%7Csl%7Csv-se%7Cth%7Ctr%7Cuk%7Cvi%7Czh-cn%7Czh-tw)\.js$ namespace object ***!
  \**********************************************************************************************************************************************************************************************************************************************************************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var map = {
	"./af.js": [
		"../node_modules/moment/locale/af.js",
		"locale/af"
	],
	"./ar.js": [
		"../node_modules/moment/locale/ar.js",
		"locale/ar"
	],
	"./bg.js": [
		"../node_modules/moment/locale/bg.js",
		"locale/bg"
	],
	"./ca.js": [
		"../node_modules/moment/locale/ca.js",
		"locale/ca"
	],
	"./cs.js": [
		"../node_modules/moment/locale/cs.js",
		"locale/cs"
	],
	"./da.js": [
		"../node_modules/moment/locale/da.js",
		"locale/da"
	],
	"./de.js": [
		"../node_modules/moment/locale/de.js",
		"locale/de"
	],
	"./el.js": [
		"../node_modules/moment/locale/el.js",
		"locale/el"
	],
	"./en-ca.js": [
		"../node_modules/moment/locale/en-ca.js",
		"node_modules_moment_locale_en-ca_js"
	],
	"./es.js": [
		"../node_modules/moment/locale/es.js",
		"locale/es"
	],
	"./et.js": [
		"../node_modules/moment/locale/et.js",
		"locale/et"
	],
	"./fa.js": [
		"../node_modules/moment/locale/fa.js",
		"locale/fa"
	],
	"./fi.js": [
		"../node_modules/moment/locale/fi.js",
		"locale/fi"
	],
	"./fr-ca.js": [
		"../node_modules/moment/locale/fr-ca.js",
		"node_modules_moment_locale_fr-ca_js"
	],
	"./fr.js": [
		"../node_modules/moment/locale/fr.js",
		"locale/fr"
	],
	"./gl.js": [
		"../node_modules/moment/locale/gl.js",
		"locale/gl"
	],
	"./he.js": [
		"../node_modules/moment/locale/he.js",
		"locale/he"
	],
	"./hi.js": [
		"../node_modules/moment/locale/hi.js",
		"locale/hi"
	],
	"./hu.js": [
		"../node_modules/moment/locale/hu.js",
		"locale/hu"
	],
	"./id.js": [
		"../node_modules/moment/locale/id.js",
		"locale/id"
	],
	"./it.js": [
		"../node_modules/moment/locale/it.js",
		"locale/it"
	],
	"./ja.js": [
		"../node_modules/moment/locale/ja.js",
		"locale/ja"
	],
	"./ko.js": [
		"../node_modules/moment/locale/ko.js",
		"locale/ko"
	],
	"./lt.js": [
		"../node_modules/moment/locale/lt.js",
		"locale/lt"
	],
	"./lv.js": [
		"../node_modules/moment/locale/lv.js",
		"locale/lv"
	],
	"./pl.js": [
		"../node_modules/moment/locale/pl.js",
		"locale/pl"
	],
	"./pt-br.js": [
		"../node_modules/moment/locale/pt-br.js",
		"locale/pt-br"
	],
	"./pt.js": [
		"../node_modules/moment/locale/pt.js",
		"locale/pt"
	],
	"./ro.js": [
		"../node_modules/moment/locale/ro.js",
		"locale/ro"
	],
	"./ru.js": [
		"../node_modules/moment/locale/ru.js",
		"locale/ru"
	],
	"./sk.js": [
		"../node_modules/moment/locale/sk.js",
		"locale/sk"
	],
	"./sl.js": [
		"../node_modules/moment/locale/sl.js",
		"locale/sl"
	],
	"./tet.js": [
		"../node_modules/moment/locale/tet.js",
		"node_modules_moment_locale_tet_js"
	],
	"./th.js": [
		"../node_modules/moment/locale/th.js",
		"locale/th"
	],
	"./tr.js": [
		"../node_modules/moment/locale/tr.js",
		"locale/tr"
	],
	"./uk.js": [
		"../node_modules/moment/locale/uk.js",
		"locale/uk"
	],
	"./vi.js": [
		"../node_modules/moment/locale/vi.js",
		"locale/vi"
	],
	"./zh-cn.js": [
		"../node_modules/moment/locale/zh-cn.js",
		"locale/zh-cn"
	],
	"./zh-tw.js": [
		"../node_modules/moment/locale/zh-tw.js",
		"locale/zh-tw"
	]
};
function webpackAsyncContext(req) {
	if(!__webpack_require__.o(map, req)) {
		return Promise.resolve().then(() => {
			var e = new Error("Cannot find module '" + req + "'");
			e.code = 'MODULE_NOT_FOUND';
			throw e;
		});
	}

	var ids = map[req], id = ids[0];
	return __webpack_require__.e(ids[1]).then(() => {
		return __webpack_require__.t(id, 7 | 16);
	});
}
webpackAsyncContext.keys = () => (Object.keys(map));
webpackAsyncContext.id = "../node_modules/moment/locale lazy recursive (ach%7Caf%7Car%7Cbg%7Cca%7Ccs%7Cda%7Cde%7Cel%7Cen%7Ces%7Cet%7Cfa%7Cfi%7Cfr%7Cgl%7Che%7Chi%7Chu%7Cid%7Cit%7Cja%7Cko%7Clt%7Clv%7Cnl-nl%7Cno%7Cpl%7Cpl-pl%7Cpt%7Cpt-br%7Cro%7Cro-ro%7Cru%7Cru-ru%7Csk%7Csl%7Csv-se%7Cth%7Ctr%7Cuk%7Cvi%7Czh-cn%7Czh-tw)\\.js$";
module.exports = webpackAsyncContext;

/***/ }),

/***/ "../src/sentry/locale lazy recursive (ach%7Caf%7Car%7Cbg%7Cca%7Ccs%7Cda%7Cde%7Cel%7Cen%7Ces%7Cet%7Cfa%7Cfi%7Cfr%7Cgl%7Che%7Chi%7Chu%7Cid%7Cit%7Cja%7Cko%7Clt%7Clv%7Cnl_NL%7Cno%7Cpl%7Cpl_PL%7Cpt%7Cpt_BR%7Cro%7Cro_RO%7Cru%7Cru_RU%7Csk%7Csl%7Csv_SE%7Cth%7Ctr%7Cuk%7Cvi%7Czh_CN%7Czh_TW)\\/.*\\.po$":
/*!*****************************************************************************************************************************************************************************************************************************************************************************************************************!*\
  !*** ../src/sentry/locale/ lazy (ach%7Caf%7Car%7Cbg%7Cca%7Ccs%7Cda%7Cde%7Cel%7Cen%7Ces%7Cet%7Cfa%7Cfi%7Cfr%7Cgl%7Che%7Chi%7Chu%7Cid%7Cit%7Cja%7Cko%7Clt%7Clv%7Cnl_NL%7Cno%7Cpl%7Cpl_PL%7Cpt%7Cpt_BR%7Cro%7Cro_RO%7Cru%7Cru_RU%7Csk%7Csl%7Csv_SE%7Cth%7Ctr%7Cuk%7Cvi%7Czh_CN%7Czh_TW)\/.*\.po$ namespace object ***!
  \*****************************************************************************************************************************************************************************************************************************************************************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var map = {
	"./ach/LC_MESSAGES/django.po": [
		"../src/sentry/locale/ach/LC_MESSAGES/django.po",
		"locale/ach"
	],
	"./af/LC_MESSAGES/django.po": [
		"../src/sentry/locale/af/LC_MESSAGES/django.po",
		"locale/af"
	],
	"./ar/LC_MESSAGES/django.po": [
		"../src/sentry/locale/ar/LC_MESSAGES/django.po",
		"locale/ar"
	],
	"./bg/LC_MESSAGES/django.po": [
		"../src/sentry/locale/bg/LC_MESSAGES/django.po",
		"locale/bg"
	],
	"./ca/LC_MESSAGES/django.po": [
		"../src/sentry/locale/ca/LC_MESSAGES/django.po",
		"locale/ca"
	],
	"./cs/LC_MESSAGES/django.po": [
		"../src/sentry/locale/cs/LC_MESSAGES/django.po",
		"locale/cs"
	],
	"./da/LC_MESSAGES/django.po": [
		"../src/sentry/locale/da/LC_MESSAGES/django.po",
		"locale/da"
	],
	"./de/LC_MESSAGES/django.po": [
		"../src/sentry/locale/de/LC_MESSAGES/django.po",
		"locale/de"
	],
	"./el/LC_MESSAGES/django.po": [
		"../src/sentry/locale/el/LC_MESSAGES/django.po",
		"locale/el"
	],
	"./en/LC_MESSAGES/django.po": [
		"../src/sentry/locale/en/LC_MESSAGES/django.po",
		"src_sentry_locale_en_LC_MESSAGES_django_po"
	],
	"./es/LC_MESSAGES/django.po": [
		"../src/sentry/locale/es/LC_MESSAGES/django.po",
		"locale/es"
	],
	"./et/LC_MESSAGES/django.po": [
		"../src/sentry/locale/et/LC_MESSAGES/django.po",
		"locale/et"
	],
	"./fa/LC_MESSAGES/django.po": [
		"../src/sentry/locale/fa/LC_MESSAGES/django.po",
		"locale/fa"
	],
	"./fi/LC_MESSAGES/django.po": [
		"../src/sentry/locale/fi/LC_MESSAGES/django.po",
		"locale/fi"
	],
	"./fr/LC_MESSAGES/django.po": [
		"../src/sentry/locale/fr/LC_MESSAGES/django.po",
		"locale/fr"
	],
	"./gl/LC_MESSAGES/django.po": [
		"../src/sentry/locale/gl/LC_MESSAGES/django.po",
		"locale/gl"
	],
	"./he/LC_MESSAGES/django.po": [
		"../src/sentry/locale/he/LC_MESSAGES/django.po",
		"locale/he"
	],
	"./hi/LC_MESSAGES/django.po": [
		"../src/sentry/locale/hi/LC_MESSAGES/django.po",
		"locale/hi"
	],
	"./hu/LC_MESSAGES/django.po": [
		"../src/sentry/locale/hu/LC_MESSAGES/django.po",
		"locale/hu"
	],
	"./id/LC_MESSAGES/django.po": [
		"../src/sentry/locale/id/LC_MESSAGES/django.po",
		"locale/id"
	],
	"./it/LC_MESSAGES/django.po": [
		"../src/sentry/locale/it/LC_MESSAGES/django.po",
		"locale/it"
	],
	"./ja/LC_MESSAGES/django.po": [
		"../src/sentry/locale/ja/LC_MESSAGES/django.po",
		"locale/ja"
	],
	"./ko/LC_MESSAGES/django.po": [
		"../src/sentry/locale/ko/LC_MESSAGES/django.po",
		"locale/ko"
	],
	"./lt/LC_MESSAGES/django.po": [
		"../src/sentry/locale/lt/LC_MESSAGES/django.po",
		"locale/lt"
	],
	"./lv/LC_MESSAGES/django.po": [
		"../src/sentry/locale/lv/LC_MESSAGES/django.po",
		"locale/lv"
	],
	"./nl_NL/LC_MESSAGES/django.po": [
		"../src/sentry/locale/nl_NL/LC_MESSAGES/django.po",
		"locale/nl-nl"
	],
	"./no/LC_MESSAGES/django.po": [
		"../src/sentry/locale/no/LC_MESSAGES/django.po",
		"locale/no"
	],
	"./pl/LC_MESSAGES/django.po": [
		"../src/sentry/locale/pl/LC_MESSAGES/django.po",
		"locale/pl"
	],
	"./pl_PL/LC_MESSAGES/django.po": [
		"../src/sentry/locale/pl_PL/LC_MESSAGES/django.po",
		"locale/pl-pl"
	],
	"./pt/LC_MESSAGES/django.po": [
		"../src/sentry/locale/pt/LC_MESSAGES/django.po",
		"locale/pt"
	],
	"./pt_BR/LC_MESSAGES/django.po": [
		"../src/sentry/locale/pt_BR/LC_MESSAGES/django.po",
		"locale/pt-br"
	],
	"./ro/LC_MESSAGES/django.po": [
		"../src/sentry/locale/ro/LC_MESSAGES/django.po",
		"locale/ro"
	],
	"./ro_RO/LC_MESSAGES/django.po": [
		"../src/sentry/locale/ro_RO/LC_MESSAGES/django.po",
		"locale/ro-ro"
	],
	"./ru/LC_MESSAGES/django.po": [
		"../src/sentry/locale/ru/LC_MESSAGES/django.po",
		"locale/ru"
	],
	"./ru_RU/LC_MESSAGES/django.po": [
		"../src/sentry/locale/ru_RU/LC_MESSAGES/django.po",
		"locale/ru-ru"
	],
	"./sk/LC_MESSAGES/django.po": [
		"../src/sentry/locale/sk/LC_MESSAGES/django.po",
		"locale/sk"
	],
	"./sl/LC_MESSAGES/django.po": [
		"../src/sentry/locale/sl/LC_MESSAGES/django.po",
		"locale/sl"
	],
	"./sv_SE/LC_MESSAGES/django.po": [
		"../src/sentry/locale/sv_SE/LC_MESSAGES/django.po",
		"locale/sv-se"
	],
	"./th/LC_MESSAGES/django.po": [
		"../src/sentry/locale/th/LC_MESSAGES/django.po",
		"locale/th"
	],
	"./tr/LC_MESSAGES/django.po": [
		"../src/sentry/locale/tr/LC_MESSAGES/django.po",
		"locale/tr"
	],
	"./uk/LC_MESSAGES/django.po": [
		"../src/sentry/locale/uk/LC_MESSAGES/django.po",
		"locale/uk"
	],
	"./vi/LC_MESSAGES/django.po": [
		"../src/sentry/locale/vi/LC_MESSAGES/django.po",
		"locale/vi"
	],
	"./zh_CN/LC_MESSAGES/django.po": [
		"../src/sentry/locale/zh_CN/LC_MESSAGES/django.po",
		"locale/zh-cn"
	],
	"./zh_TW/LC_MESSAGES/django.po": [
		"../src/sentry/locale/zh_TW/LC_MESSAGES/django.po",
		"locale/zh-tw"
	]
};
function webpackAsyncContext(req) {
	if(!__webpack_require__.o(map, req)) {
		return Promise.resolve().then(() => {
			var e = new Error("Cannot find module '" + req + "'");
			e.code = 'MODULE_NOT_FOUND';
			throw e;
		});
	}

	var ids = map[req], id = ids[0];
	return __webpack_require__.e(ids[1]).then(() => {
		return __webpack_require__.t(id, 7 | 16);
	});
}
webpackAsyncContext.keys = () => (Object.keys(map));
webpackAsyncContext.id = "../src/sentry/locale lazy recursive (ach%7Caf%7Car%7Cbg%7Cca%7Ccs%7Cda%7Cde%7Cel%7Cen%7Ces%7Cet%7Cfa%7Cfi%7Cfr%7Cgl%7Che%7Chi%7Chu%7Cid%7Cit%7Cja%7Cko%7Clt%7Clv%7Cnl_NL%7Cno%7Cpl%7Cpl_PL%7Cpt%7Cpt_BR%7Cro%7Cro_RO%7Cru%7Cru_RU%7Csk%7Csl%7Csv_SE%7Cth%7Ctr%7Cuk%7Cvi%7Czh_CN%7Czh_TW)\\/.*\\.po$";
module.exports = webpackAsyncContext;

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_bootstrap_initializeMain_tsx.1c45f7e0865b5faef7dd9947683acdab.js.map