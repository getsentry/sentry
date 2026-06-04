import {useMemo} from 'react';

import {OrderBy} from 'sentry/components/events/featureFlags/utils';
import type {Group} from 'sentry/types/group';
import {useGroupFeatureFlags} from 'sentry/views/issueDetails/groupFeatureFlags/hooks/useGroupFeatureFlags';
import type {GroupTag} from 'sentry/views/issueDetails/groupTags/useGroupTags';

interface Props {
  environments: string[];
  group: Group;
  orderBy: OrderBy;
  search: string;
}

interface Response {
  allGroupFlagCount: number;
  displayFlags: GroupTag[];
  isError: boolean;
  isPending: boolean;
  refetch: () => void;
}

export function useGroupFlagDrawerData({
  environments,
  group,
  orderBy,
  search,
}: Props): Response {
  // Fetch the base flag data
  const {
    data: groupFlags = [],
    isError: isFlagsError,
    isPending: isFlagsPending,
    refetch: refetchFlags,
  } = useGroupFeatureFlags({
    groupId: group.id,
    environment: environments,
  });

  // Flatten all the tag values together into a big string. This is meant as a
  // perf improvement: here we iterate over all tags&values once, (N*M) then
  // later only iterate through each tag (N) as the search term changes.
  const tagValues = useMemo(
    () =>
      groupFlags.reduce<Record<string, string>>((valueMap, flag) => {
        valueMap[flag.key] = flag.topValues
          .map(tv => tv.value)
          .join(' ')
          .toLowerCase();
        return valueMap;
      }, {}),
    [groupFlags]
  );

  const filteredFlags = useMemo(() => {
    const searchLower = search.toLowerCase();
    return groupFlags.filter(flag => {
      return (
        flag.name.includes(searchLower) ||
        flag.key.includes(searchLower) ||
        tagValues[flag.key]?.includes(searchLower)
      );
    });
  }, [groupFlags, search, tagValues]);

  const displayFlags = useMemo(() => {
    if (orderBy === OrderBy.A_TO_Z) {
      return filteredFlags.toSorted((a, b) => a.key.localeCompare(b.key));
    }
    if (orderBy === OrderBy.Z_TO_A) {
      return filteredFlags.toSorted((a, b) => b.key.localeCompare(a.key));
    }
    if (orderBy === OrderBy.OLDEST) {
      return Array.from(filteredFlags).reverse();
    }
    // orderBy === OrderBy.NEWEST
    return filteredFlags;
  }, [filteredFlags, orderBy]);

  return {
    allGroupFlagCount: groupFlags.length,
    displayFlags,
    isError: isFlagsError,
    isPending: isFlagsPending,
    refetch: () => {
      refetchFlags();
    },
  };
}
