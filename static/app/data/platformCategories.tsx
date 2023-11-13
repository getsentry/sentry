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
  'go-http',
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

export const replayPlatforms: readonly PlatformKey[] = [
  'capacitor',
  'electron',
  'javascript-angular',
  // 'javascript-angularjs', // Unsupported, angularjs requires the v6.x core SDK
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

/**
 * The list of platforms for which we have created onboarding instructions.
 * Should be a subset of the list of `replayPlatforms`.
 * This should match sentry-docs: `/src/wizard/${platform}/replay-onboarding/${subPlatform}/`.
 * See: https://github.com/getsentry/sentry-docs/tree/master/src/wizard/javascript/replay-onboarding
 */
export const replayOnboardingPlatforms: readonly PlatformKey[] = [
  'capacitor',
  'electron',
  'javascript-angular',
  'javascript-astro',
  // 'javascript-angularjs', // Unsupported, angularjs requires the v6.x core SDK
  // 'javascript-backbone', // No docs yet
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
