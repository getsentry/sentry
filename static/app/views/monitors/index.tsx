import Feature from 'sentry/components/acl/feature';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import useOrganization from 'sentry/utils/useOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';

const MonitorsContainer: React.FC = ({children}) => {
  const organization = useOrganization();

  return (
    <Feature features={['monitors']} renderDisabled>
      <NoProjectMessage organization={organization}>
        <PageFiltersContainer>{children}</PageFiltersContainer>
      </NoProjectMessage>
    </Feature>
  );
};

export default withPageFilters(MonitorsContainer);
