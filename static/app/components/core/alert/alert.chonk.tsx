import type {SerializedStyles, Theme} from '@emotion/react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {AlertProps} from 'sentry/components/core/alert';
import {unreachable} from 'sentry/utils/unreachable';

interface ChonkAlertProps extends Omit<AlertProps, 'type'> {
  type: 'subtle' | 'info' | 'warning' | 'success' | 'danger';
}

export const AlertPanel = styled('div')<ChonkAlertProps>`
  position: relative;
  display: grid;
  grid-template-columns: ${p => getAlertGridLayout(p)};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  border-width: ${p => (p.system ? '0px 0px 1px 0px' : '1px')};
  border-style: solid;
  border-radius: ${p => (p.system ? '0px' : p.theme.radius.md)};
  cursor: ${p => (p.expand ? 'pointer' : 'inherit')};
  gap: ${p => p.theme.space.lg};
  row-gap: 0;
  overflow: hidden;
  min-height: 44px;
  ${props => makeChonkAlertTheme(props, props.theme)};

  a:not([role='button']) {
    text-decoration: underline;
  }
`;

function getAlertGridLayout(p: ChonkAlertProps) {
  return `1fr ${p.trailingItems ? 'auto' : ''} ${p.expand ? 'min-content' : ''}`;
}

function makeChonkAlertTheme(props: ChonkAlertProps, theme: Theme): SerializedStyles {
  const tokens = getChonkAlertTokens(props.type, theme);
  return css`
    ${generateAlertBackground(props, tokens, theme)};
    border-color: ${tokens.border};

    /* We dont want to override the color of any elements inside buttons */
    :not(button *) {
      color: ${theme.tokens.content.primary};
    }
  `;
}

function getChonkAlertTokens(type: ChonkAlertProps['type'], theme: Theme) {
  switch (type) {
    case 'info':
      return {
        background: theme.colors.blue100,
        iconBackground: theme.colors.chonk.blue400,
        border: theme.tokens.border.accent,
      };
    case 'danger':
      return {
        background: theme.colors.red100,
        iconBackground: theme.colors.chonk.red400,
        border: theme.tokens.border.danger,
      };
    case 'warning':
      return {
        background: theme.colors.yellow100,
        iconBackground: theme.colors.chonk.yellow400,
        border: theme.tokens.border.warning,
      };
    case 'success':
      return {
        background: theme.colors.green100,
        iconBackground: theme.colors.chonk.green400,
        border: theme.tokens.border.success,
      };
    case 'subtle':
      return {
        background: theme.colors.surface500,
        iconBackground: theme.colors.surface500,
        border: theme.tokens.border.primary,
      };
    default:
      unreachable(type);
  }

  throw new TypeError(`Invalid alert type, got ${type}`);
}

function generateAlertBackground(
  props: ChonkAlertProps,
  tokens: ReturnType<typeof getChonkAlertTokens>,
  theme: Theme
) {
  const width = 44;
  if (props.showIcon) {
    return css`
      background-image:
        linear-gradient(
          to right,
          ${tokens.iconBackground},
          ${tokens.iconBackground} ${width - 1}px,
          ${tokens.iconBackground} ${width - 1}px,
          ${tokens.border} ${width - 1}px,
          ${tokens.border} ${width}px,
          ${tokens.background} ${width}px,
          ${tokens.background} ${width + 1}px
        ),
        linear-gradient(${theme.tokens.background.primary});
      padding-left: calc(${width}px + ${theme.space.lg});
    `;
  }
  return css`
    background-image:
      linear-gradient(${tokens.background}),
      linear-gradient(${theme.tokens.background.primary});
  `;
}

export const TrailingItems = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: max-content;
  grid-template-rows: 100%;
  gap: ${p => p.theme.space.md};
  font-size: ${p => p.theme.font.size.md};
  grid-row: 2;
  grid-column: 1 / -1;
  justify-items: start;
  min-height: 28px;
  padding-block: ${p => p.theme.space['2xs']};

  > svg {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    align-self: center;
  }

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    grid-area: auto;
    align-items: start;
  }
`;

export const Message = styled('div')`
  line-height: ${p => p.theme.font.lineHeight.comfortable};
  place-content: center;
  padding-block: ${p => p.theme.space.xs};
`;

export const IconWrapper = styled('div')<{type: AlertProps['type']}>`
  position: absolute;
  top: ${p => p.theme.space.lg};
  left: ${p => p.theme.space.lg};
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${p =>
    ['info', 'error'].includes(p.type)
      ? p.theme.colors.white
      : p.type === 'subtle'
        ? p.theme.tokens.content.primary
        : p.theme.colors.black};
`;

export const ExpandIconWrap = styled('div')`
  display: flex;
  align-items: center;
  align-self: flex-start;
`;

export const ExpandContainer = styled('div')<{
  showIcon: boolean;
  showTrailingItems: boolean;
}>`
  color: ${p => p.theme.tokens.content.muted};
  grid-row: ${p => (p.showTrailingItems ? 3 : 2)};

  grid-column: 1 / -1;
  align-self: flex-start;
  cursor: auto;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    grid-row: 2;
  }
`;
