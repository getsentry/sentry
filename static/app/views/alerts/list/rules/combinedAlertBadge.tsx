import AlertBadge from 'sentry/components/badge/alertBadge';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {MonitorType} from 'sentry/types/alerts';
import {
  ActivationStatus,
  type CombinedMetricIssueAlerts,
  IncidentStatus,
} from 'sentry/views/alerts/types';
import {isIssueAlert} from 'sentry/views/alerts/utils';

interface Props {
  rule: CombinedMetricIssueAlerts;
}

const IncidentStatusText: Record<IncidentStatus, string> = {
  [IncidentStatus.CRITICAL]: t('Critical'),
  [IncidentStatus.WARNING]: t('Warning'),
  [IncidentStatus.CLOSED]: t('Resolved'),
  [IncidentStatus.OPENED]: t('Open'),
};

/**
 * Takes in an alert rule (activated metric, metric, issue) and renders the
 * appropriate tooltip and AlertBadge
 */
export default function CombinedAlertBadge({rule}: Props) {
  const isIssueAlertInstance = isIssueAlert(rule);

  if (!isIssueAlertInstance && rule.monitorType === MonitorType.ACTIVATED) {
    const isWaiting =
      !rule.activations?.length ||
      (rule.activations?.length && rule.activations[0].isComplete);

    return (
      <Tooltip
        title={tct('Metric Alert Status: [status]', {
          status: isWaiting ? 'Ready to monitor' : 'Monitoring',
        })}
      >
        <AlertBadge
          status={rule?.latestIncident?.status}
          activationStatus={
            isWaiting ? ActivationStatus.WAITING : ActivationStatus.MONITORING
          }
        />
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
