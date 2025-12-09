import {useCallback, useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';
import type {Location} from 'history';

import {DEFAULT_REPLAY_LIST_SORT} from 'sentry/components/replays/table/useReplayTableSort';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import {REPLAY_LIST_FIELDS} from 'sentry/views/replays/types';

interface Props {
  groupIds: number[];
  location: Location;
  orgSlug: string;
}

/**
 * Hook to fetch replays for a cluster of issues.
 * Queries the replay-count endpoint with multiple issue IDs,
 * then creates an EventView for fetching replay details.
 */
export default function useReplaysForCluster({groupIds, location, orgSlug}: Props) {
  const api = useApi();

  const [replayIds, setReplayIds] = useState<string[]>();
  const [fetchError, setFetchError] = useState<RequestError>();

  const fetchReplayIds = useCallback(async () => {
    if (groupIds.length === 0) {
      setReplayIds([]);
      return;
    }

    try {
      // Query replay-count for all issues in the cluster
      // The API returns a map of issue.id -> replay IDs
      const response = await api.requestPromise(
        `/organizations/${orgSlug}/replay-count/`,
        {
          query: {
            returnIds: true,
            query: `issue.id:[${groupIds.join(',')}]`,
            data_source: 'discover',
            statsPeriod: '90d',
            project: ALL_ACCESS_PROJECTS,
          },
        }
      );

      // Collect all unique replay IDs from all issues
      const allReplayIds = new Set<string>();
      for (const issueId of groupIds) {
        const issueReplayIds = response[issueId] || [];
        for (const replayId of issueReplayIds) {
          allReplayIds.add(replayId);
        }
      }

      setReplayIds(Array.from(allReplayIds));
    } catch (error) {
      Sentry.captureException(error);
      setFetchError(error as RequestError);
    }
  }, [api, orgSlug, groupIds]);

  const eventView = useMemo(() => {
    if (!replayIds?.length) {
      return null;
    }
    return EventView.fromSavedQuery({
      id: '',
      name: '',
      version: 2,
      fields: REPLAY_LIST_FIELDS,
      query: `id:[${String(replayIds)}]`,
      range: '90d',
      projects: [],
      orderby: decodeScalar(location.query.sort, DEFAULT_REPLAY_LIST_SORT),
    });
  }, [location.query.sort, replayIds]);

  useEffect(() => {
    fetchReplayIds();
  }, [fetchReplayIds]);

  return {
    eventView,
    fetchError,
    isFetching: replayIds === undefined,
    replayIds: replayIds ?? [],
    replayCount: replayIds?.length ?? 0,
  };
}
