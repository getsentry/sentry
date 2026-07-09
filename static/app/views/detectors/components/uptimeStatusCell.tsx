import type {ReactNode} from 'react';

import {AlertBadge} from '@sentry/scraps/badge';
import {Tooltip} from '@sentry/scraps/tooltip';

import {TimeSince} from 'sentry/components/timeSince';
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
  const isFailing = detector.uptimeStatus === UptimeMonitorStatus.FAILED;
  const lastChanged = detector.uptimeStatusLastChanged;

  let title: ReactNode;
  if (disabled) {
    title = t('Uptime monitor disabled');
  } else if (isFailing && lastChanged) {
    // Show how long the monitor has been failing so it can be triaged from the
    // list without opening the monitor.
    title = tct('Failing for [duration]', {
      duration: <TimeSince date={lastChanged} suffix="" unitStyle="short" />,
    });
  } else {
    title = tct('Uptime monitor status: [statusText]', {statusText});
  }

  return (
    <Tooltip title={title}>
      <AlertBadge status={incidentStatus} isDisabled={disabled} />
    </Tooltip>
  );
}
