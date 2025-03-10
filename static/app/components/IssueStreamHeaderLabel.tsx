import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

const IssueStreamHeaderLabel = styled('div')<{
  breakpoint?: string;
  hideDivider?: boolean;
}>`
  position: relative;
  display: inline-block;
  margin-right: ${space(2)};
  justify-content: space-between;
  font-size: 13px;
  font-weight: ${p => p.theme.fontWeightBold};
  color: ${p => p.theme.subText};

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

        background-color: ${p.theme.gray200};
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
