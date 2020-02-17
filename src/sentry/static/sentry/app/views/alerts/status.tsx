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

const Status = ({className, incident, isSmall}: Props) => {
  const {status} = incident;
  const isIncidentOpen = status !== IncidentStatus.CLOSED;
  const isResolved = status === IncidentStatus.CLOSED;
  const isWarning = status === IncidentStatus.WARNING;

  const icon = isResolved
    ? 'icon-circle-check'
    : isWarning
    ? 'icon-warning-sm'
    : 'icon-circle-exclamation';

  const text = isResolved ? t('Resolved') : isWarning ? t('Warning') : t('Critical');

  return (
    <Wrapper className={className} isSmall={!!isSmall}>
      <Icon src={icon} status={status} isOpen={isIncidentOpen} />
      {text}
    </Wrapper>
  );
};

export default Status;

type WrapperProps = {status: IncidentStatus};

function getColor({theme, status}) {
  if (status === IncidentStatus.CLOSED) {
    return theme.greenDark;
  } else if (status === IncidentStatus.WARNING) {
    return theme.yellowDark;
  }

  return theme.redDark;
}

const Wrapper = styled('div')<{isSmall: boolean}>`
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
