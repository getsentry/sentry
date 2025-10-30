import {ExternalLink} from 'sentry/components/core/link';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

const getConfigureSnippet = (params: DocsParams) => `
onDeviceReady: function() {
  var Sentry = cordova.require('sentry-cordova.Sentry');
  Sentry.init({ dsn: '${params.dsn.public}' });
}`;

export const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: t('Install our SDK using the cordova command:'),
        },
        {
          type: 'code',
          language: 'bash',
          code: 'cordova plugin add sentry-cordova',
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'You should [code:init] the SDK in the [code:deviceReady] function, to make sure the native integrations runs. For more details about Cordova [link:click here]',
            {
              code: <code />,
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/cordova/" />
              ),
            }
          ),
        },
        {
          type: 'code',
          language: 'javascript',
          code: getConfigureSnippet(params),
        },
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
            'Test your Sentry configuration by intentionally triggering an error, such as calling an undefined function:'
          ),
        },
        {
          type: 'code',
          language: 'javascript',
          code: 'myUndefinedFunction();',
        },
      ],
    },
  ],
};
