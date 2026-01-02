import {ExternalLink} from 'sentry/components/core/link';
import {RequestSdkAccessButton} from 'sentry/components/gameConsole/RequestSdkAccessButton';
import {
  StepType,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {IconLock} from 'sentry/icons/iconLock';
import {t, tct} from 'sentry/locale';

export const onboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Our [sentryXboxLink:Sentry Xbox SDK] extends the core [sentryNativeLink:sentry-native] library with Xbox-specific implementations for standalone engines and proprietary game engines.',
            {
              code: <code />,
              sentryXboxLink: (
                <ExternalLink href="https://github.com/getsentry/sentry-xbox" />
              ),
              sentryNativeLink: (
                <ExternalLink href="https://github.com/getsentry/sentry-native" />
              ),
            }
          ),
        },
        {
          type: 'alert',
          alertType: 'warning',
          icon: <IconLock size="sm" locked />,
          text: tct(
            '[strong:Access Restricted]. The Xbox SDK is distributed through a [privateRepositoryLink:private repository] under NDA.',
            {
              strong: <strong />,
              privateRepositoryLink: (
                <ExternalLink href="https://github.com/getsentry/sentry-xbox" />
              ),
            }
          ),
          showIcon: true,
          trailingItems: (
            <RequestSdkAccessButton
              organization={params.organization}
              projectId={params.project.id}
              origin="onboarding"
            />
          ),
        },
        {
          type: 'text',
          text: t(
            'Once the access is granted, you can proceed with the SDK integration.'
          ),
        },
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
            'The [privateRepositoryLink:private repository] contains complete setup instructions. Here is a basic example of how to initialize the SDK:',
            {
              privateRepositoryLink: (
                <ExternalLink href="https://github.com/getsentry/sentry-xbox" />
              ),
            }
          ),
        },
        {
          type: 'code',
          language: 'c',
          code: `
#include <sentry.h>

int main(void) {
  sentry_options_t *options = sentry_options_new();
  sentry_options_set_dsn(options, "${params.dsn.public}");

  // This is also the default path. For further info:
  // https://docs.sentry.io/platforms/native/configuration/options/#database-path
  sentry_options_set_database_path(options, ".sentry-native");
  sentry_options_set_release(options, "my-xbox-game@1.0.0");
  sentry_options_set_debug(options, 1);
  sentry_init(options);

  /* Your game or app code here */

  // Ensure all events are flushed before exit
  sentry_close();
}`,
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Once integrated, verify that your Sentry integration is working correctly by sending a test event:'
          ),
        },
        {
          type: 'code',
          language: 'c',
          code: `
sentry_capture_event(sentry_value_new_message_event(
  /*   level */ SENTRY_LEVEL_INFO,
  /*  logger */ "custom",
  /* message */ "It works!"
));`,
        },
        {
          type: 'text',
          text: t(
            'After sending this test event, you should see it appear in your Sentry dashboard, confirming that the Xbox integration is working correctly.'
          ),
        },
      ],
    },
  ],
};
