import type {
  BasePlatformOptions,
  DocsParams,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t} from 'sentry/locale';

export enum InstallationMethod {
  LAMBDA_LAYER = 'lambdaLayer',
  NPM_PACKAGE = 'npmPackage',
}

export const platformOptions = {
  installationMethod: {
    label: t('Installation Method'),
    items: [
      {
        label: t('Lambda Layer'),
        value: InstallationMethod.LAMBDA_LAYER,
      },
      {
        label: t('NPM Package'),
        value: InstallationMethod.NPM_PACKAGE,
      },
    ],
    defaultValue: InstallationMethod.LAMBDA_LAYER,
  },
} satisfies BasePlatformOptions;

export type PlatformOptions = typeof platformOptions;
export type Params = DocsParams<PlatformOptions>;
