import styled from 'react-emotion';

import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

const BadgeDisplayName = styled('span')`
  ${overflowEllipsis};
  max-width: ${p => p.theme.settings.maxCrumbWidth};
  padding: ${space(0.25)} 0;
`;

export default BadgeDisplayName;
