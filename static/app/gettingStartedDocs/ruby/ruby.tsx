import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
export const steps = ({
  dsn,
}: Partial<Pick<ModuleProps, 'dsn'>> = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: (
      <p>
        {tct(
          'Sentry Ruby comes as a gem and is straightforward to install. If you are using Bundler just add this to your [code:Gemfile]:',
          {code: <code />}
        )}
      </p>
    ),
    configurations: [
      {
        language: 'ruby',
        code: 'gem "sentry-ruby"',
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct(
          'To use Sentry Ruby all you need is your DSN. Like most Sentry libraries it will honor the [sentryDSN:SENTRY_DSN] environment variable. You can find it on the project settings page under API Keys. You can either export it as environment variable or manually configure it with [sentryInit:Sentry.init]:',
          {sentryDSN: <code />, sentryInit: <code />}
        )}
      </p>
    ),
    configurations: [
      {
        language: 'ruby',
        code: `
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
        `,
      },
    ],
  },
  {
    type: StepType.VERIFY,
    description: t('You can then report errors or messages to Sentry:'),
    configurations: [
      {
        language: 'ruby',

        code: `
begin
  1 / 0
rescue ZeroDivisionError => exception
  Sentry.capture_exception(exception)
end

Sentry.capture_message("test message")
        `,
      },
    ],
  },
];
// Configuration End

export function GettingStartedWithRuby({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} {...props} />;
}

export default GettingStartedWithRuby;
