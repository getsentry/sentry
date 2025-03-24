import type React from 'react';

import type {AlertProps} from 'sentry/components/core/alert';
import {chonkStyled, type useChonkTheme} from 'sentry/utils/theme/theme.chonk';
import type {ChonkPropMapping} from 'sentry/utils/theme/withChonk';
import {unreachable} from 'sentry/utils/unreachable';

const chonkAlertPropMapping: ChonkPropMapping<AlertProps, ChonkAlertProps> = props => {
  return {
    ...props,
    type:
      props.type === 'muted' ? 'subtle' : props.type === 'error' ? 'danger' : props.type,
  };
};

interface ChonkAlertProps extends Omit<AlertProps, 'type'> {
  type: 'subtle' | 'info' | 'warning' | 'success' | 'danger';
}

const AlertPanel = chonkStyled('div')<ChonkAlertProps>`
  ${p => ({...makeChonkAlertTheme(p.type, p.theme)})};

  display: grid;
  grid-template-columns: ${p => getAlertGridLayout(p)};

  border-width: ${p => (p.system ? '0px 0px 2px 0px' : '2px')};
  border-radius: ${p => (p.system ? '0px' : p.theme.borderRadius)};

  cursor: ${p => (p.expand ? 'pointer' : 'inherit')};
  gap: ${p => p.theme.space.md};

  a,
  button {
    color: inherit;
  }

  a:hover,
  button:hover {
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
        background: theme.colors.chonk.blue400,
        border: `1px solid ${theme.colors.chonk.blue100}`,
        padding: `${theme.space.md} ${theme.space.lg}`,
      };
    case 'danger':
      return {
        color: theme.colors.white,
        background: theme.colors.chonk.red400,
        border: `1px solid ${theme.colors.chonk.red100}`,
        padding: `${theme.space.md} ${theme.space.lg}`,
      };
    case 'warning':
      return {
        color: theme.colors.black,
        background: theme.colors.chonk.yellow400,
        border: `1px solid ${theme.colors.chonk.yellow100}`,
        padding: `${theme.space.md} ${theme.space.lg}`,
      };
    case 'success':
      return {
        color: theme.colors.black,
        background: theme.colors.chonk.green400,
        border: `1px solid ${theme.colors.chonk.green100}`,
        padding: `${theme.space.md} ${theme.space.lg}`,
      };
    case 'subtle':
      return {
        color: theme.textColor,
        background: theme.colors.surface500,
        border: `1px solid ${theme.colors.surface100}`,
        padding: `${theme.space.md} ${theme.space.lg}`,
      };
    default:
      unreachable(type);
  }

  throw new TypeError(`Invalid alert type, got ${type}`);
}

function getAlertGridLayout(p: ChonkAlertProps) {
  if (p.showIcon) {
    return `min-content 1fr ${p.trailingItems ? 'min-content' : ''} ${
      p.expand ? 'min-content' : ''
    };`;
  }

  return `1fr ${p.trailingItems ? 'min-content' : ''} ${p.expand ? 'min-content' : ''};`;
}

export {AlertPanel, chonkAlertPropMapping};
