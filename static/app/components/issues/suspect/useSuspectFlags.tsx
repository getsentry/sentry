import {useMemo} from 'react';

import {OrderBy, SortBy} from 'sentry/components/events/featureFlags/utils';
import {useOrganizationFlagLog} from 'sentry/components/featureFlags/hooks/useOrganizationFlagLog';
import type {Group} from 'sentry/types/group';
import useOrganization from 'sentry/utils/useOrganization';
import useGroupFlagDrawerData from 'sentry/views/issueDetails/groupFeatureFlags/hooks/useGroupFlagDrawerData';

interface Props {
  displayMode: 'filters' | 'filter_rrf' | 'rrf';
  environments: string[];
  group: Group;
}

export default function useSuspectFlags({displayMode, environments, group}: Props) {
  const organization = useOrganization();

  const {displayFlags, isPending: isDrawerDataPending} = useGroupFlagDrawerData({
    environments,
    group,
    orderBy: OrderBy.HIGH_TO_LOW,
    search: '',
    sortBy: SortBy.DISTRIBUTION,
  });

  const filteredFlags = useMemo(() => {
    if (displayMode === 'filters' || displayMode === 'filter_rrf') {
      return displayFlags.filter(flag => {
        const uniqueBaselineValueCount = Object.keys(
          flag.distribution?.baseline ?? {}
        ).length;
        const uniqueOutlierValueCount = Object.keys(
          flag.distribution?.outliers ?? {}
        ).length;
        const everyExampleIncludesFlag = group.userCount <= flag.totalValues;
        return (
          uniqueOutlierValueCount === 1 &&
          uniqueBaselineValueCount > 1 &&
          everyExampleIncludesFlag
        );
      });
    }
    return displayFlags;
  }, [displayFlags, group.userCount, displayMode]);

  const sortedFlags = useMemo(() => {
    if (displayMode === 'filter_rrf' || displayMode === 'rrf') {
      return filteredFlags.sort(
        (a, b) => (b.suspect.score ?? 0) - (a.suspect.score ?? 0)
      );
    }
    return filteredFlags;
  }, [filteredFlags, displayMode]);

  const needFlagDates =
    !isDrawerDataPending &&
    sortedFlags.length > 0 &&
    (displayMode === 'filters' || displayMode === 'filter_rrf');
  const {data: flagsDates, isPending: isFlagsDatesPending} = useOrganizationFlagLog({
    organization,
    query: {
      flag: sortedFlags.map(flag => flag.key),
    },
    enabled: needFlagDates,
  });

  const flagsWithChanges = useMemo(() => {
    if (displayMode === 'filters' || displayMode === 'filter_rrf') {
      return sortedFlags.map(flag => ({
        ...flag,
        changes: flagsDates?.data?.filter(date => date.flag === flag.key),
        changeBeforeFirstSeen: flagsDates?.data?.filter(
          date => date.flag === flag.key && date.createdAt < group.firstSeen
        ),
      }));
    }
    return sortedFlags;
  }, [sortedFlags, flagsDates, group.firstSeen, displayMode]);

  const susFlags = useMemo(() => {
    if (displayMode === 'filters' || displayMode === 'filter_rrf') {
      return flagsWithChanges.filter(flag => flag.changes?.length);
    }
    return flagsWithChanges;
  }, [flagsWithChanges, displayMode]);

  return {
    displayFlags,
    susFlags,
    isPending: isDrawerDataPending || (needFlagDates && isFlagsDatesPending),
  };
}
