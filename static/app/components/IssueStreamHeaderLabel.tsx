import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

const IssueStreamHeaderLabel = styled('div')<{
  align?: 'left' | 'right';
  breakpoint?: string;
  hideDivider?: boolean;
}>`
  position: relative;
  display: inline-block;
  margin-right: ${space(2)};
  font-size: 13px;
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.tokens.content.secondary};
  white-space: nowrap;

  ${p =>
    p.align === 'right'
      ? css`
          padding-right: ${space(2)};
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
        left: -${space(2)};
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

export default IssueStreamHeaderLabel;
