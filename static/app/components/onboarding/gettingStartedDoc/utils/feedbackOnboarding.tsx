import Alert from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';

export const getFeedbackConfigureDescription = ({
  linkConfig,
  linkButton,
}: {
  linkButton: string;
  linkConfig: string;
}) =>
  tct(
    'To set up the integration, add the following to your Sentry initialization. There are many options you can pass to the [code:integrations] constructor to customize your form. [break] [break] You can even [linkButton:link the widget to a custom button] if you don’t want to use our auto-injected floating button. Learn more about configuring User Feedback by reading the [linkConfig:configuration docs].',
    {
      code: <code />,
      break: <br />,
      linkConfig: <ExternalLink href={linkConfig} />,
      linkButton: <ExternalLink href={linkButton} />,
    }
  );

export const getFeedbackSDKSetupSnippet = ({
  importStatement,
  dsn,
  feedbackOptions,
}: {
  dsn: string;
  importStatement: string;
  feedbackOptions?: {email?: boolean; name?: boolean};
}) =>
  `${importStatement}

  Sentry.init({
    dsn: "${dsn}",
    integrations: [
      Sentry.feedbackIntegration({
// Additional SDK configuration goes in here, for example:
colorScheme: "system",
${getFeedbackConfigOptions(feedbackOptions)}}),
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

export const getFeedbackConfigOptions = ({
  name,
  email,
}: {
  email?: boolean;
  name?: boolean;
} = {}) => {
  const options: string[] = [];
  if (name) {
    options.push('isNameRequired: true,');
  }
  if (email) {
    options.push('isEmailRequired: true,');
  }
  return options.join('\n');
};
