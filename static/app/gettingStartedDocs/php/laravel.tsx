import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {t, tct} from 'sentry/locale';

interface StepsParams {
  dsn: string;
  hasPerformance: boolean;
  hasProfiling: boolean;
}

// Configuration Start
const introduction = (
  <p>
    {tct(
      'This guide is for Laravel 8+. We also provide instructions for [otherVersionsLink:other versions] as well as [lumenSpecificLink:Lumen-specific instructions].',
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
);

export const steps = ({
  dsn,
  hasPerformance,
  hasProfiling,
}: StepsParams): LayoutProps['steps'] => [
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
      ...(hasProfiling
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
  {
    type: StepType.CONFIGURE,
    configurations: [
      {
        description: t('Configure the Sentry DSN with this command:'),
        language: 'shell',
        code: `php artisan sentry:publish --dsn=${dsn}`,
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
        code: `SENTRY_LARAVEL_DSN=${dsn}${
          hasPerformance
            ? `
# Specify a fixed sample rate
SENTRY_TRACES_SAMPLE_RATE=1.0`
            : ''
        }${
          hasProfiling
            ? `
# Set a sampling rate for profiling - this is relative to traces_sample_rate
SENTRY_PROFILES_SAMPLE_RATE=1.0`
            : ''
        }`,
      },
    ],
  },
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
];
// Configuration End

export function GettingStartedWithLaravel({
  dsn,
  activeProductSelection = [],
  ...props
}: ModuleProps) {
  const hasPerformance = activeProductSelection.includes(
    ProductSolution.PERFORMANCE_MONITORING
  );
  const hasProfiling = activeProductSelection.includes(ProductSolution.PROFILING);
  return (
    <Layout
      introduction={introduction}
      steps={steps({dsn, hasPerformance, hasProfiling})}
      {...props}
    />
  );
}

export default GettingStartedWithLaravel;
