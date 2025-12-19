import styled from '@emotion/styled';

import {Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import {
  IconCheckmark,
  IconFire,
  IconFix,
  IconMute,
  IconTimer,
  IconUnsubscribed,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  MonitorStatus,
  type MonitorEnvironment,
  type StatusNotice,
} from 'sentry/views/insights/crons/types';

interface Props {
  monitorEnv: MonitorEnvironment;
}

const statusIconColorMap: Record<MonitorStatus, StatusNotice> = {
  ok: {
    icon: <IconCheckmark variant="success" />,
    variant: 'success',
  },
  error: {
    icon: <IconFire variant="danger" />,
    variant: 'danger',
  },
  active: {
    icon: <IconTimer variant="muted" />,
    variant: 'muted',
    label: t('Waiting For Check-In'),
  },
  disabled: {
    icon: <IconUnsubscribed variant="muted" size="xs" />,
    variant: 'muted',
    label: t('Muted'),
  },
};

const userNotifiedDisplay: StatusNotice = {
  label: t(
    'This environment is likely broken due to being in an error state for multiple days.'
  ),
  icon: <IconFix variant="muted" />,
  variant: 'muted',
};

const envMutedDisplay: StatusNotice = {
  label: t(
    'This environment is likely broken due to being in an error state for multiple days. It has been automatically muted.'
  ),
  icon: <IconMute variant="muted" />,
  variant: 'muted',
};

export default function MonitorEnvironmentLabel({monitorEnv}: Props) {
  const {name, status, isMuted, activeIncident} = monitorEnv;
  const {userNotifiedTimestamp, environmentMutedTimestamp} =
    activeIncident?.brokenNotice ?? {};
  const envStatus = isMuted ? MonitorStatus.DISABLED : status;
  const {label, icon, variant} = environmentMutedTimestamp
    ? envMutedDisplay
    : userNotifiedTimestamp
      ? userNotifiedDisplay
      : statusIconColorMap[envStatus];

  return (
    <EnvWithStatus>
      <Tooltip skipWrapper showOnlyOnOverflow title={name}>
        <MonitorEnvLabel>
          <Text variant={variant}>{name}</Text>
        </MonitorEnvLabel>
      </Tooltip>
      <Tooltip disabled={!label} title={label} skipWrapper>
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

const MonitorEnvLabel = styled('div')`
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  min-width: 0;

  opacity: var(--disabled-opacity);
`;
