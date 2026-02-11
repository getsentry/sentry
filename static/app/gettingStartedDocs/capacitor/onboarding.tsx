import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {t, tct} from 'sentry/locale';

import {
  getNpmPackage,
  getSetupConfiguration,
  getSiblingName,
  type Params,
  type PlatformOptions,
} from './utils';

export const onboarding: OnboardingConfig<PlatformOptions> = {
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            `Install the Sentry Capacitor SDK as a dependency using [code:npm] or [code:yarn], alongside the Sentry [siblingName:] SDK:`,
            {
              code: <code />,
              siblingName: getSiblingName(params.platformOptions.siblingOption),
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'npm',
              value: 'npm',
              language: 'bash',
              code: `npm install --save @sentry/capacitor ${getNpmPackage(
                params.platformOptions.siblingOption
              )}@^7`,
            },
            {
              label: 'yarn',
              value: 'yarn',
              language: 'bash',
              code: `yarn add @sentry/capacitor ${getNpmPackage(
                params.platformOptions.siblingOption
              )}@^7 --exact`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            `The version of the Sentry [siblingName:] SDK must match with the version referred by Sentry Capacitor. To check which version of the Sentry [siblingName:] SDK is installed, use the following command: [code:npm info @sentry/capacitor peerDependencies]`,
            {
              code: <code />,
              siblingName: getSiblingName(params.platformOptions.siblingOption),
            }
          ),
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: getSetupConfiguration({params, showExtraStep: true}),
    },
    getUploadSourceMapsStep({
      guideLink:
        'https://docs.sentry.io/platforms/javascript/guides/capacitor/sourcemaps/',
      ...params,
    }),
  ],
  verify: _ => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: `myUndefinedFunction();`,
            },
          ],
        },
      ],
    },
  ],
  nextSteps: () => [
    {
      id: 'capacitor-android-setup',
      name: t('Capacitor 2 Setup'),
      description: t(
        'If you are using Capacitor 2 or older, follow this step to add required changes in order to initialize the Capacitor SDK on Android.'
      ),
      link: 'https://docs.sentry.io/platforms/javascript/guides/capacitor/?#capacitor-2---android-specifics',
    },
  ],
};
