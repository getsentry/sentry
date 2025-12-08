import {ExternalLink} from 'sentry/components/core/link';
import {CopyDsnField} from 'sentry/components/onboarding/gettingStartedDoc/copyDsnField';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

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
                <ExternalLink href="https://docs.sentry.io/platforms/react-native/#install" />
              ),
            }
          ),
        },
        {
          type: 'code',
          code: `npx @sentry/wizard@latest -i reactNative ${params.isSelfHosted ? '' : '--saas'} --org ${params.organization.slug} --project ${params.project.slug}`,
          language: 'bash',
        },
        {
          type: 'text',
          text: t(
            'The Sentry wizard will automatically patch your project with the following:'
          ),
        },
        {
          type: 'list',
          items: [
            t('Configure the SDK with your DSN'),
            t('Add source maps upload to your build process'),
            t('Add debug symbols upload to your build process'),
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
                <ExternalLink href="https://docs.sentry.io/platforms/react-native/manual-setup/manual-setup/" />
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
      name: t('React Navigation'),
      description: t('Set up automatic instrumentation with React Navigation'),
      link: 'https://docs.sentry.io/platforms/react-native/tracing/instrumentation/react-navigation/',
    },
    {
      name: t('React Native Navigation'),
      description: t('Set up automatic instrumentation with React Native Navigation'),
      link: 'https://docs.sentry.io/platforms/react-native/tracing/instrumentation/react-native-navigation/',
    },
    {
      name: t('Expo Router'),
      description: t('Set up automatic instrumentation with Expo Router'),
      link: 'https://docs.sentry.io/platforms/react-native/tracing/instrumentation/expo-router/',
    },
  ],
};
