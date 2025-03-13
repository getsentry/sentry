import * as Sentry from '@sentry/react';

import type EventView from 'sentry/utils/discover/eventView';
import {useQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {
  useLogsBaseSearch,
  useLogsCursor,
  useLogsFields,
  useLogsProjectIds,
  useLogsSearch,
  useLogsSortBys,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {AlwaysPresentLogFields} from 'sentry/views/explore/logs/constants';
import {useOurlogs} from 'sentry/views/insights/common/queries/useDiscover';

const {warn, fmt} = Sentry._experiment_log;

export interface OurLogsTableResult {
  eventView: EventView;
  result: ReturnType<typeof useOurlogs>;
}

export type UseExploreLogsTableResult = ReturnType<typeof useExploreLogsTable>;

export function useExploreLogsTable(options: Parameters<typeof useOurlogs>[0]) {
  const _search = useLogsSearch();
  const baseSearch = useLogsBaseSearch();
  const cursor = useLogsCursor();
  const fields = useLogsFields();
  const sortBys = useLogsSortBys();
  const projectIds = useLogsProjectIds();
  const extendedFields = new Set([...AlwaysPresentLogFields, ...fields]);

  const search = baseSearch ? _search.copy() : _search;
  if (baseSearch) {
    search.tokens.push(...baseSearch.tokens);
  }
  const {data, meta, isError, isPending, pageLinks} = useOurlogs(
    {
      ...options,
      cursor,
      sorts: sortBys,
      fields: Array.from(extendedFields),
      search,
      projectIds,
    },
    'api.logs-tab.view'
  );

  if (!meta) {
    warn(fmt`meta is 'undefined' for useExploreLogsTable`);
  }

  return {data, meta, isError, isPending, pageLinks};
}

export interface AttributeAnyValue {
  type: 'str' | 'int' | 'float' | 'bool';
  value: string | number | null;
}

type LogDetailsAttributes = Record<string, AttributeAnyValue>;

export interface OurLogsTableRowDetails {
  attributes: LogDetailsAttributes;
  itemId: string;
  timestamp: string;
  meta?: {
    requestId: string;
  };
}

export function useExploreLogsTableRow(_props: {
  log_id: string | number;
  project_id: string;
  enabled?: boolean;
}) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const _project = projects.find(p => p.id === _props.project_id);

  const {data, isError, isPending} = useQuery<OurLogsTableRowDetails>({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ['logs-table-row', _props.log_id, _props.project_id],
    queryFn: async () => {
      if (!_project) {
        throw new Error('Project not found');
      }
      const res = await fetch(
        `/api/0/projects/${organization.slug}/${_project?.slug}/trace-items/${_props.log_id}/?dataset=ourlogs`
      );
      if (!res.ok) {
        throw new Error('Failed to fetch log details');
      }
      return await res.json();
    },
  });

  return {
    data,
    isError,
    isPending,
  };
}
