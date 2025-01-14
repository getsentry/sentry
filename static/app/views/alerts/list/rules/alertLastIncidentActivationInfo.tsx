import TimeSince from 'sentry/components/timeSince';
import {t, tct} from 'sentry/locale';
import getDuration from 'sentry/utils/duration/getDuration';
import {hasActiveIncident} from 'sentry/views/alerts/list/rules/utils';
import {
  type CombinedAlerts,
  CombinedAlertType,
  type IssueAlert,
  type MetricAlert,
  type UptimeAlert,
} from 'sentry/views/alerts/types';

interface Props {
  rule: CombinedAlerts;
}

/**
 * Displays the time since the last uptime incident given an uptime alert rule
 */
function LastUptimeIncident({rule}: {rule: UptimeAlert}) {
  // TODO(davidenwang): Once we have a lastTriggered field returned from backend, display that info here
  return tct('Actively monitoring every [interval]', {
    interval: getDuration(rule.intervalSeconds),
  });
}

/**
 * Displays the last time an issue alert was triggered
 */
function LastIssueTrigger({rule}: {rule: IssueAlert}) {
  if (!rule.lastTriggered) {
    return t('Alert not triggered yet');
  }

  return (
    <div>
      {t('Triggered ')}
      <TimeSince date={rule.lastTriggered} />
    </div>
  );
}

/**
 * Displays the last incident for continuous alerts
 */
function LastMetricAlertIncident({rule}: {rule: MetricAlert}) {
  if (!rule.latestIncident) {
    return t('Alert not triggered yet');
  }

  const activeIncident = hasActiveIncident(rule);
  if (activeIncident) {
    return (
      <div>
        {t('Triggered ')}
        <TimeSince date={rule.latestIncident.dateCreated} />
      </div>
    );
  }

  return (
    <div>
      {t('Resolved ')}
      <TimeSince date={rule.latestIncident.dateClosed!} />
    </div>
  );
}

export default function AlertLastIncidentActivationInfo({rule}: Props) {
  // eslint-disable-next-line default-case
  switch (rule.type) {
    case CombinedAlertType.UPTIME:
      return <LastUptimeIncident rule={rule} />;
    case CombinedAlertType.ISSUE:
      return <LastIssueTrigger rule={rule} />;
    case CombinedAlertType.METRIC:
      return <LastMetricAlertIncident rule={rule} />;
  }
}
