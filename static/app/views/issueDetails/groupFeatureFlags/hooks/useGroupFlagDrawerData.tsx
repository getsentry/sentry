import {useMemo} from 'react';

import {OrderBy, SortBy} from 'sentry/components/events/featureFlags/utils';
import {useGroupSuspectFlagScores} from 'sentry/components/issues/suspect/useGroupSuspectFlagScores';
import type {Group} from 'sentry/types/group';
import useGroupFeatureFlags from 'sentry/views/issueDetails/groupFeatureFlags/hooks/useGroupFeatureFlags';
import type {FlagDrawerItem} from 'sentry/views/issueDetails/groupFeatureFlags/types';

interface Props {
  environments: string[];
  group: Group;
  orderBy: OrderBy;
  search: string;
  sortBy: SortBy;
}

interface Response {
  allGroupFlagCount: number;
  displayFlags: FlagDrawerItem[];
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
  const isSuspectEnabled = sortBy === SortBy.SUSPICION;

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

  // Fetch the suspect data, if we need it for this render
  const {
    data: suspectScores,
    isError: isSuspectError,
    isPending: isSuspectPending,
    refetch: refetchScores,
  } = useGroupSuspectFlagScores({
    groupId: group.id,
    environment: environments.length ? environments : undefined,
    enabled: isSuspectEnabled,
  });

  // Combine the flag and suspect data into SuspectGroupTag objects
  const allFlagsWithScores = useMemo(() => {
    const suspectScoresMap = suspectScores
      ? Object.fromEntries(suspectScores.data.map(score => [score.flag, score]))
      : {};

    return groupFlags.map<FlagDrawerItem>(flag => ({
      ...flag,
      suspect: {
        baselinePercent: suspectScoresMap[flag.key]?.baseline_percent,
        score: suspectScoresMap[flag.key]?.score,
      },
      distribution: suspectScoresMap[flag.key]?.distribution ?? {
        baseline: {},
        outliers: {},
      },
    }));
  }, [groupFlags, suspectScores]);

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
    return allFlagsWithScores.filter(flag => {
      return (
        flag.name.includes(searchLower) ||
        flag.key.includes(searchLower) ||
        tagValues[flag.key]?.includes(searchLower)
      );
    });
  }, [allFlagsWithScores, search, tagValues]);

  const displayFlags = useMemo(() => {
    if (sortBy === SortBy.ALPHABETICAL) {
      const sorted = filteredFlags.toSorted((a, b) => a.key.localeCompare(b.key));
      return orderBy === OrderBy.A_TO_Z ? sorted : sorted.reverse();
    }
    if (sortBy === SortBy.DISTRIBUTION) {
      const sorted = filteredFlags.toSorted((a, b) => {
        const aTopPct = (a.topValues[0]?.count ?? 0) / a.totalValues;
        const bTopPct = (b.topValues[0]?.count ?? 0) / b.totalValues;
        return bTopPct - aTopPct;
      });
      return orderBy === OrderBy.HIGH_TO_LOW ? sorted : sorted.reverse();
    }
    return filteredFlags;
  }, [filteredFlags, orderBy, sortBy]);

  return {
    allGroupFlagCount: allFlagsWithScores.length,
    displayFlags,
    isError: isSuspectEnabled ? isFlagsError || isSuspectError : isFlagsError,
    isPending: isSuspectEnabled ? isFlagsPending || isSuspectPending : isFlagsPending,
    refetch: () => {
      refetchFlags();
      refetchScores();
    },
  };
}
