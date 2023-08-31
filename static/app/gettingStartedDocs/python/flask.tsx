import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {t, tct} from 'sentry/locale';

// Configuration Start

const profilingConfiguration = `    # Set profiles_sample_rate to 1.0 to profile 100%
    # of sampled transactions.
    # We recommend adjusting this value in production.
    profiles_sample_rate=1.0,`;

const performanceConfiguration = `    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for performance monitoring.
    # We recommend adjusting this value in production.
    traces_sample_rate=1.0,`;

export const steps = ({
  sentryInitContent,
}: {
  sentryInitContent: string;
}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: (
      <p>
        {tct(
          'The Flask integration adds support for the [flaskWebFrameworkLink:Flask Web Framework].',
          {
            flaskWebFrameworkLink: (
              <ExternalLink href="https://flask.palletsprojects.com/en/2.3.x/" />
            ),
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'bash',
        description: (
          <p>
            {tct(
              'Install [sentrySdkCode:sentry-sdk] from PyPI with the [sentryFlaskCode:flask] extra:',
              {
                sentrySdkCode: <code />,
                sentryFlaskCode: <code />,
              }
            )}
          </p>
        ),
        code: "pip install --upgrade 'sentry-sdk[flask]'",
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: t(
      'To configure the SDK, initialize it with the integration before or after your app has been initialized:'
    ),
    configurations: [
      {
        language: 'python',
        code: `
import sentry_sdk
from flask import Flask
from sentry_sdk.integrations.flask import FlaskIntegration

sentry_sdk.init(
${sentryInitContent}
)

app = Flask(__name__)
        `,
      },
    ],
    additionalInfo: (
      <p>
        {tct(
          'The above configuration captures both error and performance data. To reduce the volume of performance data captured, change [code:traces_sample_rate] to a value between 0 and 1.',
          {code: <code />}
        )}
      </p>
    ),
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
@app.route('/debug-sentry')
def trigger_error():
  division_by_zero = 1 / 0
        `,
      },
    ],
    additionalInfo: t(
      'Visiting this route will trigger an error that will be captured by Sentry.'
    ),
  },
];
// Configuration End

export function GettingStartedWithFlask({
  dsn,
  activeProductSelection = [],
  ...props
}: ModuleProps) {
  const otherConfigs: string[] = [];

  let sentryInitContent: string[] = [
    `    dsn="${dsn}",`,
    `    integrations=[FlaskIntegration()],`,
  ];

  if (activeProductSelection.includes(ProductSolution.PERFORMANCE_MONITORING)) {
    otherConfigs.push(performanceConfiguration);
  }

  if (activeProductSelection.includes(ProductSolution.PROFILING)) {
    otherConfigs.push(profilingConfiguration);
  }

  sentryInitContent = sentryInitContent.concat(otherConfigs);

  return (
    <Layout
      steps={steps({
        sentryInitContent: sentryInitContent.join('\n'),
      })}
      {...props}
    />
  );
}

export default GettingStartedWithFlask;
