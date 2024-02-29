import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getConfigureSnippet = (params: Params) => `
onDeviceReady: function() {
  var Sentry = cordova.require('sentry-cordova.Sentry');
  Sentry.init({ dsn: '${params.dsn}' });
}`;

const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: t('Install our SDK using the cordova command:'),
      configurations: [
        {
          language: 'bash',
          code: 'cordova plugin add sentry-cordova',
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'You should [initCode:init] the SDK in the [deviceReadyCode:deviceReady] function, to make sure the native integrations runs. For more details about Cordova [link:click here]',
        {
          initCode: <code />,
          deviceReadyCode: <code />,
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/cordova/" />
          ),
        }
      ),
      configurations: [
        {
          language: 'javascript',
          code: getConfigureSnippet(params),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: (
        <Fragment>
          {t(
            'One way to verify your setup is by intentionally causing an error that breaks your application.'
          )}
          <p>{t('Calling an undefined function will throw an exception:')}</p>
        </Fragment>
      ),
      configurations: [
        {
          language: 'javascript',
          code: 'myUndefinedFunction();',
        },
      ],
    },
  ],
};

const docs: Docs = {
  onboarding,
};

export default docs;
