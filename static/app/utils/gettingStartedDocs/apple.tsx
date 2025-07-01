import {ExternalLink} from 'sentry/components/core/link';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

const getInstallSnippet = (params: DocsParams) => `
.package(url: "https://github.com/getsentry/sentry-cocoa", from: "${getPackageVersion(
  params,
  'sentry.cocoa',
  '8.49.0'
)}"),`;

export const appleProfilingOnboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      description:
        params.profilingOptions?.defaultProfilingMode === 'continuous'
          ? tct(
              'UI Profiling requires a minimum version of [code:8.49.0] of the Sentry SDK.',
              {
                code: <code />,
              }
            )
          : undefined,
      configurations: [
        {
          description: tct(
            'We recommend installing the SDK with Swift Package Manager (SPM), but we also support [alternateMethods: alternate installation methods]. To integrate Sentry into your Xcode project using SPM, open your App in Xcode and open [addPackage: File > Add Packages]. Then add the SDK by entering the Git repo url in the top right search field:',
            {
              alternateMethods: (
                <ExternalLink href="https://docs.sentry.io/platforms/apple/install/" />
              ),
              addPackage: <strong />,
            }
          ),
        },
        {
          language: 'url',
          code: `https://github.com/getsentry/sentry-cocoa.git`,
        },
        {
          description: (
            <p>
              {tct(
                'Alternatively, when your project uses a [packageSwift: Package.swift] file to manage dependencies, you can specify the target with:',
                {
                  packageSwift: <code />,
                }
              )}
            </p>
          ),
          language: 'swift',
          partialLoading: params.sourcePackageRegistries.isLoading,
          code: getInstallSnippet(params),
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'To configure profiling, assign a closure to [code:SentryOptions.configureProfiling], setting the desired options on the object passed in as parameter.',
        {
          code: <code />,
        }
      ),
      configurations: [
        {
          code: [
            {
              label: 'Swift',
              value: 'swift',
              language: 'swift',
              code: `
import Sentry

SentrySDK.start { options in
    options.dsn = "${params.dsn.public}"
    // Tracing must be enabled for profiling
    options.tracesSampleRate = 1
    // Configure the profiler to start profiling when there is an active root span
    options.configureProfiling = {
        $0.lifecycle = .trace
        $0.sessionSampleRate = 1
    }
}`,
            },
          ],
          additionalInfo: tct(
            'For more detailed information on profiling, see the [link:profiling documentation].',
            {
              link: (
                <ExternalLink
                  href={`https://docs.sentry.io/platforms/apple/profiling/`}
                />
              ),
            }
          ),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: t(
        'Verify that profiling is working correctly by simply using your application.'
      ),
    },
  ],
};
