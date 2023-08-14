import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {t, tct} from 'sentry/locale';

// Configuration Start

const profilingConfiguration = `
# To set a uniform sample rate
# Set profiles_sample_rate to 1.0 to profile 100%
# of sampled transactions.
# We recommend adjusting this value in production,
profiles_sample_rate=1.0,
`;

const performanceConfiguration = `
# Set traces_sample_rate to 1.0 to capture 100%
# of transactions for performance monitoring.
# We recommend adjusting this value in production.
traces_sample_rate=1.0,
`;

const piiConfiguration = `
# If you wish to associate users to errors (assuming you are using
# django.contrib.auth) you may enable sending PII data.
send_default_pii=True,
`;

export const steps = ({
  sentryInitContent,
}: {
  sentryInitContent?: string;
} = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: (
      <p>
        {tct(
          'The Django integration adds support for the [link:Django Web Framework] from Version 1.6 upwards.',
          {link: <ExternalLink href="https://www.djangoproject.com/" />}
        )}
      </p>
    ),
    configurations: [
      {
        language: 'bash',
        description: <p>{tct('Install [code:sentry-sdk]:', {code: <code />})}</p>,
        code: 'pip install --upgrade sentry-sdk',
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct(
          'To configure the SDK, initialize it with the Django integration in your [code:settings.py] file:',
          {code: <code />}
        )}
      </p>
    ),
    configurations: [
      {
        language: 'python',
        code: `
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration
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

        code: `
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
    additionalInfo: t(
      'Visiting this route will trigger an error that will be captured by Sentry.'
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

  let sentryInitContent: string[] = [
    `dsn="${dsn}",`,
    `integrations=[DjangoIntegration()],`,
    piiConfiguration.trim(),
  ];

  if (activeProductSelection.includes(ProductSolution.PERFORMANCE_MONITORING)) {
    otherConfigs.push(performanceConfiguration.trim());
  }

  if (activeProductSelection.includes(ProductSolution.PROFILING)) {
    otherConfigs.push(profilingConfiguration.trim());
  }

  if (otherConfigs.length > 0) {
    sentryInitContent = sentryInitContent.concat(otherConfigs);
  }

  return (
    <Layout
      steps={steps({
        sentryInitContent: sentryInitContent.join('\n'),
      })}
      {...props}
    />
  );
}

export default GettingStartedWithDjango;
