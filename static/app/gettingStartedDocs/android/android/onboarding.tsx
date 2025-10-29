import {ExternalLink} from 'sentry/components/core/link';
import {CopyDsnField} from 'sentry/components/onboarding/gettingStartedDoc/copyDsnField';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {getWizardInstallSnippet} from 'sentry/utils/gettingStartedDocs/mobileWizard';

export const onboarding: OnboardingConfig = {
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
