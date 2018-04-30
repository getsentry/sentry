import styled from 'react-emotion';

import overflowEllipsis from 'app/styles/overflowEllipsis';

const SlugOverflow = styled('span')`
  max-width: ${p => p.theme.maxSlugWidth};
  ${overflowEllipsis};
`;

export default SlugOverflow;
