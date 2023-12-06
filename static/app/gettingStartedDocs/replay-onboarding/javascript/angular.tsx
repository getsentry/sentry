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
      'In order to use Session Replay, you will need version 7.27.0 of [codeAngular:@sentry/angular] or [codeIvy:@sentry/angular-ivy] at minimum. You do not need to install any additional packages.',
      {codeAngular: <code />, codeIvy: <code />}
    ),
    configurations: [
      {
        language: 'bash',
        code: [
          {
            label: 'npm',
            value: 'npm',
            language: 'bash',
            code: `# Angular 12 and newer: \nnpm install --save @sentry/angular-ivy \n\n# Angular 10 and 11: \nnpm install --save @sentry/angular`,
          },
          {
            label: 'yarn',
            value: 'yarn',
            language: 'bash',
            code: `# Angular 12 and newer:\nyarn add @sentry/angular-ivy\n\n# Angular 10 and 11:\nyarn add @sentry/angular`,
          },
        ],
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
        import * as Sentry from "@sentry/angular-ivy";

        Sentry.init({
          ${sentryInitContent}
        });
        `,
      },
    ],
  },
];

// Configuration End

export function GettingStartedWithAngularReplay({
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

export default GettingStartedWithAngularReplay;
