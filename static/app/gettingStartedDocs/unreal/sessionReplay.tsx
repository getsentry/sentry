import {ExternalLink} from '@sentry/scraps/link';

import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

const configureIniSnippet = `[/Script/Sentry.SentrySettings]
AttachSessionReplay=True`;

export const sessionReplay: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Session Replay is available in the Sentry Unreal Engine SDK. Make sure the Sentry plugin is installed and configured by following the [link:Unreal Engine setup guide] before enabling Session Replay.',
            {
              link: <ExternalLink href="https://docs.sentry.io/platforms/unreal/" />,
            }
          ),
        },
        {
          type: 'alert',
          alertType: 'info',
          text: t('Session Replay for Unreal Engine is currently experimental.'),
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
          text: tct(
            'Enable Session Replay from the Sentry configuration window by going to [strong:Project Settings > Plugins > Sentry] and toggling the [strong:Enable session replay (experimental)] option.',
            {strong: <strong />}
          ),
        },
        {
          type: 'text',
          text: t(
            'Alternatively, you can enable Session Replay by adding the following to your project config file:'
          ),
        },
        {
          type: 'code',
          language: 'ini',
          code: configureIniSnippet,
        },
        {
          type: 'text',
          text: tct(
            'You can tune the replay duration, target framerate, and target bitrate from the same settings window. For the full list of options, see the [link:Session Replay documentation].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/unreal/session-replay/" />
              ),
            }
          ),
        },
        {
          type: 'alert',
          alertType: 'warning',
          text: t(
            'Unlike our browser and mobile SDKs, the Unreal Engine SDK does not automatically mask sensitive content in the recorded footage. Make sure no sensitive information is displayed while Session Replay is enabled.'
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
          text: tct(
            'Once Session Replay is enabled, package and run your game and interact with it for a few moments. Then head to the [strong:Replays] page in Sentry to confirm your session was captured. It may take a few minutes for the first replay to appear.',
            {strong: <strong />}
          ),
        },
      ],
    },
  ],
  nextSteps: () => [],
};
