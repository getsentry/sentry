import {ExternalLink} from '@sentry/scraps/link';

import {copyDsnFieldBlock} from 'sentry/components/onboarding/gettingStartedDoc/copyDsnField';
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
            'Sentry supports Expo SDK 50 and newer through the React Native SDK. Add Sentry automatically to your app with the [wizardLink:Sentry wizard] (call this inside your project directory).',
            {
              wizardLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/react-native/guides/expo/#install" />
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
            t('Add the Sentry Expo config plugin to your app config'),
            t('Add the Sentry Metro plugin to your Metro configuration'),
            t('Add source maps and debug symbols upload to your build process'),
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
            'Alternatively, you can also set up the SDK manually, by following the [manualSetupLink:Expo setup docs].',
            {
              manualSetupLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/react-native/guides/expo/#manual-install" />
              ),
            }
          ),
        },
        copyDsnFieldBlock(params),
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [
    {
      name: t('Expo Router'),
      description: t('Set up automatic instrumentation with Expo Router'),
      link: 'https://docs.sentry.io/platforms/react-native/guides/expo/tracing/instrumentation/expo-router/',
    },
    {
      name: t('Expo Updates'),
      description: t('Capture Expo Updates context on your events'),
      link: 'https://docs.sentry.io/platforms/react-native/guides/expo/manual-setup/expo/expo-updates/',
    },
  ],
};
