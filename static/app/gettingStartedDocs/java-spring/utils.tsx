import type {
  BasePlatformOptions,
  DocsParams,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {PackageManager, YesNo} from 'sentry/gettingStartedDocs/java/utils';
import {t} from 'sentry/locale';

export enum SpringVersion {
  V5 = 'v5',
  V6 = 'v6',
  V7 = 'v7',
}

export const platformOptions = {
  springVersion: {
    label: t('Spring Version'),
    items: [
      {
        label: t('Spring 7'),
        value: SpringVersion.V7,
      },
      {
        label: t('Spring 6'),
        value: SpringVersion.V6,
      },
      {
        label: t('Spring 5'),
        value: SpringVersion.V5,
      },
    ],
  },
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
  opentelemetry: {
    label: t('OpenTelemetry'),
    items: [
      {
        label: t('With OpenTelemetry'),
        value: YesNo.YES,
      },
      {
        label: t('Without OpenTelemetry'),
        value: YesNo.NO,
      },
    ],
  },
} satisfies BasePlatformOptions;

export type PlatformOptions = typeof platformOptions;
export type Params = DocsParams<PlatformOptions>;
