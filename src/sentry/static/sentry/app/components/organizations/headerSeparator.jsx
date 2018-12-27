import styled from 'react-emotion';
import {Box} from 'grid-emotion';

const HeaderSeparator = styled(Box)`
  width: 1px;
  background-color: ${p => p.theme.borderLight};
  margin: 4px 16px;
`;

export default HeaderSeparator;
