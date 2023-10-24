import {Fragment} from 'react';

import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
const introduction = (
  <Fragment>
    <p>{t('In Rails, all uncaught exceptions will be automatically reported.')}</p>
    <p>{t('We support Rails 5 and newer.')}</p>
  </Fragment>
);
export const steps = ({
  dsn,
}: Partial<Pick<ModuleProps, 'dsn'>> = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: (
      <p>
        {tct(
          'Add [sentryRubyCode:sentry-ruby] and [sentryRailsCode:sentry-rails] to your [sentryGemfileCode:Gemfile]:',
          {
            sentryRubyCode: <code />,
            sentryRailsCode: <code />,
            sentryGemfileCode: <code />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'ruby',
        code: `
gem "sentry-ruby"
gem "sentry-rails"
        `,
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct('Initialize the SDK within your [code:config/initializers/sentry.rb]:', {
          code: <code />,
        })}
      </p>
    ),
    configurations: [
      {
        language: 'ruby',
        code: `
Sentry.init do |config|
  config.dsn = '${dsn}'
  config.breadcrumbs_logger = [:active_support_logger, :http_logger]

  # Set traces_sample_rate to 1.0 to capture 100%
  # of transactions for performance monitoring.
  # We recommend adjusting this value in production.
  config.traces_sample_rate = 1.0
  # or
  config.traces_sampler = lambda do |context|
    true
  end
end
        `,
      },
    ],
  },
  {
    title: t('Caveats'),
    description: (
      <p>
        {tct(
          'Currently, custom exception applications [code:(config.exceptions_app)] are not supported. If you are using a custom exception app, you must manually integrate Sentry yourself.',
          {
            code: <code />,
          }
        )}
      </p>
    ),
  },
];
// Configuration End

export function GettingStartedWithRubyRails({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} introduction={introduction} {...props} />;
}

export default GettingStartedWithRubyRails;
