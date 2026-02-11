import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getReplayMobileConfigureDescription,
  getReplayVerifyStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

const getManualInstallSnippet = (params: DocsParams) => {
  const version = getPackageVersion(params, 'sentry.dart.flutter', '9.6.0');
  return `dependencies:
  sentry_flutter: ^${version}`;
};

const getInstallReplaySnippet = () => `
await SentryFlutter.init(
  (options) {
    ...
    options.replay.sessionSampleRate = 1.0;
    options.replay.onErrorSampleRate = 1.0;
  },
  appRunner: () => runApp(
      SentryWidget(
        child: MyApp(),
      ),
    ),
);
`;

const getConfigureReplaySnippet = () => `
options.replay.maskAllText = true;
options.replay.maskAllImages = true;`;

export const sessionReplay: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Make sure your Sentry Flutter SDK version is at least 8.9.0, which is required for Session Replay. You can update your [code:pubspec.yaml] to the matching version:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'YAML',
              language: 'yaml',
              code: getManualInstallSnippet(params),
            },
          ],
        },
        {
          type: 'text',
          text: t(
            'To set up the integration, add the following to your Sentry initialization:'
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Dart',
              language: 'dart',
              code: getInstallReplaySnippet(),
            },
          ],
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
          text: getReplayMobileConfigureDescription({
            link: 'https://docs.sentry.io/platforms/flutter/session-replay/#privacy',
          }),
        },
        {
          type: 'text',
          text: t(
            'The following code is the default configuration, which masks and blocks everything.'
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Dart',
              language: 'dart',
              code: getConfigureReplaySnippet(),
            },
          ],
        },
      ],
    },
  ],
  verify: getReplayVerifyStep({
    replayOnErrorSampleRateName: 'options\u200b.replay\u200b.onErrorSampleRate',
    replaySessionSampleRateName: 'options\u200b.replay\u200b.sessionSampleRate',
  }),
  nextSteps: () => [],
};
