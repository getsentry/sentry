import {ExternalLink} from 'sentry/components/core/link';
import crashReportCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/crashReportCallout';
import {widgetCalloutBlock} from 'sentry/components/onboarding/gettingStartedDoc/feedback/widgetCallout';
import TracePropagationMessage from 'sentry/components/onboarding/gettingStartedDoc/replay/tracePropagationMessage';
import type {
  ContentBlock,
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {
  getCrashReportModalConfigDescription,
  getCrashReportModalInstallDescriptionJavaScript,
  getCrashReportModalIntroduction,
  getFeedbackConfigureDescription,
  getFeedbackSDKSetupSnippet,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {
  getReplayConfigureDescription,
  getReplaySDKSetupSnippet,
  getReplayVerifyStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getConfigureSnippet = (params: Params) => `
import * as Sentry from "@sentry/electron";

Sentry.init({
  dsn: "${params.dsn.public}",
});`;

const installCodeBlock: ContentBlock = {
  type: 'code',
  tabs: [
    {
      label: 'npm',
      language: 'bash',
      code: 'npm install --save @sentry/electron',
    },
    {
      label: 'yarn',
      language: 'bash',
      code: 'yarn add @sentry/electron',
    },
    {
      label: 'pnpm',
      language: 'bash',
      code: 'pnpm add @sentry/electron',
    },
  ],
};

const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: t('Add the Sentry Electron SDK package as a dependency:'),
        },
        installCodeBlock,
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'You need to call [code:Sentry.init] in the [code:main] process and in every [code:renderer] process you spawn. For more details about configuring the Electron SDK [docsLink:click here].',
            {
              code: <code />,
              docsLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/electron/" />
              ),
            }
          ),
        },
        {
          type: 'code',
          language: 'javascript',
          code: getConfigureSnippet(params),
        },
      ],
    },
    getUploadSourceMapsStep({
      guideLink:
        'https://docs.sentry.io/platforms/javascript/guides/electron/sourcemaps/',
      ...params,
    }),
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            `One way to verify your setup is by intentionally causing an error that breaks your application.`
          ),
        },
        {
          type: 'text',
          text: t(`Calling an undefined function will throw a JavaScript exception:`),
        },
        {
          type: 'code',
          language: 'javascript',
          code: 'myUndefinedFunction();',
        },
        {
          type: 'text',
          text: t(
            `With Electron you can test native crash reporting by triggering a crash:`
          ),
        },
        {
          type: 'code',
          language: 'javascript',
          code: 'process.crash();',
        },
        {
          type: 'text',
          text: t(
            'You may want to try inserting these code snippets into both your main and any renderer processes to verify Sentry is operational in both.'
          ),
        },
      ],
    },
  ],
};

const replayOnboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'For the Session Replay to work, you must have the framework SDK (e.g. [code:@sentry/electron]) installed, minimum version 4.2.0.',
            {
              code: <code />,
            }
          ),
        },
        installCodeBlock,
      ],
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getReplayConfigureDescription({
            link: 'https://docs.sentry.io/platforms/javascript/guides/electron/session-replay/',
          }),
        },
        {
          type: 'code',
          tabs: [
            {
              language: 'javascript',
              label: 'JavaScript',
              code: getReplaySDKSetupSnippet({
                importStatement: `import * as Sentry from "@sentry/electron/renderer";`,
                dsn: params.dsn.public,
                mask: params.replayOptions?.mask,
                block: params.replayOptions?.block,
              }),
            },
          ],
        },
        {
          type: 'custom',
          content: <TracePropagationMessage />,
        },
      ],
    },
  ],
  verify: getReplayVerifyStep(),
  nextSteps: () => [],
};

const feedbackOnboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'For the User Feedback integration to work, you must have the Sentry browser SDK package, or an equivalent framework SDK (e.g. [code:@sentry/electron]) installed, minimum version 7.85.0.',
            {
              code: <code />,
            }
          ),
        },
        installCodeBlock,
      ],
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getFeedbackConfigureDescription({
            linkConfig:
              'https://docs.sentry.io/platforms/javascript/guides/electron/user-feedback/configuration/',
            linkButton:
              'https://docs.sentry.io/platforms/javascript/guides/electron/user-feedback/configuration/#bring-your-own-button',
          }),
        },
        {
          type: 'code',
          tabs: [
            {
              language: 'javascript',
              label: 'JavaScript',
              code: getFeedbackSDKSetupSnippet({
                importStatement: `import * as Sentry from "@sentry/electron/renderer";`,
                dsn: params.dsn.public,
                feedbackOptions: params.feedbackOptions,
              }),
            },
          ],
        },
        {
          type: 'custom',
          content: crashReportCallout({
            link: 'https://docs.sentry.io/platforms/javascript/guides/electron/user-feedback/#crash-report-modal',
          }),
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const crashReportOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: getCrashReportModalInstallDescriptionJavaScript(),
        },
        {
          type: 'code',
          language: 'javascript',
          code: `const { init, showReportDialog } = require("@sentry/electron");

init({
  dsn: "${params.dsn.public}",
  beforeSend(event) {
    // Check if it is an exception, if so, show the report dialog
    // Note that this only will work in the renderer process, it's a noop on the main process
    if (event.exception && event.event_id) {
      showReportDialog({ eventId: event_id });
    }
    return event;
  },
});`,
        },
      ],
    },
  ],
  configure: () => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getCrashReportModalConfigDescription({
            link: 'https://docs.sentry.io/platforms/javascript/guides/electron/user-feedback/configuration/#crash-report-modal',
          }),
        },
        widgetCalloutBlock({
          link: 'https://docs.sentry.io/platforms/javascript/guides/electron/user-feedback/#user-feedback-widget',
        }),
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  feedbackOnboardingNpm: feedbackOnboarding,
  replayOnboarding,
  crashReportOnboarding,
};

export default docs;
