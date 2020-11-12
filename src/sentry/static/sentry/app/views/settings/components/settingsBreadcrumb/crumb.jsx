import styled from '@emotion/styled';

import space from 'app/styles/space';

const Crumb = styled('div')`
  display: flex;
  align-items: center;
  position: relative;
  font-size: 18px;
  color: ${p => p.theme.subText};
  padding-right: ${space(1)};
  cursor: pointer;
  white-space: nowrap;

  > span {
    transition: 0.1s all ease;
  }

  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

export default Crumb;
