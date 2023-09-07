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
          'If you haven’t already, start by downloading Raven. The easiest way is with [code:pip]:',
          {code: <code />}
        )}
      </p>
    ),
    configurations: [
      {
        language: 'bash',
        code: 'pip install raven --upgrade',
      },
    ],
  },
  {
    title: t('WSGI Middleware'),
    configurations: [
      {
        language: 'python',
        description: t(
          'A Pylons-specific middleware exists to enable easy configuration from settings:'
        ),
        code: `
from raven.contrib.pylons import Sentry

application = Sentry(application, config)
      `,
      },
      {
        language: 'ini',
        description: t('Configuration is handled via the sentry namespace:'),
        code: `
[sentry]
dsn=${dsn}
include_paths=my.package,my.other.package,
exclude_paths=my.package.crud
      `,
      },
    ],
  },
  {
    title: t('Logger setup'),
    configurations: [
      {
        language: 'python',
        description: (
          <p>
            {tct(
              'Add the following lines to your project’s [initCode:.ini] file to setup [sentryHandlerCode:SentryHandler]:',
              {
                initCode: <code />,
                sentryHandlerCode: <code />,
              }
            )}
          </p>
        ),
        code: `
[loggers]
keys = root, sentry

[handlers]
keys = console, sentry

[formatters]
keys = generic

[logger_root]
level = INFO
handlers = console, sentry

[logger_sentry]
level = WARN
handlers = console
qualname = sentry.errors
propagate = 0

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[handler_sentry]
class = raven.handlers.logging.SentryHandler
args = ('SENTRY_DSN',)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(asctime)s,%(msecs)03d %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
      `,
      },
    ],
    additionalInfo: t('You may want to set up other loggers as well.'),
  },
];
// Configuration End

export function GettingStartedWithPylons({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} {...props} />;
}

export default GettingStartedWithPylons;
