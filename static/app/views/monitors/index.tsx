import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import withPageFilters from 'sentry/utils/withPageFilters';

const Body = styled('div')`
  background-color: ${p => p.theme.background};
  flex-direction: column;
  flex: 1;
`;

const MonitorsContainer: React.FC = ({children}) => {
  return (
    <Feature features={['monitors']} renderDisabled>
      <PageFiltersContainer>
        <Body>{children}</Body>
      </PageFiltersContainer>
    </Feature>
  );
};

export default withPageFilters(MonitorsContainer);
