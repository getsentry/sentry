import {ExternalLink} from 'sentry/components/core/link';
import {StoreCrashReportsConfig} from 'sentry/components/onboarding/gettingStartedDoc/storeCrashReportsConfig';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

const getVerifySnippet = () => `
extends Node

func _ready():
	SentrySDK.add_breadcrumb(SentryBreadcrumb.create("Just about to welcome the World."))
	SentrySDK.capture_message("Hello, World!")
`;

export const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            "To get started, download the latest release of Sentry for Godot from [releasesLink: GitHub Releases] and place the Sentry addon in [code: addons/sentry] in your project's directory.",
            {
              releasesLink: (
                <ExternalLink href="https://github.com/getsentry/sentry-godot/releases" />
              ),
              code: <code />,
            }
          ),
        },
      ],
    },
  ],
  configure: (params: DocsParams) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'Sentry can be configured in the Project Settings window or [link: programmatically]. To access project settings in Godot Engine, navigate to [code:Project > Project Settings > Sentry] section, and enter the DSN for the [code:Dsn] option.',
            {
              code: <code />,
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/godot/configuration/options/#programmatic-configuration" />
              ),
            }
          ),
        },
        {
          type: 'code',
          language: 'url',
          code: params.dsn.public,
        },
      ],
    },
  ],
  verify: (params: DocsParams) => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: tct(
            'Once the SDK is configured with the DSN you can add a [code:Node] to your test scene and attach a script with the following content',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'gdscript',
          code: getVerifySnippet(),
        },
        {
          type: 'text',
          text: tct(
            'Check the [godotSDKDocumentationLink:Godot SDK Documentation] for more details.',
            {
              godotSDKDocumentationLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/godot/" />
              ),
            }
          ),
        },
      ],
    },
    {
      title: t('Further Settings'),
      content: [
        {
          type: 'custom',
          content: (
            <StoreCrashReportsConfig
              organization={params.organization}
              projectSlug={params.project.slug}
            />
          ),
        },
      ],
    },
  ],
};
