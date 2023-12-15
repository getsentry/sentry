import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import replayOnboardingJsLoader from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const onboarding: OnboardingConfig = {
  introduction: () =>
    tct(
      'This guide is for Laravel 8+. We also provide instructions for [otherVersionsLink:other versions] as well as [lumenSpecificLink:Lumen-specific instructions].',
      {
        otherVersionsLink: (
          <ExternalLink href="https://docs.sentry.io/platforms/php/guides/laravel/other-versions/" />
        ),
        lumenSpecificLink: (
          <ExternalLink href="https://docs.sentry.io/platforms/php/guides/laravel/other-versions/lumen/" />
        ),
      }
    ),
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      configurations: [
        {
          description: (
            <p>
              {tct('Install the [code:sentry/sentry-laravel] package:', {
                code: <code />,
              })}
            </p>
          ),
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
            ]
          : []),
        {
          description: (
            <p>
              {tct(
                'Enable capturing unhandled exception to report to Sentry by making the following change to your [code:App/Exceptions/Handler.php]:',
                {
                  code: <code />,
                }
              )}
            </p>
          ),
          language: 'php',
          code: `
  public function register() {
    $this->reportable(function (Throwable $e) {
      if (app()->bound('sentry')) {
        app('sentry')->captureException($e);
      }
    });
  }
          `,
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
          code: `php artisan sentry:publish --dsn=${params.dsn}`,
        },
        {
          description: (
            <p>
              {tct(
                'It creates the config file ([sentryPHPCode:config/sentry.php]) and adds the [dsnCode:DSN] to your [envCode:.env] file where you can add further configuration options:',
                {sentryPHPCode: <code />, dsnCode: <code />, envCode: <code />}
              )}
            </p>
          ),
          language: 'shell',
          code: `SENTRY_LARAVEL_DSN=${params.dsn}${
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
          }`,
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      configurations: [
        {
          description: (
            <p>
              {tct(
                'You can test your configuration using the provided [code:sentry:test] artisan command:',
                {
                  code: <code />,
                }
              )}
            </p>
          ),
          language: 'shell',
          code: 'php artisan sentry:test',
        },
      ],
    },
  ],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
};

export default docs;
