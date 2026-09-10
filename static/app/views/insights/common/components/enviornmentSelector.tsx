import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';

export function InsightsEnvironmentSelector() {
  const {view} = useDomainViewFilters();

  return <EnvironmentPageFilter storageNamespace={view} />;
}
