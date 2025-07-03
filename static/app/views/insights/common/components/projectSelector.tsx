import type {ProjectPageFilterProps} from 'sentry/components/organizations/projectPageFilter';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {useInsightsEap} from 'sentry/views/insights/common/utils/useEap';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';

type Props = Omit<ProjectPageFilterProps, 'storageNamespace'>;

export function InsightsProjectSelector(props: Props) {
  const useEap = useInsightsEap();
  const {view} = useDomainViewFilters();

  const storageNamespace = useEap ? view : undefined;

  return <ProjectPageFilter {...props} storageNamespace={storageNamespace} />;
}
