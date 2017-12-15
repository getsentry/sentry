import styled from 'react-emotion';
import {Box} from 'grid-emotion';

const formFieldControl = styled(Box)`
  color: ${p => p.theme.gray3};
  width: 50%;
  padding-left: 10px;
  position: relative;
`;

export default formFieldControl;
