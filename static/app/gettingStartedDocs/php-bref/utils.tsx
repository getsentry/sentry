import type {
  DocsParams,
  PlatformOption,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t} from 'sentry/locale';

export enum Framework {
  LARAVEL = 'laravel',
  SYMFONY = 'symfony',
  PHP = 'php',
}

export type PlatformOptions = {
  framework: PlatformOption<Framework>;
};

export type Params = DocsParams<PlatformOptions>;

export const platformOptions: PlatformOptions = {
  framework: {
    label: t('Framework'),
    items: [
      {label: t('Laravel'), value: Framework.LARAVEL},
      {label: t('Symfony'), value: Framework.SYMFONY},
      {label: t('Other PHP'), value: Framework.PHP},
    ],
  },
};
