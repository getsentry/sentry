import {Button} from '@sentry/scraps/button';
import {useModal} from '@sentry/scraps/modal';

import {type LogsQueryInfo} from 'sentry/components/exports/dataExport';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {IconDownload} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getExportDisabledTooltip} from 'sentry/views/explore/components/getExportDisabledTooltip';
import {LogsExportModal} from 'sentry/views/explore/logs/exports/logsExportModal';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import {
  useQueryParamsFields,
  useQueryParamsSearch,
  useQueryParamsSortBys,
} from 'sentry/views/explore/queryParams/context';

const GLOBAL_MODAL_DISMISS_TO_CLOSE_REASON = {
  'backdrop-click': 'backdrop_click',
  'close-button': 'close_button',
  'escape-key': 'escape_key',
} as const;

type LogsExportModalButtonProps = {
  isLoading: boolean;
  tableData: OurLogsResponseItem[];
  error?: Error | null;
};

function useLogsQueryInfo(): LogsQueryInfo {
  const {selection} = usePageFilters();
  const logsSearch = useQueryParamsSearch();
  const fields = useQueryParamsFields();
  const sortBys = useQueryParamsSortBys();
  const {start, end, period: statsPeriod} = selection.datetime;
  const {environments, projects} = selection;

  return {
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
}

export function LogsExportModalButton({
  error,
  isLoading,
  tableData,
}: LogsExportModalButtonProps) {
  const {openModal} = useModal();

  const organization = useOrganization();
  const queryInfo = useLogsQueryInfo();
  const disabledTooltip = getExportDisabledTooltip({
    isDataEmpty: !tableData?.length,
    isDataError: error !== null,
    isDataLoading: isLoading,
  });

  return (
    <Button
      disabled={!!disabledTooltip}
      size="xs"
      variant="secondary"
      icon={<IconDownload />}
      onClick={() => {
        trackAnalytics('logs.export_modal', {
          organization,
          action: 'open',
        });
        openModal(
          deps => (
            <LogsQueryParamsProvider
              analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
              source="location"
            >
              <LogsExportModal {...deps} queryInfo={queryInfo} tableData={tableData} />
            </LogsQueryParamsProvider>
          ),
          {
            onClose: reason => {
              if (reason) {
                trackAnalytics('logs.export_modal', {
                  organization,
                  action: 'cancel',
                  close_reason: GLOBAL_MODAL_DISMISS_TO_CLOSE_REASON[reason],
                });
              }
            },
          }
        );
      }}
      tooltipProps={{
        title:
          disabledTooltip ?? t('Configure export options before starting your export.'),
      }}
    >
      {t('Export Data')}
    </Button>
  );
}
