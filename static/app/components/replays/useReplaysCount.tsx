import {useCallback, useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';

import {Organization, Project} from 'sentry/types';
import {TableData} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {doDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import projectSupportsReplay from 'sentry/utils/replays/projectSupportsReplay';
import toArray from 'sentry/utils/toArray';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';

type Options = {
  organization: Organization;
  project: undefined | Project;
  groupIds?: string | string[];
  transactionNames?: string | string[];
};

function useReplaysCount({groupIds, transactionNames, organization, project}: Options) {
  const api = useApi();
  const location = useLocation();

  const [replayCounts, setReplayCounts] = useState<Record<string, undefined | number>>(
    {}
  );

  const [condition, fieldName] = useMemo(() => {
    if (groupIds === undefined && transactionNames === undefined) {
      throw new Error('Missing groupId or transactionName in useReplaysCount()');
    }
    if (groupIds && groupIds.length) {
      return [`issue.id:[${toArray(groupIds).join(',')}]`, 'issue.id'];
    }
    if (transactionNames && transactionNames.length) {
      return [
        `event.type:transaction transaction:[${toArray(transactionNames).join(',')}]`,
        'transaction',
      ];
    }
    return [null, null];
  }, [groupIds, transactionNames]);

  const eventView = useMemo(
    () =>
      EventView.fromNewQueryWithLocation(
        {
          id: '',
          name: `Errors within replay`,
          version: 2,
          fields: ['count_unique(replayId)', String(fieldName)],
          query: `!replayId:"" ${condition}`,
          projects: [],
        },
        location
      ),
    [location, condition, fieldName]
  );

  const fetchReplayCount = useCallback(async () => {
    try {
      if (!condition || !fieldName) {
        return;
      }
      const [data] = await doDiscoverQuery<TableData>(
        api,
        `/organizations/${organization.slug}/events/`,
        eventView.getEventsAPIPayload(location)
      );

      const counts = data.data.reduce((obj, record) => {
        const key = record[fieldName];
        const val = record['count_unique(replayId)'];
        obj[key] = val;
        return obj;
      }, {});
      setReplayCounts(counts);
    } catch (err) {
      Sentry.captureException(err);
    }
  }, [api, location, organization.slug, condition, fieldName, eventView]);

  useEffect(() => {
    const hasSessionReplay =
      organization.features.includes('session-replay-ui') &&
      projectSupportsReplay(project);
    if (hasSessionReplay) {
      fetchReplayCount();
    }
  }, [fetchReplayCount, organization, project]);

  return replayCounts;
}

export default useReplaysCount;
