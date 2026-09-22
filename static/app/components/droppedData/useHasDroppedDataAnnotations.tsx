import {useOrganization} from 'sentry/utils/useOrganization';

export function useHasDroppedDataAnnotations(): boolean {
  const organization = useOrganization();
  return organization.features.includes('explore-data-fidelity-annotations');
}
