import beautify from 'js-beautify';

import {ExternalLink} from 'sentry/components/core/link';
import {tracePropagationBlock} from 'sentry/components/onboarding/gettingStartedDoc/replay/tracePropagationMessage';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getReplayConfigureDescription,
  getReplayJsLoaderSdkSetupSnippet,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {t, tct} from 'sentry/locale';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

type Params = DocsParams;

const getVerifySnippet = () => `
<!-- A button to trigger a test error -->
<button id="test-error">Trigger Test Error</button>
<script>
  const button = document.getElementById('test-error');
  button.addEventListener('click', () => {
    throw new Error('This is a test error');
  });
</script>`;

export const feedbackOnboardingJsLoader: OnboardingConfig = {
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: t('Add this script tag to the top of the page:'),
        },
        {
          type: 'code',
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
      content: [
        {
          type: 'text',
          text: t(
            'When using the Loader Script, you can lazy load the User Feedback integration like this:'
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
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
};`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            `For a full list of User Feedback configuration options, [link:read the docs].`,
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/user-feedback/configuration/" />
              ),
            }
          ),
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

export const replayOnboardingJsLoader: OnboardingConfig = {
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: t('Add this script tag to the top of the page:'),
        },
        {
          type: 'code',
          language: 'html',
          code: beautify.html(
            `<script src="${params.dsn.cdn}" crossorigin="anonymous"></script>`,
            {indent_size: 2, wrap_attributes: 'force-expand-multiline'}
          ),
        },
        {
          type: 'alert',
          alertType: 'info',
          text: tct(
            'Make sure that Session Replay is enabled in your [link:project settings].',
            {
              link: (
                <ExternalLink
                  href={normalizeUrl(
                    `/settings/${params.organization.slug}/projects/${params.project.slug}/loader-script/`
                  )}
                />
              ),
            }
          ),
        },
      ],
    },
  ],
  configure: (params: Params) => [
    {
      title: t('Configure Session Replay (Optional)'),
      collapsible: true,
      content: [
        {
          type: 'text',
          text: getReplayConfigureDescription({
            link: 'https://docs.sentry.io/platforms/javascript/session-replay/',
          }),
        },
        {
          type: 'code',
          language: 'html',
          code: getReplayJsLoaderSdkSetupSnippet(params),
        },
        tracePropagationBlock,
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'To verify your Replay setup, trigger an error on your page and watch Sentry capture the event along with a recording of the user interaction.'
          ),
        },
        {
          type: 'text',
          text: t('You can simulate an error by adding the following code:'),
        },
        {
          type: 'code',
          language: 'html',
          code: getVerifySnippet(),
        },
        {
          type: 'text',
          text: t(
            'After clicking the button, wait a few moments, and you\'ll see a new session appear on the "Replays" page.'
          ),
        },
      ],
    },
  ],
  nextSteps: () => [],
};
