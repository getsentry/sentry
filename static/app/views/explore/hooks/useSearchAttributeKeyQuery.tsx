import {useOrganization} from 'sentry/utils/useOrganization';
import type {EventValidationData} from 'sentry/views/explore/utils/validateEventParamsOptions';

interface SearchQueryValidation {
  data: EventValidationData | undefined;
  isPlaceholderData: boolean;
}

export function useSearchAttributeKeyQuery(
  query: string,
  validation: SearchQueryValidation
): string | undefined {
  const organization = useOrganization();

  if (!organization.features.includes('explore-search-attribute-intersection')) {
    return undefined;
  }

  // Attributes endpoint rejects invalid queries, so only scope once the
  // current query is confirmed valid
  if (validation.isPlaceholderData || validation.data?.query.valid !== true) {
    return undefined;
  }

  return query || undefined;
}
