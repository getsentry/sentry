import {Flex} from 'grid-emotion';
import styled from 'react-emotion';

const Row = styled(Flex)`
  border-bottom: 1px solid ${p => p.theme.borderLight};

  &:last-child {
    border: 0;
  }
`;

export default Row;
