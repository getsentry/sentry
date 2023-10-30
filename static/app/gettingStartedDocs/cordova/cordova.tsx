import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
export const steps = ({
  dsn,
}: Partial<Pick<ModuleProps, 'dsn'>> = {}): LayoutProps['steps'] => [
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
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct(
          'You should [initCode:init] the SDK in the [deviceReadyCode:deviceReady] function, to make sure the native integrations runs. For more details about Cordova [link:click here]',
          {
            initCode: <code />,
            deviceReadyCode: <code />,
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/cordova/" />
            ),
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'javascript',
        code: `
onDeviceReady: function() {
  var Sentry = cordova.require('sentry-cordova.Sentry');
  Sentry.init({ dsn: '${dsn}' });
}
        `,
      },
    ],
  },
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
];
// Configuration End

export function GettingStartedWithCordova({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} {...props} />;
}

export default GettingStartedWithCordova;
