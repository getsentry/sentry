/* eslint-disable unicorn/filename-case */
import {css, useTheme} from '@emotion/react';

import {Container, type ContainerProps} from '@sentry/scraps/layout';

type Props = ContainerProps & {
  align?: 'left' | 'right';
  hideDivider?: boolean;
};

export function IssueStreamHeaderLabel({align, hideDivider, ...props}: Props) {
  const theme = useTheme();

  return (
    <Container
      {...props}
      display={props.display ?? 'inline-block'}
      position="relative"
      marginRight="xl"
      whiteSpace="nowrap"
      paddingRight={align === 'right' ? 'xl' : undefined}
      css={css`
        font-size: 13px;
        font-weight: ${theme.font.weight.sans.medium};
        color: ${theme.tokens.content.secondary};
        text-align: ${align === 'right' ? 'right' : 'left'};

        ${!hideDivider &&
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
        `}
      `}
    />
  );
}
