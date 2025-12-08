import {widgetCalloutBlock} from 'sentry/components/onboarding/gettingStartedDoc/feedback/widgetCallout';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportModalConfigDescription,
  getCrashReportModalInstallDescriptionJavaScript,
  getCrashReportModalIntroduction,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';

export const crashReport: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: DocsParams) => [
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
