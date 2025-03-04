import type EventView from 'sentry/utils/discover/eventView';
import {doDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import {useQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
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

export function useExploreLogsTableRow({
  log_id,
  project_id,
  enabled,
  dataset = 'ourlogs',
}: {
  log_id: string | number;
  project_id: string;
  dataset?: 'ourlogs';
  enabled?: boolean;
}) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const api = useApi();
  const _project = projects.find(p => p.id === project_id);

  const {data, isError, isPending} = useQuery<OurLogsTableRowDetails>({
    queryKey: ['logs-table-row', log_id, project_id],
    enabled,
    queryFn: async () => {
      if (!_project) {
        throw new Error('Project not found');
      }

      const url = `/projects/${organization.slug}/${_project?.slug}/trace-items/${log_id}/?dataset=${dataset}`;

      const [results, _, __] = await doDiscoverQuery<OurLogsTableRowDetails>(
        api,
        url,
        {}
      );

      return results;
    },
  });

  return {
    data,
    isError,
    isPending,
  };
}
