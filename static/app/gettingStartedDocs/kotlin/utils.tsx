import type {BasePlatformOptions} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t} from 'sentry/locale';

export enum PackageManager {
  GRADLE = 'gradle',
  MAVEN = 'maven',
}

export const platformOptions = {
  packageManager: {
    label: t('Package Manager'),
    items: [
      {
        label: t('Gradle'),
        value: PackageManager.GRADLE,
      },
      {
        label: t('Maven'),
        value: PackageManager.MAVEN,
      },
    ],
  },
} satisfies BasePlatformOptions;

export type PlatformOptions = typeof platformOptions;
