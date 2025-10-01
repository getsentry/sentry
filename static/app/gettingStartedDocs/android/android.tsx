import {ExternalLink} from 'sentry/components/core/link';
import {CopyDsnField} from 'sentry/components/onboarding/gettingStartedDoc/copyDsnField';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getReplayMobileConfigureDescription,
  getReplayVerifyStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {feedbackOnboardingCrashApiJava} from 'sentry/gettingStartedDocs/java/java';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';
import {getWizardInstallSnippet} from 'sentry/utils/gettingStartedDocs/mobileWizard';

const getManualInstallSnippet = (params: DocsParams) => `
plugins {
  id "com.android.application" // should be in the same module
  id "io.sentry.android.gradle" version "${getPackageVersion(
    params,
    'sentry.java.android.gradle-plugin',
    '5.9.0'
  )}"
}`;

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

const onboarding: OnboardingConfig = {
  install: params => [
    {
      title: t('Automatic Configuration (Recommended)'),
      content: [
        {
          type: 'text',
          text: tct(
            'Add Sentry automatically to your app with the [wizardLink:Sentry wizard] (call this inside your project directory).',
            {
              wizardLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/android/#install" />
              ),
            }
          ),
        },
        {
          type: 'code',
          tabs: getWizardInstallSnippet({
            platform: 'android',
            params,
          }),
        },
        {
          type: 'text',
          text: t('The Sentry wizard will automatically patch your application:'),
        },
        {
          type: 'list',
          items: [
            tct(
              "Update your app's [buildGradle:build.gradle] file with the Sentry Gradle plugin and configure it.",
              {
                buildGradle: <code />,
              }
            ),
            tct(
              'Update your [manifest: AndroidManifest.xml] with the default Sentry configuration',
              {
                manifest: <code />,
              }
            ),
            tct(
              'Create [code: sentry.properties] with an auth token to upload proguard mappings (this file is automatically added to [code: .gitignore])',
              {
                code: <code />,
              }
            ),
            t(
              "Add an example error to your app's Main Activity to verify your Sentry setup"
            ),
          ],
        },
      ],
    },
  ],
  configure: params => [
    {
      title: t('Manual Configuration'),
      collapsible: true,
      content: [
        {
          type: 'text',
          text: tct(
            'Alternatively, you can also set up the SDK manually, by following the [manualSetupLink:manual setup docs].',
            {
              manualSetupLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/android/manual-setup/" />
              ),
            }
          ),
        },
        {
          type: 'custom',
          content: <CopyDsnField params={params} />,
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [
    {
      id: 'advanced-configuration',
      name: t('Advanced Configuration'),
      description: t('Customize the SDK initialization behavior.'),
      link: 'https://docs.sentry.io/platforms/android/configuration/manual-init/#manual-initialization',
    },
    {
      id: 'jetpack-compose',
      name: t('Jetpack Compose'),
      description: t('Learn about our first class integration with Jetpack Compose.'),
      link: 'https://docs.sentry.io/platforms/android/configuration/integrations/jetpack-compose/',
    },
  ],
};

const replayOnboarding: OnboardingConfig = {
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

const profilingOnboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Android UI Profiling is available starting in SDK version [code:8.7.0].',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Groovy',
              language: 'groovy',
              filename: 'app/build.gradle',
              code: getManualInstallSnippet(params),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'Version [versionPlugin] of the plugin will automatically add the Sentry Android SDK (version [versionSdk]) to your app.',
            {
              versionPlugin: (
                <code>
                  {getPackageVersion(
                    params,
                    'sentry.java.android.gradle-plugin',
                    '5.9.0'
                  )}
                </code>
              ),
              versionSdk: (
                <code>{getPackageVersion(params, 'sentry.java.android', '8.6.0')}</code>
              ),
            }
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
          text: tct('Set up profiling in your [code:AndroidManifest.xml] file.', {
            code: <code />,
          }),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'XML',
              language: 'xml',
              filename: 'AndroidManifest.xml',
              code: `
<application>
  <meta-data
    android:name="io.sentry.dsn"
    android:value="${params.dsn.public}"
  />
  <meta-data
    android:name="io.sentry.traces.sample-rate"
    android:value="1.0"
  />${
    params.profilingOptions?.defaultProfilingMode === 'continuous'
      ? `
  <!-- Set sampling rate for profiling, adjust in production env - this is evaluated only once per session -->
  <!-- note: there is a known issue in the Android Runtime that can be triggered by Profiling in certain circumstances -->
  <!-- see https://docs.sentry.io/platforms/android/profiling/troubleshooting/ -->
  <meta-data
    android:name="io.sentry.traces.profiling.session-sample-rate"
    android:value="1.0"
  />
  <!-- Set profiling lifecycle, can be \`manual\` (controlled through \`Sentry.startProfiler()\` and \`Sentry.stopProfiler()\`) or \`trace\` (automatically starts and stop a profile whenever a sampled trace starts and finishes) -->
  <meta-data
    android:name="io.sentry.traces.profiling.lifecycle"
    android:value="trace"
  />
  <!-- Enable profiling on app start -->
  <meta-data
    android:name="io.sentry.traces.profiling.start-on-app-start"
    android:value="true"
  />`
      : `
  <!-- Set sampling rate for profiling, adjust in production env - this is relative to sampled transactions -->
  <!-- note: there is a known issue in the Android Runtime that can be triggered by Profiling in certain circumstances -->
  <!-- see https://docs.sentry.io/platforms/android/profiling/troubleshooting/ -->
  <meta-data
    android:name="io.sentry.traces.profiling.sample-rate"
    android:value="1.0"
  />
  <!-- Enable profiling on app start -->
  <meta-data
    android:name="io.sentry.traces.profiling.enable-app-start"
    android:value="true"
  />`
  }
</application>
`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'For more detailed information on profiling, see the [link:profiling documentation].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/android/profiling/" />
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
            'Verify that profiling is working correctly by simply using your application.'
          ),
        },
      ],
    },
  ],
};

const logsOnboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            "To start using logs, make sure your Sentry Android SDK version is at least 8.12.0. If you're on an older major version of the SDK, follow our [link:migration guide] to upgrade. The easiest way to update the SDK is through the Sentry Android Gradle plugin in your app module [code:build.gradle] file.",
            {
              code: <code />,
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/android/migration/" />
              ),
            }
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
    '5.9.0'
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
    '5.9.0'
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
              value: 'groovy',
              language: 'groovy',
              filename: 'app/build.gradle',
              code: `dependencies {
  implementation 'io.sentry:sentry-android:${getPackageVersion(
    params,
    'sentry.java.android',
    '8.12.0'
  )}'
}`,
            },
            {
              label: 'Kotlin',
              value: 'kotlin',
              language: 'kotlin',
              filename: 'app/build.gradle.kts',
              code: `dependencies {
  implementation("io.sentry:sentry-android:${getPackageVersion(
    params,
    'sentry.java.android',
    '8.12.0'
  )}")
}`,
            },
          ],
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
            'To enable logging, you need to initialize the SDK with the [code:logs.enabled] option set to [code:true].',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'XML',
              language: 'xml',
              filename: 'AndroidManifest.xml',
              code: `<meta-data android:name="io.sentry.logs.enabled" android:value="true" />`,
            },
            {
              label: 'Java',
              language: 'java',
              code: `import io.sentry.SentryLevel;
import io.sentry.android.core.SentryAndroid;
import android.app.Application;

public class MyApplication extends Application {
  public void onCreate() {
    super.onCreate();
    SentryAndroid.init(this, options -> {
      options.setDsn("${params.dsn.public}");
      options.getLogs().setEnabled(true);
    });
  }
}`,
            },
            {
              label: 'Kotlin',
              language: 'kotlin',
              code: `import io.sentry.SentryLevel;
import io.sentry.android.core.SentryAndroid;
import android.app.Application;

class MyApplication : Application() {
  override fun onCreate() {
    super.onCreate()
    SentryAndroid.init(this, options -> {
      options.setDsn("${params.dsn.public}")
      options.getLogs().setEnabled(true)
    })
  }
}`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'You can also configure [link:logging integrations] to automatically capture logs from your application from libraries like [code:Timber] or [code:Logcat].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/android/logs/#integrations" />
              ),
              code: <code />,
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
          text: t('Send a test log from your app to verify logs are arriving in Sentry.'),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Java',
              language: 'java',
              code: `import io.sentry.Sentry;

Sentry.logger().info("A simple log message");
Sentry.logger().error("A %s log message", "formatted");`,
            },
            {
              label: 'Kotlin',
              language: 'kotlin',
              code: `import io.sentry.Sentry

Sentry.logger().info("A simple log message")
Sentry.logger().error("A %s log message", "formatted")`,
            },
          ],
        },
      ],
    },
  ],
};

const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi: feedbackOnboardingCrashApiJava,
  crashReportOnboarding: feedbackOnboardingCrashApiJava,
  profilingOnboarding,
  replayOnboarding,
  logsOnboarding,
};

export default docs;
