import * as Sentry from '@sentry/react';
import type {Location} from 'history';

import type {Client} from 'sentry/api';
import type {Organization} from 'sentry/types';
import type EventView from 'sentry/utils/discover/eventView';
import {mapResponseToReplayRecord} from 'sentry/utils/replays/replayDataUtils';
import type RequestError from 'sentry/utils/requestError/requestError';
import type {ReplayListRecord} from 'sentry/views/replays/types';

export const DEFAULT_SORT = '-startedAt';

export const REPLAY_LIST_FIELDS = [
  'activity',
  'countErrors',
  'duration',
  'finishedAt',
  'id',
  'projectId',
  'startedAt',
  'urls',
  'user',
];

type State = {
  fetchError: undefined | RequestError;
  isFetching: boolean;
  pageLinks: null | string;
  replays: undefined | ReplayListRecord[];
};

type Result = State;

type Props = {
  api: Client;
  eventView: EventView;
  location: Location;
  organization: Organization;
};

async function fetchReplayList({
  api,
  organization,
  location,
  eventView,
}: Props): Promise<Result> {
  try {
    const path = `/organizations/${organization.slug}/replays/`;

    const [{data: records}, _textStatus, resp] = await api.requestPromise(path, {
      includeAllArgs: true,
      query: {
        ...eventView.getEventsAPIPayload(location),
        cursor: location.query.cursor,
      },
    });

    const pageLinks = resp?.getResponseHeader('Link') ?? '';

    return {
      fetchError: undefined,
      isFetching: false,
      pageLinks,
      replays: records.map(mapResponseToReplayRecord),
    };
  } catch (error) {
    if (error.responseJSON?.detail) {
      return {
        fetchError: error.responseJSON.detail,
        isFetching: false,
        pageLinks: null,
        replays: [],
      };
    }
    Sentry.captureException(error);
    return {
      fetchError: error,
      isFetching: false,
      pageLinks: null,
      replays: [],
    };
  }
}

export default fetchReplayList;
