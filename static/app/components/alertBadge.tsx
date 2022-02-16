import styled from '@emotion/styled';

import {
  IconAlertCritical,
  IconAlertIssues,
  IconAlertResolved,
  IconAlertWarning,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Color} from 'sentry/utils/theme';

import {IncidentStatus} from '../views/alerts/types';

type Props = {
  hideText?: boolean;
  isIssue?: boolean;
  status?: IncidentStatus;
};

function AlertBadge({status, hideText = false, isIssue}: Props) {
  let statusText = t('Resolved');
  let Icon = IconAlertResolved;
  let color: Color = 'green300';
  if (isIssue) {
    statusText = t('Issue');
    Icon = IconAlertIssues;
    color = 'gray300';
  } else if (status === IncidentStatus.CRITICAL) {
    statusText = t('Critical');
    Icon = IconAlertCritical;
    color = 'red300';
  } else if (status === IncidentStatus.WARNING) {
    statusText = t('Warning');
    Icon = IconAlertWarning;
    color = 'yellow300';
  }

  return (
    <Wrapper data-test-id="alert-badge">
      <AlertIconWrapper color={color} icon={Icon}>
        <Icon color="white" size="xl" />
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
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  left: 3px;
  min-width: 30px;
`;

const IncidentStatusValue = styled('div')`
  margin-left: ${space(1.5)};
`;
