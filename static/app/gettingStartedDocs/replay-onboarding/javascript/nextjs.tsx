import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';
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
    description: t('Configure your app automatically with the Sentry wizard.'),
    configurations: [
      {
        language: 'bash',
        code: [
          {
            label: 'Bash',
            value: 'bash',
            language: 'bash',
            code: 'npx @sentry/wizard@latest -i nextjs',
          },
        ],
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: tct(
      'Add the following to your SDK config. There are several privacy and sampling options available, all of which can be set using the [codeIntegrations:integrations] constructor. Learn more about configuring Session Replay by reading the [link:configuration docs]. [break] [break] Alert: The Replay integration must be added to your [codeClient:sentry.client.config.js] file. Adding it into [codeServer:sentry.server.config.js] or [codeEdge:sentry.edge.config.js] may break your build.',
      {
        codeIntegrations: <code />,
        codeClient: <code />,
        codeServer: <code />,
        codeEdge: <code />,
        break: <br />,
        link: (
          <ExternalLink href="https://docs.sentry.io/platforms/javascript/session-replay/" />
        ),
      }
    ),
    configurations: [
      {
        language: 'javascript',
        code: `
        import * as Sentry from "@sentry/nextjs";

        Sentry.init({
          ${sentryInitContent}
        });
        `,
      },
    ],
  },
];

// Configuration End

export function GettingStartedWithNextjsReplay({
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

export default GettingStartedWithNextjsReplay;
