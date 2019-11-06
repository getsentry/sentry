import styled from 'react-emotion';

import space from 'app/styles/space';

const HeaderSeparator = styled('div')`
  width: 1px;
  background-color: ${p => p.theme.borderLight};
  margin: ${space(2)} 0;
`;

export default HeaderSeparator;
