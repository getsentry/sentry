import styled from 'react-emotion';
import {Flex} from 'grid-emotion';

const Header = styled(Flex)`
  border-bottom: 1px solid ${p => p.theme.borderDark};
  box-shadow: ${p => p.theme.dropShadowLight};
  font-size: ${p => p.theme.fontSizeExtraLarge};
  height: 60px;
`;

export default Header;
