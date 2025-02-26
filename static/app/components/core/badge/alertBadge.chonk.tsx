import {css, type DO_NOT_USE_ChonkTheme, type SerializedStyles} from '@emotion/react';

import type {AlertBadgeProps} from 'sentry/components/core/badge/alertBadge';
import {chonkStyled} from 'sentry/utils/theme/theme.chonk';
import {IncidentStatus} from 'sentry/views/alerts/types';

function makeChonkAlertBadgeDiamondBackgroundTheme(
  status: AlertBadgeProps['status'],
  isIssue: AlertBadgeProps['isIssue'],
  isDisabled: AlertBadgeProps['isDisabled'],
  theme: DO_NOT_USE_ChonkTheme
): SerializedStyles {
  if (isDisabled) {
    return css`
      color: ${theme.textColor};
      background: ${theme.colors.dynamic.surface500};
      border: 1px solid ${theme.colors.dynamic.surface100};
    `;
  }
  if (isIssue) {
    return css`
      color: ${theme.textColor};
      background: ${theme.colors.dynamic.surface500};
      border: 1px solid ${theme.colors.dynamic.surface100};
    `;
  }
  if (status === IncidentStatus.CRITICAL) {
    return css`
      color: ${theme.colors.static.white};
      background: ${theme.colors.static.red400};
      border: 1px solid ${theme.colors.dynamic.red100};
    `;
  }
  if (status === IncidentStatus.WARNING) {
    return css`
      color: ${theme.colors.static.black};
      background: ${theme.colors.static.yellow400};
      border: 1px solid ${theme.colors.dynamic.yellow100};
    `;
  }
  return css`
    color: ${theme.colors.static.black};
    background: ${theme.colors.static.green400};
    border: 1px solid ${theme.colors.dynamic.green100};
  `;
}

export const ChonkAlertBadgeDiamondBackground = chonkStyled('div')<AlertBadgeProps>`
  ${p => makeChonkAlertBadgeDiamondBackgroundTheme(p.status, p.isIssue, p.isDisabled, p.theme)};

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
