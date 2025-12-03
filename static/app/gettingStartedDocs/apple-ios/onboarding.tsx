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
                <ExternalLink href="https://docs.sentry.io/platforms/apple/guides/ios/#install" />
              ),
            }
          ),
        },
        {
          type: 'code',
          tabs: getWizardInstallSnippet({
            platform: 'ios',
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
            t('Install the Sentry SDK via Swift Package Manager or Cocoapods'),
            tct(
              'Update your [appDelegate: AppDelegate] or SwiftUI App Initializer with the default Sentry configuration and an example error',
              {
                appDelegate: <code />,
              }
            ),
            tct(
              'Add a new [code: Upload Debug Symbols] phase to your [code: xcodebuild] build script',
              {
                code: <code />,
              }
            ),
            tct(
              'Create [code: .sentryclirc] with an auth token to upload debug symbols (this file is automatically added to [code: .gitignore])',
              {
                code: <code />,
              }
            ),
            t(
              "When you're using Fastlane, it will add a Sentry lane for uploading debug symbols"
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
                <ExternalLink href="https://docs.sentry.io/platforms/apple/guides/ios/manual-setup/" />
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
      id: 'cocoapods-carthage',
      name: t('CocoaPods/Carthage'),
      description: t(
        'Learn about integrating Sentry into your project using CocoaPods or Carthage.'
      ),
      link: 'https://docs.sentry.io/platforms/apple/install/',
    },
    {
      id: 'debug-symbols',
      name: t('Debug Symbols'),
      description: t('Symbolicate and get readable stacktraces in your Sentry errors.'),
      link: 'https://docs.sentry.io/platforms/apple/dsym/',
    },
    {
      id: 'swiftui',
      name: t('SwiftUI'),
      description: t('Learn about our first class integration with SwiftUI.'),
      link: 'https://docs.sentry.io/platforms/apple/tracing/instrumentation/swiftui-instrumentation/',
    },
  ],
};
