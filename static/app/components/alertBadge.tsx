import styled from '@emotion/styled';

import {
  IconCheckmark,
  IconDiamond,
  IconExclamation,
  IconFire,
  IconIssues,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Color} from 'sentry/utils/theme';
import {IncidentStatus} from 'sentry/views/alerts/types';

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
    <Wrapper data-test-id="alert-badge">
      <AlertIconWrapper color={color} icon={Icon}>
        <AlertIconBackground color={color} />
        <Icon color="white" />
      </AlertIconWrapper>

      {!hideText && <IncidentStatusValue color={color}>{statusText}</IncidentStatusValue>}
    </Wrapper>
  );
}

export default AlertBadge;

const Wrapper = styled('div')`
  display: flex;
  align-items: center;
`;

const AlertIconWrapper = styled('div')<{color: Color; icon: React.ReactNode}>`
  width: 36px;
  height: 36px;
  position: relative;

  svg:last-child {
    width: ${p => (p.icon === IconIssues ? '13px' : '16px')};
    z-index: 2;
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    margin: auto;
  }
`;

const AlertIconBackground = styled(IconDiamond)<{color: Color}>`
  width: 36px;
  height: 36px;
`;

const IncidentStatusValue = styled('div')`
  margin-left: ${space(1)};
`;
