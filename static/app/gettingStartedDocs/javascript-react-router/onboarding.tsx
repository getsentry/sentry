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

const getVerifySnippet = (params: DocsParams) => {
  const logsCode = params.isLogsSelected
    ? `
  // Send a log before throwing the error
  Sentry.logger.info("User triggered test error", {
    'action': 'test_loader_error',
  });`
    : '';
  const metricsCode = params.isMetricsSelected
    ? `
  // Send a test metric before throwing the error
  Sentry.metrics.count('test_counter', 1);`
    : '';
  return `
import type { Route } from "./+types/error-page";

export async function loader() {${logsCode}${metricsCode}
  throw new Error("My first Sentry error!");
}

export default function ExamplePage() {
  return <div>Loading this page will throw an error</div>;
}`;
};

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
  verify: params => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Create a route that throws an error to verify that Sentry is working:'
          ),
        },
        {
          type: 'code',
          language: 'tsx',
          code: getVerifySnippet(params),
        },
        {
          type: 'text',
          text: t(
            'After opening this route in your browser, you should see the error in your Sentry issue stream.'
          ),
        },
      ],
    },
  ],
};
