import {Fragment} from 'react';

import {ExternalLink} from 'sentry/components/core/link';
import List from 'sentry/components/list/';
import ListItem from 'sentry/components/list/listItem';
import type {
  BasePlatformOptions,
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

export enum InstallationMode {
  AUTO = 'auto',
  MANUAL = 'manual',
}

const platformOptions = {
  installationMode: {
    label: t('Installation Mode'),
    items: [
      {
        label: t('Auto'),
        value: InstallationMode.AUTO,
      },
      {
        label: t('Manual'),
        value: InstallationMode.MANUAL,
      },
    ],
    defaultValue: InstallationMode.AUTO,
  },
} satisfies BasePlatformOptions;

type PlatformOptions = typeof platformOptions;
type Params = DocsParams<PlatformOptions>;

const isAutoInstall = (params: Params) =>
  params.platformOptions.installationMode === InstallationMode.AUTO;

const getManualInstallSnippet = (params: Params) => `
plugins {
  id "com.android.application" // should be in the same module
  id "io.sentry.android.gradle" version "${getPackageVersion(
    params,
    'sentry.java.android.gradle-plugin',
    '5.9.0'
  )}"
}`;

const getConfigurationSnippet = (params: Params) => `
<application>
  <!-- Required: set your sentry.io project identifier (DSN) -->
  <meta-data android:name="io.sentry.dsn" android:value="${params.dsn.public}" />

  <!-- Add data like request headers, user ip adress and device name, see https://docs.sentry.io/platforms/android/data-management/data-collected/ for more info -->
  <meta-data android:name="io.sentry.send-default-pii" android:value="true" />

  <!-- enable automatic breadcrumbs for user interactions (clicks, swipes, scrolls) -->
  <meta-data android:name="io.sentry.traces.user-interaction.enable" android:value="true" />
  <!-- enable screenshot for crashes -->
  <meta-data android:name="io.sentry.attach-screenshot" android:value="true" />
  <!-- enable view hierarchy for crashes -->
  <meta-data android:name="io.sentry.attach-view-hierarchy" android:value="true" />${
    params.isPerformanceSelected
      ? `

  <!-- enable the performance API by setting a sample-rate, adjust in production env -->
  <meta-data android:name="io.sentry.traces.sample-rate" android:value="1.0" />`
      : ''
  }${
    params.isProfilingSelected &&
    params.profilingOptions?.defaultProfilingMode !== 'continuous'
      ? `
    <!-- Set sampling rate for profiling, adjust in production env - this is relative to sampled transactions -->
    <!-- note: there is a known issue in the Android Runtime that can be triggered by Profiling in certain circumstances -->
    <!-- see https://docs.sentry.io/platforms/android/profiling/troubleshooting/ -->
    <meta-data android:name="io.sentry.traces.profiling.sample-rate" android:value="1.0" />
    <!-- Enable profiling on app start -->
    <meta-data android:name="io.sentry.traces.profiling.enable-app-start" android:value="true" />`
      : ''
  }${
    params.isProfilingSelected &&
    params.profilingOptions?.defaultProfilingMode === 'continuous'
      ? `
  <!-- Set sampling rate for profiling, adjust in production env - this is evaluated only once per session -->
  <!-- note: there is a known issue in the Android Runtime that can be triggered by Profiling in certain circumstances -->
  <!-- see https://docs.sentry.io/platforms/android/profiling/troubleshooting/ -->
  <meta-data android:name="io.sentry.traces.profiling.session-sample-rate" android:value="1.0" />
  <!-- Set profiling lifecycle, can be \`manual\` (controlled through \`Sentry.startProfiler()\` and \`Sentry.stopProfiler()\`) or \`trace\` (automatically starts and stop a profile whenever a sampled trace starts and finishes) -->
  <meta-data android:name="io.sentry.traces.profiling.lifecycle" android:value="trace" />
  <!-- Enable profiling on app start -->
  <meta-data android:name="io.sentry.traces.profiling.start-on-app-start" android:value="true" />`
      : ''
  }${
    params.isReplaySelected
      ? `

  <!-- record session replays for 100% of errors and 10% of sessions -->
  <meta-data android:name="io.sentry.session-replay.on-error-sample-rate" android:value="1.0" />
  <meta-data android:name="io.sentry.session-replay.session-sample-rate" android:value="0.1" />`
      : ''
  }${
    params.isLogsSelected
      ? `

  <!-- enable logs to be sent to Sentry -->
  <meta-data android:name="io.sentry.logs.enabled" android:value="true" />`
      : ''
  }
</application>`;

const getVerifySnippet = (params: Params) => `
${
  params.isProfilingSelected &&
  params.profilingOptions?.defaultProfilingMode === 'continuous'
    ? `
// Start profiling, if lifecycle is set to \`manual\`
Sentry.startProfiler()`
    : ''
}
val breakWorld = Button(this).apply {
  text = "Break the world"
  setOnClickListener {
    Sentry.captureException(RuntimeException("This app uses Sentry! :)"))
  }
}

addContentView(breakWorld, ViewGroup.LayoutParams(
  ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
${
  params.isProfilingSelected &&
  params.profilingOptions?.defaultProfilingMode === 'continuous'
    ? `
// Stop profiling, if lifecycle is set to \`manual\`. This call is optional. If you don't stop the profiler, it will keep profiling your application until the process exits.
Sentry.stopProfiler()`
    : ''
}`;

const getReplaySetupSnippetKotlin = (params: Params) => `
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

const onboarding: OnboardingConfig<PlatformOptions> = {
  install: params =>
    isAutoInstall(params)
      ? [
          {
            type: StepType.INSTALL,
            description: tct(
              'Add Sentry automatically to your app with the [wizardLink:Sentry wizard] (call this inside your project directory).',
              {
                wizardLink: (
                  <ExternalLink href="https://docs.sentry.io/platforms/android/#install" />
                ),
              }
            ),
            configurations: [
              {
                code: getWizardInstallSnippet({
                  platform: 'android',
                  params,
                }),
              },
              {
                description: (
                  <Fragment>
                    <p>
                      {t('The Sentry wizard will automatically patch your application:')}
                    </p>
                    <List symbol="bullet">
                      <ListItem>
                        {tct(
                          "Update your app's [buildGradle:build.gradle] file with the Sentry Gradle plugin and configure it.",
                          {
                            buildGradle: <code />,
                          }
                        )}
                      </ListItem>
                      <ListItem>
                        {tct(
                          'Update your [manifest: AndroidManifest.xml] with the default Sentry configuration',
                          {
                            manifest: <code />,
                          }
                        )}
                      </ListItem>
                      <ListItem>
                        {tct(
                          'Create [code: sentry.properties] with an auth token to upload proguard mappings (this file is automatically added to [code: .gitignore])',
                          {
                            code: <code />,
                          }
                        )}
                      </ListItem>
                      <ListItem>
                        {t(
                          "Add an example error to your app's Main Activity to verify your Sentry setup"
                        )}
                      </ListItem>
                    </List>
                  </Fragment>
                ),
              },
            ],
          },
        ]
      : [
          {
            type: StepType.INSTALL,
            description: tct(
              'Add the [sagpLink:Sentry Android Gradle plugin] to your [app:app] module:',
              {
                sagpLink: (
                  <ExternalLink href="https://docs.sentry.io/platforms/android/configuration/gradle/" />
                ),
                app: <code />,
              }
            ),
            configurations: [
              {
                language: 'groovy',
                partialLoading: params.sourcePackageRegistries?.isLoading,
                code: getManualInstallSnippet(params),
              },
            ],
          },
        ],
  configure: params =>
    isAutoInstall(params)
      ? []
      : [
          {
            type: StepType.CONFIGURE,
            description: (
              <Fragment>
                <p>
                  {tct(
                    'Configuration is done via the application [code: AndroidManifest.xml]. Under the hood Sentry uses a [code:ContentProvider] to initialize the SDK based on the values provided below. This way the SDK can capture important crashes and metrics right from the app start.',
                    {
                      code: <code />,
                    }
                  )}
                </p>
                <p>{t("Here's an example config which should get you started:")}</p>
              </Fragment>
            ),
            configurations: [
              {
                language: 'xml',
                code: getConfigurationSnippet(params),
              },
            ],
          },
        ],
  verify: params =>
    isAutoInstall(params)
      ? []
      : [
          {
            type: StepType.VERIFY,
            description: tct(
              "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected. You can add it to your app's [mainActivity: MainActivity].",
              {
                mainActivity: <code />,
              }
            ),
            configurations: [
              {
                language: 'kotlin',
                code: getVerifySnippet(params),
              },
            ],
          },
        ],
  nextSteps: params => {
    const steps = isAutoInstall(params)
      ? [
          {
            id: 'advanced-configuration',
            name: t('Advanced Configuration'),
            description: t('Customize the SDK initialization behavior.'),
            link: 'https://docs.sentry.io/platforms/android/configuration/manual-init/#manual-initialization',
          },
          {
            id: 'jetpack-compose',
            name: t('Jetpack Compose'),
            description: t(
              'Learn about our first class integration with Jetpack Compose.'
            ),
            link: 'https://docs.sentry.io/platforms/android/configuration/integrations/jetpack-compose/',
          },
        ]
      : [
          {
            id: 'advanced-configuration',
            name: t('Advanced Configuration'),
            description: t('Customize the SDK initialization behavior.'),
            link: 'https://docs.sentry.io/platforms/android/configuration/manual-init/#manual-initialization',
          },
          {
            id: 'proguard-r8',
            name: t('ProGuard/R8'),
            description: t(
              'Deobfuscate and get readable stacktraces in your Sentry errors.'
            ),
            link: 'https://docs.sentry.io/platforms/android/configuration/gradle/#proguardr8--dexguard',
          },
          {
            id: 'jetpack-compose',
            name: t('Jetpack Compose'),
            description: t(
              'Learn about our first class integration with Jetpack Compose.'
            ),
            link: 'https://docs.sentry.io/platforms/android/configuration/integrations/jetpack-compose/',
          },
          {
            id: 'source-context',
            name: t('Source Context'),
            description: t('See your source code as part of your stacktraces in Sentry.'),
            link: 'https://docs.sentry.io/platforms/android/enhance-errors/source-context/',
          },
        ];

    if (params.isLogsSelected) {
      steps.push({
        id: 'logs',
        name: t('Logging Integrations'),
        description: t(
          'Add logging integrations to automatically capture logs from your application.'
        ),
        link: 'https://docs.sentry.io/platforms/android/logs/#integrations',
      });
    }

    return steps;
  },
};

const replayOnboarding: OnboardingConfig<PlatformOptions> = {
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      description: tct(
        "Make sure your Sentry Android SDK version is at least 7.20.0. The easiest way to update the SDK is through the Sentry Android Gradle plugin in your app module's [code:build.gradle] file.",
        {code: <code />}
      ),
      configurations: [
        {
          code: [
            {
              label: 'Groovy',
              value: 'groovy',
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
              value: 'kotlin',
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
          description: tct(
            'If you have the SDK installed without the Sentry Gradle Plugin, you can update the version directly in the [code:build.gradle] through:',
            {code: <code />}
          ),
        },
        {
          code: [
            {
              label: 'Groovy',
              value: 'groovy',
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
              value: 'kotlin',
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
          description: t(
            'To set up the integration, add the following to your Sentry initialization:'
          ),
        },
        {
          code: [
            {
              label: 'Kotlin',
              value: 'kotlin',
              language: 'kotlin',
              code: getReplaySetupSnippetKotlin(params),
            },
            {
              label: 'XML',
              value: 'xml',
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
      description: getReplayMobileConfigureDescription({
        link: 'https://docs.sentry.io/platforms/android/session-replay/#privacy',
      }),
      configurations: [
        {
          description: t(
            'The following code is the default configuration, which masks and blocks everything.'
          ),
          code: [
            {
              label: 'Kotlin',
              value: 'kotlin',
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

const profilingOnboarding: OnboardingConfig<PlatformOptions> = {
  install: params => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Android UI Profiling is available starting in SDK version [code:8.7.0].',
        {
          code: <code />,
        }
      ),
      configurations: [
        {
          partialLoading: params.sourcePackageRegistries?.isLoading,
          code: [
            {
              label: 'Groovy',
              value: 'groovy',
              language: 'groovy',
              filename: 'app/build.gradle',
              code: getManualInstallSnippet(params),
            },
          ],
          additionalInfo: tct(
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
      description: tct('Set up profiling in your [code:AndroidManifest.xml] file.', {
        code: <code />,
      }),
      configurations: [
        {
          language: 'xml',
          code: [
            {
              label: 'XML',
              value: 'xml',
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
          description: tct(
            'For more detailed information on profiling, see the [link:profiling documentation].',
            {
              link: (
                <ExternalLink
                  href={`https://docs.sentry.io/platforms/android/profiling/`}
                />
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
      description: t(
        'To confirm that profiling is working correctly, run your application and check the Sentry profiles page for the collected profiles.'
      ),
    },
  ],
};

const logsOnboarding: OnboardingConfig<PlatformOptions> = {
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
                <ExternalLink
                  href={'https://docs.sentry.io/platforms/android/logs/#integrations'}
                />
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

const docs: Docs<PlatformOptions> = {
  onboarding,
  feedbackOnboardingCrashApi: feedbackOnboardingCrashApiJava,
  crashReportOnboarding: feedbackOnboardingCrashApiJava,
  platformOptions,
  profilingOnboarding,
  replayOnboarding,
  logsOnboarding,
};

export default docs;
