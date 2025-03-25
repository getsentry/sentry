import useOrganization from 'sentry/utils/useOrganization';
import {useExploreTimeseries} from 'sentry/views/explore/hooks/useExploreTimeseries';

const LOW_FIDELITY_QUERY_EXTRAS = {
  fidelity: 'low',
} as const;

const HIGH_FIDELITY_QUERY_EXTRAS = {
  fidelity: 'auto',
} as const;

export const useProgressiveExploreTimeseries = ({
  query,
  enabled,
}: {
  enabled: boolean;
  query: string;
}) => {
  const organization = useOrganization();
  const canUseProgressiveLoading = organization.features.includes(
    'organizations:visibility-explore-progressive-loading'
  );

  const {timeseriesResult, canUsePreviousResults} = useExploreTimeseries({
    query,
    enabled: enabled && !canUseProgressiveLoading,
  });

  // Start two queries with different fidelities, we will bias towards the high
  // fidelity results if they are available
  const {
    timeseriesResult: lowFidelityTimeseriesResult,
    canUsePreviousResults: canUsePreviousLowFidelityResults,
  } = useExploreTimeseries({
    query,
    enabled: enabled && canUseProgressiveLoading,
    queryExtras: LOW_FIDELITY_QUERY_EXTRAS,
  });
  const {
    timeseriesResult: highFidelityTimeseriesResult,
    canUsePreviousResults: canUsePreviousHighFidelityResults,
  } = useExploreTimeseries({
    query,
    enabled: enabled && !canUseProgressiveLoading,
    queryExtras: HIGH_FIDELITY_QUERY_EXTRAS,
  });

  if (!canUseProgressiveLoading) {
    return {
      timeseriesResult,
      canUsePreviousResults,
    };
  }

  if (highFidelityTimeseriesResult.isFetched) {
    return {
      timeseriesResult: highFidelityTimeseriesResult,
      canUsePreviousResults: canUsePreviousHighFidelityResults,
      fidelity: 'auto',
      isLoading: false,
    };
  }

  return {
    timeseriesResult: lowFidelityTimeseriesResult,
    canUsePreviousResults: canUsePreviousLowFidelityResults,
    fidelity: 'low',
    isLoading: !highFidelityTimeseriesResult.isFetched,
  };
};
