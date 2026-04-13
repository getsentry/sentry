import {css} from '@emotion/react';
import styled from '@emotion/styled';

export const IssueStreamHeaderLabel = styled('div')<{
  align?: 'left' | 'right';
  breakpoint?: string;
  hideDivider?: boolean;
}>`
  position: relative;
  display: inline-block;
  margin-right: ${p => p.theme.space.xl};
  font-size: 13px;
  font-weight: ${p => p.theme.font.weight.sans.medium};
  color: ${p => p.theme.tokens.content.secondary};
  white-space: nowrap;

  ${p =>
    p.align === 'right'
      ? css`
          padding-right: ${p.theme.space.xl};
          text-align: right;
        `
      : css`
          text-align: left;
        `}

  ${p =>
    !p.hideDivider &&
    css`
      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: -${p.theme.space.xl};
        width: 1px;
        height: 100%;

        background-color: ${p.theme.colors.gray200};
      }
    `}

  ${p =>
    p.breakpoint &&
    css`
      @container (width < ${p.breakpoint}) {
        display: none;
      }
    `}
`;
