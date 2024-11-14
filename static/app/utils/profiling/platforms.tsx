import type {Project} from 'sentry/types/project';

type SupportedProfilingPlatformSDK =
  | 'android'
  | 'apple-ios'
  | 'apple-macos'
  | 'flutter'
  | 'dart-flutter'
  | 'go'
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
  return docsPlatform === 'apple-ios'
    ? 'https://docs.sentry.io/platforms/apple/guides/ios/profiling/'
    : docsPlatform === 'apple-macos'
      ? 'https://docs.sentry.io/platforms/apple/guides/macos/profiling/'
      : `https://docs.sentry.io/platforms/${docsPlatform}/profiling/`;
}
