import {ExternalLink} from 'sentry/components/core/link';
import type {
  ContentBlock,
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
  getCrashReportSDKInstallFirstBlocks,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getExceptionHandlerSnippet = () => `
<?php

use Illuminate\\Foundation\\Application;
use Illuminate\\Foundation\\Configuration\\Exceptions;
use Illuminate\\Foundation\\Configuration\\Middleware;
use Sentry\\Laravel\\Integration;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        //
    })
    ->withExceptions(function (Exceptions $exceptions) {
        Integration::handles($exceptions);
    })->create();`;

const getConfigureSnippet = (params: Params) =>
  `SENTRY_LARAVEL_DSN=${params.dsn.public}${
    params.isPerformanceSelected
      ? `
# Specify a fixed sample rate
SENTRY_TRACES_SAMPLE_RATE=1.0`
      : ''
  }${
    params.isProfilingSelected
      ? `
# Set a sampling rate for profiling - this is relative to traces_sample_rate
SENTRY_PROFILES_SAMPLE_RATE=1.0`
      : ''
  }${
    params.isLogsSelected
      ? `
# Enable logs to be sent to Sentry
SENTRY_ENABLE_LOGS=true
# Configure logging to use both file and Sentry
LOG_CHANNEL=stack
LOG_STACK=single,sentry_logs`
      : ''
  }`;

const onboarding: OnboardingConfig = {
  introduction: () => (
    <p>
      {tct(
        'This guide is for Laravel 11.0 an up. We also provide instructions for [otherVersionsLink:other versions] as well as [lumenSpecificLink:Lumen-specific instructions].',
        {
          otherVersionsLink: (
            <ExternalLink href="https://docs.sentry.io/platforms/php/guides/laravel/other-versions/" />
          ),
          lumenSpecificLink: (
            <ExternalLink href="https://docs.sentry.io/platforms/php/guides/laravel/other-versions/lumen/" />
          ),
        }
      )}
    </p>
  ),
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct('Install the [code:sentry/sentry-laravel] package:', {
            code: <code />,
          }),
        },
        {
          type: 'code',
          language: 'bash',
          code: `composer require sentry/sentry-laravel`,
        },
        ...(params.isProfilingSelected
          ? ([
              {
                type: 'text',
                text: t('Install the Excimer extension via PECL:'),
              },
              {
                type: 'code',
                language: 'bash',
                code: 'pecl install excimer',
              },
              {
                type: 'text',
                text: tct(
                  "The Excimer PHP extension supports PHP 7.2 and up. Excimer requires Linux or macOS and doesn't support Windows. For additional ways to install Excimer, see [sentryPhpDocumentationLink: Sentry documentation].",
                  {
                    sentryPhpDocumentationLink: (
                      <ExternalLink href="https://docs.sentry.io/platforms/php/profiling/#installation" />
                    ),
                  }
                ),
              },
            ] satisfies ContentBlock[])
          : []),
        {
          type: 'text',
          text: tct(
            'Enable capturing unhandled exception to report to Sentry by making the following change to your [code:bootstrap/app.php]:',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'php',
          code: getExceptionHandlerSnippet(),
        },
      ],
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: t('Configure the Sentry DSN with this command:'),
        },
        {
          type: 'code',
          language: 'shell',
          code: `php artisan sentry:publish --dsn=${params.dsn.public}`,
        },
        {
          type: 'text',
          text: tct(
            'It creates the config file ([code:config/sentry.php]) and adds the [code:DSN] to your [code:.env] file where you can add further configuration options:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'shell',
          code: getConfigureSnippet(params),
        },
        ...(params.isLogsSelected
          ? ([
              {
                type: 'text',
                text: tct(
                  'To configure Sentry as a log channel, add the following config to the [code:channels] section in [code:config/logging.php]. If this file does not exist, run [code:php artisan config:publish logging] to publish it:',
                  {code: <code />}
                ),
              },
              {
                type: 'code',
                language: 'php',
                code: `'channels' => [
    // ...
    'sentry_logs' => [
        'driver' => 'sentry_logs',
        // The minimum logging level at which this handler will be triggered
        // Available levels: debug, info, notice, warning, error, critical, alert, emergency
        'level' => env('LOG_LEVEL', 'info'), // defaults to \`debug\` if not set
    ],
],`,
              },
            ] satisfies ContentBlock[])
          : []),
        {
          type: 'alert',
          alertType: 'warning',
          showIcon: false,
          text: tct(
            'In order to receive stack trace arguments in your errors, make sure to set [code:zend.exception_ignore_args: Off] in your php.ini',
            {
              code: <code />,
            }
          ),
        },
      ],
    },
  ],
  verify: (params: Params) => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: tct(
            'You can test your configuration using the provided [code:sentry:test] artisan command:',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'shell',
          code: 'php artisan sentry:test',
        },
        ...(params.isLogsSelected
          ? ([
              {
                type: 'text',
                text: tct(
                  "Once you have configured Sentry as a log channel, you can use Laravel's built-in logging functionality to send logs to Sentry:",
                  {code: <code />}
                ),
              },
              {
                type: 'code',
                language: 'php',
                code: `use Illuminate\\Support\\Facades\\Log;

// Log to all channels in the stack (including Sentry)
Log::info('This is an info message');
Log::warning('User {id} failed to login.', ['id' => $user->id]);
Log::error('This is an error message');

// Log directly to the Sentry channel
Log::channel('sentry')->error('This will only go to Sentry');`,
              },
              {
                type: 'text',
                text: tct(
                  'You can also test your configuration using the Sentry logger directly:',
                  {code: <code />}
                ),
              },
              {
                type: 'code',
                language: 'php',
                code: `\\Sentry\\logger()->info('A test log message');
\\Sentry\\logger()->flush();`,
              },
            ] satisfies ContentBlock[])
          : []),
      ],
    },
  ],
  nextSteps: () => [],
};

const crashReportOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      content: [
        ...getCrashReportSDKInstallFirstBlocks(params),
        {
          type: 'text',
          text: tct(
            'Next, create [code:resources/views/errors/500.blade.php], and embed the feedback code:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'HTML',
              value: 'html',
              language: 'html',
              code: `<div class="content">
  <div class="title">Something went wrong.</div>

  @if(app()->bound('sentry') && app('sentry')->getLastEventId())
  <div class="subtitle">Error ID: {{ app('sentry')->getLastEventId() }}</div>
  <script>
    Sentry.init({ dsn: '${params.dsn.public}' });
    Sentry.showReportDialog({
      eventId: '{{ app('sentry')->getLastEventId() }}'
    });
  </script>
  @endif
</div>`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'For Laravel 5 up to 5.4 there is some extra work needed. You need to open up [codeApp:App/Exceptions/Handler.php] and extend the [codeRender:render] method to make sure the 500 error is rendered as a view correctly, in 5.5+ this step is not required anymore.',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'PHP',
              value: 'php',
              language: 'php',
              code: `<?php

use Symfony\\Component\\HttpKernel\\Exception\\HttpException;

class Handler extends ExceptionHandler
{
    public function report(Exception $exception)
    {
        if (app()->bound('sentry') && $this->shouldReport($exception)) {
            app('sentry')->captureException($exception);
        }

        parent::report($exception);
    }

    // This method is ONLY needed for Laravel 5 up to 5.4.
    // You can skip this method if you are using Laravel 5.5+.
    public function render($request, Exception $exception)
    {
        // Convert all non-http exceptions to a proper 500 http exception
        // if we don't do this exceptions are shown as a default template
        // instead of our own view in resources/views/errors/500.blade.php
        if ($this->shouldReport($exception) && !$this->isHttpException($exception) && !config('app.debug')) {
            $exception = new HttpException(500, 'Whoops!');
        }

        return parent::render($request, $exception);
    }
}`,
            },
          ],
        },
      ],
    },
  ],
  configure: () => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getCrashReportModalConfigDescription({
            link: 'https://docs.sentry.io/platforms/php/guides/laravel/user-feedback/configuration/#crash-report-modal',
          }),
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const profilingOnboarding: OnboardingConfig = {
  introduction: () => (
    <p>
      {tct(
        'This guide is for Laravel 11.0 an up. We also provide instructions for [otherVersionsLink:other versions] as well as [lumenSpecificLink:Lumen-specific instructions].',
        {
          otherVersionsLink: (
            <ExternalLink href="https://docs.sentry.io/platforms/php/guides/laravel/other-versions/" />
          ),
          lumenSpecificLink: (
            <ExternalLink href="https://docs.sentry.io/platforms/php/guides/laravel/other-versions/lumen/" />
          ),
        }
      )}
    </p>
  ),
  install: () => [
    {
      type: StepType.INSTALL,
      configurations: [
        {
          description: tct('Install the [code:sentry/sentry-laravel] package:', {
            code: <code />,
          }),
          language: 'bash',
          code: `composer require sentry/sentry-laravel`,
        },
        {
          description: t('Install the Excimer extension via PECL:'),
          language: 'bash',
          code: 'pecl install excimer',
        },
        {
          description: tct(
            "The Excimer PHP extension supports PHP 7.2 and up. Excimer requires Linux or macOS and doesn't support Windows. For additional ways to install Excimer, see [sentryPhpDocumentationLink: Sentry documentation].",
            {
              sentryPhpDocumentationLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/php/profiling/#installation" />
              ),
            }
          ),
        },
      ],
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      configurations: [
        {
          description: t('Configure the Sentry DSN with this command:'),
          language: 'shell',
          code: `php artisan sentry:publish --dsn=${params.dsn.public}`,
        },
        {
          description: tct(
            'It creates the config file ([code:config/sentry.php]) and adds the [code:DSN] to your [code:.env] file where you can add further configuration options:',
            {code: <code />}
          ),
          language: 'shell',
          code: getConfigureSnippet(params),
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
  nextSteps: () => [],
};

const logsOnboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'To start using logs, install the latest version of the Sentry Laravel SDK. Logs are supported in version [code:4.15.0] and above of the SDK.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'bash',
          code: 'composer require sentry/sentry-laravel',
        },
      ],
    },
  ],
  configure: () => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'To configure Sentry as a log channel, add the following config to the [code:channels] section in [code:config/logging.php]. If this file does not exist, run [code:php artisan config:publish logging] to publish it.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'php',
              language: 'php',
              filename: 'config/logging.php',
              code: `'channels' => [
    // ...
    'sentry_logs' => [
        'driver' => 'sentry_logs',
        // The minimum logging level at which this handler will be triggered
        // Available levels: debug, info, notice, warning, error, critical, alert, emergency
        'level' => env('LOG_LEVEL', 'info'), // defaults to \`debug\` if not set
    ],
],`,
            },
          ],
        },
        {
          type: 'text',
          text: t(
            'After you configured the Sentry log channel, you can configure your app to both log to a log file and to Sentry by modifying the log stack:'
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'bash',
              language: 'bash',
              filename: '.env',
              code: `# ...
LOG_CHANNEL=stack
LOG_STACK=single,sentry_logs
# ...`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'You will also need to configure the Sentry Laravel SDK to enable the logging integration. You can do this by updating your [code:.env] file to include the following:',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'bash',
              language: 'bash',
              filename: '.env',
              code: `# ...
SENTRY_ENABLE_LOGS=true
# ...`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'Also make sure your [code:config/sentry.php] file is up to date. You can find the latest version on [externalLink:GitHub].',
            {
              code: <code />,
              externalLink: (
                <ExternalLink href="https://github.com/getsentry/sentry-laravel/blob/master/config/sentry.php" />
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
      content: [
        {
          type: 'text',
          text: t(
            "Once you have configured Sentry as a log channel, you can use Laravel's built-in logging functionality to send logs to Sentry:"
          ),
        },
        {
          type: 'code',
          language: 'php',
          code: `use Illuminate\\Support\\Facades\\Log;

// Log to all channels in the stack (including Sentry)
Log::info('This is an info message');
Log::warning('User {id} failed to login.', ['id' => $user->id]);
Log::error('This is an error message');

// Log directly to the Sentry channel
Log::channel('sentry_logs')->error('This will only go to Sentry');`,
        },
      ],
    },
  ],
};

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  profilingOnboarding,
  crashReportOnboarding,
  feedbackOnboardingJsLoader,
  logsOnboarding,
};

export default docs;
