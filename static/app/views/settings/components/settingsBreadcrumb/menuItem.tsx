import styled from '@emotion/styled';

import overflowEllipsis from 'sentry/styles/overflowEllipsis';

const MenuItem = styled('div')`
  font-size: 14px;
  ${overflowEllipsis};
`;

export default MenuItem;
