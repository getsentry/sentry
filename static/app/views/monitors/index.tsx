import * as React from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageContent} from 'sentry/styles/organization';
import useOrganization from 'sentry/utils/useOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';

const Body = styled('div')`
  background-color: ${p => p.theme.backgroundSecondary};
  flex-direction: column;
  flex: 1;
`;

const MonitorsContainer: React.FC = ({children}) => {
  const organization = useOrganization();

  return (
    <Feature features={['monitors']} renderDisabled>
      <PageFiltersContainer
        showEnvironmentSelector={false}
        showDateSelector={false}
        resetParamsOnChange={['cursor']}
        hideGlobalHeader={organization.features.includes('selection-filters-v2')}
      >
        <PageContent>
          <Body>{children}</Body>
        </PageContent>
      </PageFiltersContainer>
    </Feature>
  );
};

export default withPageFilters(MonitorsContainer);
