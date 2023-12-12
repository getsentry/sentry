import beautify from 'js-beautify';

import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getReplayConfigureDescription,
  getReplayJsLoaderSdkSetupSnippet,
} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {t} from 'sentry/locale';

type Params = DocsParams;

const getInstallConfig = (params: Params) => [
  {
    type: StepType.INSTALL,
    configurations: [
      {
        description: t('Add this script tag to the top of the page:'),
        language: 'html',
        code: beautify.html(
          `<script src="${params.cdn}" crossorigin="anonymous"></script>`,
          {indent_size: 2, wrap_attributes: 'force-expand-multiline'}
        ),
      },
    ],
  },
];

const replayOnboardingJsLoaderReact: OnboardingConfig = {
  install: (params: Params) => getInstallConfig(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: getReplayConfigureDescription({
        link: 'https://docs.sentry.io/platforms/javascript/guides/react/session-replay/',
      }),
      configurations: [
        {
          language: 'html',
          code: getReplayJsLoaderSdkSetupSnippet(),
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

export default replayOnboardingJsLoaderReact;
