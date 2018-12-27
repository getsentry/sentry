import styled from 'react-emotion';
import {Flex} from 'grid-emotion';

import space from 'app/styles/space';

const Header = styled(Flex)`
  align-items: center;
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin-bottom: ${space(2)};
`;

export default Header;
