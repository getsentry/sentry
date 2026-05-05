import {Button} from '@sentry/scraps/button';

import {openModal} from 'sentry/actionCreators/modal';
import {type LogsQueryInfo} from 'sentry/components/exports/dataExport';
import {IconDownload} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getExportDisabledTooltip} from 'sentry/views/explore/components/getExportDisabledTooltip';
import {LogsExportModal} from 'sentry/views/explore/logs/exports/logsExportModal';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';

const GLOBAL_MODAL_DISMISS_TO_CLOSE_REASON = {
  'backdrop-click': 'backdrop_click',
  'close-button': 'close_button',
  'escape-key': 'escape_key',
} as const;

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
  const organization = useOrganization();
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
