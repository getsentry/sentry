import {useMemo} from 'react';

import type {Repository} from 'sentry/types/integrations';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';

import {getPlatformInfo, type ResolvedPlatform} from './scmPlatformHelpers';
import {useScmPlatformDetection} from './useScmPlatformDetection';

interface UseScmResolvedPlatformParams {
  selectedPlatform: OnboardingSelectedSDK | undefined;
  selectedRepository: Repository | undefined;
}

/**
 * Resolves the active platform shared by `ScmPlatformFeaturesCore` (the platform
 * picker) and `ScmFeatureSelectionPanel` (the feature cards). Both surfaces must
 * agree on which platform is active during the brief window before an
 * auto-detected platform is committed to the host, so the derivation lives here
 * rather than being mirrored in each component. Each call site re-derives from
 * the (deduped) detection query instead of lifting shared state.
 */
export function useScmResolvedPlatform({
  selectedPlatform,
  selectedRepository,
}: UseScmResolvedPlatformParams) {
  const {
    detectedPlatforms,
    isPending: isDetecting,
    isError: isDetectionError,
  } = useScmPlatformDetection(selectedRepository);

  const resolvedPlatforms = useMemo(
    () =>
      detectedPlatforms.reduce<ResolvedPlatform[]>((acc, detected) => {
        const info = getPlatformInfo(detected.platform);
        if (info) {
          acc.push({...detected, info});
        }
        return acc;
      }, []),
    [detectedPlatforms]
  );

  const detectedPlatformKey = resolvedPlatforms[0]?.platform;
  // Derive platform from explicit selection, falling back to first detected.
  const currentPlatformKey = selectedPlatform?.key ?? detectedPlatformKey;

  return {
    resolvedPlatforms,
    detectedPlatformKey,
    currentPlatformKey,
    isDetecting,
    isDetectionError,
  };
}
