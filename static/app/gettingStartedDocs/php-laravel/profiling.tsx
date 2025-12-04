import {ExternalLink} from 'sentry/components/core/link';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getConfigureSnippet} from 'sentry/gettingStartedDocs/php-laravel/utils';
import {t, tct} from 'sentry/locale';

export const profiling: OnboardingConfig = {
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
  install: () => [
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
            'Verify that profiling is working correctly by simply using your application.'
          ),
        },
      ],
    },
  ],
  nextSteps: () => [],
};
