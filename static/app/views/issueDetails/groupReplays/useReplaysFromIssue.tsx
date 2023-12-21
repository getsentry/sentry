import {useCallback, useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';
import {Location} from 'history';

import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {type Group, IssueCategory, type Organization} from 'sentry/types';
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

  const dataSource =
    group.issueCategory === IssueCategory.PERFORMANCE ? 'search_issues' : 'discover';

  const fetchReplayIds = useCallback(async () => {
    try {
      const response = await api.requestPromise(
        `/organizations/${organization.slug}/replay-count/`,
        {
          query: {
            returnIds: true,
            query: `issue.id:[${group.id}]`,
            data_source: dataSource,
            statsPeriod: '14d',
            project: ALL_ACCESS_PROJECTS,
          },
        }
      );
      setReplayIds(response[group.id] || []);
    } catch (error) {
      Sentry.captureException(error);
      setFetchError(error);
    }
  }, [api, organization.slug, group.id, dataSource]);

  const eventView = useMemo(() => {
    if (!replayIds) {
      return null;
    }
    return EventView.fromSavedQuery({
      id: '',
      name: '',
      version: 2,
      fields: REPLAY_LIST_FIELDS,
      query: `id:[${String(replayIds)}]`,
      range: '14d',
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
    pageLinks: null,
  };
}

export default useReplayFromIssue;
