import {Alert} from 'sentry/components/core/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

const getInstallProfilingSnippetPackageManager = (params: DocsParams) => `
Install-Package Sentry.Profiling -Version ${getPackageVersion(
  params,
  'sentry.dotnet.profiling',
  '4.3.0'
)}`;

const getInstallProfilingSnippetCoreCli = (params: DocsParams) => `
dotnet add package Sentry.Profiling -v ${getPackageVersion(
  params,
  'sentry.dotnet.profiling',
  '4.3.0'
)}`;

const getProfilingConfigureSnippet = (
  params: DocsParams,
  platform?: 'windows' | 'apple'
) => `
using Sentry;

SentrySdk.Init(options =>
{
    // A Sentry Data Source Name (DSN) is required.
    // See https://docs.sentry.io/product/sentry-basics/dsn-explainer/
    // You can set it in the SENTRY_DSN environment variable, or you can set it in code here.
    options.Dsn = "${params.dsn.public}";${
      params.isPerformanceSelected
        ? `

    // Set TracesSampleRate to 1.0 to capture 100%
    // of transactions for tracing.
    // We recommend adjusting this value in production.
    options.TracesSampleRate = 1.0;`
        : ''
    }${
      params.isProfilingSelected
        ? `

    // Sample rate for profiling, applied on top of othe TracesSampleRate,
    // e.g. 0.2 means we want to profile 20 % of the captured transactions.
    // We recommend adjusting this value in production.
    options.ProfilesSampleRate = 1.0;${
      platform === 'apple'
        ? ''
        : `
    // Requires NuGet package: Sentry.Profiling
    // Note: By default, the profiler is initialized asynchronously. This can
    // be tuned by passing a desired initialization timeout to the constructor.
    options.AddIntegration(new ProfilingIntegration(
        // During startup, wait up to 500ms to profile the app startup code.
        // This could make launching the app a bit slower so comment it out if you
        // prefer profiling to start asynchronously
        TimeSpan.FromMilliseconds(500)
    ));`
    }`
        : ''
    }
});`;

export const getDotnetProfilingOnboarding = ({
  getInstallSnippetPackageManager,
  getInstallSnippetCoreCli,
}: {
  getInstallSnippetCoreCli: (params: DocsParams) => string;
  getInstallSnippetPackageManager: (params: DocsParams) => string;
}): OnboardingConfig => ({
  introduction: () => (
    <Alert type="info">
      <div>
        {t(
          'Sentry profiling for .NET is available in Alpha on .NET 6.0+ (tested on .NET 7.0 & .NET 8.0 as well).'
        )}
      </div>
      <div>{t('Profiling is not supported for .NET Framework and .NET on Android.')}</div>
    </Alert>
  ),
  install: params => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Make sure the SDK is up to date. The minimum version of the SDK required for profiling is [code:4.3.0].',
        {
          code: <code />,
        }
      ),
      configurations: [
        {
          partialLoading: params.sourcePackageRegistries.isLoading,
          code: [
            {
              language: 'shell',
              label: 'Package Manager',
              value: 'packageManager',
              code: getInstallSnippetPackageManager(params),
            },
            {
              language: 'shell',
              label: '.NET Core CLI',
              value: 'coreCli',
              code: getInstallSnippetCoreCli(params),
            },
          ],
        },
        {
          description: tct(
            'Additionally, for all platforms except iOS/Mac Catalyst, you need to add a dependency on the [sentryProfilingPackage:Sentry.Profiling] NuGet package.',
            {
              sentryProfilingPackage: <code />,
            }
          ),
          code: [
            {
              language: 'shell',
              label: 'Package Manager',
              value: 'packageManager',
              code: getInstallProfilingSnippetPackageManager(params),
            },
            {
              language: 'shell',
              label: '.NET Core CLI',
              value: 'coreCli',
              code: getInstallProfilingSnippetCoreCli(params),
            },
          ],
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct('Enable profiling by updating your [code:SentrySdk.Init] call:', {
        code: <code />,
      }),
      configurations: [
        {
          code: [
            {
              language: 'csharp',
              label: 'Windows/Linux/macOS',
              value: 'windows/linux/macos',
              code: getProfilingConfigureSnippet(params, 'windows'),
            },
            {
              language: 'csharp',
              label: 'iOS/Mac Catalyst',
              value: 'ios/macCatalyst',
              code: getProfilingConfigureSnippet(params, 'apple'),
            },
          ],
        },
      ],
      additionalInfo: tct(
        'For more information, read the [link:profiling documentation].',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/dotnet/profiling/" />
          ),
        }
      ),
    },
  ],
  verify: () => [],
});
