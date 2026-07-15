import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {SdkUpdateAlert} from 'sentry/views/insights/pages/agents/components/sdkUpdateAlert';

const MIN_REQUIRED_VERSION = '4.27.0';

export const agentMonitoring: OnboardingConfig = {
  introduction: params => (
    <SdkUpdateAlert
      projectId={params.project.id}
      minVersion={MIN_REQUIRED_VERSION}
      packageName="sentry/sentry-laravel"
    />
  ),
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Agent monitoring for Laravel uses the [code:laravel/ai] package and [code:sentry/sentry-laravel] version [minVersion] or newer.',
            {
              code: <code />,
              minVersion: <code>{MIN_REQUIRED_VERSION}</code>,
            }
          ),
        },
        {
          type: 'code',
          language: 'bash',
          code: `composer require sentry/sentry-laravel:^${MIN_REQUIRED_VERSION} laravel/ai
php artisan vendor:publish --provider="Laravel\\Ai\\AiServiceProvider"
php artisan migrate`,
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
          text: t(
            'Configure Sentry. Choose yes when prompted to enable Performance Monitoring.'
          ),
        },
        {
          type: 'code',
          language: 'shell',
          code: `php artisan sentry:publish --dsn=${params.dsn.public}`,
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
          text: t('Verify agent monitoring by calling any Laravel AI agent:'),
        },
        {
          type: 'code',
          language: 'php',
          code: `<?php

use App\\Ai\\Agents\\MyAgent;

$response = (new MyAgent)->prompt('What time is it?');`,
        },
      ],
    },
  ],
  nextSteps: () => [],
};
