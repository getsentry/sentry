import ExternalLink from 'sentry/components/links/externalLink';
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
    configurations: [
      {
        language: 'bash',
        code: 'composer require sentry/sdk',
      },
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
        code: `\\Sentry\\init(['dsn' => '${dsn}' ]);`,
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
} catch (\Throwable $exception) {
  \Sentry\captureException($exception);
}

// OR

\Sentry\captureLastError();
        `,
      },
    ],
  },
];
// Configuration End

export function GettingStartedWithPHP({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} {...props} />;
}

export default GettingStartedWithPHP;
