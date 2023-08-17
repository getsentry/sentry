import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
export const steps = ({
  dsn,
}: {
  dsn?: string;
} = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: (
      <p>
        {tct('Install our Python SDK using [code:pip]:', {
          code: <code />,
        })}
      </p>
    ),
    configurations: [
      {
        language: 'bash',
        code: 'pip install --upgrade sentry-sdk',
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: t(
      "Import and initialize the Sentry SDK early in your application's setup:"
    ),
    configurations: [
      {
        language: 'python',
        code: `
import sentry_sdk

sentry_sdk.init(
  dsn="${dsn}",

  # Set traces_sample_rate to 1.0 to capture 100%
  # of transactions for performance monitoring.
  # We recommend adjusting this value in production.
  traces_sample_rate=1.0
)
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
      'One way to verify your setup is by intentionally causing an error that breaks your application.'
    ),
    configurations: [
      {
        language: 'python',
        description: t(
          'Raise an unhandled Python exception by inserting a divide by zero expression into your application:'
        ),
        code: 'division_by_zero = 1 / 0',
      },
    ],
  },
];
// Configuration End

export function GettingStartedWithPython({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} {...props} />;
}

export default GettingStartedWithPython;
