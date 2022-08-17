import {useCallback, useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';
import type {Location} from 'history';
import {stringify} from 'query-string';

import type {Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import {getLocalToSystem, getUserTimezone, getUtcDateString} from 'sentry/utils/dates';
import EventView from 'sentry/utils/discover/eventView';
import {decodeInteger} from 'sentry/utils/queryString';
import {mapResponseToReplayRecord} from 'sentry/utils/replays/replayDataUtils';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import type {ReplayListLocationQuery, ReplayListRecord} from 'sentry/views/replays/types';

const DEFAULT_LIMIT = 50;
export const DEFAULT_SORT = '-startedAt';

export const REPLAY_LIST_FIELDS = [
  'countErrors',
  'duration',
  'finishedAt',
  'id',
  'projectId',
  'startedAt',
  'urls',
  'user',
];

type Options = {
  eventView: EventView;
  organization: Organization;
  defaultLimit?: number;
};

type State = {
  fetchError: undefined | RequestError;
  isFetching: boolean;
  pageLinks: null | string;
  replays: undefined | ReplayListRecord[];
};

type Result = State;

function useReplayList({
  eventView,
  organization,
  defaultLimit = DEFAULT_LIMIT,
}: Options): Result {
  const api = useApi();
  const location = useLocation<ReplayListLocationQuery>();

  const [data, setData] = useState<State>({
    fetchError: undefined,
    isFetching: true,
    pageLinks: null,
    replays: [],
  });

  const init = useCallback(async () => {
    try {
      setData(prev => ({
        ...prev,
        isFetching: true,
      }));

      const queryLimit = decodeInteger(location.query.limit, defaultLimit);
      const queryOffset = decodeInteger(location.query.offset, 0);

      const path = `/organizations/${organization.slug}/replays/`;
      const query = eventView.generateQueryStringObject();

      // TODO(replays): Need to add one as a sentinel value to detect if there
      // are more pages. Shouldn't need this when response has pageLinks header.
      query.limit = String(queryLimit + 1);
      query.offset = String(queryOffset);
      const response = await api.requestPromise(path, {
        query: eventView.getEventsAPIPayload(location),
      });

      // TODO(replays): Remove the `slice()` call once `pageLinks` is in response headers.
      const records = response.data.slice(0, queryLimit);

      // TODO(replays): Response should include pageLinks header instead of this.
      const pageLinks = getPageLinks({
        defaultLimit,
        query: eventView.generateQueryStringObject(),
        path,
        records: response.data,
      });

      setData({
        fetchError: undefined,
        isFetching: false,
        pageLinks,
        replays: records.map(mapResponseToReplayRecord),
      });
    } catch (error) {
      Sentry.captureException(error);
      setData({
        fetchError: error,
        isFetching: false,
        pageLinks: null,
        replays: [],
      });
    }
  }, [api, organization, defaultLimit, location, eventView]);

  useEffect(() => {
    init();
  }, [init]);

  return data;
}

// We should be getting pageLinks as response headers, not constructing them.
function getPageLinks({
  defaultLimit,
  path,
  query,
  records,
}: {
  defaultLimit: number;
  path: string;
  query: Location<ReplayListLocationQuery>['query'];
  records: unknown[];
}) {
  // Remove extra fields that EventView uses internally
  Object.keys(query).forEach(key => {
    if (!defined(query[key]) || query[key] === '') {
      delete query[key];
    }
  });

  // Add & subtract one because we added one above as a sentinel to tell if there is a next page
  const queryLimit = decodeInteger(query.limit, defaultLimit);
  const queryOffset = decodeInteger(query.offset, 0);

  const prevOffset = queryOffset - queryLimit;
  const nextOffset = queryOffset + queryLimit;

  const hasPrev = prevOffset >= 0;
  const hasNext = records.length === queryLimit;

  const utc =
    query.utc === 'true'
      ? true
      : query.utc === 'false'
      ? false
      : getUserTimezone() === 'UTC';

  const qs = stringify({
    ...query,
    limit: String(queryLimit),
    offset: String(queryOffset),
    start: getUtcDateString(utc ? query.start : getLocalToSystem(query.start)),
    end: getUtcDateString(utc ? query.end : getLocalToSystem(query.end)),
  });
  const url = `${path}?${qs}`;

  return [
    hasPrev
      ? `<${url}>; rel="previous"; cursor="${prevOffset}"`
      : `<${url}>; rel="previous"; results="false"`,
    hasNext
      ? `<${url}>; rel="next"; cursor="${nextOffset}"`
      : `<${url}>; rel="next"; results="false" `,
  ].join(',');
}

export default useReplayList;
