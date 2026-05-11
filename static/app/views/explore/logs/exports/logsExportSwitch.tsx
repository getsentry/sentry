import type {LogsQueryInfo} from 'sentry/components/exports/dataExport';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {LogsExportButton} from 'sentry/views/explore/logs/exports/logsExportButton';
import {LogsExportModalButton} from 'sentry/views/explore/logs/exports/logsExportModalButton';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import {useShowModalExport} from 'sentry/views/explore/logs/useShowModalExport';
import {
  useQueryParamsFields,
  useQueryParamsSearch,
  useQueryParamsSortBys,
} from 'sentry/views/explore/queryParams/context';

type LogsExportSwitchProps = {
  isLoading: boolean;
  tableData: OurLogsResponseItem[];
  error?: Error | null;
};

export function LogsExportSwitch({isLoading, tableData, error}: LogsExportSwitchProps) {
  const showModalExport = useShowModalExport();

  const {selection} = usePageFilters();
  const logsSearch = useQueryParamsSearch();
  const fields = useQueryParamsFields();
  const sortBys = useQueryParamsSortBys();
  const {start, end, period: statsPeriod} = selection.datetime;
  const {environments, projects} = selection;

  const queryInfo: LogsQueryInfo = {
    dataset: 'logs',
    field: [...fields],
    query: logsSearch.formatString(),
    project: projects,
    sort: sortBys.map(sort => `${sort.kind === 'desc' ? '-' : ''}${sort.field}`),
    start: start ? new Date(start).toISOString() : undefined,
    end: end ? new Date(end).toISOString() : undefined,
    statsPeriod: statsPeriod || undefined,
    environment: environments,
  };

  const exportButtonProps = {
    queryInfo,
    isLoading,
    error,
    tableData,
  };

  return showModalExport ? (
    <LogsExportModalButton {...exportButtonProps} />
  ) : (
    <LogsExportButton {...exportButtonProps} />
  );
}
