import {Alert} from 'sentry/components/core/alert/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
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
    <Alert.Container>
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
    </Alert.Container>
  );
}

export const CrashReportWebApiOnboarding: OnboardingConfig = {
  introduction: () => FeedbackOnboardingWebApiBanner(),
  install: () => [],
  configure: () => [],
  verify: () => [],
  nextSteps: () => [],
};

export const getFeedbackConfigOptions = ({
  name,
  email,
  screenshot,
}: {
  email?: boolean;
  name?: boolean;
  screenshot?: boolean;
} = {}) => {
  const options: string[] = [];
  if (!screenshot) {
    options.push('enableScreenshot: false,');
  }
  if (name) {
    options.push('isNameRequired: true,');
  }
  if (email) {
    options.push('isEmailRequired: true,');
  }
  return options.join('\n');
};

export const getCrashReportModalIntroduction = () =>
  t(
    'Collect feedback on your errors by installing our crash-report modal. This allows users to submit feedback after they experience an error via an automatic modal that pops up after an error occurs. The default modal will prompt the user for their name, email address, and description of what occurred.'
  );

export const getCrashReportModalInstallDescriptionJavaScript = () =>
  tct(
    'You can collect feedback at the time the event is sent, using [code:beforeSend].',
    {code: <code />}
  );

export const getCrashReportModalConfigDescription = ({link}: {link: string}) =>
  tct(
    'There are many options you can pass to the [code:Sentry.showReportDialog] call to customize your form. Learn more about configuring the modal by reading the [link:configuration docs].',
    {code: <code />, link: <ExternalLink href={link} />}
  );

const getCrashReportModalSnippetJavaScript = (params: any) => [
  {
    code: [
      {
        label: 'HTML',
        value: 'html',
        language: 'html',
        code: `<script>
  Sentry.init({
    dsn: "${params.dsn.public}",
    beforeSend(event, hint) {
      // Check if it is an exception, and if so, show the report dialog
      if (event.exception && event.event_id) {
        Sentry.showReportDialog({ eventId: event.event_id });
      }
      return event;
    },
  });
</script>`,
      },
    ],
  },
];

export const getCrashReportJavaScriptInstallStep = (params: any) => [
  {
    type: StepType.INSTALL,
    description: getCrashReportModalInstallDescriptionJavaScript(),
    configurations: getCrashReportModalSnippetJavaScript(params),
  },
];

export function getCrashReportSDKInstallFirstStep(params: DocsParams) {
  const dataLoaded =
    params.sourcePackageRegistries && !params.sourcePackageRegistries.isLoading;
  const version =
    (dataLoaded &&
      params.sourcePackageRegistries.data?.['sentry.javascript.browser']!.version) ??
    '';
  const hash =
    (dataLoaded &&
      params.sourcePackageRegistries.data?.['sentry.javascript.browser']!.files[
        'bundle.min.js'
      ]!.checksums['sha384-base64']) ??
    '';

  return {
    description: t('Make sure you have the JavaScript SDK available:'),
    code: [
      {
        label: 'HTML',
        value: 'html',
        language: 'html',
        code: `<script
  src="https://browser.sentry-cdn.com/${version}/bundle.min.js"
  integrity="sha384-${hash}"
  crossorigin="anonymous"
></script>`,
      },
    ],
  };
}

const getGenericScript = (params: any) => [
  {
    label: 'HTML',
    value: 'html',
    language: 'html',
    code: `<script>
  Sentry.init({ dsn: "${params.dsn.public}" });
  Sentry.showReportDialog({
    eventId: "{{ event_id }}",
  });
</script>`,
  },
];

export const getCrashReportGenericInstallStep = (params: any) => [
  {
    type: StepType.INSTALL,
    configurations: [
      getCrashReportSDKInstallFirstStep(params),
      {
        description: tct(
          'You will then need to call [codeShow:showReportDialog] and pass in the generated event ID. This event ID is returned from all calls to [codeEvent:CaptureEvent] and [codeException:CaptureException]. There is also a function called [codeLast:LastEventId] that returns the ID of the most recently sent event.',
          {
            codeShow: <code />,
            codeEvent: <code />,
            codeException: <code />,
            codeLast: <code />,
          }
        ),
        code: getGenericScript(params),
      },
    ],
  },
];

export const getCrashReportBackendInstallStep = (params: any) => [
  {
    type: StepType.INSTALL,
    configurations: [
      getCrashReportSDKInstallFirstStep(params),
      {
        description: tct(
          'You will then need to call [codeShow:showReportDialog] and pass in the generated event ID. This event ID is returned from all calls to [codeEvent:capture_event] and [codeException:capture_exception]. There is also a function called [codeLast:last_event_id] that returns the ID of the most recently sent event.',
          {
            codeShow: <code />,
            codeEvent: <code />,
            codeException: <code />,
            codeLast: <code />,
          }
        ),
        code: getGenericScript(params),
      },
    ],
  },
];

export function getCrashReportSDKInstallFirstStepRails(params: DocsParams) {
  const dataLoaded =
    params.sourcePackageRegistries && !params.sourcePackageRegistries.isLoading;
  const version =
    (dataLoaded &&
      params.sourcePackageRegistries.data?.['sentry.javascript.browser']!.version) ??
    '';
  const hash =
    (dataLoaded &&
      params.sourcePackageRegistries.data?.['sentry.javascript.browser']!.files[
        'bundle.min.js'
      ]!.checksums['sha384-base64']) ??
    '';

  return {
    description: t('Make sure you have the JavaScript SDK available:'),
    code: [
      {
        label: 'ERB',
        value: 'erb',
        language: 'erb',
        code: `<script
  src="https://browser.sentry-cdn.com/${version}/bundle.min.js"
  integrity="sha384-${hash}"
  crossorigin="anonymous"
></script>`,
      },
    ],
  };
}

export const getCrashReportPHPInstallStep = (params: any) => [
  {
    type: StepType.INSTALL,
    configurations: [
      {
        description: tct('This function php returns the last [code:eventId]:', {
          code: <code />,
        }),
        code: [
          {
            label: 'PHP',
            value: 'php',
            language: 'php',
            code: `\Sentry\SentrySdk::getCurrentHub()->getLastEventId();`,
          },
        ],
      },
      getCrashReportSDKInstallFirstStep(params),
      {
        description: t(
          'Depending on how you render your templates, the example would be in a simple php file:'
        ),
        code: [
          {
            label: 'HTML',
            value: 'html',
            language: 'html',
            code: `<?php if (\Sentry\SentrySdk::getCurrentHub()->getLastEventId()) { ?>
<script>
  Sentry.init({ dsn: "${params.dsn.public}" });
  Sentry.showReportDialog({
    eventId:
      "<?php echo \Sentry\SentrySdk::getCurrentHub()->getLastEventId(); ?>",
  });
</script>
<?php } ?>`,
          },
        ],
      },
    ],
  },
];
