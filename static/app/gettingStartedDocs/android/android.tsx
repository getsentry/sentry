import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list/';
import ListItem from 'sentry/components/list/listItem';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {t, tct} from 'sentry/locale';

interface StepsParams {
  dsn: string;
  hasPerformance: boolean;
  hasProfiling: boolean;
  sourcePackageRegistries?: ModuleProps['sourcePackageRegistries'];
}

// Configuration Start
export const steps = ({
  dsn,
  sourcePackageRegistries,
  hasPerformance,
  hasProfiling,
}: StepsParams): LayoutProps['steps'] => [
  {
    title: t('Auto-Install'),
    description: (
      <p>
        {tct(
          'Add Sentry automatically to your app with the [wizardLink:Sentry wizard] (call this inside your project directory).',
          {
            wizardLink: (
              <ExternalLink href="https://docs.sentry.io/platforms/android/#install" />
            ),
          }
        )}
      </p>
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
                'Alternatively, you can also [manualSetupLink:set up the SDK manually]. [stepsBelow: You can skip the steps below when using the wizard].',
                {
                  manualSetupLink: (
                    <ExternalLink href="https://docs.sentry.io/platforms/android/manual-setup/" />
                  ),
                  stepsBelow: <strong />,
                }
              )}
            </p>
          </Fragment>
        ),
      },
    ],
  },
  {
    title: t('Or Manually Install and Configure'),
    description: (
      <Fragment>
        <strong>{t('Install the Sentry SDK:')}</strong>
        <p>
          {tct(
            'Add the [sagpLink:Sentry Android Gradle plugin] to your [app:app] module:',
            {
              sagpLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/android/configuration/gradle/" />
              ),
              app: <code />,
            }
          )}
        </p>
      </Fragment>
    ),
    configurations: [
      {
        language: 'groovy',
        partialLoading: sourcePackageRegistries?.isLoading,
        code: `
plugins {
  id "com.android.application" // should be in the same module
  id "io.sentry.android.gradle" version "${
    sourcePackageRegistries?.isLoading
      ? t('\u2026loading')
      : sourcePackageRegistries?.data?.['sentry.java.android.gradle-plugin']?.version ??
        '3.12.0'
  }"
}
        `,
      },
      {
        description: (
          <Fragment>
            <strong>{t('Configure the Sentry SDK:')}</strong>
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
        language: 'xml',
        code: `
<application>
  <!-- Required: set your sentry.io project identifier (DSN) -->
  <meta-data android:name="io.sentry.dsn" android:value="${dsn}" />

  <!-- enable automatic breadcrumbs for user interactions (clicks, swipes, scrolls) -->
  <meta-data android:name="io.sentry.traces.user-interaction.enable" android:value="true" />
  <!-- enable screenshot for crashes -->
  <meta-data android:name="io.sentry.attach-screenshot" android:value="true" />
  <!-- enable view hierarchy for crashes -->
  <meta-data android:name="io.sentry.attach-view-hierarchy" android:value="true" />${
    hasPerformance
      ? `

  <!-- enable the performance API by setting a sample-rate, adjust in production env -->
  <meta-data android:name="io.sentry.traces.sample-rate" android:value="1.0" />`
      : ''
  }${
    hasProfiling
      ? `
  <!-- enable profiling when starting transactions, adjust in production env -->
  <meta-data android:name="io.sentry.traces.profiling.sample-rate" android:value="1.0" />`
      : ''
  }
</application>
        `,
      },
    ],
  },
  {
    type: StepType.VERIFY,
    description: (
      <p>
        {tct(
          "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected. You can add it to your app's [mainActivity: MainActivity].",
          {
            mainActivity: <code />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'kotlin',
        code: `
val breakWorld = Button(this).apply {
  text = "Break the world"
  setOnClickListener {
    throw RuntimeException("Break the world")
  }
}

addContentView(breakWorld, ViewGroup.LayoutParams(
  ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        `,
      },
    ],
  },
];

export const nextSteps = [
  {
    id: 'manual-configuration',
    name: t('Manual Configuration'),
    description: t('Customize the SDK initialization behavior.'),
    link: 'https://docs.sentry.io/platforms/android/configuration/manual-init/#manual-initialization',
  },
  {
    id: 'proguard-r8',
    name: t('ProGuard/R8'),
    description: t('Deobfuscate and get readable stacktraces in your Sentry errors.'),
    link: 'https://docs.sentry.io/platforms/android/configuration/gradle/#proguardr8--dexguard',
  },
  {
    id: 'jetpack-compose',
    name: t('Jetpack Compose'),
    description: t('Learn about our first class integration with Jetpack Compose.'),
    link: 'https://docs.sentry.io/platforms/android/configuration/integrations/jetpack-compose/',
  },
  {
    id: 'source-context',
    name: t('Source Context'),
    description: t('See your source code as part of your stacktraces in Sentry.'),
    link: 'https://docs.sentry.io/platforms/android/enhance-errors/source-context/',
  },
];
// Configuration End

export function GettingStartedWithAndroid({
  dsn,
  sourcePackageRegistries,
  activeProductSelection = [],
  ...props
}: ModuleProps) {
  const hasPerformance = activeProductSelection.includes(
    ProductSolution.PERFORMANCE_MONITORING
  );
  const hasProfiling = activeProductSelection.includes(ProductSolution.PROFILING);
  return (
    <Layout
      steps={steps({dsn, sourcePackageRegistries, hasPerformance, hasProfiling})}
      nextSteps={nextSteps}
      {...props}
    />
  );
}

export default GettingStartedWithAndroid;
