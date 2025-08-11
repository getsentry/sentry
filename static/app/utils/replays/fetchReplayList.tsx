import * as Sentry from '@sentry/react';
import type {Location} from 'history';

import type {Client} from 'sentry/api';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type EventView from 'sentry/utils/discover/eventView';
import {mapResponseToReplayRecord} from 'sentry/utils/replays/replayDataUtils';
import type RequestError from 'sentry/utils/requestError/requestError';
import type {ReplayListQueryReferrer, ReplayListRecord} from 'sentry/views/replays/types';

export const DEFAULT_SORT = '-started_at';

type State = {
  fetchError: undefined | RequestError;
  pageLinks: null | string;
  replays: undefined | ReplayListRecord[];
};

type Result = State;

type Props = {
  api: Client;
  eventView: EventView;
  location: Location;
  organization: Organization;
  selection: PageFilters;
  perPage?: number;
  queryReferrer?: ReplayListQueryReferrer;
};

async function fetchReplayList({
  api,
  organization,
  location,
  eventView,
  queryReferrer,
  perPage,
  selection,
}: Props): Promise<Result> {
  try {
    const path = `/organizations/${organization.slug}/replays/`;

    const payload = eventView.getEventsAPIPayload(location);

    // HACK!!! Because the sort field needs to be in the eventView, but I cannot
    // ask the server for compound fields like `os.name`.
    payload.field = payload.field.map(field => field.split('.')[0]!);
    if (perPage) {
      payload.per_page = perPage;
    }

    // unique list
    payload.field = Array.from(new Set(payload.field));

    const [{data}, _textStatus, resp] = await api.requestPromise(path, {
      includeAllArgs: true,
      query: {
        ...payload,
        cursor: location.query.cursor,
        // when queryReferrer === 'issueReplays' we override the global view check on the backend
        // we also require a project param otherwise we won't yield results
        queryReferrer,
        project:
          queryReferrer === 'issueReplays'
            ? ALL_ACCESS_PROJECTS
            : queryReferrer === 'transactionReplays'
              ? selection.projects
              : payload.project,
      },
    });

    const pageLinks = resp?.getResponseHeader('Link') ?? '';

    return {
      fetchError: undefined,
      pageLinks,
      replays: payload.query ? data.map(mapResponseToReplayRecord) : [],
      // for the replay tab in transactions, if payload.query is undefined,
      // this means the transaction has no related replays.
      // but because we cannot query for an empty list of IDs (e.g. `id:[]` breaks our search endpoint),
      // and leaving query empty results in ALL replays being returned for a specified project
      // (which doesn't make sense as we want to show no replays),
      // we essentially want to hardcode no replays being returned.
    };
  } catch (error) {
    if (error.responseJSON?.detail) {
      return {
        fetchError: error.responseJSON.detail,
        pageLinks: null,
        replays: [],
      };
    }
    Sentry.captureException(error);
    return {
      fetchError: error,
      pageLinks: null,
      replays: [],
    };
  }
}

export default fetchReplayList;
