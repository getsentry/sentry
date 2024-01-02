import {useCallback, useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';
import {Location} from 'history';

import type {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {doDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import {decodeScalar} from 'sentry/utils/queryString';
import {DEFAULT_SORT} from 'sentry/utils/replays/fetchReplayList';
import useApi from 'sentry/utils/useApi';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';
import {REPLAY_LIST_FIELDS} from 'sentry/views/replays/types';

type Options = {
  location: Location;
  organization: Organization;
  replayIdsEventView: EventView;
};

export type EventSpanData = {
  'count()': number;
  replayId: string;
  'span_ops_breakdown.relative': string;
  'spans.browser': null | number;
  'spans.db': null | number;
  'spans.http': null | number;
  'spans.resource': null | number;
  'spans.ui': null | number;
  timestamp: string;
  trace: string;
  'transaction.duration': number;
};

type Return = {
  data: null | {
    events: EventSpanData[];
    replayRecordsEventView: EventView;
  };
  fetchError: any;
  isFetching: boolean;
  pageLinks: null | string;
};

function useReplaysFromTransaction({
  location,
  organization,
  replayIdsEventView,
}: Options): Return {
  const api = useApi();

  const [response, setResponse] = useState<{
    events: EventSpanData[];
    pageLinks: null | string;
    replayIds: undefined | string[];
  }>({events: [], pageLinks: null, replayIds: undefined});

  const [fetchError, setFetchError] = useState<any>();

  const {cursor} = location.query;
  const fetchReplayIds = useCallback(async () => {
    try {
      const [{data}, _textStatus, resp] = await doDiscoverQuery<{data: EventSpanData[]}>(
        api,
        `/organizations/${organization.slug}/events/`,
        replayIdsEventView.getEventsAPIPayload({
          query: {cursor},
        } as Location<ReplayListLocationQuery>)
      );

      setResponse({
        pageLinks: resp?.getResponseHeader('Link') ?? '',
        replayIds: data.map(record => String(record.replayId)),
        events: data || [],
      });
    } catch (err) {
      Sentry.captureException(err);
      setFetchError(err);
    }
  }, [api, cursor, organization.slug, replayIdsEventView]);

  const replayRecordsEventView = useMemo(() => {
    if (!response.replayIds) {
      return null;
    }

    return EventView.fromSavedQuery({
      id: '',
      name: '',
      version: 2,
      fields: REPLAY_LIST_FIELDS,
      projects: [],
      query: `id:[${String(response.replayIds)}]`,
      orderby: decodeScalar(location.query.sort, DEFAULT_SORT),
    });
  }, [location.query.sort, response.replayIds]);

  useEffect(() => {
    fetchReplayIds();
  }, [fetchReplayIds]);

  return {
    data: replayRecordsEventView
      ? {
          events: response.events,
          replayRecordsEventView,
        }
      : null,
    fetchError,
    isFetching: !fetchError && !response.replayIds,
    pageLinks: response.pageLinks,
  };
}

export default useReplaysFromTransaction;
