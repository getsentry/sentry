import {ExternalLink} from 'sentry/components/core/link';
import {CopyDsnField} from 'sentry/components/onboarding/gettingStartedDoc/copyDsnField';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct, tctCode} from 'sentry/locale';

import {getInstallContent} from './utils';

export const onboarding: OnboardingConfig = {
  install: (params: DocsParams) => [
    {
      title: t('Automatic Configuration (Recommended)'),
      content: getInstallContent(params),
    },
  ],
  configure: params => [
    {
      collapsible: true,
      title: t('Manual Configuration'),
      content: [
        {
          type: 'text',
          text: tct(
            'Alternatively, you can also set up the SDK manually, by following the [manualSetupLink:manual setup docs].',
            {
              manualSetupLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nuxt/manual-setup/" />
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
  verify: () => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: tctCode(
            'Build and run your application and visit [code:/sentry-example-page] if you have set it up. Click the button to trigger a test error.'
          ),
        },
        {
          type: 'text',
          text: t('Or, throw an error in a simple vue component.'),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Vue',
              language: 'html',
              code: `<script setup>
  const triggerError = () => {
    throw new Error("Nuxt Button Error");
  };
</script>

<template>
  <button id="errorBtn" @click="triggerError">Trigger Error</button>
</template>`,
            },
          ],
        },
        {
          type: 'text',
          text: t(
            'If you see an issue in your Sentry Issues, you have successfully set up Sentry.'
          ),
        },
      ],
    },
  ],
  nextSteps: () => [
    {
      id: 'nuxt-features',
      name: t('Nuxt Features'),
      description: t('Learn about our first class integration with the Nuxt framework.'),
      link: 'https://docs.sentry.io/platforms/javascript/guides/nuxt/features/',
    },
  ],
};
