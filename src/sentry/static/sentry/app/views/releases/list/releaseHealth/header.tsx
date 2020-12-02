import styled from '@emotion/styled';

import {PanelHeader} from 'app/components/panels';

const Header = styled(PanelHeader)`
  border-top-left-radius: 0;
  color: ${p => p.theme.gray400};
  font-size: ${p => p.theme.fontSizeSmall};
`;

export default Header;
