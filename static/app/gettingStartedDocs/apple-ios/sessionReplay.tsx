import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getReplayMobileConfigureDescription,
  getReplayVerifyStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {t} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

const getReplaySetupSnippet = (params: DocsParams) => `
SentrySDK.start(configureOptions: { options in
  options.dsn = "${params.dsn.public}"
  options.debug = true

  options.sessionReplay.onErrorSampleRate = 1.0
  options.sessionReplay.sessionSampleRate = 0.1
})`;

const getReplayConfigurationSnippet = () => `
options.sessionReplay.maskAllText = true
options.sessionReplay.maskAllImages = true`;

export const sessionReplay: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: t(
            'Make sure your Sentry Cocoa SDK version is at least 8.43.0. If you already have the SDK installed, you can update it to the latest version with:'
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'SPM',
              language: 'swift',
              code: `.package(url: "https://github.com/getsentry/sentry-cocoa", from: "${getPackageVersion(
                params,
                'sentry.cocoa',
                '8.36.0'
              )}"),`,
            },
            {
              label: 'CocoaPods',
              language: 'ruby',
              code: `pod update`,
            },
            {
              label: 'Carthage',
              language: 'swift',
              code: `github "getsentry/sentry-cocoa" "${getPackageVersion(
                params,
                'sentry.cocoa',
                '8.36.0'
              )}"`,
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
              label: 'Swift',
              language: 'swift',
              code: getReplaySetupSnippet(params),
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
            link: 'https://docs.sentry.io/platforms/apple/guides/ios/session-replay/#privacy',
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
              label: 'Swift',
              language: 'swift',
              code: getReplayConfigurationSnippet(),
            },
          ],
        },
      ],
    },
  ],
  verify: getReplayVerifyStep({
    replayOnErrorSampleRateName: 'options\u200b.sessionReplay\u200b.onErrorSampleRate',
    replaySessionSampleRateName: 'options\u200b.sessionReplay\u200b.sessionSampleRate',
  }),
  nextSteps: () => [],
};
