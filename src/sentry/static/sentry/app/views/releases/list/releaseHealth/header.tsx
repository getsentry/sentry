import styled from '@emotion/styled';

import {PanelHeader} from 'app/components/panels';

const Header = styled(PanelHeader)`
  border-top: 1px solid ${p => p.theme.borderDark};
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  color: ${p => p.theme.gray500};
  font-size: ${p => p.theme.fontSizeSmall};
`;

export default Header;
