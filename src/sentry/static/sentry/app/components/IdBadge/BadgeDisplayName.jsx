import React from 'react';
import styled from 'react-emotion';

import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

const BadgeDisplayName = styled(({hideOverflow, ...props}) => <span {...props} />)`
  ${p => p.hideOverflow && overflowEllipsis};
  ${p =>
    p.hideOverflow &&
    `max-width: ${typeof p.hideOverflow === 'string'
      ? p.hideOverflow
      : p.theme.settings.maxCrumbWidth}`};
  padding: ${space(0.25)} 0;
`;

export default BadgeDisplayName;
