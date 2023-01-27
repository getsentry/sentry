import Feature from 'sentry/components/acl/feature';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import withPageFilters from 'sentry/utils/withPageFilters';

const MonitorsContainer: React.FC = ({children}) => {
  return (
    <Feature features={['monitors']} renderDisabled>
      <PageFiltersContainer>{children}</PageFiltersContainer>
    </Feature>
  );
};

export default withPageFilters(MonitorsContainer);
