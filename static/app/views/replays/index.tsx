import * as React from 'react';
import styled from '@emotion/styled';

import withPageFilters from 'sentry/utils/withPageFilters';

const Body = styled('div')`
  background-color: ${p => p.theme.backgroundSecondary};
  flex-direction: column;
  flex: 1;
`;

// TODO: feature check on 'replays'
const ReplaysContainer: React.FC = ({children}) => <Body>{children}</Body>;

export default withPageFilters(ReplaysContainer);
