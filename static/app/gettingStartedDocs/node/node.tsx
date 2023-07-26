import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {PlatformKey} from 'sentry/data/platformCategories';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types';

type StepProps = {
  newOrg: boolean;
  organization: Organization;
  platformKey: PlatformKey;
  projectId: string;
  sentryInitContent: string;
};

const performanceOtherConfig = `
// Performance Monitoring
tracesSampleRate: 1.0, // Capture 100% of the transactions, reduce in production!`;

export const steps = ({
  sentryInitContent,
  ...props
}: Partial<StepProps> = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: t('Add the Sentry Node SDK as a dependency:'),
    configurations: [
      {
        language: 'bash',
        code: `
# Using yarn
yarn add @sentry/node

# Using npm
npm install --save @sentry/node
        `,
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct(
          "Initialize Sentry as early as possible in your application's lifecycle, for example in your [code:index.ts/js] entry point:",
          {code: <code />}
        )}
      </p>
    ),
    configurations: [
      {
        language: 'javascript',
        code: `
        const Sentry = require("@sentry/node");
        // or use ESM import statements
        // import * as Sentry from '@sentry/node';

        Sentry.init({
          ${sentryInitContent}
        });
        `,
      },
    ],
  },
  getUploadSourceMapsStep({
    guideLink: 'https://docs.sentry.io/platforms/node/sourcemaps/',
    ...props,
  }),
  {
    type: StepType.VERIFY,
    description: t(
      "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
    ),
    configurations: [
      {
        language: 'javascript',
        code: `
        const transaction = Sentry.startTransaction({
          op: "test",
          name: "My First Test Transaction",
        });

        setTimeout(() => {
          try {
            foo();
          } catch (e) {
            Sentry.captureException(e);
          } finally {
            transaction.finish();
          }
        }, 99);
        `,
      },
    ],
  },
];

export function GettingStartedWithNode({
  dsn,
  organization,
  newOrg,
  platformKey,
  projectId,
}: ModuleProps) {
  const sentryInitContent: string[] = [`dsn: "${dsn}",`, performanceOtherConfig];

  return (
    <Layout
      steps={steps({
        sentryInitContent: sentryInitContent.join('\n'),
        organization,
        newOrg,
        platformKey,
        projectId,
      })}
      newOrg={newOrg}
      platformKey={platformKey}
    />
  );
}

export default GettingStartedWithNode;
