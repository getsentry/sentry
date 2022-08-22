"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_bootstrap_index_tsx"],{

/***/ "./app/bootstrap/index.tsx":
/*!*********************************!*\
  !*** ./app/bootstrap/index.tsx ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "bootstrap": () => (/* binding */ bootstrap)
/* harmony export */ });
const BOOTSTRAP_URL = '/api/client-config/';

const bootApplication = data => {
  window.csrfCookieName = data.csrfCookieName;
  return data;
};
/**
 * Load the client configuration data using the BOOTSTRAP_URL. Used when
 * running in standalone SPA mode.
 */


async function bootWithHydration() {
  const response = await fetch(BOOTSTRAP_URL);
  const data = await response.json();
  window.__initialData = data;
  return bootApplication(data);
}
/**
 * Load client configuration bootstrap data. This will detect if the app is
 * running in SPA mode or being booted from the django-rendered layout.html
 * template.
 */


async function bootstrap() {
  const bootstrapData = window.__initialData; // If __initialData is not already set on the window, we are likely running in
  // pure SPA mode, meaning django is not serving our frontend application and we
  // need to make an API request to hydrate the bootstrap data to boot the app.

  if (bootstrapData === undefined) {
    return await bootWithHydration();
  }

  return bootApplication(bootstrapData);
}

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_bootstrap_index_tsx.661c93d5037a9d0964653c65a1dc75c6.js.map