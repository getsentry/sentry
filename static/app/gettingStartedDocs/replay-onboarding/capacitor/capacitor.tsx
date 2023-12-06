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
    description: t(
      'Install the Sentry Capacitor SDK alongside the corresponding Sentry SDK for the framework you are using.'
    ),
    configurations: [
      {
        language: 'bash',
        header: tct('Using [code:NPM:]', {code: <code />}),
        code: [
          {
            label: 'Angular',
            value: 'angular',
            language: 'bash',
            code: `npm install --save @sentry/capacitor @sentry/angular-ivy`,
          },
          {
            label: 'React',
            value: 'react',
            language: 'bash',
            code: `npm install --save @sentry/capacitor @sentry/react`,
          },
          {
            label: 'Vue',
            value: 'vue',
            language: 'bash',
            code: `npm install --save @sentry/capacitor @sentry/vue`,
          },
          {
            label: 'Other',
            value: 'other',
            language: 'bash',
            code: `npm install --save @sentry/capacitor @sentry/browser`,
          },
        ],
      },
      {
        language: 'bash',
        header: tct('Using [code:Yarn:]', {code: <code />}),
        code: [
          {
            label: 'Angular',
            value: 'angular',
            language: 'bash',
            code: `yarn add @sentry/capacitor @sentry/angular-ivy`,
          },
          {
            label: 'React',
            value: 'react',
            language: 'bash',
            code: `yarn add @sentry/capacitor @sentry/react`,
          },
          {
            label: 'Vue',
            value: 'vue',
            language: 'bash',
            code: `yarn add @sentry/capacitor @sentry/vue`,
          },
          {
            label: 'Other',
            value: 'other',
            language: 'bash',
            code: `yarn add @sentry/capacitor @sentry/browser`,
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
        import * as Sentry from "@sentry/capacitor";

        Sentry.init({
          ${sentryInitContent}
        });
        `,
      },
    ],
  },
];

// Configuration End

export function GettingStartedWithCapacitorReplay({
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

export default GettingStartedWithCapacitorReplay;
