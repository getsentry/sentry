import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {tct} from 'sentry/locale';

// Configuration Start
export const steps = ({
  dsn,
}: Partial<Pick<ModuleProps, 'dsn'>> = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: (
      <p>
        {tct('Install the SDK via Rubygems by adding it to your [code:Gemfile]:', {
          code: <code />,
        })}
      </p>
    ),
    configurations: [
      {
        language: 'ruby',
        code: `gem "sentry-ruby"`,
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct(
          'Add use [sentryRackCode:Sentry::Rack::CaptureExceptions] to your [sentryConfigCode:config.ru] or other rackup file (this is automatically inserted in Rails):',
          {
            sentryRackCode: <code />,
            sentryConfigCode: <code />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'ruby',
        code: `
require 'sentry-ruby'

Sentry.init do |config|
  config.dsn = '${dsn}'

  # Set traces_sample_rate to 1.0 to capture 100%
  # of transactions for performance monitoring.
  # We recommend adjusting this value in production.
  config.traces_sample_rate = 1.0
  # or
  config.traces_sampler = lambda do |context|
    true
  end
end

use Sentry::Rack::CaptureExceptions
        `,
      },
    ],
  },
];
// Configuration End

export function GettingStartedWithRubyRack({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} {...props} />;
}

export default GettingStartedWithRubyRack;
