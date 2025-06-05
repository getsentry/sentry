import {useMemo} from 'react';

import {OrderBy, SortBy} from 'sentry/components/events/featureFlags/utils';
import type {Group} from 'sentry/types/group';
// import {trackAnalytics} from 'sentry/utils/analytics';
// import useOrganization from 'sentry/utils/useOrganization';
import useGroupFlagDrawerData from 'sentry/views/issueDetails/groupFeatureFlags/hooks/useGroupFlagDrawerData';

interface Props {
  environments: string[];
  group: Group;
}

export default function useSuspectFlags({environments, group}: Props) {
  // const organization = useOrganization();

  const {displayFlags, isPending} = useGroupFlagDrawerData({
    environments,
    group,
    orderBy: OrderBy.HIGH_TO_LOW,
    search: '',
    sortBy: SortBy.DISTRIBUTION,
  });

  const susFlags = useMemo(() => {
    return displayFlags.filter(flag => {
      const uniqueBaselineValueCount = Object.keys(
        flag.distribution?.baseline ?? {}
      ).length;
      const uniqueOutlierValueCount = Object.keys(
        flag.distribution?.outliers ?? {}
      ).length;
      return (
        uniqueOutlierValueCount === 1 &&
        uniqueBaselineValueCount > 1 &&
        group.userCount < flag.totalValues
      );
    });
  }, [displayFlags, group.userCount]);

  // useEffect(() => {
  //   if (!isPending) {
  //     trackAnalytics('flags.suspect_flags_v2_found', {
  //       numTotalFlags: displayFlags.length,
  //       numSuspectFlags: susFlags.length,
  //       organization,
  //       threshold: 0,
  //     });
  //   }
  // }, [isPending, organization, displayFlags.length, susFlags.length]);

  console.log('useSuspectFlags', {group, displayFlags, susFlags, isPending});

  return {
    displayFlags,
    isPending,
    susFlags,
  };
}
