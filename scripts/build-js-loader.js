const {minify} = require('terser');
const fs = require('fs');

/**
 * This script is used to generate the loader script templates used by Django.
 * It takes the base loader script (which has to be valid ES5 JS!)
 * and generates both an unminified and minified version of it, with Django template tags.
 *
 * The generated Django template tags have to be checked in normally, and are what's actually used.
 * The base `.js` file is only the blueprint used to generate the template files off.
 *
 * Run this script whenever you change the base loader script,
 * then verify the build output of both generated `js.tmpl` files and check all three files in.
 *
 * Note: You can use the following command to verify that the base file is valid ES5:
 * npx es5-validator src/sentry/templates/sentry/js-sdk-loader.js
 */

const header = `{% load sentry_helpers %}`;
const loaderScriptPath = './src/sentry/templates/sentry/js-sdk-loader.js';
const loaderTmplPath = './src/sentry/templates/sentry/js-sdk-loader.js.tmpl';
const loaderMinTmplPath = './src/sentry/templates/sentry/js-sdk-loader.min.js.tmpl';

async function run() {
  const base = fs.readFileSync(loaderScriptPath, 'utf-8');

  const unminifiedLoader = `${header}${replacePlaceholders(base)}`;
  const {code: minifiedBase} = await minify(base, {
    ecma: 5,
    mangle: {
      reserved: ['onLoad', 'forceLoad'],
    },
    format: {
      ecma: 5,
    },
  });

  const minifiedLoader = `${header}${replacePlaceholders(minifiedBase)}\n`;

  fs.writeFileSync(loaderTmplPath, unminifiedLoader, 'utf-8');

  console.log(`Updated loader script template at ${loaderTmplPath}`);

  fs.writeFileSync(loaderMinTmplPath, minifiedLoader, 'utf-8');

  console.log(`Updated loader min. script template at ${loaderMinTmplPath}`);
}

/**
 * We replace some placeholders in the loader script with Django template tags.
 * This is done so the base template is actually valid JS (so we can minify it, have autocomplete, linting, etc.).
 * The placeholders are replaced with the actual values by Django.
 */
function replacePlaceholders(str) {
  return str
    .replace('__LOADER__PUBLIC_KEY__', "'{{ publicKey|safe }}'")
    .replace('__LOADER_SDK_URL__', "'{{ jsSdkUrl|safe }}'")
    .replace('__LOADER__CONFIG__', '{{ config|to_json|safe }}')
    .replace('__LOADER__IS_LAZY__', '{{ isLazy|safe|lower }}');
}

run();
