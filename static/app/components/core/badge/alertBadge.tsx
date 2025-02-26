import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {
  IconCheckmark,
  IconExclamation,
  IconFire,
  IconIssues,
  IconPause,
} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {IncidentStatus} from 'sentry/views/alerts/types';

import {withChonk} from '../../../utils/theme/withChonk';

import {ChonkAlertBadgeDiamondBackground} from './alertBadge.chonk';

export interface AlertBadgeProps {
  /**
   * Displays a "disabled" badge
   */
  isDisabled?: boolean;
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
}

/**
 * This badge is a composition of DiamondStatus specifically used for incident
 * alerts.
 */
export function AlertBadge(props: AlertBadgeProps) {
  const theme = useTheme();
  const {text, icon: Icon} = getDiamondTheme(
    props.status,
    props.isIssue,
    props.isDisabled,
    theme
  );

  return (
    <PaddedContainer data-test-id="alert-badge" align="center" gap={space(1.5)}>
      <DiamondBackground
        {...props}
        role="presentation"
        aria-label={!props.withText ? text : undefined}
      >
        <Icon width={13} height={13} />
      </DiamondBackground>
      {props.withText && <div>{text}</div>}
    </PaddedContainer>
  );
}

function getDiamondTheme(
  status: AlertBadgeProps['status'],
  isIssue: AlertBadgeProps['isIssue'],
  isDisabled: AlertBadgeProps['isDisabled'],
  theme: Theme
): {
  backgroundColor: string;
  icon: React.ComponentType<SVGIconProps>;
  text: string;
} {
  if (isDisabled) {
    return {text: t('Disabled'), backgroundColor: theme.disabled, icon: IconPause};
  }
  if (isIssue) {
    return {
      text: t('Issue'),
      backgroundColor: theme.subText,
      // @TODO(jonasbadalic): why does the issues icon height need to be adjusted?
      icon: (props: SVGIconProps) => <IconIssues width={13} height={13} {...props} />,
    };
  }
  if (status === IncidentStatus.CRITICAL) {
    return {text: t('Critical'), backgroundColor: theme.errorText, icon: IconFire};
  }
  if (status === IncidentStatus.WARNING) {
    return {
      text: t('Warning'),
      backgroundColor: theme.warningText,
      icon: IconExclamation,
    };
  }
  return {text: t('Resolved'), backgroundColor: theme.successText, icon: IconCheckmark};
}

const PaddedContainer = styled(Flex)`
  /* @TODO(jonasbadalic): This used to be sized by the oversized icon inside it */
  padding: 5px 4px;
`;

const DiamondBackground = withChonk(
  styled('div')<AlertBadgeProps>`
    background-color: ${p =>
      getDiamondTheme(p.status, p.isIssue, p.isDisabled, p.theme).backgroundColor};
    width: 26px;
    height: 26px;

    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 2px;
    transform: rotate(45deg);

    > svg {
      width: 13px;
      height: 13px;
      transform: rotate(-45deg);
      color: ${p => p.theme.white};
    }
  `,
  ChonkAlertBadgeDiamondBackground,
  p => p
);
