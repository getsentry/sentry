import styled from '@emotion/styled';

import {DiamondStatus} from 'sentry/components/diamondStatus';
import {
  IconCheckmark,
  IconEllipsis,
  IconExclamation,
  IconFire,
  IconIssues,
  IconShow,
} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ColorOrAlias} from 'sentry/utils/theme';
import {ActivationStatus, IncidentStatus} from 'sentry/views/alerts/types';

type Props = {
  /**
   * The rule is actively monitoring
   */
  activationStatus?: ActivationStatus;
  /**
   * @deprecated use withText
   */
  hideText?: true;
  /**
   * There is no status for issue, this is to facilitate this custom usage.
   */
  isIssue?: boolean;
  /**
   * The incident status
   */
  status?: IncidentStatus;
  /**
   * Includes a label
   */
  withText?: boolean;
};

/**
 * This badge is a composition of DiamondStatus specifically used for incident
 * alerts.
 */
function AlertBadge({status, withText, isIssue, activationStatus}: Props) {
  let statusText = t('Resolved');
  let Icon: React.ComponentType<SVGIconProps> = IconCheckmark;
  let color: ColorOrAlias = 'successText';

  if (isIssue) {
    statusText = t('Issue');
    Icon = SizedIconIssue;
    color = 'subText';
  } else if (status === IncidentStatus.CRITICAL) {
    statusText = t('Critical');
    Icon = IconFire;
    color = 'errorText';
  } else if (status === IncidentStatus.WARNING) {
    statusText = t('Warning');
    Icon = IconExclamation;
    color = 'warningText';
  }

  if (activationStatus === ActivationStatus.WAITING) {
    statusText = t('Ready');
    Icon = IconEllipsis;
    color = 'purple300';
  } else if (activationStatus === ActivationStatus.MONITORING) {
    statusText = t('Monitoring');
    Icon = IconShow;
  }

  return (
    <Wrapper data-test-id="alert-badge">
      <DiamondStatus
        icon={Icon}
        color={color}
        aria-label={!withText ? statusText : undefined}
      />
      {withText && <div>{statusText}</div>}
    </Wrapper>
  );
}

export default AlertBadge;

/**
 * The size of the issue icon needs to be marginally adjusted to fit into the diamond well
 */
const SizedIconIssue = styled(IconIssues)`
  width: 13px;
`;

const Wrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
