import {useCallback, useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';
import type {Location} from 'history';

import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {type Group, IssueCategory} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import {DEFAULT_SORT} from 'sentry/utils/replays/fetchReplayList';
import useApi from 'sentry/utils/useApi';
import useCleanQueryParamsOnRouteLeave from 'sentry/utils/useCleanQueryParamsOnRouteLeave';
import {REPLAY_LIST_FIELDS} from 'sentry/views/replays/types';

export default function useReplaysFromIssue({
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

  // use Discover for errors and Issue Platform for everything else
  const dataSource =
    group.issueCategory === IssueCategory.ERROR ? 'discover' : 'search_issues';

  const fetchReplayIds = useCallback(async () => {
    try {
      const response = await api.requestPromise(
        `/organizations/${organization.slug}/replay-count/`,
        {
          query: {
            returnIds: true,
            query: `issue.id:[${group.id}]`,
            data_source: dataSource,
            statsPeriod: '90d',
            environment: location.query.environment,
            project: ALL_ACCESS_PROJECTS,
          },
        }
      );
      setReplayIds(response[group.id] || []);
    } catch (error) {
      Sentry.captureException(error);
      setFetchError(error);
    }
  }, [api, organization.slug, group.id, dataSource, location.query.environment]);

  const eventView = useMemo(() => {
    if (!replayIds || !replayIds.length) {
      return null;
    }
    return EventView.fromSavedQuery({
      id: '',
      name: '',
      version: 2,
      fields: REPLAY_LIST_FIELDS,
      query: replayIds.length ? `id:[${String(replayIds)}]` : `id:1`,
      range: '90d',
      projects: [],
      orderby: decodeScalar(location.query.sort, DEFAULT_SORT),
    });
  }, [location.query.sort, replayIds]);

  useCleanQueryParamsOnRouteLeave({
    fieldsToClean: ['cursor'],
    shouldClean: newLocation => newLocation.pathname.includes(`/issues/${group.id}/`),
  });
  useEffect(() => {
    fetchReplayIds();
  }, [fetchReplayIds]);

  return {
    eventView,
    fetchError,
    isFetching: replayIds === undefined,
    pageLinks: null,
  };
}
