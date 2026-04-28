import {
  EnvironmentPageFilter,
  type EnvironmentPageFilterProps,
} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';

type Props = Omit<EnvironmentPageFilterProps, 'storageNamespace'>;

export function InsightsEnvironmentSelector(props: Props) {
  const {view} = useDomainViewFilters();

  const storageNamespace = view;

  return <EnvironmentPageFilter {...props} storageNamespace={storageNamespace} />;
}
