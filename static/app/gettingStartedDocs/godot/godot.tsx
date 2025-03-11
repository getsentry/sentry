import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {tct} from 'sentry/locale';

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
        }
      ),
      additionalInfo: tct(
        'Check the [godotSDKDocumentationLink:Godot SDK Documentation] for more details.',
        {
          godotSDKDocumentationLink: (
            <ExternalLink href="https://docs.sentry.io/platforms/godot/" />
          ),
        }
      ),
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: (
        <Fragment>
          <p>
            {tct(
              'Sentry can be configured via Project Settings or with a [link: Configuration Script]. To access project settings in Godot Engine, navigate to [code:Project > Project Settings...], then scroll down the sections list on the left until you find the Sentry section.',
              {
                code: <code />,
                link: (
                  <ExternalLink href="https://docs.sentry.io/platforms/godot/configuration/options/" />
                ),
              }
            )}
          </p>
          <p>
            {tct('Enter the following DSN for the [code:Dsn] option.', {
              code: <code />,
            })}
          </p>
        </Fragment>
      ),
      configurations: [{language: 'url', code: params.dsn.public}],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: tct(
        'Once the SDK is configured with the DSN you can add a [code:Node] to your test scene and attach a script with the following content:',
        {
          code: <code />,
        }
      ),
      configurations: [{language: 'gdscript', code: getVerifySnippet()}],
    },
  ],
};

const docs: Docs = {onboarding};

export default docs;
