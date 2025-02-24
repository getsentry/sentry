import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {HighlightComponent} from 'sentry/components/highlight';
import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import {space} from 'sentry/styles/space';
import {unreachable} from 'sentry/utils/unreachable';
import {SeverityLevel} from 'sentry/views/explore/logs/utils';

export const StyledPanel = styled(Panel)`
  margin-bottom: 0px;
`;

export const StyledPanelHeader = styled(PanelHeader)<{align: 'left' | 'right'}>`
  white-space: nowrap;
  justify-content: ${p => (p.align === 'left' ? 'flex-start' : 'flex-end')};
`;

export const StyledPanelItem = styled(PanelItem)<{
  align?: 'left' | 'center' | 'right';
  overflow?: boolean;
  span?: number;
}>`
  align-items: center;
  padding: ${space(1)} ${space(1)};
  ${p => (p.align === 'left' ? 'justify-content: flex-start;' : null)}
  ${p => (p.align === 'right' ? 'justify-content: flex-end;' : null)}
  ${p => (p.overflow ? p.theme.overflowEllipsis : null)};
  ${p =>
    p.align === 'center'
      ? `
  justify-content: space-around;`
      : p.align === 'left' || p.align === 'right'
        ? `text-align: ${p.align};`
        : undefined}
  ${p => p.span && `grid-column: auto / span ${p.span};`}
  white-space: nowrap;
`;

export const LogPanelContent = styled('div')`
  width: 100%;
  display: grid;
  grid-template-columns: min-content auto min-content;
`;

export const LogRowContent = styled('div')`
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const DetailsWrapper = styled(StyledPanelItem)`
  background-color: ${p => p.theme.gray100};
  flex-direction: column;
`;

export const DetailsGrid = styled(StyledPanel)`
  display: grid;
  grid-template-columns: 1fr;
  width: 100%;
  gap: ${space(1)} ${space(2)};
  border-bottom: 0;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  padding: ${space(1)} ${space(2)};
`;

export const DetailsSubGrid = styled('div')`
  display: grid;
  grid-template-columns: min-content min-content;
`;

export const DetailsFooter = styled(StyledPanelItem)<{
  logColors: ReturnType<typeof getLogColors>;
  opaque?: boolean;
}>`
  width: 100%;
  padding: ${space(1)} ${space(2)};
  color: ${p => p.logColors.color};

  &:last-child {
    border: 1px solid ${p => p.logColors.border};
  }

  border-bottom-left-radius: ${p => p.theme.borderRadius};
  border-bottom-right-radius: ${p => p.theme.borderRadius};

  background: ${p =>
    p.opaque
      ? `linear-gradient(
          ${p.logColors.backgroundLight},
          ${p.logColors.backgroundLight}),
          linear-gradient(${p.theme.background}, ${p.theme.background}
        )`
      : `
          ${p.logColors.backgroundLight}
        `};
`;

export const DetailsLabel = styled('div')`
  font-weight: 600;
  min-width: 100px;
  color: ${p => p.theme.gray300};
`;

export const DetailsValue = styled('div')`
  word-break: break-word;
`;

export const StyledChevronButton = styled(Button)`
  margin-right: ${space(0.5)};
`;

const DEFAULT_SIZE = '8px';

export const ColoredLogCircle = styled('span')<{
  logColors: ReturnType<typeof getLogColors>;
  size?: string;
}>`
  padding: 0;
  position: relative;
  width: ${p => p.size || DEFAULT_SIZE};
  height: ${p => p.size || DEFAULT_SIZE};
  margin-right: ${space(0.5)};
  text-indent: -9999em;
  display: inline-block;
  border-radius: 50%;
  flex-shrink: 0;
  background-color: ${p => p.logColors.background};
`;

export const ColoredLogText = styled('span')<{
  logColors: ReturnType<typeof getLogColors>;
}>`
  color: ${p => p.logColors.color};
  font-weight: ${p => p.theme.fontWeightBold};
  font-family: ${p => p.theme.text.familyMono};
`;

export const LogDate = styled('span')`
  color: ${p => p.theme.gray300};
`;

export const LogsHighlight = styled(HighlightComponent)`
  font-weight: ${p => p.theme.fontWeightBold};
  background-color: ${p => p.theme.gray200};
  margin-right: 2px;
  margin-left: 2px;
`;

export const WrappingText = styled('div')<{wrap?: boolean}>`
  width: 100%;
  ${p => p.theme.overflowEllipsis};
  ${p => p.wrap && 'text-wrap: auto;'}
`;

export function getLogColors(level: SeverityLevel, theme: Theme) {
  switch (level) {
    case SeverityLevel.DEFAULT:
      return {
        background: theme.gray200,
        backgroundLight: theme.backgroundSecondary,
        border: theme.border,
        borderHover: theme.border,
        color: theme.gray200,
      };
    case SeverityLevel.TRACE:
      return {
        background: theme.blue300,
        backgroundLight: theme.blue100,
        border: theme.blue200,
        borderHover: theme.blue300,
        color: theme.blue400,
      };
    case SeverityLevel.WARN:
      return {
        background: theme.yellow300,
        backgroundLight: theme.yellow100,
        border: theme.yellow200,
        borderHover: theme.yellow300,
        color: theme.yellow400,
      };
    case SeverityLevel.ERROR:
      // All these colours are likely changing, so we'll hold off moving them into theme for now.
      return {
        background: '#FF7738', // Matches the legacy error level color
        backgroundLight: 'rgba(245, 113, 54, 0.11)',
        border: 'rgba(245, 113, 54, 0.55)',
        borderHover: '#FF7738',
        color: '#b34814',
      };
    case SeverityLevel.FATAL:
      return {
        background: theme.red300,
        backgroundLight: theme.red100,
        border: theme.red200,
        borderHover: theme.red300,
        color: theme.red400,
      };
    case SeverityLevel.DEBUG:
      return {
        background: theme.gray300,
        backgroundLight: theme.gray100,
        border: theme.gray200,
        borderHover: theme.gray300,
        color: theme.gray300,
      };
    case SeverityLevel.INFO:
      return {
        background: theme.blue300,
        backgroundLight: theme.blue100,
        border: theme.blue200,
        borderHover: theme.blue300,
        color: theme.blue400,
      };
    case SeverityLevel.UNKNOWN:
      return {
        background: theme.gray300,
        backgroundLight: theme.gray100,
        border: theme.gray200,
        borderHover: theme.gray300,
        color: theme.gray200,
      };
    default:
      unreachable(level);
      throw new Error(`Invalid log type, got ${level}`);
  }
}
