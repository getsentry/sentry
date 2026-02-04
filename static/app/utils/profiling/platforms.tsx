import {
  backend,
  desktop,
  frontend,
  gaming,
  mobile,
  serverless,
} from 'sentry/data/platformCategories';
import {DataCategory} from 'sentry/types/core';
import type {PlatformKey, Project} from 'sentry/types/project';

type SupportedProfilingPlatformSDK =
  | 'android'
  | 'apple-ios'
  | 'apple-macos'
  | 'flutter'
  | 'dart-flutter'
  | 'go'
  | 'java'
  | 'java-log4j2'
  | 'java-logback'
  | 'java-spring'
  | 'java-spring-boot'
  | 'node'
  | 'python'
  | 'php'
  | 'php-laravel'
  | 'php-symfony2'
  | 'ruby'
  | 'javascript-angular'
  | 'javascript-astro'
  | 'javascript-ember'
  | 'javascript-gatsby'
  | 'javascript-nextjs'
  | 'javascript-react'
  | 'javascript-remix'
  | 'javascript-svelte'
  | 'javascript-solid'
  | 'javascript-sveltekit'
  | 'javascript-vue'
  | 'javascript'
  | 'react-native';

export function getDocsPlatformSDKForPlatform(
  platform: string | undefined
): SupportedProfilingPlatformSDK | null {
  if (!platform) {
    return null;
  }

  // Android
  if (platform === 'android') {
    return 'android';
  }

  // iOS
  if (platform === 'apple-ios') {
    return 'apple-ios';
  }

  // macOS
  if (platform === 'apple-macos') {
    return 'apple-macos';
  }

  // Go
  if (platform === 'go') {
    return 'go';
  }

  // Javascript
  if (platform.startsWith('node')) {
    return 'node';
  }
  if (platform === 'javascript-nextjs') {
    return 'javascript-nextjs';
  }
  if (platform === 'javascript-remix') {
    return 'javascript-remix';
  }
  if (platform === 'javascript-sveltekit') {
    return 'javascript-sveltekit';
  }
  if (platform === 'javascript') {
    return 'javascript';
  }
  if (platform === 'javascript-react') {
    return 'javascript-react';
  }
  if (platform === 'javascript-vue') {
    return 'javascript-vue';
  }
  if (platform === 'javascript-angular') {
    return 'javascript-angular';
  }
  if (platform === 'javascript-gatsby') {
    return 'javascript-gatsby';
  }
  if (platform === 'javascript-ember') {
    return 'javascript-ember';
  }
  if (platform === 'javascript-svelte') {
    return 'javascript-svelte';
  }
  if (platform === 'javascript-solid') {
    return 'javascript-solid';
  }

  // Java
  if (platform === 'java-spring-boot') {
    return 'java-spring-boot';
  }
  if (platform === 'java-spring') {
    return 'java-spring';
  }
  if (platform === 'java-log4j2') {
    return 'java-log4j2';
  }
  if (platform === 'java-logback') {
    return 'java-logback';
  }
  if (platform.startsWith('java')) {
    return 'java';
  }

  if (platform === 'dart-flutter') {
    return 'dart-flutter';
  }
  if (platform === 'flutter') {
    return 'flutter';
  }

  // Python
  if (platform.startsWith('python')) {
    return 'python';
  }

  // PHP
  if (platform === 'php-laravel') {
    return 'php-laravel';
  }
  if (platform === 'php-symfony') {
    // TODD(aknaus): simplify once we migrate the docs to the sentry repo
    // php-symfony2 is the name for php-symfony in the docs
    return 'php-symfony2';
  }
  if (platform.startsWith('php')) {
    return 'php';
  }

  // Ruby
  if (platform.startsWith('ruby')) {
    return 'ruby';
  }

  // React native
  if (platform === 'react-native') {
    return 'react-native';
  }

  return null;
}

export function isProfilingSupportedOrProjectHasProfiles(project: Project): boolean {
  return !!(
    (project.platform && getDocsPlatformSDKForPlatform(project.platform)) ||
    // If this project somehow managed to send profiles, then profiling is supported for this project.
    // Sometimes and for whatever reason, platform can also not be set on a project so the above check alone would fail
    project.hasProfiles
  );
}

export function getProfilingDocsForPlatform(platform: string | undefined): string | null {
  const docsPlatform = getDocsPlatformSDKForPlatform(platform);
  if (!docsPlatform) {
    return null;
  }

  if (docsPlatform === 'react-native') {
    return `https://docs.sentry.io/platforms/react-native/profiling/`;
  }

  if (docsPlatform === 'java-spring-boot') {
    return `https://docs.sentry.io/platforms/java/guides/spring-boot/profiling/`;
  }

  const [language, framework] = docsPlatform.split('-');

  if (!language && !framework) {
    return null;
  }

  if (!framework) {
    return `https://docs.sentry.io/platforms/${language}/profiling/`;
  }

  return `https://docs.sentry.io/platforms/${language}/guides/${framework}/profiling/`;
}

const UI_PROFILE_PLATFORMS = new Set<PlatformKey>([
  'apple',
  'cocoa',
  'javascript-browser',
  'objc',
  'playstation',
  'react',
  'swift',
]);
const CONTINUOUS_PROFILE_PLATFORMS = new Set<PlatformKey>([
  'django',
  'dotnet-google-cloud-functions',
  'PHP',
  'rails',
]);

export function getProfileDurationCategoryForPlatform(
  platform?: PlatformKey
): DataCategory.PROFILE_DURATION | DataCategory.PROFILE_DURATION_UI | null {
  if (!platform) {
    return null;
  }

  if (
    backend.includes(platform) ||
    serverless.includes(platform) ||
    CONTINUOUS_PROFILE_PLATFORMS.has(platform) ||
    platform.startsWith('node-') ||
    platform.startsWith('php-') ||
    platform.startsWith('python-')
  ) {
    return DataCategory.PROFILE_DURATION;
  }

  if (
    frontend.includes(platform) ||
    desktop.includes(platform) ||
    gaming.includes(platform) ||
    mobile.includes(platform) ||
    UI_PROFILE_PLATFORMS.has(platform)
  ) {
    return DataCategory.PROFILE_DURATION_UI;
  }

  return null;
}
