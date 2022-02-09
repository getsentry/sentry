import styled from '@emotion/styled';

import {IconCheckmark, IconExclamation, IconFire, IconIssues} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Color} from 'sentry/utils/theme';

import {IncidentStatus} from './types';

type Props = {
  hideText?: boolean;
  isIssue?: boolean;
  status?: IncidentStatus;
};

function AlertBadge({status, hideText = false, isIssue}: Props) {
  let statusText = t('Resolved');
  let Icon = IconCheckmark;
  let color: Color = 'green300';
  if (isIssue) {
    statusText = t('Issue');
    Icon = IconIssues;
    color = 'gray300';
  } else if (status === IncidentStatus.CRITICAL) {
    statusText = t('Critical');
    Icon = IconFire;
    color = 'red300';
  } else if (status === IncidentStatus.WARNING) {
    statusText = t('Warning');
    Icon = IconExclamation;
    color = 'yellow300';
  }

  return (
    <Wrapper data-test-id="alert-badge" displayFlex={!hideText}>
      <AlertIconWrapper color={color} icon={Icon}>
        <Icon color="white" />
      </AlertIconWrapper>

      {!hideText && <IncidentStatusValue color={color}>{statusText}</IncidentStatusValue>}
    </Wrapper>
  );
}

export default AlertBadge;

const Wrapper = styled('div')<{displayFlex: boolean}>`
  display: ${p => (p.displayFlex ? `flex` : `block`)};
  align-items: center;
`;

const AlertIconWrapper = styled('div')<{color: Color; icon: React.ReactNode}>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  left: 3px;
  min-width: 30px;

  &:before {
    content: '';
    position: absolute;
    width: 28px;
    height: 28px;
    border-radius: ${p => p.theme.borderRadius};
    background-color: ${p => p.theme[p.color]};
    transform: rotate(45deg);
  }

  svg {
    width: ${p => (p.icon === IconIssues ? '13px' : '16px')};
    z-index: 1;
  }
`;

const IncidentStatusValue = styled('div')<{color: Color}>`
  margin-left: ${space(1)};
  color: ${p => p.theme[p.color]};
`;
