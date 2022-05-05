import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageContent} from 'sentry/styles/organization';
import withPageFilters from 'sentry/utils/withPageFilters';

const Body = styled('div')`
  background-color: ${p => p.theme.backgroundSecondary};
  flex-direction: column;
  flex: 1;
`;

const MonitorsContainer: React.FC = ({children}) => {
  return (
    <Feature features={['monitors']} renderDisabled>
      <PageFiltersContainer
        showEnvironmentSelector={false}
        showDateSelector={false}
        resetParamsOnChange={['cursor']}
        hideGlobalHeader
      >
        <PageContent>
          <Body>{children}</Body>
        </PageContent>
      </PageFiltersContainer>
    </Feature>
  );
};

export default withPageFilters(MonitorsContainer);
