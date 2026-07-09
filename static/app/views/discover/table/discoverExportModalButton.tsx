import type {Location} from 'history';

import {ExportQueryType} from 'sentry/components/exports/useDataExport';
import {t} from 'sentry/locale';
import type {OrganizationSummary} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import type {EventView} from 'sentry/utils/discover/eventView';
import {useDiscoverExportEstimatedRowCount} from 'sentry/views/discover/table/useDiscoverExportEstimatedRowCount';
import {downloadAsCsv} from 'sentry/views/discover/utils';
import {ExploreExportModalButton} from 'sentry/views/explore/components/exports/exploreExportModalButton';
import type {ExploreExportConfig} from 'sentry/views/explore/components/exports/types';

type DiscoverExportModalButtonProps = {
  error: string | null;
  eventView: EventView;
  isLoading: boolean;
  location: Location;
  organization: OrganizationSummary;
  tableData: TableData | null | undefined;
  title: string;
  disabled?: boolean;
};

export function DiscoverExportModalButton({
  disabled,
  error,
  eventView,
  isLoading,
  location,
  organization,
  tableData,
  title,
}: DiscoverExportModalButtonProps) {
  const rows = tableData?.data ?? [];

  const {estimatedRowCount, isPending: isEstimatePending} =
    useDiscoverExportEstimatedRowCount({
      enabled: error === null && !isLoading && rows.length > 0,
      eventView,
      loadedRowCount: rows.length,
      location,
    });

  const config: ExploreExportConfig = {
    title: t('Export'),
    filenameBase: title,
    queryInfo: eventView.getEventsAPIPayload(location),
    asyncQueryType: ExportQueryType.DISCOVER,
    supportsAllColumns: false,
    availableFormats: ['csv'],
    estimatedRowCount,
    localRowCount: rows.length,
    localDownload: ({limit}) =>
      downloadAsCsv(
        {...tableData, data: rows.slice(0, limit)},
        eventView.getColumns(),
        title
      ),
    trackExportSubmit: ({exportType}) => {
      if (exportType === 'browser_sync') {
        trackAnalytics('discover_v2.results.download_csv', {
          organization: organization.id,
        });
      }
    },
  };

  return (
    <ExploreExportModalButton
      config={config}
      size="sm"
      disabled={disabled}
      isDataEmpty={rows.length === 0}
      isDataError={error !== null}
      isDataLoading={isLoading || isEstimatePending}
    />
  );
}
