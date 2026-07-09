import {AlertBadge} from '@sentry/scraps/badge';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t, tct} from 'sentry/locale';
import type {UptimeDetector} from 'sentry/types/workflowEngine/detectors';
import {UptimeMonitorStatus} from 'sentry/views/alerts/rules/uptime/types';
import {IncidentStatus} from 'sentry/views/alerts/types';

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

export function UptimeStatusCell({detector}: {detector: UptimeDetector}) {
  const config = UptimeStatusText[detector.uptimeStatus];
  if (!config) {
    return null;
  }

  const disabled = !detector.enabled;
  const {statusText, incidentStatus} = config;

  return (
    <Tooltip
      title={
        disabled
          ? t('Uptime monitor disabled')
          : tct('Uptime Monitor Status: [statusText]', {statusText})
      }
    >
      <AlertBadge status={incidentStatus} isDisabled={disabled} />
    </Tooltip>
  );
}
