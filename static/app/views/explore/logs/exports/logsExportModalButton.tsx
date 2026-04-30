import {Button} from '@sentry/scraps/button';

import {openModal} from 'sentry/actionCreators/modal';
import {type LogsQueryInfo} from 'sentry/components/exports/dataExport';
import {IconDownload} from 'sentry/icons';
import {t} from 'sentry/locale';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {getExportDisabledTooltip} from 'sentry/views/explore/components/getExportDisabledTooltip';
import {LogsExportModal} from 'sentry/views/explore/logs/exports/logsExportModal';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';

type LogsExportModalButtonProps = {
  isLoading: boolean;
  queryInfo: LogsQueryInfo;
  tableData: OurLogsResponseItem[];
  error?: Error | null;
};

export function LogsExportModalButton({
  error,
  isLoading,
  queryInfo,
  tableData,
}: LogsExportModalButtonProps) {
  const disabledTooltip = getExportDisabledTooltip({
    isDataEmpty: !tableData?.length,
    isDataError: error !== null,
    isDataLoading: isLoading,
  });

  return (
    <Button
      disabled={!!disabledTooltip}
      size="xs"
      priority="default"
      icon={<IconDownload />}
      onClick={() => {
        openModal(deps => (
          <LogsQueryParamsProvider
            analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
            source="location"
          >
            <LogsExportModal {...deps} queryInfo={queryInfo} tableData={tableData} />
          </LogsQueryParamsProvider>
        ));
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
