import {ServerSideSamplingStore} from 'sentry/stores/serverSideSamplingStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

export function useDistribution() {
  const {distribution} = useLegacyStore(ServerSideSamplingStore);

  return {
    loading: distribution.loading,
    error: distribution.error,
    distribution: distribution.data,
  };
}
