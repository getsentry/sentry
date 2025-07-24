import {openPrivateGamingSdkAccessModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {ExternalLink} from 'sentry/components/core/link';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {
  type Docs,
  type OnboardingConfig,
  StepType,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {IconLock} from 'sentry/icons/iconLock';
import {t, tct} from 'sentry/locale';

const onboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Our [sentryXboxLink:Sentry Xbox SDK] extends the core [sentryNativeLink:sentry-native] library with Xbox specific implementations and is designed to work across standalone engines, Unreal Engine, and Unity.',
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
            '[strong:Access Restricted]. The Xbox SDK is distributed through a private repository under NDA.',
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
                  projectSlug: params.projectSlug,
                  sdkName: 'Xbox',
                  gamingPlatform: 'xbox',
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
            'The SDK supports multiple integration paths depending on your engine:'
          ),
        },
        {
          type: 'custom',
          content: (
            <List symbol="bullet">
              <ListItem>
                {tct(
                  '[strong:Standalone] - engine agostic, pure sentry-native to be used, for example, on proprietary game engines',
                  {strong: <strong />}
                )}
              </ListItem>
              <ListItem>
                {tct(
                  '[strong:Unreal Engine] - as the extension to [sentryUnrealLink:sentry-unreal] on Xbox',
                  {
                    strong: <strong />,
                    sentryUnrealLink: (
                      <ExternalLink href="https://github.com/getsentry/sentry-unreal" />
                    ),
                  }
                )}
              </ListItem>
              <ListItem>
                {tct(
                  '[strong:Unity] - as the extension to [sentryUnityLink:sentry-unity] on Xbox',
                  {
                    strong: <strong />,
                    sentryUnityLink: (
                      <ExternalLink href="https://github.com/getsentry/sentry-unity" />
                    ),
                  }
                )}
              </ListItem>
            </List>
          ),
        },
        {
          type: 'text',
          text: t(
            'Please follow the Xbox specific integration instructions for your engine in the private repository.'
          ),
        },
        {
          type: 'text',
          text: t(
            "Here's a minimal example of initializing the SDK in a standalone setup:"
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
          text: tct(
            "Alternatively, if you're using [code:Unreal] or [code:Unity], refer to the engine-specific Xbox instructions in the [privateRepositoryLink:private repository] for details on how to trigger and verify events",
            {
              code: <code />,
              privateRepositoryLink: (
                <ExternalLink href="https://github.com/getsentry/sentry-xbox" />
              ),
            }
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
