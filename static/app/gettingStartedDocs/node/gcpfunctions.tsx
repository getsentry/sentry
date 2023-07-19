import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {t, tct} from 'sentry/locale';

const performanceOtherConfig = `// Performance Monitoring
tracesSampleRate: 1.0, // Capture 100% of the transactions, reduce in production!`;

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
          'Add the Sentry Serverless SDK as a dependency to your [code:package.json]:',
          {code: <code />}
        )}
      </p>
    ),
    configurations: [
      {
        language: 'json',
        code: `
dependencies: {
  //...
  "@sentry/serverless": "^7"
}
        `,
      },
    ],
  },
  {
    title: t('Configure SDK for Http Functions'),
    description: (
      <p>
        {tct('Use [code:wrapHttpFunction] to wrap your http function:', {
          code: <code />,
        })}
      </p>
    ),
    configurations: [
      {
        language: 'javascript',
        code: `
        const Sentry = require("@sentry/serverless");

        Sentry.GCPFunction.init({
          ${sentryInitContent}
        });

        exports.helloHttp = Sentry.GCPFunction.wrapHttpFunction((req, res) => {
          /* Your function code */
        });
        `,
      },
    ],
  },
  {
    title: t('Configure SDK for Background Functions'),
    description: (
      <p>
        {tct('Use [code:wrapEventFunction] to wrap your background function:', {
          code: <code />,
        })}
      </p>
    ),
    configurations: [
      {
        language: 'javascript',
        code: `
        const Sentry = require("@sentry/serverless");

        Sentry.GCPFunction.init({
          ${sentryInitContent}
        });

        exports.helloEvents = Sentry.GCPFunction.wrapEventFunction(
          (data, context, callback) => {
            /* Your function code */
          }
        );
        `,
      },
    ],
  },
  {
    title: t('Configure SDK for CloudEvent Functions'),
    description: (
      <p>
        {tct('Use [code:wrapCloudEventFunction] to wrap your CloudEvent function:', {
          code: <code />,
        })}
      </p>
    ),
    configurations: [
      {
        language: 'javascript',
        code: `
        const Sentry = require("@sentry/serverless");

        Sentry.GCPFunction.init({
          ${sentryInitContent}
        });

        exports.helloEvents = Sentry.GCPFunction.wrapCloudEventFunction(
          (context, callback) => {
            /* Your function code */
          }
        );
        `,
      },
    ],
  },
  getUploadSourceMapsStep(
    'https://docs.sentry.io/platforms/node/guides/express/sourcemaps/'
  ),
  {
    type: StepType.VERIFY,
    description: t(
      "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
    ),
    configurations: [
      {
        language: 'javascript',
        code: `
        exports.helloHttp = Sentry.GCPFunction.wrapHttpFunction((req, res) => {
          throw new Error("oh, hello there!");
        });
        `,
      },
    ],
  },
];

export function GettingStartedWithGCPFunctions({dsn, ...props}: ModuleProps) {
  let sentryInitContent: string[] = [`dsn: "${dsn}",`];

  const otherConfigs = [performanceOtherConfig];

  if (otherConfigs.length > 0) {
    sentryInitContent = sentryInitContent.concat(otherConfigs);
  }

  return (
    <Layout steps={steps({sentryInitContent: sentryInitContent.join('\n')})} {...props} />
  );
}

export default GettingStartedWithGCPFunctions;
