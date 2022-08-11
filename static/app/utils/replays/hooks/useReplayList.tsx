import {useCallback, useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';
import type {Location} from 'history';

import type {Organization} from 'sentry/types';
import {getLocalToSystem, getUserTimezone, getUtcDateString} from 'sentry/utils/dates';
import EventView from 'sentry/utils/discover/eventView';
import {decodeInteger, decodeScalar} from 'sentry/utils/queryString';
import useMapResponseToReplayRecord from 'sentry/utils/replays/hooks/useMapResponseToReplayRecord';
import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import type {ReplayRecord} from 'sentry/views/replays/types';

export const DEFAULT_LIMIT = 50;
export const DEFAULT_SORT = '-startedAt';

export type ReplayListRecord = Pick<
  ReplayRecord,
  | 'countErrors'
  | 'duration'
  | 'finishedAt'
  | 'id'
  | 'project'
  | 'projectId'
  | 'startedAt'
  | 'urls'
  | 'user'
>;

export const INDEX_FIELDS = [
  'countErrors',
  'duration',
  'finishedAt',
  'replayId', // TODO(replay): rename to `id`
  'projectId',
  'startedAt',
  'urls',
  'user',
];

export type ReplayListLocationQuery = {
  end?: string;
  environment?: string[];
  field?: string[];
  limit?: string;
  offset?: string;
  project?: string[];
  query?: string;
  sort?: string;
  start?: string;
  statsPeriod?: string;
  utc?: 'true' | 'false';
};

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
  const mapResponseToReplayRecord = useMapResponseToReplayRecord();

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
      query.limit = String(queryLimit + 1);
      query.offset = String(queryOffset);
      const response = await api.requestPromise(path, {
        query: eventView.getEventsAPIPayload(location),
      });

      const records = response.data.slice(0, queryLimit);

      const pageLinks = getPageLinks({
        defaultLimit,
        query,
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
  }, [api, mapResponseToReplayRecord, organization, defaultLimit, location, eventView]);

  useEffect(() => {
    init();
  }, [init]);

  return data;
}

// TODO(replays): We should be getting pageLinks as response headers, not constructing them.
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
  const queryLimit = decodeInteger(query.limit, defaultLimit);
  const queryOffset = decodeInteger(query.offset, 0);

  const prevOffset = queryOffset - queryLimit;
  const nextOffset = queryOffset + queryLimit;

  const hasPrev = prevOffset >= 0;
  const hasNext = records.length === queryLimit + 1;

  const utc =
    query.utc === 'true'
      ? true
      : query.utc === 'false'
      ? false
      : getUserTimezone() === 'UTC';

  const qs = [
    ...(query.environment ?? []).map(e => `environment=${e}`),
    ...INDEX_FIELDS.map(f => `field=${f}`),
    ...(query.project ?? []).map(p => `project=${p}`),
    `limit=${queryLimit + 1}`,
    `offset=${queryOffset}`,
    `sort=${decodeScalar(query.sort, DEFAULT_SORT)}`,
    query.statsPeriod && `statsPeriod=${query.statsPeriod}`,
    query.start &&
      `start=${getUtcDateString(utc ? query.start : getLocalToSystem(query.start))}`,
    query.end && `end=${getUtcDateString(utc ? query.end : getLocalToSystem(query.end))}`,
  ]
    .filter(Boolean)
    .join('&');
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
