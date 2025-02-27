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
      background: theme.colors.dynamic.surface500,
      border: `1px solid ${theme.colors.dynamic.surface100}`,
    };
  }
  if (isIssue) {
    return {
      color: theme.textColor,
      background: theme.colors.dynamic.surface500,
      border: `1px solid ${theme.colors.dynamic.surface100}`,
    };
  }
  if (status === IncidentStatus.CRITICAL) {
    return {
      color: theme.colors.static.white,
      background: theme.colors.static.red400,
      border: `1px solid ${theme.colors.dynamic.red100}`,
    };
  }
  if (status === IncidentStatus.WARNING) {
    return {
      color: theme.colors.static.black,
      background: theme.colors.static.yellow400,
      border: `1px solid ${theme.colors.dynamic.yellow100}`,
    };
  }
  return {
    color: theme.colors.static.black,
    background: theme.colors.static.green400,
    border: `1px solid ${theme.colors.dynamic.green100}`,
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
