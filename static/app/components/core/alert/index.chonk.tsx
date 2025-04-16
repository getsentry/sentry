import type React from 'react';

import type {AlertProps} from 'sentry/components/core/alert';
import {IconCheckmark, IconInfo, IconNot, IconWarning} from 'sentry/icons';
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
}

export const AlertPanel = chonkStyled('div')<ChonkAlertProps>`
  ${p => ({...makeChonkAlertTheme(p.type, p.theme)})};

  display: grid;
  grid-template-columns: ${p => getAlertGridLayout(p)};

  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  border-width: ${p => (p.system ? '0px 0px 1px 0px' : '1px')};
  border-radius: ${p => (p.system ? '0px' : p.theme.borderRadius)};

  cursor: ${p => (p.expand ? 'pointer' : 'inherit')};
  gap: ${p => p.theme.space.md};


  a,
  button,
  code {
    color: inherit;
  }

  a:hover,
  button:hover,
  code:hover {
    color: inherit;
  }

  a {
    text-decoration: underline;
  }
`;

function makeChonkAlertTheme(
  type: ChonkAlertProps['type'],
  theme: ReturnType<typeof useChonkTheme>
): React.CSSProperties {
  switch (type) {
    case 'info':
      return {
        color: theme.colors.white,
        background: theme.colors.blue100,
        border: `1px solid ${theme.tokens.border.accent}`,
      };
    case 'danger':
      return {
        color: theme.colors.white,
        background: theme.colors.red100,
        border: `1px solid ${theme.tokens.border.danger}`,
      };
    case 'warning':
      return {
        color: theme.colors.white,
        background: theme.colors.yellow100,
        border: `1px solid ${theme.tokens.border.warning}`,
      };
    case 'success':
      return {
        color: theme.colors.white,
        background: theme.colors.green100,
        border: `1px solid ${theme.tokens.border.success}`,
      };
    case 'subtle':
      return {
        color: theme.textColor,
        background: theme.colors.surface500,
        border: `1px solid ${theme.tokens.border.muted}`,
      };
    default:
      unreachable(type);
  }

  throw new TypeError(`Invalid alert type, got ${type}`);
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

export const IconWrapper = chonkStyled('div')<ChonkAlertProps>`
  display: flex;
  align-items: center;
  background: ${p =>
    p.type === 'success'
      ? p.theme.colors.chonk.green400
      : p.type === 'warning'
        ? p.theme.colors.chonk.yellow400
        : p.type === 'danger'
          ? p.theme.colors.chonk.red400
          : p.type === 'info'
            ? p.theme.colors.chonk.blue400
            : p.theme.colors.background};
`;

export function AlertIcon(props: {type: AlertProps['type']}) {
  switch (props.type) {
    case 'warning':
      return <IconWarning />;
    case 'success':
      return <IconCheckmark />;
    case 'error':
      return <IconNot />;
    case 'info':
    case 'muted':
      return <IconInfo />;
    default:
      unreachable(props.type);
  }

  return null;
}

function getAlertGridLayout(p: ChonkAlertProps) {
  if (p.showIcon) {
    return `min-content 1fr ${p.trailingItems ? 'min-content' : ''} ${
      p.expand ? 'min-content' : ''
    };`;
  }

  return `1fr ${p.trailingItems ? 'min-content' : ''} ${p.expand ? 'min-content' : ''};`;
}
