import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import withPageFilters from 'sentry/utils/withPageFilters';

const MonitorsContainer: React.FC = ({children}) => {
  return <PageFiltersContainer>{children}</PageFiltersContainer>;
};

export default withPageFilters(MonitorsContainer);
