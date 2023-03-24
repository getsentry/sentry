import {useCallback, useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';
import {Location} from 'history';

import type {Group, Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import {DEFAULT_SORT} from 'sentry/utils/replays/fetchReplayList';
import useApi from 'sentry/utils/useApi';
import useCleanQueryParamsOnRouteLeave from 'sentry/utils/useCleanQueryParamsOnRouteLeave';
import {REPLAY_LIST_FIELDS} from 'sentry/views/replays/types';

function useReplayFromIssue({
  group,
  location,
  organization,
}: {
  group: Group;
  location: Location;
  organization: Organization;
}) {
  const api = useApi();

  const [replayIds, setReplayIds] = useState<string[]>();

  const [fetchError, setFetchError] = useState();

  const fetchReplayIds = useCallback(async () => {
    try {
      const response = await api.requestPromise(
        `/organizations/${organization.slug}/replay-count/`,
        {
          query: {
            returnIds: true,
            query: `issue.id:[${group.id}]`,
            statsPeriod: '14d',
            project: group.project.id,
          },
        }
      );
      setReplayIds(response[group.id] || []);
    } catch (error) {
      Sentry.captureException(error);
      setFetchError(error);
    }
  }, [api, organization.slug, group.id, group.project.id]);

  const eventView = useMemo(() => {
    if (!replayIds) {
      return null;
    }
    return EventView.fromSavedQuery({
      id: '',
      name: '',
      version: 2,
      fields: REPLAY_LIST_FIELDS,
      projects: [Number(group.project.id)],
      query: `id:[${String(replayIds)}]`,
      range: '14d',
      orderby: decodeScalar(location.query.sort, DEFAULT_SORT),
    });
  }, [location.query.sort, group.project.id, replayIds]);

  useCleanQueryParamsOnRouteLeave({fieldsToClean: ['cursor']});
  useEffect(() => {
    fetchReplayIds();
  }, [fetchReplayIds]);

  return {
    eventView,
    fetchError,
    pageLinks: null,
  };
}

export default useReplayFromIssue;
