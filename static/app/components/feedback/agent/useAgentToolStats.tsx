import {useMemo} from 'react';
import {skipToken, useQuery} from '@tanstack/react-query';

import {organizationTagValuesApiOptions} from 'sentry/actionCreators/tags';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';

type ToolStatsRow = {
  'count()': number;
  'count_unique(user.id)': number;
  'failure_rate()': number;
  'mcp.tool.name': string;
  'p50(span.duration)': number;
  'p95(span.duration)': number;
};

export interface AgentToolStats {
  calls: number;
  failureRate: number;
  p50Ms: number;
  p95Ms: number;
  users: number;
}

export function getToolSpanQuery(tools: string[]) {
  return `span.op:mcp.server mcp.tool.name:[${tools.map(tool => JSON.stringify(tool)).join(',')}]`;
}

/**
 * How each tool is doing for every caller over the selected period, so a
 * report can be read against the tool's real traffic.
 */
export function useAgentToolStats({tools}: {tools: string[]}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const {data, isPending, isError} = useQuery(
    apiOptions.as<{data: ToolStatsRow[]}>()(
      '/organizations/$organizationIdOrSlug/events/',
      {
        path: tools.length ? {organizationIdOrSlug: organization.slug} : skipToken,
        query: {
          dataset: 'spans',
          referrer: 'api.feedback.agent-tool-stats',
          project: selection.projects,
          ...normalizeDateTimeParams(selection.datetime),
          field: [
            'mcp.tool.name',
            'count()',
            'failure_rate()',
            'count_unique(user.id)',
            'p50(span.duration)',
            'p95(span.duration)',
          ],
          query: getToolSpanQuery(tools),
          sort: '-count()',
          per_page: tools.length,
        },
        staleTime: 5 * 60_000,
      }
    )
  );

  const statsByTool = useMemo(
    () =>
      new Map<string, AgentToolStats>(
        data?.data.map(row => [
          row['mcp.tool.name'],
          {
            calls: row['count()'],
            failureRate: row['failure_rate()'],
            users: row['count_unique(user.id)'],
            p50Ms: row['p50(span.duration)'],
            p95Ms: row['p95(span.duration)'],
          },
        ])
      ),
    [data]
  );

  return {statsByTool, isPending: tools.length > 0 && isPending, isError};
}

/**
 * How many reports carry each value of a feedback tag over the selected period.
 */
export function useAgentFeedbackTagCounts(tagKey: string) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const {data, isPending} = useQuery(
    organizationTagValuesApiOptions({
      orgSlug: organization.slug,
      tagKey,
      dataset: Dataset.ISSUE_PLATFORM,
      projectIds: selection.projects.map(String),
      endpointParams: normalizeDateTimeParams(selection.datetime),
      sort: '-count',
    })
  );

  const counts = useMemo(
    () =>
      (data ?? [])
        .filter(tagValue => tagValue.value)
        .map(tagValue => ({value: tagValue.value!, count: tagValue.count}))
        .toSorted((a, b) => b.count - a.count),
    [data]
  );

  return {counts, isPending};
}
