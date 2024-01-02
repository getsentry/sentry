import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getMidlewareSetupSnippet = () => `
from raven.contrib.pylons import Sentry

application = Sentry(application, config)`;

const getConfigurationSnippet = (params: Params) => `
[sentry]
dsn=${params.dsn}
include_paths=my.package,my.other.package,
exclude_paths=my.package.crud`;

const getLoggerSnippet = () => `
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
datefmt = %H:%M:%S`;

const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'If you haven’t already, start by downloading Raven. The easiest way is with [code:pip]:',
        {code: <code />}
      ),
      configurations: [
        {
          language: 'bash',
          code: 'pip install raven --upgrade',
        },
      ],
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      configurations: [
        {
          language: 'python',
          description: t(
            'A Pylons-specific middleware exists to enable easy configuration from settings:'
          ),
          code: getMidlewareSetupSnippet(),
        },
        {
          language: 'ini',
          description: t('Configuration is handled via the sentry namespace:'),
          code: getConfigurationSnippet(params),
        },
      ],
    },
    {
      title: t('Logger setup'),
      configurations: [
        {
          language: 'python',
          description: tct(
            'Add the following lines to your project’s [initCode:.ini] file to setup [sentryHandlerCode:SentryHandler]:',
            {
              initCode: <code />,
              sentryHandlerCode: <code />,
            }
          ),
          code: getLoggerSnippet(),
        },
      ],
      additionalInfo: t('You may want to set up other loggers as well.'),
    },
  ],
  verify: () => [],
};

const docs: Docs = {
  onboarding,
};

export default docs;
