import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {tct} from 'sentry/locale';
import type {Organization, PlatformKey} from 'sentry/types';

type StepProps = {
  newOrg: boolean;
  organization: Organization;
  platformKey: PlatformKey;
  projectId: string;
  sentryInitContent: string;
};

// Configuration Start
const replayIntegration = `
new Sentry.Replay(),
`;

const replayOtherConfig = `
// This sets the sample rate to be 10%. You may want this to be 100% while
// in development and sample at a lower rate in production.
replaysSessionSampleRate: 0.1,
// If the entire session is not sampled, use the below sample rate to sample
// sessions when an error occurs.
replaysOnErrorSampleRate: 1.0,
`;

export const steps = ({
  sentryInitContent,
}: Partial<StepProps> = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: tct(
      'To use Sentry with your Gatsby application, you will need to use [code:@sentry/gatsby] (Sentry’s Gatsby SDK):',
      {code: <code />}
    ),
    configurations: [
      {
        language: 'bash',
        code: [
          {
            label: 'npm',
            value: 'npm',
            language: 'bash',
            code: 'npm install --save @sentry/gatsby',
          },
          {
            label: 'yarn',
            value: 'yarn',
            language: 'bash',
            code: 'yarn add @sentry/gatsby',
          },
        ],
      },
    ],
  },
  {
    type: StepType.REGISTER,
    description: tct(
      'Register the [codeSentry:@sentry/gatsby] plugin in your Gatsby configuration file (typically [codeGatsby:gatsby-config.js]).',
      {
        codeSentry: <code />,
        codeGatsby: <code />,
        link: (
          <ExternalLink href="https://docs.sentry.io/platforms/javascript/session-replay/" />
        ),
      }
    ),
    configurations: [
      {
        language: 'javascript',
        code: `
        module.exports = {
          plugins: [
            {
              resolve: "@sentry/gatsby",
            },
          ],
        };
        `,
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: tct(
      'Add the following to your SDK config. There are several privacy and sampling options available, all of which can be set using the [code:integrations] constructor. Learn more about configuring Session Replay by reading the [link:configuration docs].',
      {
        code: <code />,
        link: (
          <ExternalLink href="https://docs.sentry.io/platforms/javascript/session-replay/" />
        ),
      }
    ),
    configurations: [
      {
        language: 'javascript',
        code: `
        import * as Sentry from "@sentry/gatsby";

        Sentry.init({
          ${sentryInitContent}
        });
        `,
      },
    ],
    additionalInfo: tct(
      'Note: If [codeGatsby:gatsby-config.js] has any settings for the [codeSentry:@sentry/gatsby plugin], they need to be moved into [codeConfig:sentry.config.js]. The [codeGatsby:gatsby-config.js] file does not support non-serializable options, like [codeNew:new Replay()].',
      {
        codeGatsby: <code />,
        codeSentry: <code />,
        codeConfig: <code />,
        codeNew: <code />,
      }
    ),
  },
];

// Configuration End

export function GettingStartedWithGatsbyReplay({
  dsn,
  organization,
  newOrg,
  platformKey,
  projectId,
  ...props
}: ModuleProps) {
  const integrations = replayIntegration.trim();
  const otherConfigs = replayOtherConfig.trim();
  let sentryInitContent: string[] = [`dsn: "${dsn}",`];
  sentryInitContent = sentryInitContent.concat('integrations: [', integrations, '],');
  sentryInitContent = sentryInitContent.concat(otherConfigs);

  return (
    <Layout
      steps={steps({
        sentryInitContent: sentryInitContent.join('\n'),
        organization,
        newOrg,
        platformKey,
        projectId,
      })}
      platformKey={platformKey}
      newOrg={newOrg}
      hideHeader
      {...props}
    />
  );
}

export default GettingStartedWithGatsbyReplay;
