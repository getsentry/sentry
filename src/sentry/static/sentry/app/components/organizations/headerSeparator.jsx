import {Box} from 'grid-emotion';
import styled from 'react-emotion';

import space from 'app/styles/space';

const HeaderSeparator = styled(Box)`
  width: 1px;
  background-color: ${p => p.theme.borderLight};
  margin: ${space(1.5)} 0;
`;

export default HeaderSeparator;
