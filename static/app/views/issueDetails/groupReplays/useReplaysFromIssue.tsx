import {useEffect, useMemo} from 'react';
import * as Sentry from '@sentry/react';
import {useQuery} from '@tanstack/react-query';
import type {Location} from 'history';

import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {DEFAULT_REPLAY_LIST_SORT} from 'sentry/components/replays/table/useReplayTableSort';
import {IssueCategory, type Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {EventView} from 'sentry/utils/discover/eventView';
import {useCleanQueryParamsOnRouteLeave} from 'sentry/utils/useCleanQueryParamsOnRouteLeave';
import {REPLAY_LIST_FIELDS} from 'sentry/views/explore/replays/types';

export function useReplaysFromIssue({
  group,
  location,
  organization,
}: {
  group: Group;
  location: Location;
  organization: Organization;
}) {
  // use Discover for errors and Issue Platform for everything else
  const dataSource =
    group.issueCategory === IssueCategory.ERROR ? 'discover' : 'search_issues';

  const {data, error, isFetching, refetch} = useQuery({
    ...apiOptions.as<Record<string, string[]>>()(
      '/organizations/$organizationIdOrSlug/replay-count/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          returnIds: true,
          query: `issue.id:[${group.id}]`,
          data_source: dataSource,
          statsPeriod: '90d',
          environment: location.query.environment,
          project: ALL_ACCESS_PROJECTS,
        },
        staleTime: 0,
      }
    ),
    retry: false,
  });
  const replayIds = data?.[group.id];

  useEffect(() => {
    if (error) {
      Sentry.captureException(error);
    }
  }, [error]);

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
      orderby: DEFAULT_REPLAY_LIST_SORT,
    });
  }, [replayIds]);

  useCleanQueryParamsOnRouteLeave({
    fieldsToClean: ['cursor'],
    shouldClean: newLocation => newLocation.pathname.includes(`/issues/${group.id}/`),
  });
  return {
    eventView,
    fetchError: error ?? undefined,
    isFetching,
    pageLinks: null,
    refetch,
  };
}
