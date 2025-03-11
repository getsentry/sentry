import type {DO_NOT_USE_ChonkTheme} from '@emotion/react';

import type {AlertBadgeProps} from 'sentry/components/core/badge/alertBadge';
import {chonkStyled} from 'sentry/utils/theme/theme.chonk';
import {IncidentStatus} from 'sentry/views/alerts/types';

function makeChonkAlertBadgeDiamondBackgroundTheme(
  status: AlertBadgeProps['status'],
  isIssue: AlertBadgeProps['isIssue'],
  isDisabled: AlertBadgeProps['isDisabled'],
  theme: DO_NOT_USE_ChonkTheme
): React.CSSProperties {
  if (isDisabled) {
    return {
      color: theme.textColor,
      background: theme.colors.surface500,
      border: `1px solid ${theme.colors.surface100}`,
    };
  }
  if (isIssue) {
    return {
      color: theme.textColor,
      background: theme.colors.surface500,
      border: `1px solid ${theme.colors.surface100}`,
    };
  }
  if (status === IncidentStatus.CRITICAL) {
    return {
      color: theme.colors.white,
      background: theme.colors.chonk.red400,
      border: `1px solid ${theme.colors.chonk.red100}`,
    };
  }
  if (status === IncidentStatus.WARNING) {
    return {
      color: theme.colors.black,
      background: theme.colors.chonk.yellow400,
      border: `1px solid ${theme.colors.chonk.yellow100}`,
    };
  }
  return {
    color: theme.colors.black,
    background: theme.colors.chonk.green400,
    border: `1px solid ${theme.colors.chonk.green100}`,
  };
}

export const ChonkAlertBadgeDiamondBackground = chonkStyled('div')<AlertBadgeProps>`
  ${p => ({
    ...makeChonkAlertBadgeDiamondBackgroundTheme(
      p.status,
      p.isIssue,
      p.isDisabled,
      p.theme
    ),
  })};

  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${p => p.theme.radius.mini};

  > svg {
    width: 13px;
    height: 13px;
  }
`;
