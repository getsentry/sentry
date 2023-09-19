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
            {tct(
              'To install the PHP SDK, you need to be using Composer in your project. For more details about Composer, see the [composerDocumentationLink:Composer documentation].',
              {
                composerDocumentationLink: (
                  <ExternalLink href="https://getcomposer.org/doc/" />
                ),
              }
            )}
          </p>
        ),
        language: 'bash',
        code: 'composer require sentry/sdk',
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
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: t(
      'To capture all errors, even the one during the startup of your application, you should initialize the Sentry PHP SDK as soon as possible.'
    ),
    configurations: [
      {
        language: 'php',
        code: `\\Sentry\\init([
    'dsn' => '${dsn}',${
      hasPerformance
        ? `
    // Specify a fixed sample rate
    'traces_sample_rate' => 1.0,`
        : ''
    }${
      hasProfiling
        ? `
    // Set a sampling rate for profiling - this is relative to traces_sample_rate
    'profiles_sample_rate' => 1.0,`
        : ''
    }
]);`,
        additionalInfo: hasPerformance && (
          <p>
            {tct(
              'To instrument certain regions of your code, you can [instrumentationLink:create transactions to capture them].',
              {
                instrumentationLink: (
                  <ExternalLink href="https://docs.sentry.io/platforms/php/performance/instrumentation/custom-instrumentation/" />
                ),
              }
            )}
          </p>
        ),
      },
    ],
  },
  {
    type: StepType.VERIFY,
    description: t(
      'In PHP you can either capture a caught exception or capture the last error with captureLastError.'
    ),
    configurations: [
      {
        language: 'php',
        code: `
try {
  $this->functionFailsForSure();
} catch (\\Throwable $exception) {
  \\Sentry\\captureException($exception);
}`,
      },
    ],
  },
];
// Configuration End

export function GettingStartedWithPHP({
  dsn,
  activeProductSelection = [],
  ...props
}: ModuleProps) {
  const hasPerformance = activeProductSelection.includes(
    ProductSolution.PERFORMANCE_MONITORING
  );
  const hasProfiling = activeProductSelection.includes(ProductSolution.PROFILING);
  return <Layout steps={steps({dsn, hasPerformance, hasProfiling})} {...props} />;
}

export default GettingStartedWithPHP;
