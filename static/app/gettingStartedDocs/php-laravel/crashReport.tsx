import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
  getCrashReportSDKInstallFirstBlocks,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {tct} from 'sentry/locale';

export const crashReport: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: DocsParams) => [
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
