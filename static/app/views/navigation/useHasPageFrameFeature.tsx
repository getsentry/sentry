import {useOrganization} from 'sentry/utils/useOrganization';

export function useHasPageFrameFeature() {
  const organization = useOrganization({allowNull: true});
  return organization?.features.includes('page-frame') ?? false;
}
