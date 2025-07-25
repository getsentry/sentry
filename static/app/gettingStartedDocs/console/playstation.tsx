import {Button} from 'sentry/components/core/button';
import {ExternalLink} from 'sentry/components/core/link';
import {
  type Docs,
  type OnboardingConfig,
  StepType,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {IconLock} from 'sentry/icons/iconLock';
import {t, tct} from 'sentry/locale';

const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Our [sentryPlayStationLink:Sentry PlayStation SDK] extends the core [sentryNativeLink:sentry-native] library with PlayStation-specific implementations for standalone engines and proprietary game engines.',
            {
              code: <code />,
              sentryPlayStationLink: (
                <ExternalLink href="https://github.com/getsentry/sentry-playstation" />
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
            '[strong:Access Restricted]. The PlayStation SDK is distributed through a [privateRepositoryLink:private repository] under NDA.',
            {
              strong: <strong />,
              privateRepositoryLink: (
                <ExternalLink href="https://github.com/getsentry/sentry-playstation" />
              ),
            }
          ),
          showIcon: true,
          trailingItems: (
            <Button size="sm" priority="primary">
              {t('Request Access')}
            </Button>
          ),
        },
        {
          type: 'text',
          text: t(
            'Once you have access, the private repository contains complete instructions for building and integrating the SDK with your engine of choice.'
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
          text: t(
            'The PlayStation SDK is designed for standalone engine integration. Initialize the SDK in your application:'
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
  sentry_options_set_release(options, "my-project-name@2.3.12");
  sentry_options_set_debug(options, 1);
  // For further configuration options, including database path,
  // see the private repository.
  sentry_init(options);

  /* ... */

  // make sure everything flushes
  sentry_close();
}`,
        },
        {
          type: 'text',
          text: tct(
            'For PlayStation-specific configuration options and advanced features, please refer to the documentation in the [privateRepositoryLink:private repository].',
            {
              privateRepositoryLink: (
                <ExternalLink href="https://github.com/getsentry/sentry-playstation" />
              ),
            }
          ),
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
            'After sending this test event, you should see it appear in your Sentry dashboard, confirming that the PlayStation integration is working correctly.'
          ),
        },
      ],
    },
  ],
};

const docs: Docs = {
  onboarding,
};

export default docs;
