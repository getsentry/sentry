import Alert from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

export const getFeedbackConfigureDescription = ({link}: {link: string}) =>
  tct(
    'To set up the integration, add the following to your Sentry initialization. There are many options you can pass to the [code:integrations] constructor. Learn more about configuring User Feedback by reading the [link:configuration docs].',
    {
      code: <code />,
      link: <ExternalLink href={link} />,
    }
  );

export const getFeedbackSDKSetupSnippet = ({
  importStatement,
  dsn,
}: {
  dsn: string;
  importStatement: string;
}) =>
  `${importStatement}

  Sentry.init({
    dsn: "${dsn}",
    integrations: [
      Sentry.feedbackIntegration({
// Additional SDK configuration goes in here, for example:
colorScheme: "light",
}),
    ],
  });`;

export const getCrashReportApiIntroduction = () =>
  t(
    'When a user experiences an error, Sentry provides the ability to collect additional feedback from the user via a form. The user feedback API allows you to collect user feedback while utilizing your own UI for the form. You can use the same programming language you have in your app to send user feedback.'
  );

export const getCrashReportInstallDescription = () =>
  tct(
    'Sentry needs the error [codeEvent:eventId] to be able to associate the user feedback to the corresponding event. To get the [codeEvent:eventId], you can use [codeBefore:beforeSend] or the return value of the method capturing an event.',
    {codeEvent: <code />, codeBefore: <code />}
  );

export function FeedbackOnboardingWebApiBanner() {
  return (
    <Alert type="info" showIcon>
      {tct(
        `When a user experiences an error, Sentry provides the ability to collect additional feedback. You can use an endpoint in Sentry to submit it. [link:Read our docs] to learn more.`,
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/api/projects/submit-user-feedback/" />
          ),
        }
      )}
    </Alert>
  );
}

export const feedbackOnboardingWebApi: OnboardingConfig = {
  introduction: () => FeedbackOnboardingWebApiBanner(),
  install: () => [],
  configure: () => [],
  verify: () => [],
  nextSteps: () => [],
};
