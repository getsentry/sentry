import * as React from 'react';
import styled from '@emotion/styled';

import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageContent} from 'sentry/styles/organization';
import withPageFilters from 'sentry/utils/withPageFilters';

const Body = styled('div')`
  background-color: ${p => p.theme.backgroundSecondary};
  flex-direction: column;
  flex: 1;
`;

// TODO: feature check on 'replays'
const ReplaysContainer: React.FC = ({children}) => (
  <PageFiltersContainer
    showEnvironmentSelector={false}
    showDateSelector={false}
    resetParamsOnChange={['cursor']}
  >
    <PageContent>
      <Body>{children}</Body>
    </PageContent>
  </PageFiltersContainer>
);

export default withPageFilters(ReplaysContainer);
