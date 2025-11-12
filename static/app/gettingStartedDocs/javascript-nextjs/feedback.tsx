import crashReportCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/crashReportCallout';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getFeedbackConfigureDescription,
  getFeedbackSDKSetupSnippet,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {t, tct} from 'sentry/locale';

import {getInstallSnippet} from './utils';

export const feedback: OnboardingConfig = {
  install: (params: DocsParams) => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'For the User Feedback integration to work, you must have the Sentry browser SDK package, or an equivalent framework SDK (e.g. [code:@sentry/nextjs]) installed, minimum version 7.85.0.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'text',
          text: t('Install the Next.js SDK using our installation wizard:'),
        },
        {
          type: 'code',
          language: 'bash',
          code: getInstallSnippet(params),
        },
      ],
    },
  ],
  configure: (params: DocsParams) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getFeedbackConfigureDescription({
            linkConfig:
              'https://docs.sentry.io/platforms/javascript/guides/nextjs/user-feedback/configuration/',
            linkButton:
              'https://docs.sentry.io/platforms/javascript/guides/nextjs/user-feedback/configuration/#bring-your-own-button',
          }),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              filename: 'instrumentation-client.(js|ts)',
              language: 'javascript',
              code: getFeedbackSDKSetupSnippet({
                importStatement: `import * as Sentry from "@sentry/nextjs";`,
                dsn: params.dsn.public,
                feedbackOptions: params.feedbackOptions,
              }),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'Note: The User Feedback integration only needs to be added to your [code:instrumentation-client.(js|ts)] file. Adding it to any server-side configuration files (like [code:instrumentation.(js|ts)]) will break your build because the Feedback integration depends on Browser APIs.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'custom',
          content: crashReportCallout({
            link: 'https://docs.sentry.io/platforms/javascript/guides/nextjs/user-feedback/#crash-report-modal',
          }),
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};
