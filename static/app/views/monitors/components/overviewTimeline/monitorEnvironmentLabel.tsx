import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import {
  type Monitor,
  type MonitorEnvironment,
  MonitorStatus,
} from 'sentry/views/monitors/types';
import {statusIconColorMap} from 'sentry/views/monitors/utils/constants';

interface Props {
  monitor: Monitor;
  monitorEnv: MonitorEnvironment;
}

export default function MonitorEnvironmentLabel({monitorEnv, monitor}: Props) {
  const {name, status, isMuted} = monitorEnv;
  const envStatus = monitor.isMuted || isMuted ? MonitorStatus.DISABLED : status;
  const {label, icon} = statusIconColorMap[envStatus];
  return (
    <EnvWithStatus>
      <MonitorEnvLabel status={envStatus}>{name}</MonitorEnvLabel>
      <Tooltip title={label} skipWrapper>
        {icon}
      </Tooltip>
    </EnvWithStatus>
  );
}

const EnvWithStatus = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  gap: ${space(0.5)};
  align-items: center;
  opacity: var(--disabled-opacity);
`;

const MonitorEnvLabel = styled('div')<{status: MonitorStatus}>`
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  min-width: 0;

  color: ${p => p.theme[statusIconColorMap[p.status].color]};
  opacity: var(--disabled-opacity);
`;
