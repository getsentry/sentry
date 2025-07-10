import ExternalLink from 'sentry/components/links/externalLink';
import {StoreCrashReportsConfig} from 'sentry/components/onboarding/gettingStartedDoc/storeCrashReportsConfig';
import type {
  Docs,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

const getVerifySnippet = () => `
extends Node

func _ready():
	SentrySDK.add_breadcrumb("Just about to welcome the World.", "Note")
	SentrySDK.capture_message("Hello, World!")
`;

const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        "To get started, download the latest release of sentry Godot GDExtension from [releasesLink: GitHub Releases page] and place the Sentry SDK addon in [code: addons/sentry] in your project's directory.",
        {
          releasesLink: (
            <ExternalLink href="https://github.com/getsentry/sentry-godot/releases" />
          ),
          code: <code />,
        }
      ),
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: (
        <p>
          {tct(
            'Sentry can be configured via Project Settings or with a [link: Configuration Script]. To access project settings in Godot Engine, navigate to [code:Project > Project Settings > Sentry] section, and enter the DSN for the [code:Dsn] option.',
            {
              code: <code />,
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/godot/configuration/options/" />
              ),
            }
          )}
        </p>
      ),
      configurations: [{language: 'url', code: params.dsn.public}],
    },
  ],
  verify: params => [
    {
      type: StepType.VERIFY,
      description: tct(
        'Once the SDK is configured with the DSN you can add a [code:Node] to your test scene and attach a script with the following content',
        {
          code: <code />,
        }
      ),
      configurations: [{language: 'gdscript', code: getVerifySnippet()}],
      additionalInfo: tct(
        'Check the [godotSDKDocumentationLink:Godot SDK Documentation] for more details.',
        {
          godotSDKDocumentationLink: (
            <ExternalLink href="https://docs.sentry.io/platforms/godot/" />
          ),
        }
      ),
    },
    {
      title: t('Further Settings'),
      description: (
        <StoreCrashReportsConfig
          organization={params.organization}
          projectSlug={params.projectSlug}
        />
      ),
    },
  ],
};

const docs: Docs = {onboarding};

export default docs;
