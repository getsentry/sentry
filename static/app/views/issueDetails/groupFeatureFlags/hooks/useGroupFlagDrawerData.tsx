import {useMemo} from 'react';

import {OrderBy, SortBy} from 'sentry/components/events/featureFlags/utils';
import type {Group} from 'sentry/types/group';
import useGroupFeatureFlags from 'sentry/views/issueDetails/groupFeatureFlags/hooks/useGroupFeatureFlags';
import type {GroupTag} from 'sentry/views/issueDetails/groupTags/useGroupTags';

interface Props {
  environments: string[];
  group: Group;
  orderBy: OrderBy;
  search: string;
  sortBy: SortBy;
}

interface Response {
  allGroupFlagCount: number;
  displayFlags: GroupTag[];
  isError: boolean;
  isPending: boolean;
  refetch: () => void;
}

export default function useGroupFlagDrawerData({
  environments,
  group,
  orderBy,
  search,
  sortBy,
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
    if (sortBy === SortBy.ALPHABETICAL) {
      const sorted = filteredFlags.toSorted((a, b) => a.key.localeCompare(b.key));
      return orderBy === OrderBy.A_TO_Z ? sorted : sorted.reverse();
    }
    return filteredFlags;
  }, [filteredFlags, orderBy, sortBy]);

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
