import Feature from 'sentry/components/acl/feature';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import useOrganization from 'sentry/utils/useOrganization';

function MonitorsContainer({children}: {children?: React.ReactNode}) {
  const organization = useOrganization();

  return (
    <Feature features="monitors" renderDisabled>
      <NoProjectMessage organization={organization}>
        <PageFiltersContainer>{children}</PageFiltersContainer>
      </NoProjectMessage>
    </Feature>
  );
}

export default MonitorsContainer;
