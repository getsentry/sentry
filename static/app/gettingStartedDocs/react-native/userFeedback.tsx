import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getFeedbackConfigureMobileDescription} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {t, tct} from 'sentry/locale';

import {getFeedbackConfigureSnippet} from './utils';

export const userFeedback: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: t(
            "If you're using a self-hosted Sentry instance, you'll need to be on version 24.4.2 or higher in order to use the full functionality of the User Feedback feature. Lower versions may have limited functionality."
          ),
        },
        {
          type: 'text',
          text: tct(
            'To collect user feedback from inside your application, use the [code:showFeedbackWidget] method.',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: `import * as Sentry from "@sentry/react-native";

Sentry.wrap(RootComponent);
Sentry.showFeedbackWidget();`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'You may also use the [code:showFeedbackButton] and [code:hideFeedbackButton] to show and hide a button that opens the Feedback Widget.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: `import * as Sentry from "@sentry/react-native";

Sentry.wrap(RootComponent);

Sentry.showFeedbackWidget();
Sentry.hideFeedbackButton();`,
            },
          ],
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
          text: getFeedbackConfigureMobileDescription({
            linkConfig:
              'https://docs.sentry.io/platforms/react-native/user-feedback/configuration/',
            linkButton:
              'https://docs.sentry.io/platforms/react-native/user-feedback/configuration/#feedback-button-customization',
          }),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: getFeedbackConfigureSnippet(params),
            },
          ],
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};
