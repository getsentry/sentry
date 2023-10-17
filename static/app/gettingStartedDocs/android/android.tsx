import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list/';
import ListItem from 'sentry/components/list/listItem';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {
  BasePlatformOptions,
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

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
    defaultValue:
      navigator.userAgent.indexOf('Win') !== -1
        ? InstallationMode.MANUAL
        : InstallationMode.AUTO,
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
    '3.12.0'
  )}"
}`;

const getConfigurationSnippet = (params: Params) => `
<application>
  <!-- Required: set your sentry.io project identifier (DSN) -->
  <meta-data android:name="io.sentry.dsn" android:value="${params.dsn}" />

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
    params.isProfilingSelected
      ? `
  <!-- enable profiling when starting transactions, adjust in production env -->
  <meta-data android:name="io.sentry.traces.profiling.sample-rate" android:value="1.0" />`
      : ''
  }
</application>`;

const getVerifySnippet = () => `
val breakWorld = Button(this).apply {
  text = "Break the world"
  setOnClickListener {
    Sentry.captureException(RuntimeException("This app uses Sentry! :)"))
  }
}

addContentView(breakWorld, ViewGroup.LayoutParams(
  ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))`;

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
                language: 'bash',
                code: `brew install getsentry/tools/sentry-wizard && sentry-wizard -i android`,
              },
              {
                description: (
                  <Fragment>
                    {t('The Sentry wizard will automatically patch your application:')}
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
                          'Create [sentryProperties: sentry.properties] with an auth token to upload proguard mappings (this file is automatically added to [gitignore: .gitignore])',
                          {
                            sentryProperties: <code />,
                            gitignore: <code />,
                          }
                        )}
                      </ListItem>
                      <ListItem>
                        {t(
                          "Add an example error to your app's Main Activity to verify your Sentry setup"
                        )}
                      </ListItem>
                    </List>
                    <p>
                      {tct(
                        'Alternatively, you can also [manualSetupLink:set up the SDK manually].',
                        {
                          manualSetupLink: (
                            <ExternalLink href="https://docs.sentry.io/platforms/android/manual-setup/" />
                          ),
                        }
                      )}
                    </p>
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
                    'Configuration is done via the application [manifest: AndroidManifest.xml]. Under the hood Sentry uses a [provider:ContentProvider] to initialize the SDK based on the values provided below. This way the SDK can capture important crashes and metrics right from the app start.',
                    {
                      manifest: <code />,
                      provider: <code />,
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
                code: getVerifySnippet(),
              },
            ],
          },
        ],
  nextSteps: params =>
    isAutoInstall(params)
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
        ],
};

const docs: Docs<PlatformOptions> = {
  onboarding,
  platformOptions,
};

export default docs;
