import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import moment from 'moment-timezone';

import Legend from 'sentry/components/charts/components/legend';
import {usePageFilterDates} from 'sentry/components/checkInTimeline/hooks/useMonitorDates';
import {DateTime} from 'sentry/components/dateTime';
import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import type {Event} from 'sentry/types/event';
import type {GroupOpenPeriod} from 'sentry/types/group';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import type {TimePeriodType} from 'sentry/views/alerts/rules/metric/details/constants';
import {type MetricRule, TimePeriod} from 'sentry/views/alerts/rules/metric/types';
import {useIssueDetails} from 'sentry/views/issueDetails/streamline/context';
import {getGroupEventQueryKey} from 'sentry/views/issueDetails/utils';

export function useMetricIssueAlertId({groupId}: {groupId: string}): string | undefined {
  /**
   * This should be removed once the metric alert rule ID is set on the issue.
   * This will fetch an event from the max range if the detector details
   * are not available (e.g. time range has changed and page refreshed)
   */
  const user = useUser();
  const organization = useOrganization();
  const {detectorDetails} = useIssueDetails();
  const {detectorId, detectorType} = detectorDetails;

  const hasMetricDetector = detectorId && detectorType === 'metric_alert';

  const {data: event} = useApiQuery<Event>(
    getGroupEventQueryKey({
      orgSlug: organization.slug,
      groupId,
      eventId: user.options.defaultIssueEvent,
      environments: [],
    }),
    {
      staleTime: Infinity,
      enabled: !hasMetricDetector,
      retry: false,
    }
  );

  // Fall back to the fetched event in case the provider doesn't have the detector details
  return hasMetricDetector ? detectorId : event?.contexts?.metric_alert?.alert_rule_id;
}

interface UseMetricTimePeriodParams {
  openPeriod?: GroupOpenPeriod;
}

export function useMetricTimePeriod({
  openPeriod,
}: UseMetricTimePeriodParams = {}): TimePeriodType {
  const {since, until} = usePageFilterDates();
  return useMemo(() => {
    const start = openPeriod?.start ?? since.toISOString();
    let end = openPeriod?.end ?? until.toISOString();
    if (!end) {
      end = new Date().toISOString();
    }
    return {
      start,
      end,
      period: TimePeriod.SEVEN_DAYS,
      usingPeriod: false,
      label: t('Custom time'),
      display: (
        <Fragment>
          <DateTime date={moment.utc(start)} />
          {' — '}
          <DateTime date={moment.utc(end)} />
        </Fragment>
      ),
      custom: true,
    };
  }, [openPeriod, since, until]);
}

export function useMetricIssueLegend({
  rule,
  series,
}: {
  rule: MetricRule;
  series: Series[];
}) {
  const theme = useTheme();
  return useMemo(() => {
    const legendSet = new Set(series.map(s => s.seriesName));
    if (legendSet.has(rule.aggregate)) {
      legendSet.delete(rule.aggregate);
    }
    const legendItems = Array.from(legendSet).map(name => {
      switch (name) {
        case 'Threshold Line':
          return {
            name,
            icon: HORIZONTAL_DASHED_LINE_CHART_ICON,
            itemStyle: {
              color: theme.error,
            },
          };
        case 'Incident Line':
          return {
            name,
            icon: VERTICAL_LINE_CHART_ICON,
            itemStyle: {
              color: theme.error,
            },
          };

        case 'Status Area':
          return {
            name,
            icon: HORIZONTAL_WIDE_LINE_CHART_ICON,
            itemStyle: {
              color: theme.error,
            },
          };
        default:
          return {
            name,
            icon: 'circle',
            color: theme.gray300,
          };
      }
    });
    return Legend({
      theme,
      orient: 'horizontal',
      align: 'left',
      show: true,
      data: legendItems,
      inactiveColor: theme.gray200,
    });
  }, [rule, series, theme]);
}

const HORIZONTAL_DASHED_LINE_CHART_ICON =
  'path://M180 1000 l0 -80 200 0 200 0 0 80 0 80 -200 0 -200 0 0 -80z, M810 1000 l0 -80 200 0 200 0 0 80 0 80 -200 0 -200 0 0 -80zm, M1440 1000 l0 -80 200 0 200 0 0 80 0 80 -200 0 -200 0 0 -80z';

const VERTICAL_LINE_CHART_ICON =
  'path://M1000 180 l0 -40 40 0 40 0 0 200 0 200 0 200 0 200 -40 0 -40 0 0 -200 0 -200 0 -200 0 -200z';

const HORIZONTAL_WIDE_LINE_CHART_ICON =
  'path://M180 1000 l0 -160 400 0 400 0 0 160 0 160 -400 0 -400 0 0 -160z';
