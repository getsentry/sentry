import type {ProjectPageFilterProps} from 'sentry/components/organizations/projectPageFilter';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';

type Props = Omit<ProjectPageFilterProps, 'storageNamespace'>;

export function InsightsProjectSelector(props: Props) {
  const {view} = useDomainViewFilters();

  const storageNamespace = view;

  return <ProjectPageFilter {...props} storageNamespace={storageNamespace} />;
}
