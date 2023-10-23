import {useCallback, useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';

import {DateString, IssueCategory, Organization} from 'sentry/types';
import toArray from 'sentry/utils/toArray';
import useApi from 'sentry/utils/useApi';

export type UseReplaysCountOptions = {
  organization: Organization;
  datetime?: {
    end: DateString;
    start: DateString;
  };
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
}: UseReplaysCountOptions) {
  const api = useApi();

  const [replayCounts, setReplayCounts] = useState<CountState>({});

  const filterUnseen = useCallback(
    (ids: string | string[]) => {
      return toArray(ids).filter(id => !(id in replayCounts));
    },
    [replayCounts]
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

  const query = useMemo(() => {
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

  const fetchReplayCount = useCallback(async () => {
    let dataSource = 'discover';
    if (issueCategory && issueCategory === IssueCategory.PERFORMANCE) {
      dataSource = 'search_issues';
    }

    try {
      if (!query) {
        return;
      }
      const response = await api.requestPromise(
        `/organizations/${organization.slug}/replay-count/`,
        {
          query: {
            query: [query.conditions, extraConditions].join(' ').trim(),
            data_source: dataSource,
            project: -1,
            ...(datetime ? {...datetime, statsPeriod: undefined} : {statsPeriod: '14d'}),
          },
        }
      );
      setReplayCounts({...zeroCounts, ...response});
    } catch (err) {
      Sentry.captureException(err);
    }
  }, [
    issueCategory,
    query,
    api,
    organization.slug,
    extraConditions,
    datetime,
    zeroCounts,
  ]);

  useEffect(() => {
    const hasSessionReplay = organization.features.includes('session-replay');
    if (hasSessionReplay) {
      fetchReplayCount();
    }
  }, [fetchReplayCount, organization]);

  return replayCounts;
}

export default useReplaysCount;
