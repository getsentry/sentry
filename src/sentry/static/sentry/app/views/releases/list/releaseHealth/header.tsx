import styled from '@emotion/styled';

import {PanelHeader} from 'app/components/panels';
import space from 'app/styles/space';

const Header = styled(PanelHeader)`
  border-top-left-radius: 0;
  padding: ${space(1.5)} ${space(2)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

export default Header;
