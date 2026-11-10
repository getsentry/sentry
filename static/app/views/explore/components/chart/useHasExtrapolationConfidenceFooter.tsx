import {useOrganization} from 'sentry/utils/useOrganization';

export function useHasExtrapolationConfidenceFooter() {
  const organization = useOrganization();
  return organization.features.includes('data-browsing-time-series-confidence');
}
