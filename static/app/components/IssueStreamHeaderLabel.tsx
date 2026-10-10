import {css, cx} from '@linaria/core';

import {Container, type ContainerProps} from '@sentry/scraps/layout';
import {theme} from '@sentry/scraps/theme';

type Props = ContainerProps & {
  align?: 'left' | 'right';
  hideDivider?: boolean;
};

export function IssueStreamHeaderLabel({align, hideDivider, ...props}: Props) {
  return (
    <Container
      {...props}
      display={props.display ?? 'inline-block'}
      position="relative"
      marginRight="xl"
      whiteSpace="nowrap"
      paddingRight={align === 'right' ? 'xl' : undefined}
      customCss={cx(
        css`
          font-size: 13px;
          font-weight: ${theme.font.weight.sans.medium};
          color: ${theme.tokens.content.secondary};
          text-align: left;
        `,
        align === 'right' &&
          css`
            text-align: right;
          `,
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
      )}
    />
  );
}
