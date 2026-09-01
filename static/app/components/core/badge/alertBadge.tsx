import {useTheme, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {useTranslation} from '@sentry/scraps/translationContext';

import {IconCheckmark, IconFire, IconIssues, IconWarning} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {IncidentStatus} from 'sentry/views/alerts/types';

interface AlertBadgeProps {
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

type AlertBadgeStatus = IncidentStatus | 'issue';
interface AlertBadgeConfig {
  icon: React.FC<SVGIconProps>;
  style: React.CSSProperties;
  text: string;
}
function useAlertBadgeConfig(status: AlertBadgeStatus, theme: Theme): AlertBadgeConfig {
  const {t} = useTranslation();
  switch (status) {
    case 'issue':
      return {
        text: t('Issue'),
        icon: IconIssues,
        style: {
          color: theme.tokens.content.primary,
          background: theme.tokens.background.primary,
          border: `1px solid ${theme.tokens.border.primary}`,
        },
      };
    case IncidentStatus.CRITICAL:
      return {
        text: t('Critical'),
        icon: IconFire,
        style: {
          color: theme.tokens.content.onVibrant.light,
          background: theme.tokens.background.danger.vibrant,
        },
      };
    case IncidentStatus.WARNING:
      return {
        text: t('Warning'),
        icon: IconWarning,
        style: {
          color: theme.tokens.content.onVibrant.dark,
          background: theme.tokens.background.warning.vibrant,
        },
      };
    default:
      return {
        text: t('Resolved'),
        icon: IconCheckmark,
        style: {
          color: theme.tokens.content.onVibrant.dark,
          background: theme.tokens.background.success.vibrant,
        },
      };
  }
}

/**
 * This badge is a composition of DiamondStatus specifically used for incident
 * alerts.
 */
export function AlertBadge(props: AlertBadgeProps) {
  const theme = useTheme();
  const status = props.isIssue ? 'issue' : (props.status ?? IncidentStatus.CLOSED);
  const {text, icon: Icon, style} = useAlertBadgeConfig(status, theme);

  return (
    <PaddedContainer data-test-id="alert-badge" align="center" gap="lg">
      <Flex
        align="center"
        justify="center"
        role="presentation"
        width="26px"
        height="26px"
        radius="xs"
        aria-label={props.withText ? undefined : text}
        style={style}
      >
        <Icon width={13} height={13} />
      </Flex>
      {props.withText && <div>{text}</div>}
    </PaddedContainer>
  );
}

const PaddedContainer = styled(Flex)`
  /* @TODO(jonasbadalic): This used to be sized by the oversized icon inside it */
  padding: calc(${p => p.theme.space.xs} + 1px) ${p => p.theme.space.xs};
`;
