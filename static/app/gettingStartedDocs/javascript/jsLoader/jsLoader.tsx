import styled from '@emotion/styled';
import beautify from 'js-beautify';

import Alert from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import TracePropagationMessage from 'sentry/components/onboarding/gettingStartedDoc/replay/tracePropagationMessage';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getReplayConfigureDescription,
  getReplayJsLoaderSdkSetupSnippet,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {t, tct} from 'sentry/locale';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

type Params = DocsParams;

const getInstallConfig = (params: Params) => [
  {
    type: StepType.INSTALL,
    configurations: [
      {
        description: t('Add this script tag to the top of the page:'),
        language: 'html',
        code: beautify.html(
          `<script src="${params.dsn.cdn}" crossorigin="anonymous"></script>`,
          {indent_size: 2, wrap_attributes: 'force-expand-multiline'}
        ),
        additionalInfo: (
          <StyledAlert type="info" showIcon>
            {tct(
              'Make sure that Session Replay is enabled in your [link:project settings].',
              {
                link: (
                  <ExternalLink
                    href={normalizeUrl(
                      `/settings/${params.organization.slug}/projects/${params.projectSlug}/loader-script/`
                    )}
                  />
                ),
              }
            )}
          </StyledAlert>
        ),
      },
    ],
  },
];

const getVerifySnippet = () => `
<!-- A button to trigger a test error -->
<button id="test-error">Trigger Test Error</button>
<script>
  const button = document.getElementById('test-error');
  button.addEventListener('click', () => {
    throw new Error('This is a test error');
  });
</script>`;

const replayOnboardingJsLoader: OnboardingConfig = {
  install: (params: Params) => getInstallConfig(params),
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: getReplayConfigureDescription({
        link: 'https://docs.sentry.io/platforms/javascript/session-replay/',
      }),
      configurations: [
        {
          language: 'html',
          code: getReplayJsLoaderSdkSetupSnippet(params),
        },
      ],
      isOptional: true,
      additionalInfo: <TracePropagationMessage />,
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: t(
        'To verify your Replay setup, trigger an error on your page and watch Sentry capture the event along with a recording of the user interaction.'
      ),
      configurations: [
        {
          description: t('You can simulate an error by adding the following code:'),
          language: 'html',
          code: getVerifySnippet(),
          additionalInfo: t(
            'After clicking the button, wait a few moments, and you\'ll see a new session appear on the "Replays" page.'
          ),
        },
      ],
    },
  ],
  nextSteps: () => [],
};

const StyledAlert = styled(Alert)`
  margin: 0;
`;

export default replayOnboardingJsLoader;
