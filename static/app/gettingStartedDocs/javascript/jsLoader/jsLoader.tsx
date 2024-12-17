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

const feedbackOnboardingJsLoader: OnboardingConfig = {
  install: (params: Params) => [
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
        },
      ],
    },
  ],
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: t(
        'When using the Loader Script, you can lazy load the User Feedback integration like this:'
      ),
      configurations: [
        {
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: `
window.sentryOnLoad = function () {
  Sentry.init({
    // add other configuration here
  });

  Sentry.lazyLoadIntegration("feedbackIntegration")
    .then((feedbackIntegration) => {
      Sentry.addIntegration(feedbackIntegration({
      	// User Feedback configuration options
      }));
    })
    .catch(() => {
      // this can happen if e.g. a network error occurs,
      // in this case User Feedback will not be enabled
    });
};
              `,
            },
          ],
        },
      ],
      additionalInfo: tct(
        `For a full list of User Feedback configuration options, [link:read the docs].`,
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/user-feedback/configuration/" />
          ),
        }
      ),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const replayOnboardingJsLoader: OnboardingConfig = {
  install: (params: Params) => getInstallConfig(params),
  configure: (params: Params) => [
    {
      title: t('Configure Session Replay (Optional)'),
      description: getReplayConfigureDescription({
        link: 'https://docs.sentry.io/platforms/javascript/session-replay/',
      }),
      configurations: [
        {
          language: 'html',
          code: getReplayJsLoaderSdkSetupSnippet(params),
        },
      ],
      collapsible: true,
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

export {feedbackOnboardingJsLoader, replayOnboardingJsLoader};
