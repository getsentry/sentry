import { useLocation } from "sentry/utils/useLocation";
import { FetchOptions } from "./types";
import {ReplayListLocationQuery} from 'sentry/views/replays/types';
import useOrganization from "sentry/utils/useOrganization";
import useProjects from "sentry/utils/useProjects";
import { useEffect, useMemo, useRef, useState } from "react";
import { decodeScalar } from "sentry/utils/queryString";
import { MutableSearch } from "sentry/utils/tokenizeSearch";
import EventView from "sentry/utils/discover/eventView";
import useReplayList, { Result } from "sentry/utils/replays/hooks/useReplayList";

interface State {
  isInfiniteFetching: boolean;
  timestamp: null | number;
  results: null | Result
}

export function useFetchReplays({userId, infiniteRef, limit = 5}: FetchOptions) {
  const location = useLocation<ReplayListLocationQuery>();
  const organization = useOrganization();
  const {projects} = useProjects();
  const projectsHash = new Map(projects.map(project => [`${project.id}`, project]));
  const observer = useRef<null | IntersectionObserver>(null);
  const state = useState<State>({
    isInfiniteFetching: false,
    timestamp: null,
    results: null,
  });

  useEffect(() => {
    if (infiniteRef && infiniteRef.current && !observer.current) {
      console.log('replays, useEffect observing', observer.current);

      observer.current = new IntersectionObserver(
          (entries) => {
          const first = entries[0];
          if (first.isIntersecting) {
          // Do fetch
          console.log('useFetchReplays inf loading hit');
          }
          })
      observer.current.observe(infiniteRef.current);
    }

    return () => {
    console.log('replays useEffect cleanup', infiniteRef?.current, observer.current)
    }
  })


  const eventView = useMemo(() => {
    const query = decodeScalar(location.query.query, '');
    const conditions = new MutableSearch(query);
    conditions.addFilterValue('user.id', userId);

    return EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: '',
        version: 2,
        fields: [
          'activity',
          'browser.name',
          'browser.version',
          'count_dead_clicks',
          'count_errors',
          'count_rage_clicks',
          'duration',
          'finished_at',
          'id',
          'is_archived',
          'os.name',
          'os.version',
          'project_id',
          'started_at',
          'urls',
          'user',
        ],
        projects: [],
        query: conditions.formatString(),
        orderby: decodeScalar(location.query.sort, '-started_at'),
      },
      location
    );
  }, [location, userId]);

  const results = useReplayList({
    eventView,
    location,
    organization,
    perPage: limit,
  });


  if (!results.isFetching) {
  
  }


  return {
    ...results,
    projects: projectsHash,
  };
}
