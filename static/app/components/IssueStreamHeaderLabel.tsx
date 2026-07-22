/* eslint-disable unicorn/filename-case */
import {css, useTheme} from '@emotion/react';

import {Container, type ContainerProps} from '@sentry/scraps/layout';

type Props = ContainerProps & {
  align?: 'left' | 'right';
  hideDivider?: boolean;
};

export function IssueStreamHeaderLabel({align, hideDivider, style, ...props}: Props) {
  const theme = useTheme();

  return (
    <Container
      {...props}
      style={{
        position: 'relative',
        display: props.display === undefined ? 'inline-block' : undefined,
        marginRight: theme.space.xl,
        fontSize: '13px',
        fontWeight: theme.font.weight.sans.medium,
        color: theme.tokens.content.secondary,
        whiteSpace: 'nowrap',
        paddingRight: align === 'right' ? theme.space.xl : undefined,
        textAlign: align === 'right' ? 'right' : 'left',
        ...style,
      }}
      css={
        !hideDivider &&
        css`
          &::before {
            content: '';
            position: absolute;
            top: 0;
            left: -${theme.space.xl};
            width: 1px;
            height: 100%;

            background-color: ${theme.colors.gray200};
          }
        `
      }
    />
  );
}
