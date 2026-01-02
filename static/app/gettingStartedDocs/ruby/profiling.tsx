import {ExternalLink} from 'sentry/components/core/link';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

export const profiling = ({
  frameworkPackage,
}: {frameworkPackage?: string} = {}): OnboardingConfig => ({
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'We use the [code:stackprof] [stackprofLink:gem] to collect profiles for Ruby.',
            {
              code: <code />,
              stackprofLink: <ExternalLink href="https://github.com/tmm1/stackprof" />,
            }
          ),
        },
        {
          type: 'text',
          text: tct(
            'First add [code:stackprof] to your [code:Gemfile] and make sure it is loaded before the Sentry SDK.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'ruby',
          code: `
gem 'stackprof'
gem 'sentry-ruby'${
            frameworkPackage
              ? `
gem '${frameworkPackage}'`
              : ''
          }`,
        },
      ],
    },
  ],
  configure: (params: DocsParams) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'Then, make sure both [code:traces_sample_rate] and [code:profiles_sample_rate] are set and non-zero in your Sentry initializer.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Ruby',
              filename: 'config/initializers/sentry.rb',
              language: 'ruby',
              code: `
Sentry.init do |config|
  config.dsn = "${params.dsn.public}"
  config.traces_sample_rate = 1.0
  config.profiles_sample_rate = 1.0
end
                   `,
            },
          ],
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Verify that profiling is working correctly by simply using your application.'
          ),
        },
      ],
    },
  ],
});
