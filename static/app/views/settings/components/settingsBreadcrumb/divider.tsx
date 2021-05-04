import styled from '@emotion/styled';

import {IconChevron} from 'app/icons';

type Props = {
  isHover?: boolean;
  isLast?: boolean;
};

const Divider = ({isHover, isLast}: Props) =>
  isLast ? null : (
    <StyledDivider>
      <StyledIconChevron direction={isHover ? 'down' : 'right'} size="14px" />
    </StyledDivider>
  );

const StyledIconChevron = styled(IconChevron)`
  display: block;
`;

const StyledDivider = styled('span')`
  display: inline-block;
  margin-left: 6px;
  color: ${p => p.theme.gray200};
  position: relative;
`;

export default Divider;
