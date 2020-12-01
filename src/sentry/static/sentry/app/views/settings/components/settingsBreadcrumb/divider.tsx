import React from 'react';
import styled from '@emotion/styled';

import {IconChevron} from 'app/icons';

type Props = {
  isHover?: boolean;
  isLast?: boolean;
};

const Divider = ({isHover, isLast}: Props) =>
  isLast ? null : (
    <StyledDivider isHover={isHover}>
      <StyledIconChevron direction="right" size="14px" />
    </StyledDivider>
  );

const StyledIconChevron = styled(IconChevron)`
  display: block;
`;

const StyledDivider = styled('span')<{isHover?: boolean}>`
  display: inline-block;
  margin-left: 6px;
  color: ${p => p.theme.gray200};
  position: relative;
  top: -1px;

  ${p =>
    p.isHover &&
    `
    transform: rotate(90deg);
    top: 0;
    `};
`;

export default Divider;
