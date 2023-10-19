import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as Sentry from '@sentry/react';
import {Location} from 'history';

import {getSampleEventQuery} from 'sentry/components/events/eventStatisticalDetector/eventComparison/eventDisplay';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {Event, type Group, type Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import {DEFAULT_SORT} from 'sentry/utils/replays/fetchReplayList';
import useApi from 'sentry/utils/useApi';
import useCleanQueryParamsOnRouteLeave from 'sentry/utils/useCleanQueryParamsOnRouteLeave';
import {REPLAY_LIST_FIELDS} from 'sentry/views/replays/types';

function useReplaysForRegressionIssue({
  group,
  location,
  organization,
  event,
}: {
  event: Event;
  group: Group;
  location: Location;
  organization: Organization;
}) {
  const now = useRef(new Date().toISOString());
  const api = useApi();

  const [replayIds, setReplayIds] = useState<string[]>();

  const [fetchError, setFetchError] = useState();

  const {transaction, aggregateRange2, breakpoint} = event.occurrence?.evidenceData ?? {};

  const datetime = useMemo(
    () => ({
      start: new Date(breakpoint * 1000).toISOString(),
      end: now.current,
    }),
    [breakpoint]
  );

  const fetchReplayIds = useCallback(async () => {
    try {
      const response = await api.requestPromise(
        `/organizations/${organization.slug}/replay-count/`,
        {
          query: {
            returnIds: true,
            query: getSampleEventQuery({
              transaction,
              durationBaseline: aggregateRange2,
              addUpperBound: false,
            }),
            data_source: 'search_issues',
            project: ALL_ACCESS_PROJECTS,
            ...datetime,
          },
        }
      );
      setReplayIds(response[transaction] || []);
    } catch (error) {
      Sentry.captureException(error);
      setFetchError(error);
    }
  }, [api, organization.slug, transaction, aggregateRange2, datetime]);

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
      projects: [],
      orderby: decodeScalar(location.query.sort, DEFAULT_SORT),
      ...datetime,
    });
  }, [datetime, location.query.sort, replayIds]);

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

export default useReplaysForRegressionIssue;
