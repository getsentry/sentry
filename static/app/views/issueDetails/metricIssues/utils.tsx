import {Fragment, useMemo} from 'react';
import moment from 'moment-timezone';

import {DateTime} from 'sentry/components/dateTime';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {GroupOpenPeriod} from 'sentry/types/group';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import type {TimePeriodType} from 'sentry/views/alerts/rules/metric/details/constants';
import {TimePeriod} from 'sentry/views/alerts/rules/metric/types';
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

export function useMetricTimePeriod({
  openPeriod,
}: {
  openPeriod?: GroupOpenPeriod;
}): TimePeriodType | null {
  return useMemo((): TimePeriodType | null => {
    if (!openPeriod) {
      return null;
    }
    const start = openPeriod.start;
    let end = openPeriod.end;
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
  }, [openPeriod]);
}
