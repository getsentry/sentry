import beautify from 'js-beautify';

import Alert from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getReplayConfigureDescription,
  getReplayJsLoaderSdkSetupSnippet,
} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {t, tct} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

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
        additionalInfo: (
          <Alert type="info" showIcon style={{margin: 0}}>
            {tct(
              'Make sure that Session Replay is enabled in your [link:project settings].',
              {
                link: (
                  <ExternalLink
                    href={normalizeUrl(
                      `/settings/projects/${params.projectSlug}/loader-script/`
                    )}
                  />
                ),
              }
            )}
          </Alert>
        ),
      },
    ],
  },
];

const replayOnboardingJsLoaderJavascript: OnboardingConfig = {
  install: (params: Params) => getInstallConfig(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: getReplayConfigureDescription({
        link: 'https://docs.sentry.io/platforms/javascript/session-replay/',
      }),
      configurations: [
        {
          language: 'html',
          code: getReplayJsLoaderSdkSetupSnippet(),
        },
      ],
      isOptional: true,
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

export default replayOnboardingJsLoaderJavascript;
