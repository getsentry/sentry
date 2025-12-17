import type {BasePlatformOptions} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t} from 'sentry/locale';

export enum InstallationMode {
  RETAIL = 'retail',
  DEVKIT = 'devkit',
}

export const platformOptions = {
  installationMode: {
    label: t('Installation Mode'),
    items: [
      {
        label: t('Retail'),
        value: InstallationMode.RETAIL,
      },
      {
        label: t('Devkit'),
        value: InstallationMode.DEVKIT,
      },
    ],
    defaultValue: InstallationMode.DEVKIT,
  },
} satisfies BasePlatformOptions;
