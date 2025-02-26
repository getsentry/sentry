import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

export function getWizardInstallSnippet({
  platform,
  params,
}: {
  params: DocsParams;
  platform: 'ios' | 'android' | 'flutter' | 'reactNative';
}) {
  const {isSelfHosted, organization, projectSlug} = params;
  const urlParam = isSelfHosted ? '' : '--saas';
  const platformWithFlags = `${platform} ${urlParam} --org ${organization.slug} --project ${projectSlug}`;

  // Get version from registry if available, or use fallback
  const version = getPackageVersion(params, 'sentry.wizard', '4.0.1');

  return [
    {
      label: 'brew',
      value: 'brew',
      language: 'bash',
      code: `brew install getsentry/tools/sentry-wizard && sentry-wizard -i ${platformWithFlags}`,
    },
    {
      label: 'npx',
      value: 'npx',
      language: 'bash',
      code: `npx @sentry/wizard@latest -i ${platformWithFlags}`,
    },
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
