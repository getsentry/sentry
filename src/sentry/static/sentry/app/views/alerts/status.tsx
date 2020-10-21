import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';
import {IconCheckmark, IconWarning, IconFire} from 'app/icons';

import {Incident, IncidentStatus} from './types';

type Props = {
  className?: string;
  incident: Incident;
  /**
   * Use inherited color for icons
   */
  disableIconColor?: boolean;
};

const Status = ({className, incident, disableIconColor}: Props) => {
  const {status} = incident;
  const isResolved = status === IncidentStatus.CLOSED;
  const isWarning = status === IncidentStatus.WARNING;

  const icon = isResolved ? (
    <IconCheckmark color={disableIconColor ? undefined : 'green400'} />
  ) : isWarning ? (
    <IconWarning color={disableIconColor ? undefined : 'orange400'} />
  ) : (
    <IconFire color={disableIconColor ? undefined : 'red400'} />
  );

  const text = isResolved ? t('Resolved') : isWarning ? t('Warning') : t('Critical');

  return (
    <Wrapper className={className}>
      <Icon>{icon}</Icon>
      {text}
    </Wrapper>
  );
};

export default Status;

const Wrapper = styled('div')`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  grid-template-columns: auto 1fr;
  grid-gap: ${space(0.75)};
`;

const Icon = styled('span')`
  margin-bottom: -3px;
`;
