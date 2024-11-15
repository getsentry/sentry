import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

const IssueStreamHeaderLabel = styled('div')<{breakpoint?: string}>`
  position: relative;
  display: inline-block;
  margin-right: ${space(2)};
  justify-content: space-between;
  font-size: 13px;
  font-weight: ${p => p.theme.fontWeightBold};
  color: ${p => p.theme.subText};

  ${p =>
    p.breakpoint &&
    css`
      @media (max-width: ${p.breakpoint}) {
        display: none;
      }
    `}
`;

export default IssueStreamHeaderLabel;
