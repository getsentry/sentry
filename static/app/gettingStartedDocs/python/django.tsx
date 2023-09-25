import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {t, tct} from 'sentry/locale';

// Configuration Start
const performanceConfiguration = `    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for performance monitoring.
    traces_sample_rate=1.0,`;

const profilingConfiguration = `    # Set profiles_sample_rate to 1.0 to profile 100%
    # of sampled transactions.
    # We recommend adjusting this value in production.
    profiles_sample_rate=1.0,`;

const introduction = (
  <p>
    {tct('The Django integration adds support for the [link:Django Web Framework].', {
      link: <ExternalLink href="https://www.djangoproject.com/" />,
    })}
  </p>
);

export const steps = ({
  sentryInitContent,
}: {
  sentryInitContent?: string;
} = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: (
      <p>
        {tct('The Django integration adds support for the [link:Django Web Framework].', {
          link: <ExternalLink href="https://www.djangoproject.com/" />,
        })}
      </p>
    ),
    configurations: [
      {
        language: 'bash',
        description: (
          <p>
            {tct(
              'Install [code:sentry-sdk] from PyPI with the [sentryDjangoCode:django] extra:',
              {
                code: <code />,
                sentryDjangoCode: <code />,
              }
            )}
          </p>
        ),
        code: 'pip install --upgrade sentry-sdk[django]',
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct(
          'If you have the [codeDjango:django] package in your dependencies, the Django integration will be enabled automatically when you initialize the Sentry SDK. Initialize the Sentry SDK in your Django [codeSettings:settings.py] file:',
          {
            codeDjango: <code />,
            codeSettings: <code />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'python',
        code: `# settings.py
import sentry_sdk

sentry_sdk.init(
${sentryInitContent}
)`,
      },
    ],
  },
  {
    type: StepType.VERIFY,
    description: t(
      'You can easily verify your Sentry installation by creating a route that triggers an error:'
    ),
    configurations: [
      {
        language: 'python',

        code: `# urls.py
from django.urls import path

def trigger_error(request):
    division_by_zero = 1 / 0

urlpatterns = [
    path('sentry-debug/', trigger_error),
    # ...
]
        `,
      },
    ],
    additionalInfo: (
      <div>
        <p>
          {tct(
            'When you point your browser to [link:http://localhost:8000/sentry-debug/] a transaction in the Performance section of Sentry will be created.',
            {
              link: <ExternalLink href="http://localhost:8000/" />,
            }
          )}
        </p>
        <p>
          {t(
            'Additionally, an error event will be sent to Sentry and will be connected to the transaction.'
          )}
        </p>
        <p>{t('It takes a couple of moments for the data to appear in Sentry.')}</p>
      </div>
    ),
  },
];
// Configuration End

export function GettingStartedWithDjango({
  dsn,
  activeProductSelection = [],
  ...props
}: ModuleProps) {
  const otherConfigs: string[] = [];

  let sentryInitContent: string[] = [`    dsn="${dsn}",`];

  if (activeProductSelection.includes(ProductSolution.PERFORMANCE_MONITORING)) {
    otherConfigs.push(performanceConfiguration);
  }

  if (activeProductSelection.includes(ProductSolution.PROFILING)) {
    otherConfigs.push(profilingConfiguration);
  }

  sentryInitContent = sentryInitContent.concat(otherConfigs);

  return (
    <Layout
      introduction={introduction}
      steps={steps({
        sentryInitContent: sentryInitContent.join('\n'),
      })}
      {...props}
    />
  );
}

export default GettingStartedWithDjango;
