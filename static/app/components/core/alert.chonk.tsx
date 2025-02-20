import {css, type DO_NOT_USE_ChonkTheme} from '@emotion/react';
import styled from '@emotion/styled';

import type {AlertProps} from 'sentry/components/alert';
import type {ChonkPropMapping} from 'sentry/utils/theme/withChonk';

const chonkAlertPropMapping: ChonkPropMapping<AlertProps, ChonkAlertProps> = props => {
  return {
    ...props,
    type:
      props.type === 'muted' ? 'subtle' : props.type === 'error' ? 'danger' : props.type,
  };
};

interface ChonkAlertProps extends Omit<AlertProps, 'type'> {
  theme: DO_NOT_USE_ChonkTheme;
  type: 'subtle' | 'info' | 'warning' | 'success' | 'danger';
  size?: 'sm';
}

function AlertPanel({type, theme, size, ...props}: ChonkAlertProps) {
  const colors = useChonkAlertTheme(type, theme);
  const padding = useChonkAlertPadding(size, theme);

  return (
    <AlertPanelDiv
      {...props}
      css={css`
        background-color: ${colors.background};
        color: ${colors.color};
        border: ${colors.border};
        border-width: ${props.system ? '0px 0px 2px 0px' : '2px'};
        border-radius: ${props.system ? '0px' : theme.borderRadius};
        padding: ${padding};

        cursor: ${props.expand ? 'pointer' : 'default'};

        display: grid;
        grid-template-columns:
          ${!!props.showIcon && `minmax(0, max-content)`}
          minmax(0, 1fr)
          ${!!props.trailingItems && `max-content`}
          ${!!props.expand && `max-content`};

        gap: ${theme.space.md};

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
      `}
    >
      {props.children}
    </AlertPanelDiv>
  );
}

const AlertPanelDiv = styled('div')<Omit<ChonkAlertProps, 'type' | 'theme'>>``;

function useChonkAlertPadding(
  size: ChonkAlertProps['size'],
  theme: DO_NOT_USE_ChonkTheme
) {
  switch (size) {
    case 'sm':
      return `${theme.space.mini} ${theme.space.md}`;
    default:
      return `${theme.space.md} ${theme.space.lg}`;
  }
}

function useChonkAlertTheme(type: ChonkAlertProps['type'], theme: DO_NOT_USE_ChonkTheme) {
  switch (type) {
    case 'info':
      return {
        color: theme.colors.static.white,
        background: theme.colors.static.blurple400,
        border: `2px solid ${theme.colors.static.blurple400}`,
      };
    case 'success':
      return {
        color: theme.colors.static.black,
        background: theme.colors.static.green400,
        border: `2px solid ${theme.colors.dynamic.green100}`,
      };
    case 'warning':
      return {
        color: theme.colors.static.black,
        background: theme.colors.static.gold400,
        border: `2px solid ${theme.colors.dynamic.gold100}`,
      };
    case 'danger':
      return {
        color: theme.colors.static.white,
        background: theme.colors.static.red400,
        border: `2px solid ${theme.colors.dynamic.red100}`,
      };
    case 'subtle':
      return {
        color: theme.textColor,
        background: theme.colors.dynamic.surface400,
        border: `2px solid ${theme.colors.dynamic.surface100}`,
      };

    default:
      unreachable(type);
  }

  throw new TypeError(`Invalid alert type, got ${type}`);
}

function unreachable(x: never) {
  return x;
}

export {AlertPanel, chonkAlertPropMapping};
