import AlertBadge from 'sentry/components/badge/alertBadge';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {getAggregateEnvStatus} from 'sentry/views/alerts/rules/crons/utils';
import {UptimeMonitorStatus} from 'sentry/views/alerts/rules/uptime/types';
import {
  type CombinedAlerts,
  CombinedAlertType,
  IncidentStatus,
} from 'sentry/views/alerts/types';
import {isIssueAlert} from 'sentry/views/alerts/utils';
import {MonitorStatus} from 'sentry/views/monitors/types';

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

const CronsStatusText: Record<
  MonitorStatus,
  {statusText: string; disabled?: boolean; incidentStatus?: IncidentStatus}
> = {
  [MonitorStatus.ACTIVE]: {
    statusText: t('Active'),
    incidentStatus: IncidentStatus.CLOSED,
  },
  [MonitorStatus.OK]: {statusText: t('Ok'), incidentStatus: IncidentStatus.CLOSED},
  [MonitorStatus.ERROR]: {
    statusText: t('Failing'),
    incidentStatus: IncidentStatus.CRITICAL,
  },
  [MonitorStatus.DISABLED]: {
    statusText: t('Disabled'),
    disabled: true,
  },
};

/**
 * Takes in an alert rule (metric or issue) and renders the
 * appropriate tooltip and AlertBadge
 */
export default function CombinedAlertBadge({rule}: Props) {
  if (rule.type === CombinedAlertType.UPTIME) {
    const {statusText, incidentStatus} = UptimeStatusText[rule.uptimeStatus];
    const disabled = rule.status === 'disabled';
    return (
      <Tooltip
        title={
          disabled
            ? t('Uptime monitor disabled')
            : tct('Uptime Alert Status: [statusText]', {statusText})
        }
      >
        <AlertBadge status={incidentStatus} isDisabled={disabled} />
      </Tooltip>
    );
  }

  if (rule.type === CombinedAlertType.CRONS) {
    const envStatus = getAggregateEnvStatus(rule.environments);
    const {statusText, incidentStatus, disabled} = CronsStatusText[envStatus];
    return (
      <Tooltip
        title={
          disabled
            ? t('Cron Monitor Disabled')
            : tct('Cron Monitor Status: [statusText]', {statusText})
        }
      >
        <AlertBadge status={incidentStatus} isDisabled={disabled} />
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
