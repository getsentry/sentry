import styled from '@emotion/styled';

import {IconChevron} from 'sentry/icons';

type Props = {
  isHover?: boolean;
  isLast?: boolean;
};

function Divider({isHover, isLast}: Props) {
  return isLast ? null : (
    <StyledDivider>
      <StyledIconChevron direction={isHover ? 'down' : 'right'} legacySize="14px" />
    </StyledDivider>
  );
}

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
