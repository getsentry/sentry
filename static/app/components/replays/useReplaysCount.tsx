import {useCallback, useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';

import {Organization} from 'sentry/types';
import toArray from 'sentry/utils/toArray';
import useApi from 'sentry/utils/useApi';

type Options = {
  organization: Organization;
  projectIds: number[];
  groupIds?: string | string[];
  transactionNames?: string | string[];
};

type CountState = Record<string, undefined | number>;

function useReplaysCount({
  groupIds,
  transactionNames,
  organization,
  projectIds,
}: Options) {
  const api = useApi();

  const [replayCounts, setReplayCounts] = useState<CountState>({});

  const filterUnseen = useCallback(
    (ids: string | string[]) => {
      return toArray(ids).filter(id => !(id in replayCounts));
    },
    [replayCounts]
  );

  const zeroCounts = useMemo(() => {
    const ids = toArray(groupIds || []);
    const names = toArray(transactionNames || []);
    return [...ids, ...names].reduce<CountState>((record, key) => {
      record[key] = 0;
      return record;
    }, {});
  }, [groupIds, transactionNames]);

  const query = useMemo(() => {
    if (groupIds === undefined && transactionNames === undefined) {
      throw new Error('Missing groupId or transactionName in useReplaysCount()');
    }
    if (groupIds !== undefined && transactionNames !== undefined) {
      throw new Error(
        'Unable to query both groupId and transactionName simultaneously in useReplaysCount()'
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

    if (transactionNames && transactionNames.length) {
      const txnsToFetch = filterUnseen(transactionNames);
      if (txnsToFetch.length) {
        return {
          field: 'transaction' as const,
          conditions: `event.type:transaction transaction:[${txnsToFetch
            .map(t => `"${t}"`)
            .join(',')}]`,
        };
      }
      return null;
    }
    return null;
  }, [filterUnseen, groupIds, transactionNames]);

  const fetchReplayCount = useCallback(async () => {
    try {
      if (!query) {
        return;
      }

      const response = await api.requestPromise(
        `/organizations/${organization.slug}/replay-count/`,
        {
          query: {
            query: query.conditions,
            statsPeriod: '14d',
            project: projectIds,
          },
        }
      );
      setReplayCounts({...zeroCounts, ...response});
    } catch (err) {
      Sentry.captureException(err);
    }
  }, [api, organization.slug, query, zeroCounts, projectIds]);

  useEffect(() => {
    const hasSessionReplay = organization.features.includes('session-replay-ui');
    if (hasSessionReplay) {
      fetchReplayCount();
    }
  }, [fetchReplayCount, organization]);

  return replayCounts;
}

export default useReplaysCount;
