import {Alert} from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
  getCrashReportSDKInstallFirstStep,
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
      configurations: [
        {
          description: tct('Install the [code:sentry/sentry-laravel] package:', {
            code: <code />,
          }),
          language: 'bash',
          code: `composer require sentry/sentry-laravel`,
        },
        ...(params.isProfilingSelected
          ? [
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
            ]
          : []),
        {
          description: tct(
            'Enable capturing unhandled exception to report to Sentry by making the following change to your [code:bootstrap/app.php]:',
            {
              code: <code />,
            }
          ),
          language: 'php',
          code: getExceptionHandlerSnippet(),
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
        {
          description: (
            <Alert.Container>
              <Alert margin type="warning">
                {tct(
                  'In order to receive stack trace arguments in your errors, make sure to set [code:zend.exception_ignore_args: Off] in your php.ini',
                  {
                    code: <code />,
                  }
                )}
              </Alert>
            </Alert.Container>
          ),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      configurations: [
        {
          description: tct(
            'You can test your configuration using the provided [code:sentry:test] artisan command:',
            {
              code: <code />,
            }
          ),
          language: 'shell',
          code: 'php artisan sentry:test',
        },
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
      configurations: [
        getCrashReportSDKInstallFirstStep(params),
        {
          description: tct(
            'Next, create [code:resources/views/errors/500.blade.php], and embed the feedback code:',
            {code: <code />}
          ),
          code: [
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
          description: tct(
            'For Laravel 5 up to 5.4 there is some extra work needed. You need to open up [codeApp:App/Exceptions/Handler.php] and extend the [codeRender:render] method to make sure the 500 error is rendered as a view correctly, in 5.5+ this step is not required anymore.',
            {code: <code />}
          ),
          code: [
            {
              label: 'PHP',
              value: 'php',
              language: 'php',
              code: `<?php

use Symfony\Component\HttpKernel\Exception\HttpException;

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
      description: getCrashReportModalConfigDescription({
        link: 'https://docs.sentry.io/platforms/php/guides/laravel/user-feedback/configuration/#crash-report-modal',
      }),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  crashReportOnboarding,
  feedbackOnboardingJsLoader,
};

export default docs;
