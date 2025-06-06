import {useMemo} from 'react';

import {OrderBy, SortBy} from 'sentry/components/events/featureFlags/utils';
import {useOrganizationFlagLog} from 'sentry/components/featureFlags/hooks/useOrganizationFlagLog';
import type {Group} from 'sentry/types/group';
import useOrganization from 'sentry/utils/useOrganization';
import useGroupFlagDrawerData from 'sentry/views/issueDetails/groupFeatureFlags/hooks/useGroupFlagDrawerData';

interface Props {
  environments: string[];
  group: Group;
}

export default function useSuspectFlags({environments, group}: Props) {
  const organization = useOrganization();

  const {displayFlags, isPending: isDrawerDataPending} = useGroupFlagDrawerData({
    environments,
    group,
    orderBy: OrderBy.HIGH_TO_LOW,
    search: '',
    sortBy: SortBy.DISTRIBUTION,
  });

  const filteredFlags = useMemo(() => {
    return displayFlags.filter(flag => {
      const uniqueBaselineValueCount = Object.keys(
        flag.distribution?.baseline ?? {}
      ).length;
      const uniqueOutlierValueCount = Object.keys(
        flag.distribution?.outliers ?? {}
      ).length;
      const everyExampleIncludesFlag = group.userCount < flag.totalValues;
      return (
        uniqueOutlierValueCount === 1 &&
        uniqueBaselineValueCount > 1 &&
        everyExampleIncludesFlag
      );
    });
  }, [displayFlags, group.userCount]);

  const needFlagDates = !isDrawerDataPending && filteredFlags.length > 0;
  const {data: flagsDates, isPending: isFlagsDatesPending} = useOrganizationFlagLog({
    organization,
    query: {
      flag: filteredFlags.map(flag => flag.key),
    },
    enabled: needFlagDates,
  });

  const flagsWithChanges = useMemo(() => {
    return filteredFlags.map(flag => ({
      ...flag,
      changes: flagsDates?.data?.filter(date => date.flag === flag.key),
      changeBeforeFirstSeen: flagsDates?.data?.filter(
        date => date.flag === flag.key && date.createdAt < group.firstSeen
      ),
    }));
  }, [filteredFlags, flagsDates, group.firstSeen]);

  const susFlags = useMemo(
    () => flagsWithChanges.filter(flag => flag.changes?.length),
    [flagsWithChanges]
  );

  return {
    displayFlags,
    susFlags,
    isPending: isDrawerDataPending || (needFlagDates && isFlagsDatesPending),
  };
}
