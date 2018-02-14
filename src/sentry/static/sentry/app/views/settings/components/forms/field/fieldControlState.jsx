import styled from 'react-emotion';
import {Flex} from 'grid-emotion';

const width = '36px';
const FieldControlState = styled(Flex)`
  position: relative;
  width: ${width};
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
`;

export default FieldControlState;
