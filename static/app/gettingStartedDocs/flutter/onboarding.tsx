import {ExternalLink} from 'sentry/components/core/link';
import {CopyDsnField} from 'sentry/components/onboarding/gettingStartedDoc/copyDsnField';
import type {
  BasePlatformOptions,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {getWizardInstallSnippet} from 'sentry/utils/gettingStartedDocs/mobileWizard';

const getVerifySnippet = (params: DocsParams<BasePlatformOptions>) => {
  const logsCode = params.isLogsSelected
    ? `
    // Send a log before throwing the error
    Sentry.logger.info("User triggered test error button", {
      'action': SentryLogAttribute.string('test_error_button_click'),
    });`
    : '';
  return `
import 'package:sentry/sentry.dart';

child: ElevatedButton(
  onPressed: () {${logsCode}
    throw StateError('This is test exception');
  },
  child: const Text('Verify Sentry Setup'),
)
`;
};

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
                <ExternalLink href="https://docs.sentry.io/platforms/flutter/#install" />
              ),
            }
          ),
        },
        {
          type: 'code',
          tabs: getWizardInstallSnippet({
            platform: 'flutter',
            params,
          }),
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
            tct(
              'Configure the SDK with your DSN and performance monitoring options in your [main:main.dart] file.',
              {
                main: <code />,
              }
            ),
            tct('Update your [pubspec:pubspec.yaml] with the Sentry package', {
              pubspec: <code />,
            }),
            t('Add an example error to verify your setup'),
          ],
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
                <ExternalLink href="https://docs.sentry.io/platforms/flutter/manual-setup/" />
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
            'Create an intentional error, so you can test that everything is working. In the example below, pressing the button will throw an exception:'
          ),
        },
        {
          type: 'code',
          language: 'dart',
          code: getVerifySnippet(params),
        },
      ],
    },
  ],
  nextSteps: () => [
    {
      name: t('Upload Debug Symbols'),
      description: t(
        'We offer a range of methods to provide Sentry with debug symbols so that you can see symbolicated stack traces and find the cause of your errors faster.'
      ),
      link: 'https://docs.sentry.io/platforms/flutter/upload-debug/',
    },
    {
      name: t('Distributed Tracing'),
      description: t(
        'Connect all your services by configuring your endpoints in the Sentry init.'
      ),
      link: 'https://docs.sentry.io/platforms/flutter/tracing/trace-propagation/limiting-trace-propagation/',
    },
    {
      name: t('Connect your Git Repo'),
      description: t(
        'Adding our Git integrations will allow us determine suspect commits, comment on PRs, and create links directly to your source code from Sentry issues.'
      ),
      link: 'https://docs.sentry.io/organization/integrations/source-code-mgmt/',
    },
    {
      name: t('Structured Logs'),
      description: t(
        'Learn how to send structured logs to Sentry and view them alongside your errors.'
      ),
      link: 'https://docs.sentry.io/platforms/dart/guides/flutter/logs/',
    },
  ],
};
