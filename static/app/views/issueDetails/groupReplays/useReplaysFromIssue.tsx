import {useCallback, useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';
import {Location} from 'history';

import type {Group, Organization} from 'sentry/types';
import {TableData} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {doDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import {decodeScalar} from 'sentry/utils/queryString';
import {DEFAULT_SORT, REPLAY_LIST_FIELDS} from 'sentry/utils/replays/fetchReplayList';
import useApi from 'sentry/utils/useApi';
import useCleanQueryParamsOnRouteLeave from 'sentry/utils/useCleanQueryParamsOnRouteLeave';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';

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

  const [response, setResponse] = useState<{
    pageLinks: null | string;
    replayIds: undefined | string[];
  }>({pageLinks: null, replayIds: undefined});

  const [fetchError, setFetchError] = useState();

  const {cursor} = location.query;
  const fetchReplayIds = useCallback(async () => {
    const eventView = EventView.fromSavedQuery({
      id: '',
      name: `Errors within replay`,
      version: 2,
      fields: ['replayId', 'count()'],
      query: `issue.id:${group.id} !replayId:""`,
      projects: [Number(group.project.id)],
    });

    try {
      const [{data}, _textStatus, resp] = await doDiscoverQuery<TableData>(
        api,
        `/organizations/${organization.slug}/events/`,
        eventView.getEventsAPIPayload({
          query: {cursor},
        } as Location<ReplayListLocationQuery>)
      );

      setResponse({
        pageLinks: resp?.getResponseHeader('Link') ?? '',
        replayIds: data.map(record => String(record.replayId)),
      });
    } catch (err) {
      Sentry.captureException(err);
      setFetchError(err);
    }
  }, [api, cursor, organization.slug, group.id, group.project.id]);

  const eventView = useMemo(() => {
    if (!response.replayIds) {
      return null;
    }
    return EventView.fromSavedQuery({
      id: '',
      name: '',
      version: 2,
      fields: REPLAY_LIST_FIELDS,
      projects: [Number(group.project.id)],
      query: `id:[${String(response.replayIds)}]`,
      orderby: decodeScalar(location.query.sort, DEFAULT_SORT),
    });
  }, [location.query.sort, group.project.id, response.replayIds]);

  useCleanQueryParamsOnRouteLeave({fieldsToClean: ['cursor']});
  useEffect(() => {
    fetchReplayIds();
  }, [fetchReplayIds]);

  return {
    eventView,
    fetchError,
    pageLinks: response.pageLinks,
  };
}

export default useReplayFromIssue;
