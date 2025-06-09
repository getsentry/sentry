import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';

export function InsightsProjectSelector() {
  const {view} = useDomainViewFilters();
  return <ProjectPageFilter storageNamespace={view} />;
}
