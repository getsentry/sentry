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

const getReplaySetupSnippetKotlin = (params: DocsParams) => `
SentryAndroid.init(context) { options ->
  options.dsn = "${params.dsn.public}"
  options.isDebug = true

  options.sessionReplay.onErrorSampleRate = 1.0
  options.sessionReplay.sessionSampleRate = 0.1
}`;

const getReplaySetupSnippetXml = () => `
<meta-data android:name="io.sentry.session-replay.on-error-sample-rate" android:value="1.0" />
<meta-data android:name="io.sentry.session-replay.session-sample-rate" android:value="1.0" />`;

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
          text: tct(
            "Make sure your Sentry Android SDK version is at least 7.20.0. The easiest way to update the SDK is through the Sentry Android Gradle plugin in your app module's [code:build.gradle] file.",
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Groovy',
              language: 'groovy',
              filename: 'app/build.gradle',
              code: `plugins {
  id "com.android.application"
  id "io.sentry.android.gradle" version "${getPackageVersion(
    params,
    'sentry.java.android.gradle-plugin',
    '4.11.0'
  )}"
}`,
            },
            {
              label: 'Kotlin',
              language: 'kotlin',
              filename: 'app/build.gradle.kts',
              code: `plugins {
  id("com.android.application")
  id("io.sentry.android.gradle") version "${getPackageVersion(
    params,
    'sentry.java.android.gradle-plugin',
    '4.11.0'
  )}"
}`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'If you have the SDK installed without the Sentry Gradle Plugin, you can update the version directly in the [code:build.gradle] through:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Groovy',
              language: 'groovy',
              filename: 'app/build.gradle',
              code: `dependencies {
    implementation 'io.sentry:sentry-android:${getPackageVersion(
      params,
      'sentry.java.android',
      '7.14.0'
    )}'
}`,
            },
            {
              label: 'Kotlin',
              language: 'kotlin',
              filename: 'app/build.gradle.kts',
              code: `dependencies {
    implementation("io.sentry:sentry-android:${getPackageVersion(
      params,
      'sentry.java.android',
      '7.14.0'
    )}")
}`,
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
              label: 'Kotlin',
              language: 'kotlin',
              code: getReplaySetupSnippetKotlin(params),
            },
            {
              label: 'XML',
              language: 'xml',
              filename: 'AndroidManifest.xml',
              code: getReplaySetupSnippetXml(),
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
            link: 'https://docs.sentry.io/platforms/android/session-replay/#privacy',
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
              label: 'Kotlin',
              language: 'kotlin',
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
