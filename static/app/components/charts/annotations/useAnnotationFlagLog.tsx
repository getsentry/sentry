import {useOrganizationFlagLogInfinite} from 'sentry/components/featureFlags/hooks/useOrganizationFlagLog';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useOrganization} from 'sentry/utils/useOrganization';

export function useAnnotationFlagLog({enabled}: {enabled: boolean}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  return useOrganizationFlagLogInfinite({
    organization,
    query: {...normalizeDateTimeParams(selection.datetime), sort: 'created_at'},
    enabled,
  });
}
