import {type OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {
  isAutoInstall,
  loaderScriptOnboarding,
  packageManagerOnboarding,
  type PlatformOptions,
} from './utils';

export const onboarding: OnboardingConfig<PlatformOptions> = {
  introduction: params =>
    isAutoInstall(params)
      ? loaderScriptOnboarding.introduction?.(params)
      : packageManagerOnboarding.introduction?.(params),
  install: params =>
    isAutoInstall(params)
      ? loaderScriptOnboarding.install(params)
      : packageManagerOnboarding.install(params),
  configure: params =>
    isAutoInstall(params)
      ? loaderScriptOnboarding.configure(params)
      : packageManagerOnboarding.configure(params),
  verify: params =>
    isAutoInstall(params)
      ? loaderScriptOnboarding.verify(params)
      : packageManagerOnboarding.verify(params),
  nextSteps: params =>
    isAutoInstall(params)
      ? loaderScriptOnboarding.nextSteps?.(params)
      : packageManagerOnboarding.nextSteps?.(params),
  onPageLoad: params =>
    isAutoInstall(params)
      ? loaderScriptOnboarding.onPageLoad?.(params)
      : packageManagerOnboarding.onPageLoad?.(params),
  onProductSelectionChange: params =>
    isAutoInstall(params)
      ? loaderScriptOnboarding.onProductSelectionChange?.(params)
      : packageManagerOnboarding.onProductSelectionChange?.(params),
  onPlatformOptionsChange: params =>
    isAutoInstall(params)
      ? loaderScriptOnboarding.onPlatformOptionsChange?.(params)
      : packageManagerOnboarding.onPlatformOptionsChange?.(params),
  onProductSelectionLoad: params =>
    isAutoInstall(params)
      ? loaderScriptOnboarding.onProductSelectionLoad?.(params)
      : packageManagerOnboarding.onProductSelectionLoad?.(params),
};
