import type {SerializedStyles} from '@emotion/react';
import {css} from '@emotion/react';

import type {AlertProps} from 'sentry/components/core/alert';
import {chonkStyled, type useChonkTheme} from 'sentry/utils/theme/theme.chonk';
import type {ChonkPropMapping} from 'sentry/utils/theme/withChonk';
import {unreachable} from 'sentry/utils/unreachable';

export const chonkAlertPropMapping: ChonkPropMapping<
  AlertProps,
  ChonkAlertProps
> = props => {
  return {
    ...props,
    type:
      props.type === 'muted' ? 'subtle' : props.type === 'error' ? 'danger' : props.type,
  };
};

interface ChonkAlertProps extends Omit<AlertProps, 'type'> {
  type: 'subtle' | 'info' | 'warning' | 'success' | 'danger';
  theme?: ReturnType<typeof useChonkTheme>;
}

export const AlertPanel = chonkStyled('div')<ChonkAlertProps>`
  ${props => makeChonkAlertTheme(props)};

  position: relative;
  display: grid;
  grid-template-columns: ${p => getAlertGridLayout(p)};
  padding: ${p => p.theme.space.lg};
  border-width: ${p => (p.system ? '0px 0px 1px 0px' : '1px')};
  border-radius: ${p => (p.system ? '0px' : p.theme.borderRadius)};

  cursor: ${p => (p.expand ? 'pointer' : 'inherit')};
  gap: ${p => p.theme.space.lg};
  row-gap: 0;
  overflow: hidden;

  a {
    text-decoration: underline;
  }
`;

function makeChonkAlertTheme(props: ChonkAlertProps): SerializedStyles {
  const tokens = getChonkAlertTokens(props.type, props.theme!);
  return css`
    ${generateAlertBackground(props, tokens)};
    border: 1px solid ${tokens.border};

    /* We dont want to override the color of any elements inside buttons */
    :not(button *) {
      color: ${props.theme!.tokens.content.primary};
    }
  `;
}

function getChonkAlertTokens(
  type: ChonkAlertProps['type'],
  theme: ReturnType<typeof useChonkTheme>
) {
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
  tokens: ReturnType<typeof getChonkAlertTokens>
) {
  const width = 44;
  if (props.showIcon) {
    return css`
      background: linear-gradient(
        to right,
        ${tokens.iconBackground},
        ${tokens.iconBackground} ${width - 1}px,
        ${tokens.iconBackground} ${width - 1}px,
        ${tokens.border} ${width - 1}px,
        ${tokens.border} ${width}px,
        ${tokens.background} ${width}px,
        ${tokens.background} ${width + 1}px
      );
    `;
  }
  return css`
    background: ${tokens.background};
  `;
}

export const TrailingItems = chonkStyled('div')<ChonkAlertProps>`
  display: grid;
  grid-auto-flow: column;
  grid-template-rows: 100%;
  gap: ${p => p.theme.space.md};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    /* In mobile, TrailingItems should wrap to a second row and be vertically aligned
    with Message. When there is a leading icon, Message is in the second grid column.
    Otherwise it's in the first grid column. */
    grid-row: 2;
    grid-column: ${p => (p.showIcon ? 2 : 1)} / -1;
    justify-items: start;
    margin: ${p => p.theme.space.md} 0;
  }
`;

export const Message = chonkStyled('div')`
  padding: 0;
  min-height: 24px;
  padding-top: ${p => p.theme.space.mini};
`;

export const IconWrapper = chonkStyled('div')<{type: AlertProps['type']}>`
  display: flex;
  align-items: center;
  justify-content: center;
  margin: calc(${p => p.theme.space.nano} * -1) calc(${p => p.theme.space.lg} * -1) 0;
  margin-right: -1px;
  max-width: 44px;
  max-height: 24px;
  color: ${p => (['info', 'error'].includes(p.type) ? p.theme.colors.white : p.type === 'muted' ? p.theme.tokens.content.primary : p.theme.colors.black)};
  z-index: 1;
`;

export const ExpandContainer = chonkStyled('div')<{
  showIcon: boolean;
  showTrailingItems: boolean;
}>`
  color: ${p => p.theme.tokens.content.muted};
  grid-row: 2;
  /* ExpandContainer should be vertically aligned with Message. When there is a leading icon,
  Message is in the second grid column. Otherwise it's in the first column. */
  grid-column: ${p => (p.showIcon ? 2 : 1)} / -1;
  cursor: auto;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-row: ${p => (p.showTrailingItems ? 3 : 2)};
  }
`;

function getAlertGridLayout(p: ChonkAlertProps) {
  if (p.showIcon) {
    return `32px 1fr ${p.trailingItems ? 'min-content' : ''} ${
      p.expand ? 'min-content' : ''
    };`;
  }

  return `1fr ${p.trailingItems ? 'min-content' : ''} ${p.expand ? 'min-content' : ''};`;
}
