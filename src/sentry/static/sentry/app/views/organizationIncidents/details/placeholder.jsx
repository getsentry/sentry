import styled from 'react-emotion';

import space from 'app/styles/space';

const Placeholder = styled('div')`
  background-color: ${p => p.theme.placeholderBackground};
  padding: ${space(4)};
  margin-bottom: ${space(1)};
`;

export default Placeholder;
