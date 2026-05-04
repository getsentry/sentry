import type {ComponentType} from 'react';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  IconGraph,
  IconProfiling,
  IconSpan,
  IconTerminal,
  IconTimer,
  IconWarning,
} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import {HookStore} from 'sentry/stores/hookStore';

export type FeatureMeta = {
  description: string;
  icon: ComponentType<SVGIconProps>;
  label: string;
  volume: string;
  volumeTooltip: string;
  alwaysEnabled?: boolean;
};

export type UseScmFeatureMetaResult = {
  isLoading: boolean;
  meta: Record<ProductSolution, FeatureMeta>;
};

export const FALLBACK_FEATURE_META: Record<ProductSolution, FeatureMeta> = {
  [ProductSolution.ERROR_MONITORING]: {
    label: t('Error monitoring'),
    icon: IconWarning,
    description: t('Automatically capture exceptions and stack traces'),
    alwaysEnabled: true,
    volume: t('5,000 errors / mo'),
    volumeTooltip: t(
      'Free plan includes 5,000 errors / month. Upgrade to Team or Business to send more.'
    ),
  },
  [ProductSolution.PERFORMANCE_MONITORING]: {
    label: t('Tracing'),
    icon: IconSpan,
    description: t(
      'Find bottlenecks, broken requests, and understand application flow end-to-end'
    ),
    volume: t('5M spans / mo'),
    volumeTooltip: t(
      'Free plan includes 5M spans / month. Upgrade to Team or Business to send more.'
    ),
  },
  [ProductSolution.SESSION_REPLAY]: {
    label: t('Session replay'),
    icon: IconTimer,
    description: t('Watch real user sessions to see what went wrong'),
    volume: t('50 replays / mo'),
    volumeTooltip: t(
      'Free plan includes 50 replays / month. Upgrade to Team or Business to send more.'
    ),
  },
  [ProductSolution.LOGS]: {
    label: t('Logging'),
    icon: IconTerminal,
    description: t('See logs in context with errors and performance issues'),
    volume: t('5 GB logs / mo'),
    volumeTooltip: t(
      'Free plan includes 5 GB logs / month. Upgrade to Team or Business to send more.'
    ),
  },
  [ProductSolution.PROFILING]: {
    label: t('Profiling'),
    icon: IconProfiling,
    description: t(
      'Pinpoint the functions and lines of code responsible for performance issues'
    ),
    volume: t('Usage-based'),
    volumeTooltip: t('Upgrade to Team or Business to send more.'),
  },
  [ProductSolution.METRICS]: {
    label: t('Application Metrics'),
    icon: IconGraph,
    description: t(
      'Track application performance and usage over time with custom metrics'
    ),
    volume: t('5 GB / mo'),
    volumeTooltip: t(
      'Free plan includes 5 GB metrics / month. Upgrade to Team or Business to send more.'
    ),
  },
};

function useFallbackScmFeatureMeta(): UseScmFeatureMetaResult {
  return {meta: FALLBACK_FEATURE_META, isLoading: false};
}

/**
 * Returns the per-product metadata used to render SCM onboarding feature cards.
 *
 * The implementation lives in gsApp; it reads the active org's billing-config
 * to keep the volume strings aligned with the actual free-plan limits. On
 * self-hosted, where gsApp isn't bundled, the static FALLBACK_FEATURE_META is
 * returned with isLoading=false.
 */
export function useScmFeatureMeta(): UseScmFeatureMetaResult {
  const hook =
    HookStore.get('react-hook:use-scm-feature-meta')[0] ?? useFallbackScmFeatureMeta;
  return hook();
}
