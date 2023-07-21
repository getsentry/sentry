import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {PlatformKey} from 'sentry/data/platformCategories';
import {tct} from 'sentry/locale';
import type {Organization} from 'sentry/types';

type StepProps = {
  newOrg: boolean;
  organization: Organization;
  platformKey: PlatformKey;
  projectId: string;
  sentryInitContent: string;
};

export const steps = ({
  sentryInitContent,
}: Partial<StepProps> = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: (
      <p>{tct('Add [code:@sentry/node] as a dependency:', {code: <code />})}</p>
    ),
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
        {tct('To set up Sentry error logging for an Azure Function:', {
          code: <code />,
        })}
      </p>
    ),
    configurations: [
      {
        language: 'javascript',
        code: `
        "use strict";

const Sentry = require("@sentry/node");

Sentry.init({
  ${sentryInitContent},
});

module.exports = async function (context, req) {
  try {
    await notExistFunction();
  } catch (e) {
    Sentry.captureException(e);
    await Sentry.flush(2000);
  }

  context.res = {
    status: 200,
    body: "Hello from Azure Cloud Function!",
  };
};
        `,
      },
      {
        language: 'javascript',
        description: (
          <p>
            {tct(
              'Note: You need to call both [code:captureException] and [code:flush] for captured events to be successfully delivered to Sentry.',
              {}
            )}
          </p>
        ),
      },
    ],
  },
];

export function GettingStartedWithAzurefunctions({
  dsn,
  organization,
  newOrg,
  platformKey,
  projectId,
}: ModuleProps) {
  const sentryInitContent: string[] = [`dsn: "${dsn}"`];

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

export default GettingStartedWithAzurefunctions;
