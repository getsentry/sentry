import styled from '@emotion/styled';

import space from 'app/styles/space';

const HeaderSeparator = styled('div')`
  width: 1px;
  background-color: ${p => p.theme.gray300};
  margin: ${space(2)} 0;
`;

export default HeaderSeparator;
