import styled from '@emotion/styled';

import space from 'app/styles/space';

const Surface = styled('div')`
  background: ${p => p.theme.bodyBackground};
  border-radius: ${p => p.theme.borderRadius};
  border: solid 1px ${p => p.theme.gray100};
  padding: ${space(1)} ${space(2)};
  margin: ${space(2)} 0;
`;

export default Surface;
