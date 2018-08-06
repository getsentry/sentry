import styled from 'react-emotion';

import space from 'app/styles/space';

const Crumb = styled('div')`
  display: flex;
  align-items: center;
  position: relative;
  font-size: 18px;
  color: ${p => p.theme.gray3};
  padding-right: ${space(1)};
  padding-bottom: ${space(0.5)};
  cursor: pointer;
  > span {
    transition: 0.1s all ease;
  }

  &:hover {
    color: ${p => p.theme.gray5};
  }
`;

export default Crumb;
