import {css, type SerializedStyles} from '@emotion/react';

import type {AlertProps} from 'sentry/components/core/alert/alert';
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
  ${p => makeChonkAlertTheme(p.type, p.theme)}
  display: grid;
  grid-template-columns: ${p => getAlertGridLayout(p)};

  border-width: ${p => (p.system ? '0px 0px 2px 0px' : '2px')};
  border-radius: ${p => (p.system ? '0px' : p.theme.borderRadius)};

  cursor: ${p => (p.expand ? 'pointer' : 'default')};
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
): SerializedStyles {
  switch (type) {
    case 'info':
      return css`
        color: ${theme.colors.static.white};
        background: ${theme.colors.static.blue400};
        border: 2px solid ${theme.colors.static.blue400};
        padding: ${theme.space.md} ${theme.space.lg};
      `;
    case 'success':
      return css`
        color: ${theme.colors.static.black};
        background: ${theme.colors.static.green400};
        border: 2px solid ${theme.colors.dynamic.green100};
        padding: ${theme.space.md} ${theme.space.lg};
      `;
    case 'warning':
      return css`
        color: ${theme.colors.static.black};
        background: ${theme.colors.static.yellow400};
        border: 2px solid ${theme.colors.dynamic.yellow100};
        padding: ${theme.space.md} ${theme.space.lg};
      `;
    case 'danger':
      return css`
        color: ${theme.colors.static.white};
        background: ${theme.colors.static.red400};
        border: 2px solid ${theme.colors.dynamic.red100};
        padding: ${theme.space.md} ${theme.space.lg};
      `;
    case 'subtle':
      return css`
        color: ${theme.textColor};
        background: ${theme.colors.dynamic.surface400};
        border: 2px solid ${theme.colors.dynamic.surface100};
        padding: ${theme.space.md} ${theme.space.lg};
      `;

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
