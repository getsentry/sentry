import {Fragment, type ReactNode} from 'react';

import {Switch} from 'sentry/components/core/switch';
import {Tooltip} from 'sentry/components/core/tooltip';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  type AutoRefreshState,
  useLogsAutoRefreshEnabled,
  useSetLogsAutoRefresh,
} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';
import {useLogsPageData} from 'sentry/views/explore/contexts/logs/logsPageData';
import {
  useLogsAnalyticsPageSource,
  useLogsMode,
  useLogsSortBys,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {AutoRefreshLabel} from 'sentry/views/explore/logs/styles';
import {useLogsAutoRefreshInterval} from 'sentry/views/explore/logs/useLogsAutoRefreshInterval';
import {checkSortIsTimeBasedDescending} from 'sentry/views/explore/logs/utils';

const MAX_LOGS_PER_SECOND = 100; // Rate limit for initial check

type PreFlightDisableReason =
  | 'sort' // Wrong sort order
  | 'absolute_time' // Using absolute date range
  | 'aggregates' // In aggregates view
  | 'rate_limit_initial' // Too many logs per second
  | 'initial_error'; // Initial table query errored

interface AutorefreshToggleProps {
  averageLogsPerSecond?: number | null;
  disabled?: boolean;
}

/**
 * Toggle control for the logs auto-refresh feature.
 *
 * Auto-refresh uses two types of state:
 * - Pre-flight conditions (PreFlightDisableReason): Checked locally before enabling, prevents toggle activation
 * - Runtime state (AutoRefreshState): Stored in URL params, tracks active refresh status and failures
 *
 * Preflight conditions don't disable autorefresh when values change (eg. sort changes), it's assumed all preflight conditions
 * should be handled via logs page params resetting autorefresh state meaning future values will be checked again before the toggle can be re-enabled.
 */
export function AutorefreshToggle({
  disabled: externallyDisabled,
  averageLogsPerSecond = 0,
}: AutorefreshToggleProps) {
  const organization = useOrganization();
  const analyticsPageSource = useLogsAnalyticsPageSource();
  const autorefreshEnabled = useLogsAutoRefreshEnabled();
  const setAutorefresh = useSetLogsAutoRefresh();
  const sortBys = useLogsSortBys();
  const mode = useLogsMode();
  const {selection} = usePageFilters();
  const {infiniteLogsQueryResult} = useLogsPageData();
  const {isError, fetchPreviousPage} = infiniteLogsQueryResult;

  useLogsAutoRefreshInterval({
    fetchPreviousPage: () => fetchPreviousPage() as any,
    isError,
  });

  const hasAbsoluteDates = Boolean(selection.datetime.start && selection.datetime.end);

  const preFlightDisableReason = getPreFlightDisableReason({
    sortBys,
    hasAbsoluteDates,
    mode,
    averageLogsPerSecond,
    initialIsError: isError,
  });

  const isToggleDisabled = !!preFlightDisableReason || externallyDisabled;
  const tooltipReason =
    preFlightDisableReason || (autorefreshEnabled ? null : preFlightDisableReason);

  return (
    <Fragment>
      <AutoRefreshLabel>
        <Tooltip
          title={getTooltipMessage(tooltipReason, externallyDisabled)}
          disabled={!tooltipReason && !externallyDisabled}
          skipWrapper
        >
          <Switch
            disabled={isToggleDisabled}
            checked={autorefreshEnabled}
            onChange={() => {
              const newChecked = !autorefreshEnabled;

              trackAnalytics('logs.auto_refresh.toggled', {
                enabled: newChecked,
                organization,
                page_source: analyticsPageSource,
              });

              if (newChecked) {
                setAutorefresh('enabled');
              } else {
                setAutorefresh('idle');
              }
            }}
          />
        </Tooltip>
        {t('Auto-refresh')}
      </AutoRefreshLabel>
    </Fragment>
  );
}

function getPreFlightDisableReason({
  sortBys,
  hasAbsoluteDates,
  mode,
  averageLogsPerSecond,
  initialIsError,
}: {
  hasAbsoluteDates: boolean;
  mode: string;
  sortBys: ReturnType<typeof useLogsSortBys>;
  averageLogsPerSecond?: number | null;
  initialIsError?: boolean;
}): PreFlightDisableReason | null {
  if (mode === 'aggregates') {
    return 'aggregates';
  }
  if (!checkSortIsTimeBasedDescending(sortBys)) {
    return 'sort';
  }
  if (hasAbsoluteDates) {
    return 'absolute_time';
  }
  if (averageLogsPerSecond && averageLogsPerSecond > MAX_LOGS_PER_SECOND) {
    return 'rate_limit_initial';
  }
  if (initialIsError) {
    return 'initial_error';
  }
  return null;
}

function getTooltipMessage(
  reason: PreFlightDisableReason | AutoRefreshState | null,
  externallyDisabled?: boolean
): ReactNode {
  if (externallyDisabled) {
    return t('Auto-refresh is not available in the aggregates view.');
  }

  switch (reason) {
    case 'rate_limit_initial':
      return tct(
        'Auto-refresh is disabled due to high data volume ([maxLogsPerSecond] logs per second). Try adding a filter to reduce the number of logs.',
        {maxLogsPerSecond: MAX_LOGS_PER_SECOND}
      );
    case 'rate_limit':
      return t(
        'Auto-refresh was disabled due to high data volume. Try adding a filter to reduce the number of logs.'
      );
    case 'timeout':
      return t(
        'Auto-refresh was disabled due to reaching the absolute max auto-refresh time of 10 minutes. Re-enable to continue.'
      );
    case 'error':
      return t(
        'Auto-refresh was disabled due to an error fetching logs. If the issue persists, please contact support.'
      );
    case 'absolute_time':
      return t(
        'Auto-refresh is only supported when using a relative time period, not absolute dates.'
      );
    case 'sort':
      return t(
        'Auto-refresh is only supported when sorting by time in descending order and using a relative time period.'
      );
    case 'aggregates':
      return t('Auto-refresh is not available in the aggregates view.');
    case 'initial_error':
      return t(
        'Auto-refresh is not available due to an error fetching logs. If the issue persists, please contact support.'
      );
    default:
      return null;
  }
}
