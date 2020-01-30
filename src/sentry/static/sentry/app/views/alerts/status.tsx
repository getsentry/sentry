import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';

import {Incident, IncidentStatus} from './types';

type Props = {
  className?: string;
  incident: Incident;
  isSmall?: boolean;
};

const Status: React.FC<Props> = ({className, incident, isSmall}: Props) => {
  const isIncidentOpen = incident.status !== IncidentStatus.CLOSED;

  // TODO(incidents): Make this work
  const status = !isIncidentOpen
    ? 'resolved'
    : incident.status === IncidentStatus.CREATED
    ? 'critical'
    : 'warning';
  const isResolved = status === 'resolved';
  const isCritical = status === 'critical';

  const icon = isResolved
    ? 'icon-circle-check'
    : isCritical
    ? 'icon-circle-exclamation'
    : 'icon-warning-sm';

  const text = isResolved ? t('Resolved') : isCritical ? t('Critical') : t('Warning');

  return (
    <Wrapper status={status} className={className} isSmall={!!isSmall}>
      <Icon src={icon} status={status} isOpen={isIncidentOpen} />
      {text}
    </Wrapper>
  );
};

export default Status;

type StatusType = 'warning' | 'critical' | 'resolved';

type WrapperProps = {status: StatusType};

function getColor({theme, status}) {
  if (status === 'resolved') {
    return theme.greenDark;
  } else if (status === 'warning') {
    return theme.yellowDark;
  }

  return theme.redDark;
}

const Wrapper = styled('div')<WrapperProps & {isSmall: boolean}>`
  display: flex;
  align-items: center;
  justify-self: flex-start;
  ${p => p.isSmall && `font-size: ${p.theme.fontSizeSmall};`};
`;

const Icon = styled(InlineSvg)<WrapperProps & {isOpen: boolean}>`
  color: ${getColor};
  margin-right: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeMedium};
`;
