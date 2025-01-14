import AlertBadge from 'sentry/components/badge/alertBadge';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {UptimeMonitorStatus} from 'sentry/views/alerts/rules/uptime/types';
import {
  type CombinedAlerts,
  CombinedAlertType,
  IncidentStatus,
} from 'sentry/views/alerts/types';
import {isIssueAlert} from 'sentry/views/alerts/utils';

interface Props {
  rule: CombinedAlerts;
}

const IncidentStatusText: Record<IncidentStatus, string> = {
  [IncidentStatus.CRITICAL]: t('Critical'),
  [IncidentStatus.WARNING]: t('Warning'),
  [IncidentStatus.CLOSED]: t('Resolved'),
  [IncidentStatus.OPENED]: t('Open'),
};

const UptimeStatusText: Record<
  UptimeMonitorStatus,
  {incidentStatus: IncidentStatus; statusText: string}
> = {
  [UptimeMonitorStatus.OK]: {statusText: t('Up'), incidentStatus: IncidentStatus.CLOSED},
  [UptimeMonitorStatus.FAILED]: {
    statusText: t('Down'),
    incidentStatus: IncidentStatus.WARNING,
  },
};

/**
 * Takes in an alert rule (activated metric, metric, issue) and renders the
 * appropriate tooltip and AlertBadge
 */
export default function CombinedAlertBadge({rule}: Props) {
  if (rule.type === CombinedAlertType.UPTIME) {
    const {statusText, incidentStatus} = UptimeStatusText[rule.status];
    return (
      <Tooltip title={tct('Uptime Alert Status: [statusText]', {statusText})}>
        <AlertBadge status={incidentStatus} />
      </Tooltip>
    );
  }

  return (
    <Tooltip
      title={
        isIssueAlert(rule)
          ? t('Issue Alert')
          : tct('Metric Alert Status: [status]', {
              status:
                IncidentStatusText[rule?.latestIncident?.status ?? IncidentStatus.CLOSED],
            })
      }
    >
      <AlertBadge status={rule?.latestIncident?.status} isIssue={isIssueAlert(rule)} />
    </Tooltip>
  );
}
