import {useOrganizationFlagLog} from 'sentry/components/featureFlags/hooks/useOrganizationFlagLog';
import type {Event} from 'sentry/types/event';
import useOrganization from 'sentry/utils/useOrganization';

interface Params {
  event: Event | undefined;
  query: Record<string, any>;
  enabled?: boolean;
}
export function useIntersectionFlags({event, query, enabled}: Params) {
  console.log('useIntersectionFlags', event, query);
  const organization = useOrganization();
  const {data: rawFlagData, ...flagQuery} = useOrganizationFlagLog({
    organization,
    query: {
      ...query,
      statsPeriod: query.period,
    },
    enabled: enabled && Boolean(event),
  });
  if (!rawFlagData?.data?.length || flagQuery.isError || flagQuery.isPending) {
    return {
      data: [],
      ...flagQuery,
    };
  }
  console.log('rawFlagData', rawFlagData);

  const evaluatedFlagNames = event?.contexts?.flags?.values?.map(f => f.flag);
  const intersectionFlags = rawFlagData.data.filter(f =>
    evaluatedFlagNames?.includes(f.flag)
  );

  return {
    data: intersectionFlags,
    ...flagQuery,
  };
}
