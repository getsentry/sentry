import {Fragment} from 'react';
import styled from '@emotion/styled';

// import createSentryNode from 'sentry-images/onboarding/godot/create-sentry-node.png';
// import sentryNodePropertyEditor from 'sentry-images/onboarding/godot/sentry-node-property-editor.png';
import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

const getVerifySnippet = () => `SentrySdk.capture_message("Test event")`;

const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        "To get started, download the latest release from [releasesLink: GitHub Releases page] and place the GDExtension in your project's [code:bin] directory.",
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
              'Create a [code:SentryNode] and make it the root of your project. If you have an existing project, change the root type of your project to [code:SentryNode]. Alternatively, if you cannot change the type of your root node, add a [code:SentryNode] as high up in your scene tree as possible.',
              {code: <code />}
            )}
          </p>
          <p>
            {tct(
              'Configure the Sentry SDK directly on the [code:SentryNode] in the property editor. Read about the available options in the [link:Sentry SDK Documentation].',
              {
                code: <code />,
                link: (
                  <ExternalLink href="https://docs.sentry.io/platforms/native/configuration/options/" />
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
      description: t(
        'Once the SDK is configured with the DSN you can call the SDK from anywhere:'
      ),
      configurations: [{language: 'c', code: getVerifySnippet()}],
    },
  ],
};

const docs: Docs = {onboarding};

export default docs;

export const Image = styled('img')`
  height: 720px;
  margin-bottom: ${space(4)}; /** override styles in less files */
  max-width: 1280px !important;
  box-shadow: none !important;
  border: 0 !important;
  border-radius: 0 !important;
`;
