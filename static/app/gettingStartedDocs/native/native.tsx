import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {CrashReportWebApiOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getConfigureSnippet = (params: Params) => `
#include <sentry.h>

int main(void) {
  sentry_options_t *options = sentry_options_new();
  sentry_options_set_dsn(options, "${params.dsn.public}");
  // This is also the default-path. For further information and recommendations:
  // https://docs.sentry.io/platforms/native/configuration/options/#database-path
  sentry_options_set_database_path(options, ".sentry-native");
  sentry_options_set_release(options, "my-project-name@2.3.12");
  sentry_options_set_debug(options, 1);
  sentry_init(options);

  /* ... */

  // make sure everything flushes
  sentry_close();
}`;

const getVerifySnippet = () => `
sentry_capture_event(sentry_value_new_message_event(
  /*   level */ SENTRY_LEVEL_INFO,
  /*  logger */ "custom",
  /* message */ "It works!"
));`;

const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Install the SDK by downloading the [releasesLink:latest release]. Next, follow the instructions in the [nativeSDKDocumentationLink:Native SDK Documentation] to build and link the SDK library.',
        {
          releasesLink: (
            <ExternalLink href="https://github.com/getsentry/sentry-native/releases" />
          ),
          nativeSDKDocumentationLink: (
            <ExternalLink href="https://docs.sentry.io/platforms/native/" />
          ),
        }
      ),
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: t(
        'Import and initialize the Sentry SDK early in your application setup:'
      ),
      configurations: [
        {
          language: 'c',
          code: getConfigureSnippet(params),
        },
      ],
      additionalInfo: tct(
        'Alternatively, the DSN can be passed as [code:SENTRY_DSN] environment variable during runtime. This can be especially useful for server applications.',
        {
          code: <code />,
        }
      ),
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: t(
        'The quickest way to verify Sentry in your Native application is by capturing a message:'
      ),
      configurations: [
        {
          language: 'c',
          code: getVerifySnippet(),
        },
      ],
      additionalInfo: (
        <Fragment>
          {t(
            "If you're new to Sentry, use the email alert to access your account and complete a product tour."
          )}
          {t(
            "If you're an existing user and have disabled alerts, you won't receive this email."
          )}
        </Fragment>
      ),
    },
  ],
};

const docs: Docs = {
  onboarding,
  crashReportOnboarding: CrashReportWebApiOnboarding,
};

export default docs;
