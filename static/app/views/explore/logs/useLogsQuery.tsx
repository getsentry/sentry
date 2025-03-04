import type EventView from 'sentry/utils/discover/eventView';
import {useQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {
  useLogsFields,
  useLogsSearch,
  useLogsSortBys,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {useOurlogs} from 'sentry/views/insights/common/queries/useDiscover';

export interface OurLogsTableResult {
  eventView: EventView;
  result: ReturnType<typeof useOurlogs>;
}

export function useExploreLogsTable(options: Parameters<typeof useOurlogs>[0]) {
  const search = useLogsSearch();
  const fields = useLogsFields();
  const sortBys = useLogsSortBys();

  const {data, isError, isPending} = useOurlogs(
    {
      ...options,
      sorts: sortBys,
      fields,
      search,
    },
    'api.logs-tab.view'
  );

  return {data, isError, isPending};
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
