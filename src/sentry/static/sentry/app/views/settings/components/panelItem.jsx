import styled from 'react-emotion';
import {Flex} from 'grid-emotion';

export default styled(Flex)`
  border-bottom: 1px solid ${p => p.theme.borderLight};
  &:last-child {
    border: 0;
  }
`;
