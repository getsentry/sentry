import styled from '@emotion/styled';

import {IconArrow} from 'sentry/icons';

export function SortableHeader({title, direction, onClick}) {
  const arrow = !direction ? null : (
    <StyledIconArrow size="xs" direction={direction === 'desc' ? 'down' : 'up'} />
  );
  return (
    <HeaderWrapper onClick={onClick}>
      {title} {arrow}
    </HeaderWrapper>
  );
}

const HeaderWrapper = styled('div')`
  cursor: pointer;
`;

const StyledIconArrow = styled(IconArrow)`
  vertical-align: top;
`;
