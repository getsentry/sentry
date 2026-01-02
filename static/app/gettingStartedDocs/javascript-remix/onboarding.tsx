import {ExternalLink} from 'sentry/components/core/link';
import {CopyDsnField} from 'sentry/components/onboarding/gettingStartedDoc/copyDsnField';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

import {getInstallContent} from './utils';

export const onboarding: OnboardingConfig = {
  introduction: () => (
    <p>
      {tct(
        "Sentry's integration with [remixLink:Remix] supports Remix 1.0.0 and above.",
        {
          remixLink: <ExternalLink href="https://remix.run/" />,
        }
      )}
    </p>
  ),
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
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/remix/manual-setup/" />
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
          text: tct(
            'Start your development server and visit [code:/sentry-example-page] if you have set it up. Click the button to trigger a test error.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'text',
          text: t(
            'Or, trigger a sample error by calling a function that does not exist somewhere in your application.'
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Javascript',
              language: 'javascript',
              code: 'myUndefinedFunction();',
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
};
