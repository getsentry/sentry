import {openPrivateGamingSdkAccessModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {ExternalLink} from 'sentry/components/core/link';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
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
            'Our [sentrySwitchLink:Sentry Switch SDK] extends the core [sentryNativeLink:sentry-native] library with Nintendo Switch-specific implementations and is designed to work across standalone engines and proprietary game engines.',
            {
              sentrySwitchLink: (
                <ExternalLink href="https://github.com/getsentry/sentry-switch" />
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
            '[strong:Access Restricted]. The Switch SDK is distributed through a private repository under NDA.',
            {
              strong: <strong />,
            }
          ),
          showIcon: true,
          trailingItems: (
            <Button
              size="sm"
              priority="primary"
              onClick={() => {
                openPrivateGamingSdkAccessModal({
                  organization: params.organization,
                  projectSlug: params.project.slug,
                  projectId: params.project.id,
                  sdkName: 'Nintendo Switch',
                  gamingPlatform: 'nintendo-switch',
                  origin: params.newOrg ? 'onboarding' : 'project-creation',
                });
              }}
            >
              {t('Request Access')}
            </Button>
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
            'After building the SDK, you can integrate it as a static library into your game. The SDK handles crash reporting automatically, with crash context forwarded to Sentry via CRPORTAL.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'text',
          text: t(
            'The SDK also supports sending additional runtime events, which requires:'
          ),
        },
        {
          type: 'custom',
          content: (
            <List symbol="bullet">
              <ListItem>
                {tct(
                  'Providing a valid [strong:database path] via [code:sentry_options_set_database_path()]',
                  {code: <code />, strong: <strong />}
                )}
              </ListItem>
              <ListItem>
                {tct(
                  'Ensuring [strong:network access] is properly initialized and providing a thread-safe network request callback',
                  {code: <code />, strong: <strong />}
                )}
              </ListItem>
            </List>
          ),
        },
        {
          type: 'text',
          text: tct(
            'The [privateRepositoryLink:private repository] contains complete setup instructions and configuration examples in the sample folder. Here is a basic example of how to initialize the SDK:',
            {
              privateRepositoryLink: (
                <ExternalLink href="https://github.com/getsentry/sentry-switch" />
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
  // Example of Nintendo Switch-specific configuration options
  // (including database path) are available in
  // the sample folder of the private repository
  sentry_init(options);
}
`,
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
            'After sending this test event, you should see it appear in your Sentry dashboard, confirming that the Nintendo Switch integration is working correctly.'
          ),
        },
      ],
    },
  ],
};
