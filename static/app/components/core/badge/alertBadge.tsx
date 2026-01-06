import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {
  IconCheckmark,
  IconExclamation,
  IconFire,
  IconIssues,
  IconPause,
} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import {IncidentStatus} from 'sentry/views/alerts/types';

interface AlertBadgeProps {
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
    <PaddedContainer data-test-id="alert-badge" align="center" gap="lg">
      <DiamondBackground
        {...props}
        role="presentation"
        aria-label={props.withText ? undefined : text}
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
      backgroundColor: theme.tokens.content.warning,
      icon: IconExclamation,
    };
  }
  return {text: t('Resolved'), backgroundColor: theme.successText, icon: IconCheckmark};
}

function makeAlertBadgeDiamondBackgroundTheme(
  status: AlertBadgeProps['status'],
  isIssue: AlertBadgeProps['isIssue'],
  isDisabled: AlertBadgeProps['isDisabled'],
  theme: Theme
): React.CSSProperties {
  if (isDisabled) {
    return {
      color: theme.tokens.content.primary,
      background: theme.colors.surface500,
      border: `1px solid ${theme.colors.surface100}`,
    };
  }
  if (isIssue) {
    return {
      color: theme.tokens.content.primary,
      background: theme.colors.surface500,
      border: `1px solid ${theme.colors.surface100}`,
    };
  }
  if (status === IncidentStatus.CRITICAL) {
    return {
      color: theme.colors.white,
      background: theme.colors.chonk.red400,
      border: `1px solid ${theme.colors.red100}`,
    };
  }
  if (status === IncidentStatus.WARNING) {
    return {
      color: theme.colors.black,
      background: theme.colors.chonk.yellow400,
      border: `1px solid ${theme.colors.yellow100}`,
    };
  }
  return {
    color: theme.colors.black,
    background: theme.colors.chonk.green400,
    border: `1px solid ${theme.colors.green100}`,
  };
}

const PaddedContainer = styled(Flex)`
  /* @TODO(jonasbadalic): This used to be sized by the oversized icon inside it */
  padding: 5px 4px;
`;

const DiamondBackground = styled('div')<AlertBadgeProps>`
  ${p => ({
    ...makeAlertBadgeDiamondBackgroundTheme(p.status, p.isIssue, p.isDisabled, p.theme),
  })};

  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${p => p.theme.radius.xs};

  > svg {
    width: 13px;
    height: 13px;
  }
`;
