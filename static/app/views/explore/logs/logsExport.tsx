import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import DataExport, {ExportQueryType} from 'sentry/components/dataExport';
import {IconDownload} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useLogsSearch} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {QUERY_PAGE_LIMIT} from 'sentry/views/explore/logs/constants';
import {isLogsExportEnabled} from 'sentry/views/explore/logs/isLogsEnabled';
import {downloadLogsAsCsv} from 'sentry/views/explore/logs/logsExportCsv';
import type {OurLogFieldKey, OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import {
  useQueryParamsFields,
  useQueryParamsSortBys,
} from 'sentry/views/explore/queryParams/context';

type LogsExportButtonProps = {
  isLoading: boolean;
  tableData: OurLogsResponseItem[] | null | undefined;
  error?: Error | null;
};

type InternalLogsQueryInfo = LogsExportButtonProps & {queryInfo: LogsQueryInfo};

interface LogsQueryInfo {
  dataset: 'logs';
  field: OurLogFieldKey[];
  project: number[];
  query: string;
  sort: string[];
  end?: string;
  environment?: string[];
  start?: string;
  statsPeriod?: string;
}

function handleDownloadLogsAsCsv(
  tableData: OurLogsResponseItem[],
  props: InternalLogsQueryInfo,
  organization: Organization
) {
  trackAnalytics('logs.export_csv', {
    organization,
    ...props.queryInfo,
  });
  downloadLogsAsCsv(tableData, props.queryInfo.field, 'logs');
}

function BrowserExportButton(props: InternalLogsQueryInfo) {
  const organization = useOrganization();
  const {isLoading, error, tableData} = props;
  const disabled = isLoading || error !== null || !tableData || tableData.length === 0;
  const onClick = disabled
    ? undefined
    : () => handleDownloadLogsAsCsv(tableData, props, organization);

  return (
    <StyledLogsExportButton
      size="xs"
      disabled={disabled}
      onClick={onClick}
      data-test-id="logs-download-csv"
      icon={<IconDownload />}
      title={
        disabled
          ? undefined
          : t(
              "There aren't that many results, start your export and it'll download immediately."
            )
      }
    >
      {t('Export')}
    </StyledLogsExportButton>
  );
}

function AsyncExportButton(props: InternalLogsQueryInfo) {
  const {isLoading, error, queryInfo} = props;
  const disabled = isLoading || error !== null;

  const payload = {
    queryType: ExportQueryType.EXPLORE,
    queryInfo: {
      ...queryInfo,
      dataset: 'logs',
    },
  };

  return (
    <DataExport payload={payload} disabled={disabled} icon={<IconDownload />}>
      {t('Export')}
    </DataExport>
  );
}

export function LogsExportButton(props: LogsExportButtonProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const logsSearch = useLogsSearch();
  const fields = useQueryParamsFields();
  const sortBys = useQueryParamsSortBys();
  const isEnabled = isLogsExportEnabled(organization);

  if (!isEnabled) {
    return <span />;
  }

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

  const isMoreThanOnePage =
    props.tableData && props.tableData.length > QUERY_PAGE_LIMIT - 1;

  const exportProps = {
    ...props,
    queryInfo: {
      ...queryInfo,
    },
  };

  return (
    <Fragment>
      {isMoreThanOnePage
        ? AsyncExportButton(exportProps)
        : BrowserExportButton(exportProps)}
    </Fragment>
  );
}

const StyledLogsExportButton = styled(Button)`
  justify-self: flex-end;
`;
