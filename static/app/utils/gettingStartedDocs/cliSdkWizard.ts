import type * as React from 'react';

import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

export type PlatformType =
  // JS Frameworks
  | 'nextjs'
  | 'nuxt'
  | 'sveltekit'
  | 'remix'
  // Mobile Platforms
  | 'ios'
  | 'android'
  | 'flutter'
  | 'reactNative'
  // Other
  | 'source-maps'
  | string;

// Default version to use if sourcePackageRegistries is not available
const DEFAULT_VERSION = '4.0.1';

/**
 * Generate wizard installation snippets for any platform
 */
export function getWizardSnippet({
  platform,
  params,
}: {
  params: DocsParams;
  platform: PlatformType;
}) {
  const {isSelfHosted, organization, projectSlug} = params;
  const urlParam = isSelfHosted ? '' : '--saas';
  const platformWithFlags = `${platform} ${urlParam} --org ${organization.slug} --project ${projectSlug}`;

  // Use the default version directly if sourcePackageRegistries is missing or incomplete
  let version = DEFAULT_VERSION;

  // Only try to get the version from registry if we have a complete sourcePackageRegistries object
  if (
    params.sourcePackageRegistries &&
    typeof params.sourcePackageRegistries.isLoading !== 'undefined' &&
    (params.sourcePackageRegistries.isLoading === false ||
      params.sourcePackageRegistries.data)
  ) {
    version = getPackageVersion(params, 'sentry.wizard', DEFAULT_VERSION);
  }

  return [
    {
      label: 'npx',
      value: 'npx',
      language: 'bash',
      code: `npx @sentry/wizard@latest -i ${platformWithFlags}`,
    },
    // Include brew for mobile platforms
    ...(platform === 'ios' ||
    platform === 'android' ||
    platform === 'flutter' ||
    platform === 'reactNative'
      ? [
          {
            label: 'brew',
            value: 'brew',
            language: 'bash',
            code: `brew install getsentry/tools/sentry-wizard && sentry-wizard -i ${platformWithFlags}`,
          },
        ]
      : []),
    {
      label: 'macOS (Intel/x64)',
      value: 'macos-x64',
      language: 'bash',
      code: `downloadUrl="https://github.com/getsentry/sentry-wizard/releases/download/v${version}/sentry-wizard-darwin-x64"
curl -L $downloadUrl -o sentry-wizard
chmod +x sentry-wizard
./sentry-wizard -i ${platformWithFlags}`,
    },
    {
      label: 'macOS (Apple Silicon/arm64)',
      value: 'macos-arm64',
      language: 'bash',
      code: `downloadUrl="https://github.com/getsentry/sentry-wizard/releases/download/v${version}/sentry-wizard-darwin-arm64"
curl -L $downloadUrl -o sentry-wizard
chmod +x sentry-wizard
./sentry-wizard -i ${platformWithFlags}`,
    },
    {
      label: 'Linux (x64)',
      value: 'linux-x64',
      language: 'bash',
      code: `downloadUrl="https://github.com/getsentry/sentry-wizard/releases/download/v${version}/sentry-wizard-linux-x64"
curl -L $downloadUrl -o sentry-wizard
chmod +x sentry-wizard
./sentry-wizard -i ${platformWithFlags}`,
    },
    {
      label: 'Linux (arm64)',
      value: 'linux-arm64',
      language: 'bash',
      code: `downloadUrl="https://github.com/getsentry/sentry-wizard/releases/download/v${version}/sentry-wizard-linux-arm64"
curl -L $downloadUrl -o sentry-wizard
chmod +x sentry-wizard
./sentry-wizard -i ${platformWithFlags}`,
    },
    {
      label: 'Windows',
      value: 'windows',
      language: 'powershell',
      code: `$downloadUrl = "https://github.com/getsentry/sentry-wizard/releases/download/v${version}/sentry-wizard-win-x64.exe"
Invoke-WebRequest $downloadUrl -OutFile sentry-wizard.exe
./sentry-wizard.exe -i ${platformWithFlags}`,
    },
  ];
}

/**
 * Create a common install configuration for docs
 */
export function getWizardConfig(
  params: DocsParams,
  platform: PlatformType,
  options?: {
    description?: React.ReactNode;
    onCopy?: () => void;
    onSelectAndCopy?: () => void;
  }
) {
  return {
    description: options?.description || '',
    code: getWizardSnippet({
      platform,
      params,
    }),
    onCopy: options?.onCopy,
    onSelectAndCopy: options?.onSelectAndCopy,
  };
}
