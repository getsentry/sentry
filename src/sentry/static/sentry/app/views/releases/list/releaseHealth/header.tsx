import styled from '@emotion/styled';

import {PanelHeader} from 'app/components/panels';

const Header = styled(PanelHeader)`
  border-top: 1px solid ${p => p.theme.border};
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeSmall};
`;

export default Header;
