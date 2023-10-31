import {useCallback, useMemo, useState} from 'react';

import {DateString, IssueCategory, Organization} from 'sentry/types';
import {ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';
import toArray from 'sentry/utils/toArray';

type DateTime = {
  end: DateString;
  start: DateString;
};

type Options = {
  organization: Organization;
  datetime?: DateTime;
  extraConditions?: string;
  groupIds?: string | string[];
  issueCategory?: IssueCategory;
  replayIds?: string | string[];
  transactionNames?: string | string[];
};

type CountState = Record<string, undefined | number>;

function useReplaysCount({
  issueCategory,
  groupIds,
  organization,
  replayIds,
  transactionNames,
  extraConditions,
  datetime,
}: Options) {
  const [lastData, setLastData] = useState<CountState>({});

  const filterUnseen = useCallback(
    (ids: string | string[]) => {
      return toArray(ids).filter(id => !(id in lastData));
    },
    [lastData]
  );

  const zeroCounts = useMemo(() => {
    const gIds = toArray(groupIds || []);
    const txnNames = toArray(transactionNames || []);
    const rIds = toArray(replayIds || []);
    return [...gIds, ...txnNames, ...rIds].reduce<CountState>((record, key) => {
      record[key] = 0;
      return record;
    }, {});
  }, [groupIds, replayIds, transactionNames]);

  const queryField = useMemo(() => {
    const fieldsProvided = [
      groupIds !== undefined,
      transactionNames !== undefined,
      replayIds !== undefined,
    ].filter(Boolean);
    if (fieldsProvided.length === 0) {
      throw new Error(
        'Missing one of: groupIds|transactionNames|replayIds in useReplaysCount()'
      );
    }
    if (fieldsProvided.length > 1) {
      throw new Error(
        'Unable to query more than one of: groupIds|transactionNames|replayIDs simultaneously in useReplaysCount()'
      );
    }

    if (groupIds && groupIds.length) {
      const groupsToFetch = filterUnseen(groupIds);
      if (groupsToFetch.length) {
        return {
          field: 'issue.id' as const,
          conditions: `issue.id:[${groupsToFetch.join(',')}]`,
        };
      }
      return null;
    }

    if (replayIds && replayIds.length) {
      const replaysToFetch = filterUnseen(replayIds);
      if (replaysToFetch.length) {
        return {
          field: 'replay_id' as const,
          conditions: `replay_id:[${replaysToFetch.join(',')}]`,
        };
      }
      return null;
    }

    if (transactionNames && transactionNames.length) {
      const txnsToFetch = filterUnseen(transactionNames);
      if (txnsToFetch.length) {
        return {
          field: 'transaction' as const,
          conditions: `transaction:[${txnsToFetch.map(t => `"${t}"`).join(',')}]`,
        };
      }
      return null;
    }
    return null;
  }, [filterUnseen, groupIds, replayIds, transactionNames]);

  const hasSessionReplay = organization.features.includes('session-replay');
  const {data, isFetched} = useApiQuery<CountState>(
    makeReplayCountsQueryKey({
      organization,
      conditions: [queryField?.conditions ?? '', extraConditions ?? ''],
      datetime,
      issueCategory,
    }),
    {
      staleTime: Infinity,
      enabled: Boolean(queryField) && hasSessionReplay,
    }
  );

  return useMemo(() => {
    if (isFetched) {
      const merged = {
        ...zeroCounts,
        ...lastData,
        ...data,
      };
      setLastData(merged);
      return merged;
    }
    return {
      ...lastData,
      ...data,
    };
  }, [isFetched, zeroCounts, lastData, data]);
}

function makeReplayCountsQueryKey({
  conditions,
  datetime,
  issueCategory,
  organization,
}: {
  conditions: string[];
  datetime: undefined | DateTime;
  issueCategory: undefined | IssueCategory;
  organization: Organization;
}): ApiQueryKey {
  return [
    `/organizations/${organization.slug}/replay-count/`,
    {
      query: {
        query: conditions.filter(Boolean).join(' ').trim(),
        data_source: getDatasource(issueCategory),
        project: -1,
        ...(datetime ? {...datetime, statsPeriod: undefined} : {statsPeriod: '14d'}),
      },
    },
  ];
}

function getDatasource(issueCategory: undefined | IssueCategory) {
  switch (issueCategory) {
    case IssueCategory.PERFORMANCE:
      return 'search_issues';
    default:
      return 'discover';
  }
}

export default useReplaysCount;
