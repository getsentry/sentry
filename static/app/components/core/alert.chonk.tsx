import {css, type SerializedStyles} from '@emotion/react';

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
  ${p => makeChonkAlertTheme(p.type, p.theme)}

  border-width: ${p => (p.system ? '0px 0px 2px 0px' : '2px')};
  border-radius: ${p => (p.system ? '0px' : p.theme.borderRadius)};

  cursor: ${p => (p.expand ? 'pointer' : 'default')};

  display: grid;
  grid-template-columns:
    ${p => (p.showIcon ? `minmax(0, max-content)` : '0fr')}
    minmax(0, 1fr)
    ${p => (p.trailingItems ? `max-content` : '0fr')}
    ${p => (p.expand ? `max-content` : '0fr')};

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

export {AlertPanel, chonkAlertPropMapping};
