import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';
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
import type {ColorOrAlias} from 'sentry/utils/theme';
import {
  type MonitorEnvironment,
  MonitorStatus,
  type StatusNotice,
} from 'sentry/views/monitors/types';

interface Props {
  monitorEnv: MonitorEnvironment;
}

export const statusIconColorMap: Record<MonitorStatus, StatusNotice> = {
  ok: {
    icon: <IconCheckmark color="successText" />,
    color: 'successText',
  },
  error: {
    icon: <IconFire color="errorText" />,
    color: 'errorText',
  },
  active: {
    icon: <IconTimer color="subText" />,
    color: 'subText',
    label: t('Waiting For Check-In'),
  },
  disabled: {
    icon: <IconUnsubscribed color="subText" size="xs" />,
    color: 'subText',
    label: t('Muted'),
  },
};

const userNotifiedDisplay: StatusNotice = {
  label: t(
    'This environment is likely broken due to being in an error state for multiple days.'
  ),
  icon: <IconFix color="subText" />,
  color: 'subText',
};

const envMutedDisplay: StatusNotice = {
  label: t(
    'This environment is likely broken due to being in an error state for multiple days. It has been automatically muted.'
  ),
  icon: <IconMute color="subText" />,
  color: 'subText',
};

export default function MonitorEnvironmentLabel({monitorEnv}: Props) {
  const {name, status, isMuted, activeIncident} = monitorEnv;
  const {userNotifiedTimestamp, environmentMutedTimestamp} =
    activeIncident?.brokenNotice ?? {};
  const envStatus = isMuted ? MonitorStatus.DISABLED : status;
  const {label, icon, color} = environmentMutedTimestamp
    ? envMutedDisplay
    : userNotifiedTimestamp
      ? userNotifiedDisplay
      : statusIconColorMap[envStatus];

  return (
    <EnvWithStatus>
      <MonitorEnvLabel color={color}>{name}</MonitorEnvLabel>
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

const MonitorEnvLabel = styled('div')<{color: ColorOrAlias}>`
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  min-width: 0;

  color: ${p => p.theme[p.color]};
  opacity: var(--disabled-opacity);
`;
