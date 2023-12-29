import {PlatformKey} from 'sentry/types';

export enum PlatformCategory {
  FRONTEND,
  MOBILE,
  BACKEND,
  SERVERLESS,
  DESKTOP,
  OTHER,
}

// Mirrors `FRONTEND` in src/sentry/utils/platform_categories.py
// When changing this file, make sure to keep src/sentry/utils/platform_categories.py in sync.
export const frontend: PlatformKey[] = [
  'dart',
  'javascript',
  'javascript-angular',
  'javascript-angularjs',
  'javascript-astro',
  'javascript-backbone',
  'javascript-ember',
  'javascript-gatsby',
  'javascript-nextjs',
  'javascript-react',
  'javascript-remix',
  'javascript-svelte',
  'javascript-sveltekit',
  'javascript-vue',
  'unity',
];

// Mirrors `MOBILE` in src/sentry/utils/platform_categories.py
// When changing this file, make sure to keep src/sentry/utils/platform_categories.py in sync.
export const mobile: PlatformKey[] = [
  'android',
  'apple-ios',
  'capacitor',
  'cordova',
  'dart-flutter',
  'dotnet-maui',
  'dotnet-xamarin',
  'flutter',
  'ionic',
  'javascript-capacitor',
  'javascript-cordova',
  'react-native',
  'unity',
  'unreal',
  // Old platforms
  'java-android',
  'cocoa-objc',
  'cocoa-swift',
];

// Mirrors `BACKEND` in src/sentry/utils/platform_categories.py
// When changing this file, make sure to keep src/sentry/utils/platform_categories.py in sync.
export const backend: PlatformKey[] = [
  'bun',
  'dotnet',
  'dotnet-aspnetcore',
  'dotnet-aspnet',
  'elixir',
  'go',
  'go-echo',
  'go-fasthttp',
  'go-gin',
  'go-http',
  'go-iris',
  'go-martini',
  'java',
  'java-appengine',
  'java-log4j',
  'java-log4j2',
  'java-logback',
  'java-logging',
  'java-spring',
  'java-spring-boot',
  'kotlin',
  'native',
  'node',
  'node-express',
  'node-koa',
  'node-connect',
  'perl',
  'php',
  'php-laravel',
  'php-monolog',
  'php-symfony',
  'python',
  'python-aiohttp',
  'python-asgi',
  'python-bottle',
  'python-celery',
  'python-chalice',
  'python-django',
  'python-falcon',
  'python-fastapi',
  'python-flask',
  'python-pylons',
  'python-pymongo',
  'python-pyramid',
  'python-quart',
  'python-rq',
  'python-sanic',
  'python-starlette',
  'python-tornado',
  'python-tryton',
  'python-wsgi',
  'ruby',
  'ruby-rails',
  'ruby-rack',
  'rust',
];

// Mirrors `SERVERLESS` in src/sentry/utils/platform_categories.py
// When changing this file, make sure to keep src/sentry/utils/platform_categories.py in sync.
export const serverless: PlatformKey[] = [
  'dotnet-awslambda',
  'dotnet-gcpfunctions',
  'node-awslambda',
  'node-azurefunctions',
  'node-gcpfunctions',
  'python-awslambda',
  'python-azurefunctions',
  'python-gcpfunctions',
  'python-serverless',
];

// Mirrors `DESKTOP` in src/sentry/utils/platform_categories.py
// When changing this file, make sure to keep src/sentry/utils/platform_categories.py in sync.
export const desktop: PlatformKey[] = [
  'apple-macos',
  'dotnet-maui',
  'dotnet-winforms',
  'dotnet-wpf',
  'dotnet',
  'electron',
  'flutter',
  'java',
  'javascript-electron',
  'kotlin',
  'minidump',
  'native',
  'native-breakpad',
  'native-crashpad',
  'native-minidump',
  'native-qt',
  'unity',
  'unreal',
];

export const sourceMaps: PlatformKey[] = [
  ...frontend,
  'react-native',
  'cordova',
  'electron',
];

export const performance: PlatformKey[] = [
  'bun',
  'javascript',
  'javascript-ember',
  'javascript-react',
  'javascript-vue',
  'php',
  'php-laravel',
  'python',
  'python-django',
  'python-flask',
  'python-fastapi',
  'python-starlette',
  'python-sanic',
  'python-celery',
  'python-bottle',
  'python-pylons',
  'python-pyramid',
  'python-tornado',
  'python-rq',
  'node',
  'node-express',
  'node-koa',
  'node-connect',
];

// List of platforms that have performance onboarding checklist content
export const withPerformanceOnboarding: Set<PlatformKey> = new Set([
  'javascript',
  'javascript-react',
]);

// List of platforms that do not have performance support. We make use of this list in the product to not provide any Performance
// views such as Performance onboarding checklist.
export const withoutPerformanceSupport: Set<PlatformKey> = new Set([
  'elixir',
  'minidump',
]);

export const profiling: PlatformKey[] = [
  // mobile
  'android',
  'apple-ios',
  // go
  'go',
  // nodejs
  'node',
  'node-express',
  'node-koa',
  'node-connect',
  'javascript-nextjs',
  'javascript-remix',
  'javascript-sveltekit',
  'javascript',
  'javascript-react',
  // react-native
  'react-native',
  // python
  'python',
  'python-django',
  'python-flask',
  'python-fastapi',
  'python-starlette',
  'python-sanic',
  'python-celery',
  'python-bottle',
  'python-pylons',
  'python-pyramid',
  'python-tornado',
  'python-rq',
  'python-aiohttp',
  'python-chalice',
  'python-falcon',
  'python-quart',
  'python-tryton',
  'python-wsgi',
  'python-serverless',
  // rust
  'rust',
  // php
  'php',
  'php-laravel',
  'php-symfony',
  // ruby
  'ruby',
  'ruby-rails',
  'ruby-rack',
];

export const releaseHealth: PlatformKey[] = [
  // frontend
  'javascript',
  'javascript-react',
  'javascript-angular',
  'javascript-angularjs',
  'javascript-astro',
  'javascript-backbone',
  'javascript-ember',
  'javascript-gatsby',
  'javascript-vue',
  'javascript-nextjs',
  'javascript-remix',
  'javascript-svelte',
  'javascript-sveltekit',
  // mobile
  'android',
  'apple-ios',
  'cordova',
  'javascript-cordova',
  'react-native',
  'flutter',
  'dart-flutter',
  // backend
  'bun',
  'native',
  'node',
  'node-express',
  'node-koa',
  'node-connect',
  'python',
  'python-django',
  'python-flask',
  'python-fastapi',
  'python-starlette',
  'python-sanic',
  'python-celery',
  'python-bottle',
  'python-pylons',
  'python-pyramid',
  'python-tornado',
  'python-rq',
  'python-pymongo',
  'rust',
  // serverless
  // desktop
  'apple-macos',
  'native',
  'native-crashpad',
  'native-breakpad',
  'native-qt',
];

// These are the backend platforms that can set up replay -- e.g. they can be set up via a linked JS framework or via JS loader.
const replayBackendPlatforms: readonly PlatformKey[] = [
  'bun',
  'dotnet-aspnetcore',
  'dotnet-aspnet',
  'elixir',
  'go-echo',
  'go-fasthttp',
  'go-gin',
  'go-iris',
  'go-martini',
  'java-spring',
  'java-spring-boot',
  'node',
  'node-express',
  'php',
  'php-laravel',
  'php-symfony',
  'python-aiohttp',
  'python-bottle',
  'python-django',
  'python-falcon',
  'python-fastapi',
  'python-flask',
  'python-pyramid',
  'python-quart',
  'python-sanic',
  'python-starlette',
  'python-tornado',
  'ruby-rails',
];

// These are the frontend platforms that can set up replay.
export const replayFrontendPlatforms: readonly PlatformKey[] = [
  'capacitor',
  'electron',
  'javascript-angular',
  'javascript-astro',
  'javascript-backbone',
  'javascript-capacitor',
  'javascript-electron',
  'javascript-ember',
  'javascript-gatsby',
  'javascript-nextjs',
  'javascript-react',
  'javascript-remix',
  'javascript-svelte',
  'javascript-sveltekit',
  'javascript-vue',
  'javascript',
];

// These are all the platforms that can set up replay.
export const replayPlatforms: readonly PlatformKey[] = [
  ...replayFrontendPlatforms,
  ...replayBackendPlatforms,
];

/**
 * The list of platforms for which we have created onboarding instructions.
 * Should be a subset of the list of `replayPlatforms`.
 * This should match sentry-docs: `/src/wizard/${platform}/replay-onboarding/${subPlatform}/`.
 * See: https://github.com/getsentry/sentry-docs/tree/master/src/wizard/javascript/replay-onboarding
 */
export const replayOnboardingPlatforms: readonly PlatformKey[] = [
  ...replayFrontendPlatforms.filter(p => !['javascript-backbone'].includes(p)),
  ...replayBackendPlatforms,
];

// These are the supported replay platforms that can also be set up using the JS loader.
export const replayJsLoaderInstructionsPlatformList: readonly PlatformKey[] = [
  'javascript',
  ...replayBackendPlatforms,
];

const customMetricBackendPlatforms: readonly PlatformKey[] = [
  'php',
  'php-laravel',
  // TODO: Enable once metrics are available for Symfony
  // 'php-symfony',
  'python',
  'python-aiohttp',
  'python-asgi',
  'python-awslambda',
  'python-bottle',
  'python-celery',
  'python-chalice',
  'python-django',
  'python-falcon',
  'python-fastapi',
  'python-flask',
  'python-gcpfunctions',
  'python-pymongo',
  'python-pylons',
  'python-pyramid',
  'python-quart',
  'python-rq',
  'python-sanic',
  'python-serverless',
  'python-starlette',
  'python-tornado',
  'python-tryton',
  'python-wsgi',
  'rust',
];

const customMetricFrontendPlatforms: readonly PlatformKey[] = [
  'electron',
  'javascript-angular',
  'javascript-astro',
  'javascript-backbone',
  'javascript-capacitor',
  'javascript-electron',
  'javascript-ember',
  'javascript-gatsby',
  'javascript-nextjs',
  'javascript-react',
  'javascript-remix',
  'javascript-svelte',
  'javascript-sveltekit',
  'javascript-vue',
  'javascript',
];

// These are all the platforms that can set up custom metrics.
export const customMetricPlatforms: Set<PlatformKey> = new Set([
  ...customMetricFrontendPlatforms,
  ...customMetricBackendPlatforms,
]);

/**
 * The list of platforms for which we have created onboarding instructions.
 * Should be a subset of the list of `customMetricPlatforms`.
 */
export const customMetricOnboardingPlatforms = new Set(
  [...customMetricPlatforms].filter(
    p =>
      // Legacy platforms that do not have in-product docs
      ![
        'javascript-backbone',
        'javascript-capacitor',
        'javascript-electron',
        'python-pylons',
        'python-tryton',
      ].includes(p)
  )
);
