import {useCallback, useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';
import {Location} from 'history';

import {Organization} from 'sentry/types';
import {TableData} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {doDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import useApi from 'sentry/utils/useApi';

type Options = {
  organization: Organization;
  projectIds: Array<number | string>;
  groupIds?: string[];
  transactionNames?: string[];
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

  const zeroCounts = useMemo(() => {
    const ids = groupIds || [];
    const names = transactionNames || [];
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
      return {
        field: 'issue.id' as const,
        conditions: `issue.id:[${groupIds.join(',')}]`,
      };
    }
    if (transactionNames && transactionNames.length) {
      return {
        field: 'transaction' as const,
        conditions: `event.type:transaction transaction:[${transactionNames.join(',')}]`,
      };
    }
    return null;
  }, [groupIds, transactionNames]);

  const eventView = useMemo(
    () =>
      EventView.fromSavedQuery({
        id: '',
        name: `Errors within replay`,
        version: 2,
        fields: ['count_unique(replayId)', String(query?.field)],
        query: `!replayId:"" ${query?.conditions}`,
        projects: projectIds.map(Number),
      }),
    [projectIds, query]
  );

  const fetchReplayCount = useCallback(async () => {
    try {
      if (!query) {
        return;
      }

      if (query.field === 'issue.id') {
        const response = await api.requestPromise(
          `/organizations/${organization.slug}/issue-replay-count/`,
          {
            query: {
              query: query.conditions,
              statsPeriod: '14d',
              projectIds: projectIds.map(Number),
            },
          }
        );
        setReplayCounts({...zeroCounts, ...response});
      } else {
        const [data] = await doDiscoverQuery<TableData>(
          api,
          `/organizations/${organization.slug}/events/`,
          eventView.getEventsAPIPayload({query: {}} as Location<any>)
        );

        const counts = data.data.reduce((obj, record) => {
          const key = record[query.field] as string;
          const val = record['count_unique(replayId)'] as number;
          obj[key] = val;
          return obj;
        }, zeroCounts);
        setReplayCounts(counts);
      }
    } catch (err) {
      Sentry.captureException(err);
    }
  }, [api, organization.slug, query, zeroCounts, eventView, projectIds]);

  useEffect(() => {
    const hasSessionReplay = organization.features.includes('session-replay-ui');
    if (hasSessionReplay) {
      fetchReplayCount();
    }
  }, [fetchReplayCount, organization, projectIds]);

  return replayCounts;
}

export default useReplaysCount;
