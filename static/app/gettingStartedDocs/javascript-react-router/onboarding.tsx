import {Fragment} from 'react';

import {ExternalLink} from 'sentry/components/core/link';
import {CopyDsnField} from 'sentry/components/onboarding/gettingStartedDoc/copyDsnField';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

import {getInstallSnippet} from './utils';

export const onboarding: OnboardingConfig = {
  introduction: () => (
    <Fragment>
      <p>{t("In this guide you'll set up the Sentry React Router SDK")}</p>
      <p>
        {tct(
          'If you are using React Router in library mode, you can follow the instructions in the [reactLibraryLink:React guide].',
          {
            reactLibraryLink: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/react/features/react-router/" />
            ),
          }
        )}
      </p>
    </Fragment>
  ),
  install: (params: DocsParams) => [
    {
      title: t('Automatic Configuration (Recommended)'),
      content: [
        {
          type: 'text',
          text: tct(
            'Configure your app automatically by running the [wizardLink:Sentry wizard] in the root of your project.',
            {
              wizardLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/react-router/#install" />
              ),
            }
          ),
        },
        {
          type: 'code',
          language: 'bash',
          code: getInstallSnippet(params),
        },
      ],
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
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/react-router/manual-setup/" />
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
              label: 'JavaScript',
              language: 'javascript',
              code: 'myUndefinedFunction();',
            },
          ],
        },
        {
          type: 'text',
          text: t(
            'If you see an issue in your Sentry Issues, you have successfully set up Sentry with React Router.'
          ),
        },
      ],
    },
  ],
};
