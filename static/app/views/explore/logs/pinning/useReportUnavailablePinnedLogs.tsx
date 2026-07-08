import {useEffect, useRef} from 'react';

import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useLogsAnalyticsPageSource} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import type {usePinnedLogsQuery} from 'sentry/views/explore/logs/pinning/usePinnedLogsQuery';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';

interface ReportUnavailablePinnedLogsOptions {
  pinnedRows: string[];
  rowById: Map<string, OurLogsResponseItem>;
  statusById: ReturnType<typeof usePinnedLogsQuery>['statusById'];
}

export function useReportUnavailablePinnedLogs({
  pinnedRows,
  rowById,
  statusById,
}: ReportUnavailablePinnedLogsOptions) {
  const organization = useOrganization();
  const analyticsPageSource = useLogsAnalyticsPageSource();
  const reportedRef = useRef(new Set<string>());

  useEffect(() => {
    for (const rowId of pinnedRows) {
      if (rowById.has(rowId)) {
        continue;
      }
      const status = statusById.get(rowId);
      if (status !== 'success' && status !== 'error') {
        continue;
      }
      const reason = status === 'error' ? 'error' : 'not_found';
      const reportKey = `${rowId}:${reason}`;
      if (reportedRef.current.has(reportKey)) {
        continue;
      }
      reportedRef.current.add(reportKey);
      trackAnalytics('logs.table.pinned_row_unavailable', {
        log_id: rowId,
        organization,
        page_source: analyticsPageSource,
        reason,
      });
    }
  }, [pinnedRows, rowById, statusById, organization, analyticsPageSource]);
}
