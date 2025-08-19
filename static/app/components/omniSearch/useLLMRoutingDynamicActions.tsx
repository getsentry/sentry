import {useEffect, useRef, useState} from 'react';

import {IconDocs} from 'sentry/icons';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useTraceExploreAiQuerySetup} from 'sentry/views/explore/hooks/useTraceExploreAiQuerySetup';
import {getExploreUrl} from 'sentry/views/explore/utils';

import type {OmniAction} from './types';

type LLMRoutingResult = {
  route: 'traces' | 'issues' | 'other';
};

export function useLLMRoutingDynamicActions(query: string): OmniAction[] {
  const [extraRouteActions, setExtraRouteActions] = useState<OmniAction[]>([]);
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const {projects} = useProjects();
  const navigate = useNavigate();
  const memberProjects = projects.filter(p => p.isMember);

  // Setup trace explorer AI when omni search is loaded (runs once)
  useTraceExploreAiQuerySetup({enableAISearch: true});

  // Prevent unnecessary re-renders by tracking the last query that was processed
  const lastQueryRef = useRef<string>('');

  useEffect(() => {
    if (!query || query === lastQueryRef.current) {
      if (!query) {
        setExtraRouteActions([]);
        lastQueryRef.current = '';
      }
      return;
    }

    lastQueryRef.current = query;

    const attemptRouteQuery = async () => {
      const url =
        process.env.NODE_ENV === 'development'
          ? 'http://localhost:5000/route-query'
          : 'https://cmdkllm-12459da2e71a.herokuapp.com/route-query';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
        }),
      });
      const data: LLMRoutingResult = await res.json();

      const route = data.route;

      if (route === 'other') {
        setExtraRouteActions([]);
      } else if (route === 'traces') {
        setExtraRouteActions([
          {
            key: 'nl-trace-query',
            areaKey: 'navigate',
            label: 'Find this in trace explorer',
            actionIcon: <IconDocs />,
            onAction: async () => {
              try {
                const selectedProjects =
                  pageFilters.selection.projects?.length > 0 &&
                  pageFilters.selection.projects?.[0] !== -1
                    ? pageFilters.selection.projects
                    : memberProjects.map(p => p.id);

                const response = await fetchMutation({
                  url: `/organizations/${organization.slug}/trace-explorer-ai/query/`,
                  method: 'POST',
                  data: {
                    natural_language_query: query,
                    project_ids: selectedProjects,
                    limit: 1,
                  },
                });

                if (response.queries && response.queries.length > 0) {
                  const result = response.queries[0];
                  const startFilter = pageFilters.selection.datetime.start?.valueOf();
                  const start = startFilter
                    ? new Date(startFilter).toISOString()
                    : pageFilters.selection.datetime.start;

                  const endFilter = pageFilters.selection.datetime.end?.valueOf();
                  const end = endFilter
                    ? new Date(endFilter).toISOString()
                    : pageFilters.selection.datetime.end;

                  const selection = {
                    ...pageFilters.selection,
                    datetime: {
                      start,
                      end,
                      utc: pageFilters.selection.datetime.utc,
                      period:
                        result.stats_period || pageFilters.selection.datetime.period,
                    },
                  };

                  const mode =
                    result.group_by.length > 0
                      ? Mode.AGGREGATE
                      : result.mode === 'aggregates'
                        ? Mode.AGGREGATE
                        : Mode.SAMPLES;

                  const visualize =
                    result.visualization?.map((v: any) => ({
                      chartType: v?.chart_type,
                      yAxes: v?.y_axes,
                    })) ?? [];

                  const exploreUrl = getExploreUrl({
                    organization,
                    selection,
                    query: result.query,
                    visualize,
                    groupBy: result.group_by ?? [],
                    sort: result.sort,
                    mode,
                  });

                  navigate(exploreUrl);
                }
              } catch (error) {
                // Fallback to basic explore page if AI query fails
                const exploreUrl = getExploreUrl({
                  organization,
                  selection: pageFilters.selection,
                  query,
                  visualize: [],
                  groupBy: [],
                  sort: '',
                  mode: Mode.SAMPLES,
                });
                navigate(exploreUrl);
              }
            },
          },
        ]);
      } else if (route === 'issues') {
        setExtraRouteActions([
          {
            key: 'nl-issue-query',
            areaKey: 'navigate',
            label: 'Find this in issue details',
            actionIcon: <IconDocs />,
            onAction: () => {
              // console.log('issue details');
            },
          },
        ]);
      }
    };

    attemptRouteQuery();
  }, [query, memberProjects, organization, pageFilters.selection, navigate]);

  return extraRouteActions;
}
