import {ExternalLink} from 'sentry/components/core/link';
import type {
  ContentBlock,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getConfigureSnippet} from 'sentry/gettingStartedDocs/php-laravel/utils';
import {t, tct} from 'sentry/locale';

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

export const onboarding: OnboardingConfig = {
  introduction: () => (
    <p>
      {tct(
        'This guide is for Laravel 11.0 and up. We also provide instructions for [otherVersionsLink:other versions] as well as [lumenSpecificLink:Lumen-specific instructions].',
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
  install: (params: DocsParams) => [
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
  configure: (params: DocsParams) => [
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
        {
          type: 'conditional',
          condition: params.isLogsSelected,
          content: [
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
          ],
        },
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
  verify: (params: DocsParams) => [
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
        {
          type: 'conditional',
          condition: params.isLogsSelected,
          content: [
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
          ],
        },
      ],
    },
  ],
  nextSteps: () => [],
};
